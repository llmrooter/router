package server

import (
    "bytes"
    "encoding/json"
    "io"
    "net/http"
    "strings"
    "time"

    "github.com/labstack/echo/v4"
    "gorm.io/gorm"
)

func registerOpenAIRoutes(g *echo.Group) {
    g.GET("/models", openaiListModels)
    g.POST("/chat/completions", openaiChatCompletions)
    g.POST("/completions", openaiCompletions)
    g.POST("/embeddings", openaiEmbeddings)
}

// Auth for these endpoints uses Bearer user API key
func getUserFromAuth(c echo.Context) (*User, *APIKey, error) {
    app := getApp(c)
    auth := c.Request().Header.Get("Authorization")
    if auth != "" && strings.HasPrefix(strings.ToLower(auth), "bearer ") {
        token := strings.TrimSpace(auth[len("bearer "):])
        return validateAPIKey(app, token)
    }
    // Fallback: try session cookie
    cookie, err := c.Cookie("session")
    if err != nil || cookie == nil || cookie.Value == "" {
        return nil, nil, echo.ErrUnauthorized
    }
    claims, err := parseJWT(app, cookie.Value)
    if err != nil {
        return nil, nil, echo.ErrUnauthorized
    }
    var u User
    if err := app.DB.First(&u, claims.UserID).Error; err != nil {
        return nil, nil, echo.ErrUnauthorized
    }
    if u.Disabled {
        return nil, nil, echo.ErrUnauthorized
    }
    return &u, nil, nil
}

func openaiListModels(c echo.Context) error {
    app := getApp(c)
    if _, _, err := getUserFromAuth(c); err != nil {
        return c.JSON(http.StatusUnauthorized, echo.Map{"error": "unauthorized"})
    }
    type modelObj struct {
        ID      string `json:"id"`
        Object  string `json:"object"`
        OwnedBy string `json:"owned_by"`
    }
    var models []modelObj
    var providers []Provider
    if err := app.DB.Where("enabled = ?", true).Find(&providers).Error; err != nil {
        return c.JSON(http.StatusInternalServerError, echo.Map{"error": "db error"})
    }
    for _, p := range providers {
        names := app.GetPulled(p.ID)
        if len(names) == 0 {
            continue
        }
        for _, name := range names {
            qualified := strings.ToLower(p.Name) + "/" + name
            models = append(models, modelObj{ID: qualified, Object: "model", OwnedBy: p.Name})
        }
    }
    // Add router/ fallbacks
    var routes []FallbackRoute
    if err := app.DB.Where("enabled = ?", true).Find(&routes).Error; err == nil {
        for _, r := range routes {
            models = append(models, modelObj{ID: "router/" + r.Name, Object: "model", OwnedBy: "router"})
        }
    }
    return c.JSON(http.StatusOK, echo.Map{"object": "list", "data": models})
}

func forwardOpenAIWithStream(c echo.Context, p Provider, clientModel string, upstreamBody []byte, endpoint string, stream bool) error {
    app := getApp(c)
    user, key, err := getUserFromAuth(c)
    if err != nil { return c.JSON(http.StatusUnauthorized, echo.Map{"error": "unauthorized"}) }
    keyID := uint(0)
    if key != nil {
        keyID = key.ID
    }

    // Determine message count if present in body
    msgCount := 0
    var payload map[string]any
    if err := json.Unmarshal(upstreamBody, &payload); err == nil {
        if v, ok := payload["messages"]; ok {
            if arr, ok := v.([]any); ok { msgCount = len(arr) }
        }
    }

    // build request to provider
    started := time.Now()
    url := strings.TrimSuffix(p.BaseURL, "/") + endpoint
    req, _ := http.NewRequest(http.MethodPost, url, bytes.NewReader(upstreamBody))
    req.Header.Set("Content-Type", "application/json")
    if p.APIKey != "" { req.Header.Set("Authorization", "Bearer "+p.APIKey) }

    resp, err := http.DefaultClient.Do(req)
    if err != nil {
        logUsage(app, user.ID, keyID, p.ID, clientModel, 0, started, msgCount, 0, 0)
        return c.JSON(http.StatusBadGateway, echo.Map{"error": "provider error"})
    }
    defer resp.Body.Close()

    if stream && resp.StatusCode >= 200 && resp.StatusCode < 300 {
        // Stream response directly to client
        c.Response().Header().Set("Content-Type", "text/event-stream")
        c.Response().WriteHeader(http.StatusOK)
        buf := make([]byte, 4096)
        for {
            n, err := resp.Body.Read(buf)
            if n > 0 {
                if _, werr := c.Response().Write(buf[:n]); werr != nil {
                    break
                }
                c.Response().Flush()
            }
            if err != nil {
                break
            }
        }
        // Log minimal usage for streaming (tokens unknown)
        logUsage(app, user.ID, keyID, p.ID, clientModel, resp.StatusCode, started, msgCount, 0, 0)
        return nil
    }

    b, _ := io.ReadAll(resp.Body)

    // try to extract usage for logging
    var usage struct {
        Usage struct {
            PromptTokens     int `json:"prompt_tokens"`
            CompletionTokens int `json:"completion_tokens"`
            TotalTokens      int `json:"total_tokens"`
        } `json:"usage"`
    }
    _ = json.Unmarshal(b, &usage)
    logUsage(app, user.ID, keyID, p.ID, clientModel, resp.StatusCode, started, msgCount, usage.Usage.PromptTokens, usage.Usage.CompletionTokens)

    // mirror status code and body
    return c.Blob(resp.StatusCode, "application/json", b)
}

// Router fallback helpers
func handleRouterChat(c echo.Context, app *App, clientModel string, payload map[string]any) error {
    user, key, err := getUserFromAuth(c)
    if err != nil { return c.JSON(http.StatusUnauthorized, echo.Map{"error": "unauthorized"}) }
    keyID := uint(0); if key != nil { keyID = key.ID }
    stream := false
    if s, ok := payload["stream"].(bool); ok { stream = s }
    // resolve route
    name := strings.TrimPrefix(strings.ToLower(clientModel), "router/")
    var route FallbackRoute
    if err := app.DB.Preload("Targets", func(db *gorm.DB) *gorm.DB { return db.Order("position ASC, id ASC") }).Where("enabled = ? AND name = ?", true, name).First(&route).Error; err != nil {
        return c.JSON(http.StatusBadRequest, echo.Map{"error": "unknown model"})
    }
    // message count for logging
    msgCount := 0
    if v, ok := payload["messages"]; ok { if arr, ok := v.([]any); ok { msgCount = len(arr) } }

    body, _ := json.Marshal(payload)
    var lastBody []byte
    var lastStatus int
    for _, t := range route.Targets {
        // confirm provider still enabled and model available in cache
        var p Provider
        if err := app.DB.Where("id = ? AND enabled = ?", t.ProviderID, true).First(&p).Error; err != nil { continue }
        // replace model
        var pl map[string]any
        _ = json.Unmarshal(body, &pl)
        pl["model"] = t.Model
        upBody, _ := json.Marshal(pl)
        started := time.Now()
        url := strings.TrimSuffix(p.BaseURL, "/") + "/chat/completions"
        req, _ := http.NewRequest(http.MethodPost, url, bytes.NewReader(upBody))
        req.Header.Set("Content-Type", "application/json")
        if p.APIKey != "" { req.Header.Set("Authorization", "Bearer "+p.APIKey) }
        resp, rerr := http.DefaultClient.Do(req)
        if rerr != nil {
            logUsage(app, user.ID, keyID, p.ID, clientModel, 0, started, msgCount, 0, 0)
            continue
        }
        defer resp.Body.Close()
        // fallback on 5xx; 4xx is returned to client
        if stream && resp.StatusCode >= 200 && resp.StatusCode < 300 {
            c.Response().Header().Set("Content-Type", "text/event-stream")
            c.Response().WriteHeader(http.StatusOK)
            buf := make([]byte, 4096)
            for {
                n, err := resp.Body.Read(buf)
                if n > 0 { if _, werr := c.Response().Write(buf[:n]); werr != nil { break }; c.Response().Flush() }
                if err != nil { break }
            }
            logUsage(app, user.ID, keyID, p.ID, clientModel, resp.StatusCode, started, msgCount, 0, 0)
            return nil
        }
        b, _ := io.ReadAll(resp.Body)
        if resp.StatusCode >= 200 && resp.StatusCode < 300 {
            var usage struct{ Usage struct{ PromptTokens int `json:"prompt_tokens"`; CompletionTokens int `json:"completion_tokens"` } `json:"usage"` }
            _ = json.Unmarshal(b, &usage)
            logUsage(app, user.ID, keyID, p.ID, clientModel, resp.StatusCode, started, msgCount, usage.Usage.PromptTokens, usage.Usage.CompletionTokens)
            return c.Blob(resp.StatusCode, "application/json", b)
        }
        if resp.StatusCode >= 500 {
            // try next
            lastBody = b; lastStatus = resp.StatusCode
            logUsage(app, user.ID, keyID, p.ID, clientModel, resp.StatusCode, started, msgCount, 0, 0)
            continue
        }
        // 4xx: return immediately
        logUsage(app, user.ID, keyID, p.ID, clientModel, resp.StatusCode, started, msgCount, 0, 0)
        return c.Blob(resp.StatusCode, "application/json", b)
    }
    // exhausted
    if lastBody != nil && lastStatus != 0 { return c.Blob(lastStatus, "application/json", lastBody) }
    return c.JSON(http.StatusBadGateway, echo.Map{"error": "no_available_target"})
}

func handleRouterNonStream(c echo.Context, app *App, clientModel string, payload map[string]any, endpoint string) error {
    user, key, err := getUserFromAuth(c)
    if err != nil { return c.JSON(http.StatusUnauthorized, echo.Map{"error": "unauthorized"}) }
    keyID := uint(0); if key != nil { keyID = key.ID }
    name := strings.TrimPrefix(strings.ToLower(clientModel), "router/")
    var route FallbackRoute
    if err := app.DB.Preload("Targets", func(db *gorm.DB) *gorm.DB { return db.Order("position ASC, id ASC") }).Where("enabled = ? AND name = ?", true, name).First(&route).Error; err != nil {
        return c.JSON(http.StatusBadRequest, echo.Map{"error": "unknown model"})
    }
    msgCount := 0
    if v, ok := payload["messages"]; ok { if arr, ok := v.([]any); ok { msgCount = len(arr) } }
    body, _ := json.Marshal(payload)
    var lastBody []byte
    var lastStatus int
    for _, t := range route.Targets {
        var p Provider
        if err := app.DB.Where("id = ? AND enabled = ?", t.ProviderID, true).First(&p).Error; err != nil { continue }
        var pl map[string]any; _ = json.Unmarshal(body, &pl)
        pl["model"] = t.Model
        upBody, _ := json.Marshal(pl)
        started := time.Now()
        url := strings.TrimSuffix(p.BaseURL, "/") + endpoint
        req, _ := http.NewRequest(http.MethodPost, url, bytes.NewReader(upBody))
        req.Header.Set("Content-Type", "application/json")
        if p.APIKey != "" { req.Header.Set("Authorization", "Bearer "+p.APIKey) }
        resp, rerr := http.DefaultClient.Do(req)
        if rerr != nil {
            logUsage(app, user.ID, keyID, p.ID, clientModel, 0, started, msgCount, 0, 0)
            continue
        }
        defer resp.Body.Close()
        b, _ := io.ReadAll(resp.Body)
        if resp.StatusCode >= 200 && resp.StatusCode < 300 {
            var usage struct{ Usage struct{ PromptTokens int `json:"prompt_tokens"`; CompletionTokens int `json:"completion_tokens"` } `json:"usage"` }
            _ = json.Unmarshal(b, &usage)
            logUsage(app, user.ID, keyID, p.ID, clientModel, resp.StatusCode, started, msgCount, usage.Usage.PromptTokens, usage.Usage.CompletionTokens)
            return c.Blob(resp.StatusCode, "application/json", b)
        }
        if resp.StatusCode >= 500 {
            lastBody = b; lastStatus = resp.StatusCode
            logUsage(app, user.ID, keyID, p.ID, clientModel, resp.StatusCode, started, msgCount, 0, 0)
            continue
        }
        logUsage(app, user.ID, keyID, p.ID, clientModel, resp.StatusCode, started, msgCount, 0, 0)
        return c.Blob(resp.StatusCode, "application/json", b)
    }
    if lastBody != nil && lastStatus != 0 { return c.Blob(lastStatus, "application/json", lastBody) }
    return c.JSON(http.StatusBadGateway, echo.Map{"error": "no_available_target"})
}

func openaiChatCompletions(c echo.Context) error {
    var payload map[string]any
    if err := json.NewDecoder(c.Request().Body).Decode(&payload); err != nil {
        return c.JSON(http.StatusBadRequest, echo.Map{"error": "invalid json"})
    }
    clientModel, _ := payload["model"].(string)
    if clientModel == "" {
        return c.JSON(http.StatusBadRequest, echo.Map{"error": "model required"})
    }
    app := getApp(c)
    // Router fallback path
    if strings.HasPrefix(strings.ToLower(clientModel), "router/") {
        return handleRouterChat(c, app, clientModel, payload)
    }
    p, raw, ok := resolveQualifiedModel(app, clientModel)
    if !ok {
        return c.JSON(http.StatusBadRequest, echo.Map{"error": "unknown model"})
    }
    payload["model"] = raw
    // Pass through stream param if present
    stream := false
    if s, ok := payload["stream"].(bool); ok {
        stream = s
    }
    body, _ := json.Marshal(payload)
    return forwardOpenAIWithStream(c, p, clientModel, body, "/chat/completions", stream)
}

func openaiCompletions(c echo.Context) error {
    var payload map[string]any
    if err := json.NewDecoder(c.Request().Body).Decode(&payload); err != nil {
        return c.JSON(http.StatusBadRequest, echo.Map{"error": "invalid json"})
    }
    clientModel, _ := payload["model"].(string)
    if clientModel == "" {
        return c.JSON(http.StatusBadRequest, echo.Map{"error": "model required"})
    }
    app := getApp(c)
    if strings.HasPrefix(strings.ToLower(clientModel), "router/") {
        return handleRouterNonStream(c, app, clientModel, payload, "/completions")
    }
    p, raw, ok := resolveQualifiedModel(app, clientModel)
    if !ok {
        return c.JSON(http.StatusBadRequest, echo.Map{"error": "unknown model"})
    }
    payload["model"] = raw
    body, _ := json.Marshal(payload)
    return forwardOpenAIWithStream(c, p, clientModel, body, "/completions", false)
}

func openaiEmbeddings(c echo.Context) error {
    var payload map[string]any
    if err := json.NewDecoder(c.Request().Body).Decode(&payload); err != nil {
        return c.JSON(http.StatusBadRequest, echo.Map{"error": "invalid json"})
    }
    clientModel, _ := payload["model"].(string)
    if clientModel == "" {
        return c.JSON(http.StatusBadRequest, echo.Map{"error": "model required"})
    }
    app := getApp(c)
    if strings.HasPrefix(strings.ToLower(clientModel), "router/") {
        return handleRouterNonStream(c, app, clientModel, payload, "/embeddings")
    }
    p, raw, ok := resolveQualifiedModel(app, clientModel)
    if !ok {
        return c.JSON(http.StatusBadRequest, echo.Map{"error": "unknown model"})
    }
    payload["model"] = raw
    body, _ := json.Marshal(payload)
    return forwardOpenAIWithStream(c, p, clientModel, body, "/embeddings", false)
}

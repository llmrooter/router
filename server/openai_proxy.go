package server

import (
    "bytes"
    "encoding/json"
    "io"
    "net/http"
    "strings"
    "time"

    "github.com/labstack/echo/v4"
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
            models = append(models, modelObj{ID: name, Object: "model", OwnedBy: p.Name})
        }
    }
    return c.JSON(http.StatusOK, echo.Map{"object": "list", "data": models})
}

func forwardOpenAIWithStream(c echo.Context, model string, body []byte, endpoint string, stream bool) error {
    app := getApp(c)
    user, key, err := getUserFromAuth(c)
    if err != nil { return c.JSON(http.StatusUnauthorized, echo.Map{"error": "unauthorized"}) }
    keyID := uint(0)
    if key != nil {
        keyID = key.ID
    }

    // Resolve model to a provider: only from pulled cache
    var p Provider
    var providers []Provider
    if err := app.DB.Where("enabled = ?", true).Find(&providers).Error; err != nil {
        return c.JSON(http.StatusInternalServerError, echo.Map{"error": "db error"})
    }
    found := false
    for _, cand := range providers {
        for _, name := range app.GetPulled(cand.ID) {
            if name == model {
                p = cand
                found = true
                break
            }
        }
        if found { break }
    }
    if !found {
        return c.JSON(http.StatusBadRequest, echo.Map{"error": "unknown model"})
    }

    // Determine message count if present in body
    msgCount := 0
    var payload map[string]any
    if err := json.Unmarshal(body, &payload); err == nil {
        if v, ok := payload["messages"]; ok {
            if arr, ok := v.([]any); ok { msgCount = len(arr) }
        }
    }

    // build request to provider
    started := time.Now()
    url := strings.TrimSuffix(p.BaseURL, "/") + endpoint
    req, _ := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
    req.Header.Set("Content-Type", "application/json")
    if p.APIKey != "" { req.Header.Set("Authorization", "Bearer "+p.APIKey) }

    resp, err := http.DefaultClient.Do(req)
    if err != nil {
        logUsage(app, user.ID, keyID, p.ID, model, 0, started, msgCount, 0, 0)
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
        logUsage(app, user.ID, keyID, p.ID, model, resp.StatusCode, started, msgCount, 0, 0)
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
    logUsage(app, user.ID, keyID, p.ID, model, resp.StatusCode, started, msgCount, usage.Usage.PromptTokens, usage.Usage.CompletionTokens)

    // mirror status code and body
    return c.Blob(resp.StatusCode, "application/json", b)
}

func openaiChatCompletions(c echo.Context) error {
    var payload map[string]any
    if err := json.NewDecoder(c.Request().Body).Decode(&payload); err != nil {
        return c.JSON(http.StatusBadRequest, echo.Map{"error": "invalid json"})
    }
    model, _ := payload["model"].(string)
    if model == "" {
        return c.JSON(http.StatusBadRequest, echo.Map{"error": "model required"})
    }
    // Pass through stream param if present
    stream := false
    if s, ok := payload["stream"].(bool); ok {
        stream = s
    }
    body, _ := json.Marshal(payload)
    return forwardOpenAIWithStream(c, model, body, "/chat/completions", stream)
}

func openaiCompletions(c echo.Context) error {
    var payload map[string]any
    if err := json.NewDecoder(c.Request().Body).Decode(&payload); err != nil {
        return c.JSON(http.StatusBadRequest, echo.Map{"error": "invalid json"})
    }
    model, _ := payload["model"].(string)
    if model == "" {
        return c.JSON(http.StatusBadRequest, echo.Map{"error": "model required"})
    }
    body, _ := json.Marshal(payload)
    return forwardOpenAIWithStream(c, model, body, "/completions", false)
}

func openaiEmbeddings(c echo.Context) error {
    var payload map[string]any
    if err := json.NewDecoder(c.Request().Body).Decode(&payload); err != nil {
        return c.JSON(http.StatusBadRequest, echo.Map{"error": "invalid json"})
    }
    model, _ := payload["model"].(string)
    if model == "" {
        return c.JSON(http.StatusBadRequest, echo.Map{"error": "model required"})
    }
    body, _ := json.Marshal(payload)
    return forwardOpenAIWithStream(c, model, body, "/embeddings", false)
}

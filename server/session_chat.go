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

func registerSessionChatRoutes(g *echo.Group) {
    g.POST("/chat", requireAuth(blockAdminIfMustChange(sessionChatCompletions)))
}

func sessionChatCompletions(c echo.Context) error {
    app := getApp(c)
    user := c.Get("user").(*User)

    var payload map[string]any
    if err := json.NewDecoder(c.Request().Body).Decode(&payload); err != nil {
        return c.JSON(http.StatusBadRequest, echo.Map{"error": "invalid json"})
    }
    clientModel, _ := payload["model"].(string)
    if clientModel == "" {
        return c.JSON(http.StatusBadRequest, echo.Map{"error": "model required"})
    }
    // If router/ fallback is requested, delegate to router handler (non-stream)
    if strings.HasPrefix(strings.ToLower(clientModel), "router/") {
        return handleRouterNonStream(c, app, clientModel, payload, "/chat/completions")
    }
    // Count messages if present
    msgCount := 0
    if v, ok := payload["messages"]; ok {
        if arr, ok := v.([]any); ok { msgCount = len(arr) }
    }
    payload["stream"] = false
    body, _ := json.Marshal(payload)

    // Resolve provider/model strictly
    p, raw, ok := resolveQualifiedModel(app, clientModel)
    if !ok {
        return c.JSON(http.StatusBadRequest, echo.Map{"error": "unknown model"})
    }
    payload["model"] = raw

    // Build request to provider
    started := time.Now()
    url := strings.TrimSuffix(p.BaseURL, "/") + "/chat/completions"
    req, _ := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
    req.Header.Set("Content-Type", "application/json")
    if p.APIKey != "" { req.Header.Set("Authorization", "Bearer "+p.APIKey) }

    resp, err := http.DefaultClient.Do(req)
    if err != nil {
        logUsage(app, user.ID, 0, p.ID, clientModel, 0, started, msgCount, 0, 0)
        return c.JSON(http.StatusBadGateway, echo.Map{"error": "provider error"})
    }
    defer resp.Body.Close()
    b, _ := io.ReadAll(resp.Body)

    var usage struct {
        Usage struct {
            PromptTokens     int `json:"prompt_tokens"`
            CompletionTokens int `json:"completion_tokens"`
        } `json:"usage"`
    }
    _ = json.Unmarshal(b, &usage)
    logUsage(app, user.ID, 0, p.ID, clientModel, resp.StatusCode, started, msgCount, usage.Usage.PromptTokens, usage.Usage.CompletionTokens)

    return c.Blob(resp.StatusCode, "application/json", b)
}

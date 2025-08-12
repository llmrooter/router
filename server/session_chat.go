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
    model, _ := payload["model"].(string)
    if model == "" {
        return c.JSON(http.StatusBadRequest, echo.Map{"error": "model required"})
    }
    // Count messages if present
    msgCount := 0
    if v, ok := payload["messages"]; ok {
        if arr, ok := v.([]any); ok { msgCount = len(arr) }
    }
    payload["stream"] = false
    body, _ := json.Marshal(payload)

    // Resolve provider by pulled cache across enabled providers
    var providers []Provider
    if err := app.DB.Where("enabled = ?", true).Find(&providers).Error; err != nil {
        return c.JSON(http.StatusInternalServerError, echo.Map{"error": "db error"})
    }
    var p Provider
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

    // Build request to provider
    started := time.Now()
    url := strings.TrimSuffix(p.BaseURL, "/") + "/chat/completions"
    req, _ := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
    req.Header.Set("Content-Type", "application/json")
    if p.APIKey != "" { req.Header.Set("Authorization", "Bearer "+p.APIKey) }

    resp, err := http.DefaultClient.Do(req)
    if err != nil {
        logUsage(app, user.ID, 0, p.ID, model, 0, started, msgCount, 0, 0)
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
    logUsage(app, user.ID, 0, p.ID, model, resp.StatusCode, started, msgCount, usage.Usage.PromptTokens, usage.Usage.CompletionTokens)

    return c.Blob(resp.StatusCode, "application/json", b)
}

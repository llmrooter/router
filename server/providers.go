package server

import (
    "encoding/json"
    "fmt"
    "io"
    "log"
    "net/http"
    "net/url"
    "strconv"
    "strings"

    "github.com/labstack/echo/v4"
)

type providerReq struct {
    Name       string `json:"name"`
    Type       string `json:"type"`
    BaseURL    string `json:"base_url"`
    APIKey     string `json:"api_key"`
    Enabled    bool   `json:"enabled"`
}

func registerProviderRoutes(g *echo.Group) {
    ag := g.Group("/providers")
    ag.GET("", requireAuth(blockAdminIfMustChange(listProviders)))
    ag.POST("", requireAdmin(blockAdminIfMustChange(createProvider)))
    ag.GET("/:id", requireAdmin(blockAdminIfMustChange(getProvider)))
    ag.PUT("/:id", requireAdmin(blockAdminIfMustChange(updateProvider)))
    ag.DELETE("/:id", requireAdmin(blockAdminIfMustChange(deleteProvider)))
    ag.POST("/:id/refresh_models", requireAdmin(blockAdminIfMustChange(refreshProviderModels)))
}

func listProviders(c echo.Context) error {
    app := getApp(c)
    var ps []Provider
    if err := app.DB.Preload("Models").Order("id ASC").Find(&ps).Error; err != nil {
        return c.JSON(http.StatusInternalServerError, echo.Map{"error": "db error"})
    }
    // attach runtime pulled models to response
    for i := range ps {
        ps[i].RuntimeModels = app.GetPulled(ps[i].ID)
    }
    return c.JSON(http.StatusOK, ps)
}

func createProvider(c echo.Context) error {
    app := getApp(c)
    var req providerReq
    if err := c.Bind(&req); err != nil || req.Name == "" || req.Type == "" {
        return c.JSON(http.StatusBadRequest, echo.Map{"error": "invalid payload"})
    }
    p := Provider{
        Name:       req.Name,
        Type:       strings.ToLower(req.Type),
        BaseURL:    defaultStr(req.BaseURL, "https://api.openai.com/v1"),
        APIKey:     req.APIKey,
        Enabled:    req.Enabled,
    }
    if err := app.DB.Create(&p).Error; err != nil {
        return c.JSON(http.StatusConflict, echo.Map{"error": "name exists"})
    }
    // Always attempt to pull models
    _ = fetchAndStoreModels(app, &p)
    if err := app.DB.Preload("Models").First(&p, p.ID).Error; err == nil {
        return c.JSON(http.StatusCreated, p)
    }
    return c.JSON(http.StatusCreated, p)
}

func getProvider(c echo.Context) error {
    app := getApp(c)
    id := c.Param("id")
    var p Provider
    if err := app.DB.Preload("Models").First(&p, id).Error; err != nil {
        return c.JSON(http.StatusNotFound, echo.Map{"error": "not found"})
    }
    p.RuntimeModels = app.GetPulled(p.ID)
    return c.JSON(http.StatusOK, p)
}

func updateProvider(c echo.Context) error {
    app := getApp(c)
    id := c.Param("id")
    var p Provider
    if err := app.DB.First(&p, id).Error; err != nil {
        return c.JSON(http.StatusNotFound, echo.Map{"error": "not found"})
    }
    var req providerReq
    if err := c.Bind(&req); err != nil {
        return c.JSON(http.StatusBadRequest, echo.Map{"error": "invalid payload"})
    }
    if req.Name != "" { p.Name = req.Name }
    if req.Type != "" { p.Type = strings.ToLower(req.Type) }
    if req.BaseURL != "" { p.BaseURL = req.BaseURL }
    // Allow clearing API key by sending explicit empty? Keep as: only set if provided non-empty
    if req.APIKey != "" { p.APIKey = req.APIKey }
    prevEnabled := p.Enabled
    p.Enabled = req.Enabled
    if err := app.DB.Save(&p).Error; err != nil {
        return c.JSON(http.StatusInternalServerError, echo.Map{"error": "db error"})
    }
    // Refresh cache; clear if disabled now
    if p.Enabled {
        _ = fetchAndStoreModels(app, &p)
    } else if prevEnabled && !p.Enabled {
        app.ClearPulled(p.ID)
    }
    _ = app.DB.Preload("Models").First(&p, p.ID).Error
    return c.JSON(http.StatusOK, p)
}

func refreshProviderModels(c echo.Context) error {
    app := getApp(c)
    id := c.Param("id")
    var p Provider
    if err := app.DB.First(&p, id).Error; err != nil {
        return c.JSON(http.StatusNotFound, echo.Map{"error": "not found"})
    }
    if err := fetchAndStoreModels(app, &p); err != nil {
        return c.JSON(http.StatusBadGateway, echo.Map{"error": "refresh_failed"})
    }
    _ = app.DB.Preload("Models").First(&p, p.ID).Error
    return c.JSON(http.StatusOK, p)
}

func deleteProvider(c echo.Context) error {
    app := getApp(c)
    id := c.Param("id")
    // cascade delete models
    app.DB.Where("provider_id = ?", id).Delete(&ModelEntry{})
    if err := app.DB.Delete(&Provider{}, id).Error; err != nil {
        return c.JSON(http.StatusInternalServerError, echo.Map{"error": "db error"})
    }
    if n, err := strconv.ParseUint(id, 10, 64); err == nil {
        app.ClearPulled(uint(n))
    }
    return c.NoContent(http.StatusNoContent)
}

func defaultStr(s, def string) string { if s == "" { return def }; return s }

// Fetch models from provider and store
func fetchAndStoreModels(app *App, p *Provider) error {
    if p.Type != "openai" {
        return nil
    }
    // Call GET {base}/models
    base := strings.TrimSuffix(p.BaseURL, "/")
    u, _ := url.Parse(base + "/models")
    req, _ := http.NewRequest(http.MethodGet, u.String(), nil)
    if p.APIKey != "" {
        req.Header.Set("Authorization", "Bearer "+p.APIKey)
    }
    resp, err := http.DefaultClient.Do(req)
    if err != nil {
        fmt.Printf("provider %s fetch models error: %v\n", p.Name, err)
        return err
    }
    defer resp.Body.Close()
    if resp.StatusCode < 200 || resp.StatusCode >= 300 {
        b, _ := io.ReadAll(resp.Body)
        fmt.Printf("provider %s fetch models status %d: %s\n", p.Name, resp.StatusCode, string(b))
        return fmt.Errorf("status %d", resp.StatusCode)
    }
    var payload struct {
        Data []struct {
            ID string `json:"id"`
        } `json:"data"`
    }
    if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
        fmt.Printf("provider %s decode models error: %v\n", p.Name, err)
        return err
    }
    // cache models in memory (do not persist)
    names := make([]string, 0, len(payload.Data))
    for _, m := range payload.Data { names = append(names, m.ID) }
    app.SetPulled(p.ID, names)
    log.Printf("models: pulled %d models from provider=%s", len(names), p.Name)
    return nil
}

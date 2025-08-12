package server

import (
    "net/http"

    "github.com/labstack/echo/v4"
)

// listModels now returns only runtime pulled models (read-only)
func registerModelRoutes(g *echo.Group) {
    ag := g.Group("/models")
    ag.GET("", requireAuth(blockAdminIfMustChange(listModels)))
}

func listModels(c echo.Context) error {
    app := getApp(c)
    type runtimeModel struct {
        ProviderID   uint   `json:"provider_id"`
        ProviderName string `json:"provider_name"`
        Name         string `json:"name"`
    }
    var providers []Provider
    // Query all enabled providers (pull_models is deprecated/removed)
    if err := app.DB.Where("enabled = ?", true).Find(&providers).Error; err != nil {
        return c.JSON(http.StatusInternalServerError, echo.Map{"error": "db error"})
    }
    resp := []runtimeModel{}
    for _, p := range providers {
        for _, name := range app.GetPulled(p.ID) {
            resp = append(resp, runtimeModel{ProviderID: p.ID, ProviderName: p.Name, Name: name})
        }
    }
    return c.JSON(http.StatusOK, resp)
}

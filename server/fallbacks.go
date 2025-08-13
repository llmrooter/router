package server

import (
    "net/http"
    "sort"
    "strings"

    "github.com/labstack/echo/v4"
    "gorm.io/gorm"
)

type fallbackReq struct {
    Name    string   `json:"name"`
    Enabled bool     `json:"enabled"`
    // Targets as qualified ids: provider/model, in priority order
    Targets []string `json:"targets"`
}

func registerFallbackRoutes(g *echo.Group) {
    ag := g.Group("/fallbacks")
    ag.GET("", requireAdmin(blockAdminIfMustChange(listFallbacks)))
    ag.POST("", requireAdmin(blockAdminIfMustChange(createFallback)))
    ag.GET("/:id", requireAdmin(blockAdminIfMustChange(getFallback)))
    ag.PUT("/:id", requireAdmin(blockAdminIfMustChange(updateFallback)))
    ag.DELETE("/:id", requireAdmin(blockAdminIfMustChange(deleteFallback)))
}

func listFallbacks(c echo.Context) error {
    app := getApp(c)
    var routes []FallbackRoute
    if err := app.DB.Preload("Targets", func(db *gorm.DB) *gorm.DB { return db.Order("position ASC, id ASC") }).Order("id ASC").Find(&routes).Error; err != nil {
        return c.JSON(http.StatusInternalServerError, echo.Map{"error": "db error"})
    }
    return c.JSON(http.StatusOK, routes)
}

func createFallback(c echo.Context) error {
    app := getApp(c)
    var req fallbackReq
    if err := c.Bind(&req); err != nil || strings.TrimSpace(req.Name) == "" {
        return c.JSON(http.StatusBadRequest, echo.Map{"error": "invalid payload"})
    }
    r := FallbackRoute{Name: req.Name, Enabled: req.Enabled}
    if err := app.DB.Create(&r).Error; err != nil {
        return c.JSON(http.StatusConflict, echo.Map{"error": "name exists"})
    }
    if len(req.Targets) > 0 {
        if err := replaceTargets(app, &r, req.Targets); err != nil {
            return c.JSON(http.StatusBadRequest, echo.Map{"error": err.Error()})
        }
    }
    _ = app.DB.Preload("Targets", func(db *gorm.DB) *gorm.DB { return db.Order("position ASC, id ASC") }).First(&r, r.ID).Error
    return c.JSON(http.StatusCreated, r)
}

func getFallback(c echo.Context) error {
    app := getApp(c)
    var r FallbackRoute
    if err := app.DB.Preload("Targets", func(db *gorm.DB) *gorm.DB { return db.Order("position ASC, id ASC") }).First(&r, c.Param("id")).Error; err != nil {
        return c.JSON(http.StatusNotFound, echo.Map{"error": "not found"})
    }
    return c.JSON(http.StatusOK, r)
}

func updateFallback(c echo.Context) error {
    app := getApp(c)
    var r FallbackRoute
    if err := app.DB.First(&r, c.Param("id")).Error; err != nil {
        return c.JSON(http.StatusNotFound, echo.Map{"error": "not found"})
    }
    var req fallbackReq
    if err := c.Bind(&req); err != nil {
        return c.JSON(http.StatusBadRequest, echo.Map{"error": "invalid payload"})
    }
    if strings.TrimSpace(req.Name) != "" {
        r.Name = req.Name
    }
    r.Enabled = req.Enabled
    if err := app.DB.Save(&r).Error; err != nil {
        return c.JSON(http.StatusInternalServerError, echo.Map{"error": "db error"})
    }
    if req.Targets != nil { // explicit replace
        if err := replaceTargets(app, &r, req.Targets); err != nil {
            return c.JSON(http.StatusBadRequest, echo.Map{"error": err.Error()})
        }
    }
    _ = app.DB.Preload("Targets", func(db *gorm.DB) *gorm.DB { return db.Order("position ASC, id ASC") }).First(&r, r.ID).Error
    return c.JSON(http.StatusOK, r)
}

func deleteFallback(c echo.Context) error {
    app := getApp(c)
    id := c.Param("id")
    app.DB.Unscoped().Where("route_id = ?", id).Delete(&FallbackTarget{})
    if err := app.DB.Unscoped().Delete(&FallbackRoute{}, id).Error; err != nil {
        return c.JSON(http.StatusInternalServerError, echo.Map{"error": "db error"})
    }
    return c.NoContent(http.StatusNoContent)
}

func replaceTargets(app *App, r *FallbackRoute, qualified []string) error {
    // Resolve qualified provider/model into ProviderID + raw model
    targets := make([]FallbackTarget, 0, len(qualified))
    for i, q := range qualified {
        p, raw, ok := resolveQualifiedModel(app, q)
        if !ok {
            return echo.NewHTTPError(http.StatusBadRequest, "unknown target: "+q)
        }
        targets = append(targets, FallbackTarget{RouteID: r.ID, ProviderID: p.ID, Model: raw, Position: i})
    }
    // delete existing and insert new ordered targets in a transaction
    return app.DB.Transaction(func(tx *gorm.DB) error {
        if err := tx.Where("route_id = ?", r.ID).Delete(&FallbackTarget{}).Error; err != nil { return err }
        if len(targets) > 0 {
            if err := tx.Create(&targets).Error; err != nil { return err }
        }
        return nil
    })
}

// helpers for use in resolvers
func listEnabledFallbacks(app *App) ([]FallbackRoute, error) {
    var routes []FallbackRoute
    if err := app.DB.Preload("Targets").Where("enabled = ?", true).Find(&routes).Error; err != nil {
        return nil, err
    }
    for i := range routes {
        sort.SliceStable(routes[i].Targets, func(a, b int) bool { return routes[i].Targets[a].Position < routes[i].Targets[b].Position })
    }
    return routes, nil
}

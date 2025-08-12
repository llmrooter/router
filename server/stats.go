package server

import (
    "net/http"
    "time"

    "github.com/labstack/echo/v4"
)

type statsResp struct {
    Requests int64 `json:"requests"`
    AvgMs    int64 `json:"avg_ms"`
    TokensIn int64 `json:"tokens_in"`
    TokensOut int64 `json:"tokens_out"`
}

func registerStatsRoutes(g *echo.Group) {
    g.GET("/stats/me", requireAuth(blockAdminIfMustChange(statsMe)))
    ag := g.Group("/admin")
    ag.GET("/stats/user/:id", requireAdmin(blockAdminIfMustChange(adminStatsUser)))
}

func statsMe(c echo.Context) error {
    app := getApp(c)
    u := c.Get("user").(*User)
    var count int64
    var totalMs int64
    var inT, outT int64
    rows, err := app.DB.Model(&UsageLog{}).Select("latency_ms, tokens_in, tokens_out").Where("user_id = ?", u.ID).Rows()
    if err != nil {
        return c.JSON(http.StatusInternalServerError, echo.Map{"error": "db error"})
    }
    defer rows.Close()
    for rows.Next() {
        var ms int64
        var tin, tout int
        _ = rows.Scan(&ms, &tin, &tout)
        count++
        totalMs += ms
        inT += int64(tin)
        outT += int64(tout)
    }
    avg := int64(0)
    if count > 0 { avg = totalMs / count }
    return c.JSON(http.StatusOK, statsResp{Requests: count, AvgMs: avg, TokensIn: inT, TokensOut: outT})
}

func adminStatsUser(c echo.Context) error {
    app := getApp(c)
    id := c.Param("id")
    var count int64
    var totalMs int64
    var inT, outT int64
    rows, err := app.DB.Model(&UsageLog{}).Select("latency_ms, tokens_in, tokens_out").Where("user_id = ?", id).Rows()
    if err != nil {
        return c.JSON(http.StatusInternalServerError, echo.Map{"error": "db error"})
    }
    defer rows.Close()
    for rows.Next() {
        var ms int64
        var tin, tout int
        _ = rows.Scan(&ms, &tin, &tout)
        count++
        totalMs += ms
        inT += int64(tin)
        outT += int64(tout)
    }
    avg := int64(0)
    if count > 0 { avg = totalMs / count }
    return c.JSON(http.StatusOK, statsResp{Requests: count, AvgMs: avg, TokensIn: inT, TokensOut: outT})
}

// Convenience for usage logs
func logUsage(app *App, userID uint, keyID uint, providerID uint, model string, status int, started time.Time, promptTok, compTok int) {
    took := time.Since(started).Milliseconds()
    _ = app.DB.Create(&UsageLog{
        UserID:     userID,
        APIKeyID:   keyID,
        ProviderID: providerID,
        Model:      model,
        Status:     status,
        LatencyMs:  took,
        TokensIn:   promptTok,
        TokensOut:  compTok,
    }).Error
}

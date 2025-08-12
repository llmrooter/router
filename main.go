package main

import (
    "log"
    "net/http"
    "os"
    "path/filepath"
    "strings"
    "time"

    "github.com/labstack/echo/v4"
    "github.com/labstack/echo/v4/middleware"

    "github.com/railendemoss/LLMRouter/server"
)

func main() {
    cfg, err := server.LoadConfig()
    if err != nil {
        log.Fatalf("failed to load config: %v", err)
    }

    // Default to production-like behavior: require built client unless dev
    staticDir := cfg.Server.StaticDir
    if _, err := os.Stat(staticDir); os.IsNotExist(err) {
        if !cfg.Server.Dev && strings.ToLower(os.Getenv("DEV")) != "true" {
            log.Fatalf("client build missing: expected %s. Build the client first.", staticDir)
        }
    }

    e := echo.New()
    e.HideBanner = true
    e.HidePort = true
    e.Pre(middleware.RemoveTrailingSlash())
    e.Use(middleware.Recover())
    e.Use(middleware.RequestID())
    e.Use(middleware.Secure())

    // CORS (same-origin in prod; permissive in dev; allowlist in config)
    if cfg.Server.Dev || strings.ToLower(os.Getenv("DEV")) == "true" {
        e.Use(middleware.CORS())
    } else {
        allow := cfg.Server.CORSAllowOrigins
        if len(allow) == 0 {
            allow = []string{"*"}
        }
        e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
            AllowOrigins: allow,
            AllowMethods: []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodOptions},
            AllowHeaders: []string{"*"},
        }))
    }

    // Boot server: DB, routes, handlers
    if err := server.Boot(e, cfg); err != nil {
        log.Fatalf("boot error: %v", err)
    }

    // Serve static client in production with SPA fallback
    if _, err := os.Stat(staticDir); err == nil {
        e.GET("/*", func(c echo.Context) error {
            p := c.Request().URL.Path
            if strings.HasPrefix(p, "/api/") {
                return echo.ErrNotFound
            }
            // try to serve actual file if exists
            if p == "/" || p == "" {
                return c.File(filepath.Join(staticDir, "index.html"))
            }
            // sanitize and join
            cleaned := strings.TrimPrefix(filepath.Clean(p), string(filepath.Separator))
            fpath := filepath.Join(staticDir, cleaned)
            if info, err := os.Stat(fpath); err == nil && !info.IsDir() {
                return c.File(fpath)
            }
            return c.File(filepath.Join(staticDir, "index.html"))
        })
    }

    port := cfg.Server.Port
    if p := os.Getenv("PORT"); p != "" { port = p }
    addr := ":" + port
    srv := &http.Server{
        Addr:         addr,
        ReadTimeout:  60 * time.Second,
        WriteTimeout: 60 * time.Second,
        IdleTimeout:  90 * time.Second,
    }
    log.Printf("server listening on %s", addr)
    if err := e.StartServer(srv); err != nil {
        log.Fatalf("server error: %v", err)
    }
}

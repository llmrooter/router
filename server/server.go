package server

import (
    "errors"
    "fmt"
    "log"
    "net/http"
    "os"
    "strings"
    "time"
    "sync"

    "github.com/golang-jwt/jwt/v5"
    "github.com/labstack/echo/v4"
    "github.com/labstack/echo/v4/middleware"
    "gorm.io/driver/postgres"
    "gorm.io/driver/sqlite"
    "gorm.io/gorm"
)

type App struct {
    DB        *gorm.DB
    JWTSecret []byte
    Config    *Config
    pulledMu  sync.RWMutex
    pulled    map[uint][]string // providerID -> model IDs fetched from provider
}

func getEnv(key, def string) string {
    v := os.Getenv(key)
    if v == "" {
        return def
    }
    return v
}

// Boot initializes DB, auth, and routes
func Boot(e *echo.Echo, cfg *Config) error {
    app := &App{Config: cfg, pulled: map[uint][]string{}}

    // JWT Secret
    secret := cfg.Server.JWTSecret
    if v := os.Getenv("JWT_SECRET"); v != "" { secret = v }
    app.JWTSecret = []byte(secret)

    // DB
    db, err := openDB(cfg)
    if err != nil {
        return err
    }
    app.DB = db
    if err := migrate(db); err != nil {
        return err
    }
    if err := seedAdmin(app); err != nil {
        return err
    }

    // Warm pulled models cache for enabled providers with pull_models
    if err := warmPulledModels(app); err != nil {
        // Non-fatal; continue serving
        log.Printf("warn: warmPulledModels: %v", err)
    }

    // Middlewares
    e.Use(middleware.Logger())
    e.Use(withApp(app))

    // API routes
    api := e.Group("/api")
    registerAuthRoutes(api)
    registerAccountRoutes(api)
    registerUserRoutes(api)
    registerKeyRoutes(api)
    registerProviderRoutes(api)
    registerModelRoutes(api)
    registerFallbackRoutes(api)
    registerStatsRoutes(api)
    registerSessionChatRoutes(api)

    // OpenAI-compatible routes under /api/v1
    v1 := api.Group("/v1")
    registerOpenAIRoutes(v1)

    // Health
    e.GET("/healthz", func(c echo.Context) error { return c.String(http.StatusOK, "ok") })
    return nil
}

// Pulled models cache helpers
func (a *App) SetPulled(providerID uint, models []string) {
    a.pulledMu.Lock()
    defer a.pulledMu.Unlock()
    a.pulled[providerID] = models
}

func (a *App) GetPulled(providerID uint) []string {
    a.pulledMu.RLock()
    defer a.pulledMu.RUnlock()
    v := a.pulled[providerID]
    // return a copy to avoid races
    out := make([]string, len(v))
    copy(out, v)
    return out
}

func (a *App) ClearPulled(providerID uint) {
    a.pulledMu.Lock()
    defer a.pulledMu.Unlock()
    delete(a.pulled, providerID)
}

func warmPulledModels(app *App) error {
    var providers []Provider
    if err := app.DB.Where("enabled = ?", true).Find(&providers).Error; err != nil {
        return err
    }
    for i := range providers {
        if err := fetchAndStoreModels(app, &providers[i]); err == nil {
            models := app.GetPulled(providers[i].ID)
            log.Printf("models: provider=%s pulled=%d", providers[i].Name, len(models))
        } else {
            log.Printf("models: provider=%s pull error: %v", providers[i].Name, err)
        }
    }
    return nil
}

func openDB(cfg *Config) (*gorm.DB, error) {
    driver := strings.ToLower(strings.TrimSpace(cfg.Database.Driver))
    // Env override path for pragmatic use
    envDSN := os.Getenv("DATABASE_URL")
    if driver == "postgres" || (driver == "" && envDSN != "") {
        dsn := cfg.Database.DSN
        if dsn == "" { dsn = envDSN }
        if dsn == "" {
            return nil, fmt.Errorf("database.driver=postgres but no DSN provided (set database.dsn or DATABASE_URL)")
        }
        db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
        if err != nil {
            return nil, fmt.Errorf("postgres connect: %w", err)
        }
        sqlDB, _ := db.DB()
        sqlDB.SetMaxOpenConns(10)
        sqlDB.SetMaxIdleConns(5)
        sqlDB.SetConnMaxLifetime(30 * time.Minute)
        log.Println("DB: connected to Postgres")
        return db, nil
    }

    // SQLite path from config or env
    path := cfg.Database.SQLitePath
    if v := os.Getenv("SQLITE_PATH"); v != "" { path = v }
    if path == "" { path = "data/app.db" }
    if err := os.MkdirAll("data", 0o755); err != nil && !os.IsExist(err) {
        return nil, err
    }
    db, err := gorm.Open(sqlite.Open(path), &gorm.Config{})
    if err != nil {
        return nil, fmt.Errorf("sqlite connect: %w", err)
    }
    log.Printf("DB: using SQLite at %s", path)
    return db, nil
}

// Context helpers
type ctxKey string

const appKey ctxKey = "app"

func withApp(app *App) echo.MiddlewareFunc {
    return func(next echo.HandlerFunc) echo.HandlerFunc {
        return func(c echo.Context) error {
            c.Set(string(appKey), app)
            return next(c)
        }
    }
}

func getApp(c echo.Context) *App {
    v := c.Get(string(appKey))
    if v == nil {
        panic("app not in context")
    }
    return v.(*App)
}

// JWT utilities
type Claims struct {
    UserID uint   `json:"user_id"`
    Role   string `json:"role"`
    jwt.RegisteredClaims
}

func signJWT(app *App, uid uint, role string, ttl time.Duration) (string, error) {
    now := time.Now()
    token := jwt.NewWithClaims(jwt.SigningMethodHS256, &Claims{
        UserID: uid,
        Role:   role,
        RegisteredClaims: jwt.RegisteredClaims{
            ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
            IssuedAt:  jwt.NewNumericDate(now),
        },
    })
    return token.SignedString(app.JWTSecret)
}

func parseJWT(app *App, tokenStr string) (*Claims, error) {
    token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(token *jwt.Token) (interface{}, error) {
        return app.JWTSecret, nil
    })
    if err != nil || !token.Valid {
        return nil, errors.New("invalid token")
    }
    claims, ok := token.Claims.(*Claims)
    if !ok {
        return nil, errors.New("invalid claims")
    }
    return claims, nil
}

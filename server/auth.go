package server

import (
    "net/http"
    "strings"
    "time"

    "github.com/labstack/echo/v4"
)

type loginRequest struct {
    Email    string `json:"email"`
    Password string `json:"password"`
}

func registerAuthRoutes(g *echo.Group) {
    g.POST("/auth/login", handleLogin)
    g.POST("/auth/logout", handleLogout)
    g.GET("/auth/me", requireAuth(handleMe))
}

func handleLogin(c echo.Context) error {
    app := getApp(c)
    var req loginRequest
    if err := c.Bind(&req); err != nil {
        return c.JSON(http.StatusBadRequest, echo.Map{"error": "invalid payload"})
    }

    email := strings.TrimSpace(strings.ToLower(req.Email))
    var u User
    if err := app.DB.Where("email = ?", email).First(&u).Error; err != nil {
        return c.JSON(http.StatusUnauthorized, echo.Map{"error": "invalid credentials"})
    }
    if u.Disabled || !u.CheckPassword(req.Password) {
        return c.JSON(http.StatusUnauthorized, echo.Map{"error": "invalid credentials"})
    }

    token, err := signJWT(app, u.ID, u.Role, 24*time.Hour)
    if err != nil {
        return c.JSON(http.StatusInternalServerError, echo.Map{"error": "auth error"})
    }
    cookie := &http.Cookie{
        Name:     "session",
        Value:    token,
        Path:     "/",
        HttpOnly: true,
        Secure:   false,
        SameSite: http.SameSiteLaxMode,
        Expires:  time.Now().Add(24 * time.Hour),
    }
    c.SetCookie(cookie)
    return c.JSON(http.StatusOK, echo.Map{"ok": true})
}

func handleLogout(c echo.Context) error {
    cookie := &http.Cookie{
        Name:     "session",
        Value:    "",
        Path:     "/",
        HttpOnly: true,
        Secure:   false,
        Expires:  time.Unix(0, 0),
        MaxAge:   -1,
    }
    c.SetCookie(cookie)
    return c.JSON(http.StatusOK, echo.Map{"ok": true})
}

func handleMe(c echo.Context) error {
    u := c.Get("user").(*User)
    return c.JSON(http.StatusOK, echo.Map{
        "id":       u.ID,
        "email":    u.Email,
        "role":     u.Role,
        "disabled": u.Disabled,
        "must_change_password": u.MustChangePassword,
    })
}

func seedAdmin(app *App) error {
    var count int64
    if err := app.DB.Model(&User{}).Count(&count).Error; err != nil {
        return err
    }
    if count > 0 {
        return nil
    }
    // default admin:admin
    seedUser := app.Config.Admin.SeedUser
    if seedUser == "" { seedUser = "admin" }
    seedPass := app.Config.Admin.SeedPassword
    if seedPass == "" { seedPass = "admin" }
    admin := User{Email: seedUser /* username-like */, Role: "admin", MustChangePassword: true}
    if err := admin.SetPassword(seedPass); err != nil {
        return err
    }
    return app.DB.Create(&admin).Error
}

// Middleware
func requireAuth(next echo.HandlerFunc) echo.HandlerFunc {
    return func(c echo.Context) error {
        app := getApp(c)
        cookie, err := c.Cookie("session")
        if err != nil || cookie == nil || cookie.Value == "" {
            return c.JSON(http.StatusUnauthorized, echo.Map{"error": "unauthorized"})
        }
        claims, err := parseJWT(app, cookie.Value)
        if err != nil {
            return c.JSON(http.StatusUnauthorized, echo.Map{"error": "unauthorized"})
        }
        var u User
        if err := app.DB.First(&u, claims.UserID).Error; err != nil {
            return c.JSON(http.StatusUnauthorized, echo.Map{"error": "unauthorized"})
        }
        if u.Disabled {
            return c.JSON(http.StatusForbidden, echo.Map{"error": "account disabled"})
        }
        c.Set("user", &u)
        return next(c)
    }
}

func requireAdmin(next echo.HandlerFunc) echo.HandlerFunc {
    return requireAuth(func(c echo.Context) error {
        u := c.Get("user").(*User)
        if u.Role != "admin" {
            return c.JSON(http.StatusForbidden, echo.Map{"error": "forbidden"})
        }
        return next(c)
    })
}

// If user is admin and must change password, block everything except account/auth endpoints
func blockAdminIfMustChange(next echo.HandlerFunc) echo.HandlerFunc {
    return func(c echo.Context) error {
        u := c.Get("user").(*User)
        if u != nil && u.Role == "admin" && u.MustChangePassword {
            p := c.Request().URL.Path
            if strings.HasPrefix(p, "/api/account") || strings.HasPrefix(p, "/api/auth/") {
                return next(c)
            }
            return c.JSON(http.StatusForbidden, echo.Map{"error": "must_change_password"})
        }
        return next(c)
    }
}

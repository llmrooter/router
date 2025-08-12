package server

import (
    "crypto/rand"
    "encoding/hex"
    "fmt"
    "net/http"
    "strings"

    "github.com/labstack/echo/v4"
    "golang.org/x/crypto/bcrypt"
)

type keyCreateReq struct {
    Name string `json:"name"`
}

type keyCreateResp struct {
    ID    uint   `json:"id"`
    Name  string `json:"name"`
    Value string `json:"value"` // shown once
}

func registerKeyRoutes(g *echo.Group) {
    g.GET("/keys", requireAuth(blockAdminIfMustChange(listMyKeys)))
    g.POST("/keys", requireAuth(blockAdminIfMustChange(createKey)))
    g.DELETE("/keys/:id", requireAuth(blockAdminIfMustChange(deleteKey)))

    ag := g.Group("/admin")
    ag.GET("/users/:id/keys", requireAdmin(blockAdminIfMustChange(adminListUserKeys)))
}

func listMyKeys(c echo.Context) error {
    app := getApp(c)
    u := c.Get("user").(*User)
    var keys []APIKey
    if err := app.DB.Where("user_id = ?", u.ID).Order("id DESC").Find(&keys).Error; err != nil {
        return c.JSON(http.StatusInternalServerError, echo.Map{"error": "db error"})
    }
    for i := range keys {
        keys[i].Hash = ""
    }
    return c.JSON(http.StatusOK, keys)
}

func createKey(c echo.Context) error {
    app := getApp(c)
    u := c.Get("user").(*User)
    var req keyCreateReq
    if err := c.Bind(&req); err != nil {
        return c.JSON(http.StatusBadRequest, echo.Map{"error": "invalid payload"})
    }
    // generate random key
    raw := make([]byte, 24)
    if _, err := rand.Read(raw); err != nil {
        return c.JSON(http.StatusInternalServerError, echo.Map{"error": "rng error"})
    }
    body := hex.EncodeToString(raw)
    prefix := "sk_" + body[:8]
    value := fmt.Sprintf("%s_%s", prefix, body[8:])
    h, _ := bcrypt.GenerateFromPassword([]byte(value), bcrypt.DefaultCost)

    key := APIKey{UserID: u.ID, Name: strings.TrimSpace(req.Name), Prefix: prefix, Hash: string(h)}
    if err := app.DB.Create(&key).Error; err != nil {
        return c.JSON(http.StatusInternalServerError, echo.Map{"error": "db error"})
    }
    return c.JSON(http.StatusCreated, keyCreateResp{ID: key.ID, Name: key.Name, Value: value})
}

func deleteKey(c echo.Context) error {
    app := getApp(c)
    u := c.Get("user").(*User)
    id := c.Param("id")
    // ensure ownership
    if err := app.DB.Where("id = ? AND user_id = ?", id, u.ID).Delete(&APIKey{}).Error; err != nil {
        return c.JSON(http.StatusInternalServerError, echo.Map{"error": "db error"})
    }
    return c.NoContent(http.StatusNoContent)
}

func adminListUserKeys(c echo.Context) error {
    app := getApp(c)
    uid := c.Param("id")
    var keys []APIKey
    if err := app.DB.Where("user_id = ?", uid).Order("id DESC").Find(&keys).Error; err != nil {
        return c.JSON(http.StatusInternalServerError, echo.Map{"error": "db error"})
    }
    for i := range keys {
        keys[i].Hash = ""
    }
    return c.JSON(http.StatusOK, keys)
}

// API key validation for /api/v1 endpoints
func validateAPIKey(app *App, token string) (*User, *APIKey, error) {
    // token like sk_xxx_yyyy
    parts := strings.SplitN(token, "_", 3)
    if len(parts) < 2 {
        return nil, nil, echo.ErrUnauthorized
    }
    prefix := strings.Join(parts[:2], "_") // keep sk_xxx
    var key APIKey
    if err := app.DB.Where("prefix = ?", prefix).First(&key).Error; err != nil {
        return nil, nil, echo.ErrUnauthorized
    }
    if bcrypt.CompareHashAndPassword([]byte(key.Hash), []byte(token)) != nil {
        return nil, nil, echo.ErrUnauthorized
    }
    var user User
    if err := app.DB.First(&user, key.UserID).Error; err != nil {
        return nil, nil, echo.ErrUnauthorized
    }
    if user.Disabled {
        return nil, nil, echo.ErrForbidden
    }
    return &user, &key, nil
}

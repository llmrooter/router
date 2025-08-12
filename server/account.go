package server

import (
    "net/http"
    "strings"

    "github.com/labstack/echo/v4"
)

type accountUpdateReq struct {
    Email           *string `json:"email"`
    CurrentPassword *string `json:"current_password"`
    NewPassword     *string `json:"new_password"`
}

func registerAccountRoutes(g *echo.Group) {
    g.GET("/account", requireAuth(blockAdminIfMustChange(handleAccountGet)))
    g.PUT("/account", requireAuth(blockAdminIfMustChange(handleAccountUpdate)))
}

func handleAccountGet(c echo.Context) error {
    u := c.Get("user").(*User)
    return c.JSON(http.StatusOK, echo.Map{
        "id": u.ID,
        "email": u.Email,
        "role": u.Role,
        "disabled": u.Disabled,
        "must_change_password": u.MustChangePassword,
    })
}

func handleAccountUpdate(c echo.Context) error {
    app := getApp(c)
    u := c.Get("user").(*User)
    var req accountUpdateReq
    if err := c.Bind(&req); err != nil {
        return c.JSON(http.StatusBadRequest, echo.Map{"error": "invalid payload"})
    }
    changed := false
    if req.Email != nil {
        email := strings.TrimSpace(*req.Email)
        if email != "" && email != u.Email {
            u.Email = email
            changed = true
        }
    }
    if req.NewPassword != nil {
        // require current password match (if user has a password)
        if req.CurrentPassword == nil || !u.CheckPassword(*req.CurrentPassword) {
            return c.JSON(http.StatusBadRequest, echo.Map{"error": "current_password_incorrect"})
        }
        if len(*req.NewPassword) < 6 {
            return c.JSON(http.StatusBadRequest, echo.Map{"error": "new_password_too_short"})
        }
        if err := u.SetPassword(*req.NewPassword); err != nil {
            return c.JSON(http.StatusInternalServerError, echo.Map{"error": "hash_error"})
        }
        u.MustChangePassword = false
        changed = true
    }
    if !changed {
        return c.JSON(http.StatusBadRequest, echo.Map{"error": "no_changes"})
    }
    if err := app.DB.Save(u).Error; err != nil {
        return c.JSON(http.StatusInternalServerError, echo.Map{"error": "db_error"})
    }
    return handleAccountGet(c)
}


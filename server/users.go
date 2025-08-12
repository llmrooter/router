package server

import (
    "net/http"

    "github.com/labstack/echo/v4"
)

type userCreateReq struct {
    Email    string `json:"email"`
    Password string `json:"password"`
    Role     string `json:"role"`
}

type userUpdateReq struct {
    Password *string `json:"password"`
    Role     *string `json:"role"`
    Disabled *bool   `json:"disabled"`
}

func registerUserRoutes(g *echo.Group) {
    ag := g.Group("/users")
    ag.GET("", requireAdmin(blockAdminIfMustChange(adminListUsers)))
    ag.POST("", requireAdmin(blockAdminIfMustChange(adminCreateUser)))
    ag.PUT("/:id", requireAdmin(blockAdminIfMustChange(adminUpdateUser)))
    ag.DELETE("/:id", requireAdmin(blockAdminIfMustChange(adminDeleteUser)))
}

func adminListUsers(c echo.Context) error {
    app := getApp(c)
    var users []User
    if err := app.DB.Order("id ASC").Find(&users).Error; err != nil {
        return c.JSON(http.StatusInternalServerError, echo.Map{"error": "db error"})
    }
    for i := range users {
        users[i].PasswordHash = ""
    }
    return c.JSON(http.StatusOK, users)
}

func adminCreateUser(c echo.Context) error {
    app := getApp(c)
    var req userCreateReq
    if err := c.Bind(&req); err != nil || req.Email == "" || req.Password == "" || req.Role == "" {
        return c.JSON(http.StatusBadRequest, echo.Map{"error": "invalid payload"})
    }
    u := User{Email: req.Email, Role: req.Role}
    if err := u.SetPassword(req.Password); err != nil {
        return c.JSON(http.StatusInternalServerError, echo.Map{"error": "hash error"})
    }
    if err := app.DB.Create(&u).Error; err != nil {
        return c.JSON(http.StatusConflict, echo.Map{"error": "email exists"})
    }
    u.PasswordHash = ""
    return c.JSON(http.StatusCreated, u)
}

func adminUpdateUser(c echo.Context) error {
    app := getApp(c)
    id := c.Param("id")
    var u User
    if err := app.DB.First(&u, id).Error; err != nil {
        return c.JSON(http.StatusNotFound, echo.Map{"error": "not found"})
    }
    var req userUpdateReq
    if err := c.Bind(&req); err != nil {
        return c.JSON(http.StatusBadRequest, echo.Map{"error": "invalid payload"})
    }
    if req.Password != nil {
        _ = u.SetPassword(*req.Password)
    }
    if req.Role != nil {
        u.Role = *req.Role
    }
    if req.Disabled != nil {
        u.Disabled = *req.Disabled
    }
    if err := app.DB.Save(&u).Error; err != nil {
        return c.JSON(http.StatusInternalServerError, echo.Map{"error": "db error"})
    }
    u.PasswordHash = ""
    return c.JSON(http.StatusOK, u)
}

func adminDeleteUser(c echo.Context) error {
    app := getApp(c)
    id := c.Param("id")
    if err := app.DB.Delete(&User{}, id).Error; err != nil {
        return c.JSON(http.StatusInternalServerError, echo.Map{"error": "db error"})
    }
    return c.NoContent(http.StatusNoContent)
}

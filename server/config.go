package server

import (
    "errors"
    "io/fs"
    "os"

    "gopkg.in/yaml.v3"
)

type Config struct {
    Server struct {
        Port            string   `yaml:"port"`
        Dev             bool     `yaml:"dev"`
        StaticDir       string   `yaml:"static_dir"`
        JWTSecret       string   `yaml:"jwt_secret"`
        CORSAllowOrigins []string `yaml:"cors_allow_origins"`
    } `yaml:"server"`
    Database struct {
        Driver     string `yaml:"driver"`      // postgres|sqlite
        DSN        string `yaml:"dsn"`         // postgres DSN
        SQLitePath string `yaml:"sqlite_path"` // sqlite file path
    } `yaml:"database"`
    Admin struct {
        SeedUser     string `yaml:"seed_user"`
        SeedPassword string `yaml:"seed_password"`
    } `yaml:"admin"`
}

func defaultConfig() *Config {
    c := &Config{}
    c.Server.Port = "8080"
    c.Server.StaticDir = "client/dist"
    c.Server.JWTSecret = "dev-insecure-secret-change-me"
    c.Database.Driver = ""
    c.Database.SQLitePath = "data/app.db"
    c.Admin.SeedUser = "admin"
    c.Admin.SeedPassword = "admin"
    return c
}

func LoadConfig() (*Config, error) {
    // CONFIG_PATH or default config.yml
    path := os.Getenv("CONFIG_PATH")
    if path == "" {
        path = "config.yml"
    }
    cfg := defaultConfig()
    b, err := os.ReadFile(path)
    if err != nil {
        if errors.Is(err, fs.ErrNotExist) {
            return cfg, nil // no config file is acceptable
        }
        return nil, err
    }
    if err := yaml.Unmarshal(b, cfg); err != nil {
        return nil, err
    }
    return cfg, nil
}


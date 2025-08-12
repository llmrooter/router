package server

import (
    "time"

    "golang.org/x/crypto/bcrypt"
    "gorm.io/gorm"
)

type User struct {
    ID           uint           `gorm:"primaryKey" json:"id"`
    CreatedAt    time.Time      `json:"created_at"`
    UpdatedAt    time.Time      `json:"updated_at"`
    DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
    Email        string         `gorm:"uniqueIndex;size:255" json:"email"`
    PasswordHash string         `json:"-"`
    Role         string         `gorm:"size:32" json:"role"`
    Disabled     bool           `json:"disabled"`
    MustChangePassword bool     `gorm:"default:false" json:"must_change_password"`
    APIKeys      []APIKey       `json:"-"`
}

func (u *User) SetPassword(pw string) error {
    b, err := bcrypt.GenerateFromPassword([]byte(pw), bcrypt.DefaultCost)
    if err != nil {
        return err
    }
    u.PasswordHash = string(b)
    return nil
}

func (u *User) CheckPassword(pw string) bool {
    return bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(pw)) == nil
}

type APIKey struct {
    ID        uint      `gorm:"primaryKey" json:"id"`
    CreatedAt time.Time `json:"created_at"`
    UpdatedAt time.Time `json:"updated_at"`
    UserID    uint      `gorm:"index" json:"user_id"`
    Name      string    `gorm:"size:255" json:"name"`
    Prefix    string    `gorm:"size:24;index" json:"prefix"`
    Hash      string    `json:"-"`
}

type Provider struct {
    ID          uint           `gorm:"primaryKey" json:"id"`
    CreatedAt   time.Time      `json:"created_at"`
    UpdatedAt   time.Time      `json:"updated_at"`
    DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
    Name        string         `gorm:"size:255;uniqueIndex" json:"name"`
    Type        string         `gorm:"size:64" json:"type"` // e.g., "openai"
    BaseURL     string         `gorm:"size:512" json:"base_url"`
    APIKey      string         `gorm:"size:1024" json:"-"` // never expose in API responses
    // PullModels field is removed: models are always pulled at runtime for OpenAI providers.
    Enabled     bool           `json:"enabled"`
    // Models contains only DB-persisted models (for non-runtime providers, if any).
    Models      []ModelEntry   `json:"-"`
    // RuntimeModels contains the list of models pulled at runtime (not persisted; source of truth for OpenAI providers).
    RuntimeModels []string     `gorm:"-" json:"runtime_models,omitempty"`
}

type ModelEntry struct {
    ID          uint           `gorm:"primaryKey" json:"id"`
    CreatedAt   time.Time      `json:"created_at"`
    UpdatedAt   time.Time      `json:"updated_at"`
    DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
    ProviderID  uint           `gorm:"index:provider_model,unique" json:"provider_id"`
    Name        string         `gorm:"size:255;index:provider_model,unique" json:"name"`
    DisplayName string         `gorm:"size:255" json:"display_name"`
    Enabled     bool           `json:"enabled"`
    Pulled      bool           `json:"pulled"` // if true, not editable; for legacy/manual models only
    // Note: For OpenAI providers, models are not persisted in the DB; see Provider.RuntimeModels.
}

type UsageLog struct {
    ID         uint      `gorm:"primaryKey" json:"id"`
    CreatedAt  time.Time `json:"created_at"`
    UserID     uint      `gorm:"index" json:"user_id"`
    APIKeyID   uint      `gorm:"index" json:"api_key_id"`
    ProviderID uint      `gorm:"index" json:"provider_id"`
    Model      string    `gorm:"size:255" json:"model"`
    Status     int       `json:"status"`
    LatencyMs  int64     `json:"latency_ms"`
    TokensIn   int       `json:"tokens_in"`
    TokensOut  int       `json:"tokens_out"`
    Cost       float64   `json:"cost"`
}

func migrate(db *gorm.DB) error {
    return db.AutoMigrate(&User{}, &APIKey{}, &Provider{}, &ModelEntry{}, &UsageLog{})
}

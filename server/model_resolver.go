package server

import "strings"

// resolveQualifiedModel requires the form "provider/model" and returns
// the matched Provider and the raw upstream model id (without provider prefix).
func resolveQualifiedModel(app *App, qualified string) (Provider, string, bool) {
    if !strings.Contains(qualified, "/") {
        return Provider{}, "", false
    }
    parts := strings.SplitN(qualified, "/", 2)
    provName := strings.TrimSpace(parts[0])
    raw := strings.TrimSpace(parts[1])
    if provName == "" || raw == "" {
        return Provider{}, "", false
    }
    // Case-insensitive provider name match to support lowercase IDs
    var providers []Provider
    if err := app.DB.Where("enabled = ?", true).Find(&providers).Error; err != nil {
        return Provider{}, "", false
    }
    provLower := strings.ToLower(provName)
    for _, cand := range providers {
        if strings.ToLower(cand.Name) != provLower {
            continue
        }
        for _, name := range app.GetPulled(cand.ID) {
            if name == raw {
                return cand, raw, true
            }
        }
        // Provider matched but model not found under it
        return Provider{}, "", false
    }
    return Provider{}, "", false
}

> Note: This file was AI-assisted; reviewed but may contain errors. Please submit fixes or open an issue if a typo was made.

# LLMRouter API Reference

This document describes both the administrative JSON API under `/api` and the OpenAI‑compatible API under `/api/v1`.

- Base URL: your server origin, e.g. `https://your-host`.
- All endpoints are JSON over HTTP.
- Time values are ISO 8601 unless otherwise noted.

## Authentication

- Session cookie: Admin/console endpoints under `/api` require a session cookie set by `POST /api/auth/login`.
- API keys: OpenAI‑compatible endpoints under `/api/v1` require `Authorization: Bearer <user_api_key>`.
  - Format for created keys: `sk_xxxxxxxx_yyyyyyyyyyyyyyyyyyyyyyyy`.
  - For `/api/v1`, a valid session cookie may be used as a fallback if present.

## Errors

- Admin endpoints typically return `{ "error": string }` with appropriate HTTP status.
- OpenAI‑compatible endpoints mirror upstream provider status codes and bodies; errors are passed through.

---

## /api (Admin and App API)

### Auth

- POST `/api/auth/login`
  - Auth: none
  - Body: `{ "email": string, "password": string }`
  - Success: `200 { "ok": true }` and sets `session` HttpOnly cookie.
  - Failure: `401 { "error": "invalid credentials" }` or `400` for bad payload.

- POST `/api/auth/logout`
  - Auth: session
  - Success: `200 { "ok": true }` and clears `session` cookie.

- GET `/api/auth/me`
  - Auth: session
  - Success: `200 { "id": number, "email": string, "role": "admin"|"user", "disabled": bool, "must_change_password": bool }`
  - Failure: `401 { "error": "unauthorized" }`

### Account

- GET `/api/account`
  - Auth: session
  - Success: same shape as `GET /api/auth/me`.

- PUT `/api/account`
  - Auth: session
  - Body (any field optional):
    - `email?: string`
    - `current_password?: string` (required when changing password)
    - `new_password?: string` (>= 6 chars)
  - Success: `200` with updated account object.
  - Failure: `400 { "error": "current_password_incorrect" | "new_password_too_short" | "no_changes" | "invalid payload" }`, `500 { "error": "db_error" }`.

### Users (Admin)

- GET `/api/users`
  - Auth: admin session
  - Success: `200` array of users (no `password_hash`).

- POST `/api/users`
  - Auth: admin session
  - Body: `{ "email": string, "password": string, "role": "admin"|"user" }`
  - Success: `201` user object (no `password_hash`).
  - Failure: `409 { "error": "email exists" }`, `400 { "error": "invalid payload" }`.

- PUT `/api/users/:id`
  - Auth: admin session
  - Body (any field optional): `{ "password"?: string, "role"?: string, "disabled"?: boolean }`
  - Success: `200` updated user object (no `password_hash`).
  - Failure: `404 { "error": "not found" }`, `500 { "error": "db error" }`, `400 { "error": "invalid payload" }`.

- DELETE `/api/users/:id`
  - Auth: admin session
  - Success: `204 No Content`

### API Keys

- GET `/api/keys`
  - Auth: session
  - Success: `200` array of keys for current user. Fields: `id`, `created_at`, `updated_at`, `user_id`, `name`, `prefix`.

- POST `/api/keys`
  - Auth: session
  - Body: `{ "name": string }`
  - Success: `201 { "id": number, "name": string, "value": string }` (full key shown only once).

- DELETE `/api/keys/:id`
  - Auth: session (must own the key)
  - Success: `204 No Content`

- GET `/api/admin/users/:id/keys`
  - Auth: admin session
  - Success: `200` array of the user’s keys (no `hash`).

### Providers

- GET `/api/providers`
  - Auth: session
  - Success: `200` array of providers with fields:
    - `id`, `name`, `type` (e.g., `openai`), `base_url`, `enabled`, timestamps
    - `models`: array of legacy/manual `ModelEntry` (if any)
    - `runtime_models`: array of model IDs pulled live from provider (not persisted)

- POST `/api/providers`
  - Auth: admin session
  - Body: `{ "name": string, "type": string, "base_url"?: string, "api_key"?: string, "enabled": boolean }`
  - Notes: `base_url` defaults to `https://api.openai.com/v1`. After creation, models are pulled from provider.
  - Success: `201` provider object.
  - Failure: `409 { "error": "name exists" }`, `400 { "error": "invalid payload" }`.

- GET `/api/providers/:id`
  - Auth: admin session
  - Success: `200` provider object with `runtime_models` populated.
  - Failure: `404 { "error": "not found" }`.

- PUT `/api/providers/:id`
  - Auth: admin session
  - Body: may include `name`, `type`, `base_url`, `api_key` (set only if non-empty), and `enabled`.
  - Side effects: toggling `enabled` refreshes or clears the in‑memory model cache.
  - Success: `200` updated provider object.

- POST `/api/providers/:id/refresh_models`
  - Auth: admin session
  - Effect: Pulls models from provider and refreshes runtime cache.
  - Success: `200` provider object.
  - Failure: `502 { "error": "refresh_failed" }`, `404 { "error": "not found" }`.

- DELETE `/api/providers/:id`
  - Auth: admin session
  - Effect: Deletes provider and any persisted `ModelEntry` rows; clears runtime cache for that provider.
  - Success: `204 No Content`

### Models (Runtime)

- GET `/api/models`
  - Auth: session
  - Success: `200` array of `{ "provider_id": number, "provider_name": string, "name": string }` representing models pulled from all enabled providers. Includes router entries as `{ provider_name: "router", name: "<route>" }`.

### Fallbacks (Admin)

- GET `/api/fallbacks`
  - Auth: admin
  - Returns: all fallback routes with ordered targets.

- POST `/api/fallbacks`
  - Auth: admin
  - Body: `{ name: string, enabled: boolean, targets?: string[] }` where `targets` are qualified `provider/model` strings in priority order.
  - Returns: created route with targets.

- GET `/api/fallbacks/:id`
  - Auth: admin
  - Returns: route with ordered targets.

- PUT `/api/fallbacks/:id`
  - Auth: admin
  - Body: may include `name`, `enabled`, and `targets` (array of qualified `provider/model` that replaces existing and determines new order).

- DELETE `/api/fallbacks/:id`
  - Auth: admin
  - Deletes the route and its targets.

### Stats

- GET `/api/stats/me`
  - Auth: session
  - Success: `200 { "requests": number, "avg_ms": number, "tokens_in": number, "tokens_out": number, "messages": number }`

- GET `/api/admin/stats/user/:id`
  - Auth: admin session
  - Success: same shape as `/api/stats/me` for the specified user.

### Session Chat

- POST `/api/chat`
  - Auth: session
  - Purpose: Convenience non‑OpenAI endpoint that forwards a chat completion request to the selected provider or router fallback.
  - Body: OpenAI Chat Completions‑style payload. Required: `model: string`.
    - Accepts `provider/model` (lowercase provider) or `router/<name>`.
  - Behavior:
    - For `provider/model`: resolves provider and forwards to `{provider.base_url}/chat/completions` with `stream: false`.
    - For `router/<name>`: sequentially tries each configured target; on network/5xx errors it falls back to the next target; 4xx errors are returned immediately.
  - Success: `200` with upstream JSON body; on failure, mirrors upstream status or returns `400 { "error": "unknown model" }`, `502 { "error": "provider error" }`.

---

## /api/v1 (OpenAI‑Compatible)

- Auth: `Authorization: Bearer <user_api_key>` required; valid session cookie is accepted as fallback.
- Model resolution: The `model` must be specified as `provider/model` (provider in lowercase, e.g., `openai/gpt-4.1`) and must exist in the runtime model cache of the named provider; otherwise `400 { "error": "unknown model" }`.

### GET `/api/v1/models`

- Returns: `200 { "object": "list", "data": [{ "id": string, "object": "model", "owned_by": string }, ...] }` where `id` is `provider/model`.

### POST `/api/v1/chat/completions`

- Body: OpenAI Chat Completions JSON payload; required `model: string` in the form `provider/model`.
- Streaming: If `stream: true`, the server relays upstream Server‑Sent Events as they arrive.
- Success: Mirrors upstream provider JSON or event stream.
- Errors: `401 { "error": "unauthorized" }`, `400 { "error": "model required" | "unknown model" }`, or upstream status/body.

### POST `/api/v1/completions`

- Body: OpenAI Completions JSON payload; required `model: string` in the form `provider/model`.
- Success/Errors: Same behavior as chat completions (non‑streaming).

### POST `/api/v1/embeddings`

- Body: OpenAI Embeddings JSON payload; required `model: string` in the form `provider/model`.
- Success/Errors: Mirrors upstream provider response.

---

## Usage Logging

The server records usage for proxied requests, including status, latency, message count, and any reported token usage, keyed to the calling user and API key (when used). These logs power the `/api/stats/*` endpoints.

## Notes

- Providers of type `openai` pull models from `{base_url}/models`. Runtime model lists are cached in‑memory and refreshed at startup and when a provider is created/updated or explicitly refreshed.
- Provider `api_key` values are stored in plaintext in this MVP; consider at‑rest encryption for production.

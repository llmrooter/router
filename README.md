> Note: This file was AI-assisted; reviewed but may contain errors. Please submit fixes or open an issue if a typo was made.

# LLMRouter

Self‑hosted, OpenRouter‑like gateway and admin panel.

## Overview

LLMRouter provides a Go backend and React admin UI for routing OpenAI‑style requests to one or more upstream providers. It exposes an OpenAI‑compatible API for clients and a separate admin/app API for managing users, keys, providers, and basic usage stats.

## APIs

### OpenAI‑Compatible (`/api/v1`)

- Client‑facing API compatible with OpenAI. Use a user API key via `Authorization: Bearer <key>` (a valid session cookie also works). See the [API documentation](docs/api.md) for the full route list, auth rules, request/response shapes, streaming behavior, and error semantics.

### Admin/App (`/api`)

- Administrative and application endpoints used by the UI: authentication, account settings, users, API keys, providers, runtime models, stats, and session chat. Auth uses a session cookie. See the [API documentation](docs/api.md) for endpoint details and payloads.

## Key Features

- OpenAI compatibility with provider routing and optional streaming.
- Providers of type `openai` with configurable `base_url` and `api_key`.
- Runtime model discovery from `{base_url}/models` cached in memory; client-visible model IDs are `provider/model`.
- Admin UI to manage users, keys, providers; view usage stats.
- Usage logging: latency, status, message count, and token usage (if provided by upstream).
- Authentication: session cookies for `/api`, user API keys for `/api/v1`.

## Architecture

- Backend: Go (Echo + GORM) serving the JSON APIs and static admin UI.
- Database: GORM with migrations for `User`, `APIKey`, `Provider`, `ModelEntry`, `UsageLog`.
- Static assets: `client/dist` served with SPA fallback in production.
- Configuration: `config.yml` with environment overrides (`PORT`, `JWT_SECRET`, `DATABASE_URL`, `SQLITE_PATH`, `CONFIG_PATH`).

## Data Model

- `User`: account with role (`admin` or `user`), password hash, flags.
- `APIKey`: per‑user key used for `/api/v1` authorization.
- `Provider`: upstream config (`type`, `base_url`, `api_key`, `enabled`).
- `ModelEntry`: optional legacy/manual entries; runtime models are not persisted.
- `UsageLog`: per‑request metrics (status, latency, messages, tokens).

## Documentation

- API Reference: [docs/api.md](docs/api.md)
- Setup guide: [docs/setup.md](docs/setup.md)
- Configuration (coming soon): [docs/configuration.md](docs/configuration.md)
- Admin UI (coming soon): [docs/admin-ui.md](docs/admin-ui.md)

## Notes & Security

- Provider API keys are stored in plaintext in this MVP; use at‑rest encryption for production.
- CORS: permissive in dev; allowlist configurable for production.
- Model resolution uses the in‑memory list from enabled providers; unknown models return `400`.

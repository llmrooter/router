> Note: This file was AI-assisted; reviewed but may contain errors. Please submit fixes or open an issue if a typo was made.

# Setup Guide

This guide covers local development and production setup for LLMRouter.

## Prerequisites

- Go 1.21+ installed (`go version`).
- Node.js 18+ and npm (`node -v`, `npm -v`) for building the client.
- One of:
  - SQLite (no external service; default file `data/app.db`), or
  - PostgreSQL (have a DSN/URL and network access).

## Repo Layout

- `main.go`: server entrypoint
- `server/`: backend code (Echo + GORM)
- `client/`: React + Vite admin UI
- `docs/`: documentation

## Configuration

The server loads configuration from `config.yml` in the project root (or `CONFIG_PATH`). Environment variables can override select values.

Example `config.yml`:

```yaml
server:
  port: "8080"
  dev: false               # set true in dev to relax checks
  static_dir: client/dist  # SPA build output
  jwt_secret: "change-me"
  cors_allow_origins: ["*"]

database:
  driver: "sqlite"         # "sqlite" or "postgres"
  dsn: ""                   # Postgres DSN if using postgres
  sqlite_path: "data/app.db"

admin:
  seed_user: "admin"
  seed_password: "admin"
```

Environment overrides:

- `PORT`: overrides `server.port`.
- `JWT_SECRET`: overrides `server.jwt_secret`.
- `DATABASE_URL`: Postgres DSN; implies Postgres if set.
- `SQLITE_PATH`: overrides `database.sqlite_path`.
- `CONFIG_PATH`: path to a config file.
- `DEV`: when `true`, enables permissive CORS and allows running without a built client.

## Quick Start (Development)

1) Backend

```bash
# from repo root
export DEV=true                 # relaxes static build check, permissive CORS
export JWT_SECRET=dev-secret    # set your own secret
# optional: choose DB
# export SQLITE_PATH=./data/app.db
# or use Postgres via DATABASE_URL
# export DATABASE_URL=postgres://user:pass@host:5432/dbname?sslmode=disable

go run .
```

The server listens on `:8080` by default and exposes:
- Admin/app API at `/api/*`
- OpenAI‑compatible API at `/api/v1/*`
- Health check at `/healthz`

2) Frontend (admin UI)

```bash
cd client
npm install
npm run dev
```

The Vite dev server runs on its own port. If your dev proxy isn’t configured yet, open the backend’s JSON API directly or build the client for a combined experience.

## Production

1) Build the client

```bash
cd client
npm install
npm run build   # emits client/dist
```

2) Configure the server

- Ensure `config.yml` has production values (strong `jwt_secret`, DB selection, CORS allowlist).
- Make sure `server.static_dir` points to `client/dist` (default).

3) Run the server

```bash
# from repo root
export PORT=8080
# Choose DB via DATABASE_URL (Postgres) or SQLITE_PATH (SQLite)
# export DATABASE_URL=postgres://...
# export SQLITE_PATH=/var/lib/llmrouter/app.db

./llmrouter    # if you built a binary
# or
go build -o llmrouter . && ./llmrouter
```

If `client/dist` is present, the server will serve the SPA with an SPA fallback for unknown routes, alongside the JSON APIs.

## Database Notes

- SQLite: default path `data/app.db` is created automatically; `AutoMigrate` runs on startup for all models.
- Postgres: set `database.driver: postgres` and `database.dsn`, or just set `DATABASE_URL` env. Connection pool defaults are tuned conservatively.

> Postgres has not been tested as much as SQLite, this is planned and is in the [TODO.md](../TODO.md)

## Auth and First Login

- On first boot, an admin user is seeded using `admin.seed_user` / `admin.seed_password` (defaults: `admin` / `admin`). You will be prompted to change the password via the UI/API.
- Session cookie is established with `POST /api/auth/login`.
- Create user API keys under “API Keys” to call `/api/v1/*` with `Authorization: Bearer <key>`.

## Providers and Models

- Add a provider of type `openai` with `base_url` (defaults to `https://api.openai.com/v1`) and an upstream API key.
- Models are pulled from `{base_url}/models` at startup and when creating/updating/refreshing a provider. Pulled model IDs are cached in memory (not persisted).

## Streaming

- Chat Completions (`POST /api/v1/chat/completions`) supports `stream: true`; the server relays SSE from the upstream provider.
- Other endpoints are proxied non‑streaming.

## CORS

- Dev mode (`DEV=true` or `server.dev: true`): permissive CORS.
- Production: configure `server.cors_allow_origins` to an allowlist (e.g., your UI origin).

## Health Check

- `GET /healthz` returns `200 OK` and `ok` body when the server is healthy.

## Troubleshooting

- “client build missing”: Build the client (`npm run build`) or set `DEV=true` / `server.dev: true`.
- Unauthorized (`401`): Ensure you’re sending the session cookie for `/api` or a user API key for `/api/v1`.
- Unknown model (`400`): Ensure the model exists in the runtime list for an enabled provider; use the admin UI or `GET /api/models` to verify.
- Database connection errors: verify `DATABASE_URL` or `SQLITE_PATH` and permissions.

## Reference

- API details: see [docs/api.md](./api.md).
- Configuration fields: see example `config.yml` above and in‑code defaults in `server/config.go`.

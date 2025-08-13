# Changelog

All notable changes to this project will be documented in this file.

## 2025-08-13

- Changed: Model IDs are now represented as `provider/model` everywhere (OpenAI-compatible endpoints and UI). The provider segment is always lowercase (e.g., `openai/gpt-4.1`).
- Changed: OpenAI-compatible requests must specify `model` in the form `provider/model`. The server resolves the provider by name (case-insensitive) and forwards the raw upstream model ID to the provider.
- Changed: `/api/v1/models` now lists qualified model IDs (`provider/model`).
- Changed: Admin Chat `/api/chat` also expects `provider/model`.
- Updated: Admin UI model picker and copy actions now use qualified, lowercase provider IDs.
- Docs: Updated README and API docs to reflect the new model ID format.

- Added: Router fallback models. Admins can create `router/<name>` routes backed by an ordered list of provider targets.
- Added: New admin endpoints under `/api/fallbacks` to manage routes (list/create/update/delete), with targets specified as qualified `provider/model` IDs.
- Added: OpenAI-compatible endpoints accept `router/<name>` for the `model` parameter and will sequentially try configured targets, falling back on network errors or 5xx responses.
- Added: UI page at `/models/fallback` to create and manage fallback routes, add targets, and change priority via Up/Down actions.

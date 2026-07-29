# wiki-backend template

Shared backend proxy template (agent-ops issue #286) that every app wiki
gets one deployed instance of. Its only job is to let the frontend's
Sandbox ("Try it") panel call the real target API without hitting CORS: the
browser POSTs to this server's `/api/proxy` (same-origin or an explicitly
CORS-allowed origin relative to the deployed wiki-site), which forwards the
request server-side to `TARGET_API_BASE_URL`, attaching whatever auth
header(s) the user typed into the sandbox at QA time.

## Why Node/Express instead of porting OrderMate's FastAPI backend

OrderMate's `docs/backend` (FastAPI) was read as the closest existing
precedent and is architecturally almost identical - a `POST /api/proxy/request`
that forwards to a fixed upstream base URL with an injected `Authorization`
header. Two things argued for a Node/Express port instead of vendoring the
Python app directly as the shared template:

1. Every other piece of this generator (the extractors, the driver, the
   frontend template) is JS/TS/Node - a single reusable-workflow runner
   (`actions/setup-node`, no separate Python toolchain/venv) keeps the CI
   surface for `.github/workflows/wiki-generate-reusable.yml` minimal.
2. OrderMate's backend also ships `app/routes/mock.py`, a few hundred lines
   of Clover-specific mock-data generators (fake orders/customers/payments).
   That's real, useful functionality for OrderMate specifically, but it's
   app-specific business logic, not something a *shared* template can carry
   generically for BusyBuddy_v2 or a future repo's completely different API
   shape - porting it here would have meant either dragging Clover-shaped
   mocks into every wiki or inventing a generic mock-schema DSL, which is
   more than issue #286 asks for ("a proxy endpoint, not a full mock
   framework"). It is intentionally left out.

The proxy behavior itself (single forwarding endpoint, auth header
passthrough, fixed server-side upstream base URL) is a faithful port of
OrderMate's `proxy.py` semantics.

## Endpoints

- `GET /health` - liveness check.
- `POST /api/proxy` - `{ method, path, headers?, body? }` -> forwards to
  `TARGET_API_BASE_URL + path`, returns `{ status, body }`. See
  `src/routes/proxy.js` for the full contract and safety notes (fixed
  server-side target, not client-suppliable - this is not an open proxy).

## Configuration

Copy `.env.example` to `.env` (or set the equivalent deployment secrets):
`PORT`, `TARGET_API_BASE_URL`, `ALLOWED_ORIGINS`. `TARGET_API_BASE_URL`
should match the consuming repo's `wiki.config.yaml` →
`backend.targetApiBaseUrl`, and the deployed URL of this service should
match that same config's `backend.proxyBaseUrl`.

## Local development

```bash
npm install
cp .env.example .env   # then edit TARGET_API_BASE_URL
npm run dev
```

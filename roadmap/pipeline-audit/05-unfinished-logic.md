# T5 — Unfinished Pipeline Logic (agent-ops #30)

All incomplete/broken/dead/undocumented pipeline work, each classified
**finish / fix / consolidate / replace / delete**. Feeds Epic 11 / Ticket 45 (final plan).

## agent-ops

| Item | Kind | File | Class |
|---|---|---|---|
| `dev-pipeline-reusable.yml` referenced by registry + roadmap + skills but **not present** in this repo (lives in each app repo / the npm engine) | undocumented | `orchestrator/src/registry/pipelines.yaml`, `roadmap/multi-pipeline-agent-strategy.md` | **consolidate** — reconcile roadmap vs reality; document that it isn't local |
| deploy-litellm forwards only `GEMINI_API_KEY`/`MASTER_KEY`/`DATABASE_URL`; config aliases need `ANTHROPIC_API_KEY` (documentation), `OPENAI_API_KEY` (fallback), ollama (classification) | incomplete_integration | `.github/workflows/deploy-litellm.yml` vs `litellm/config.yaml` | **fix** — `author_content` wiki runs, fallback, classification are dead in prod |
| planning/implementation aliases pinned to `gemini-2.5-flash` (not pro/opus); Claude aliases commented out awaiting key/quota | todo | `litellm/config.yaml` | **finish** — degraded model quality; explicit "revert once billing upgraded" TODO |
| ordermate-dev coverage gate `jacoco`/`desired_coverage=40` but OrderMate has no jacoco plugin | incomplete_integration | `orchestrator/src/registry/pipelines.yaml` | **fix** — gate cannot run until jacoco added to OrderMate |
| Plane integration is an empty placeholder (`export {};`) | placeholder | `orchestrator/src/integrations/plane.ts` | **finish** (only if Plane adopted) |
| the-store append is fail-open when `THE_STORE_*` unset; CSV append not atomic under concurrency | incomplete_integration | `orchestrator/src/integrations/the_store.ts` | **finish** — ties to Epic 8 |
| deploy-docs needs a one-time manual Pages "Source: GitHub Actions" toggle | undocumented | `.github/workflows/deploy-docs.yml` | **finish** — document as prerequisite |
| No automated tests for orchestrator/scripts; no committed REST collection | test-coverage-missing | `orchestrator/package.json`, `scripts/package.json` | **finish** — ties to T4 / Ticket 19 |

## BusyBuddy_v2

| Item | Kind | File | Class |
|---|---|---|---|
| `openhands.yml.legacy` retired workflow kept in repo | disabled workflow | `.github/workflows/openhands.yml.legacy` | **delete** → Epic 3 |
| OpenHands Postman collection + environment + README for retired pipeline | stale tooling | `postman/OpenHands_Automations.postman_collection.json` (+ env, README) | **delete** → Epic 3/Ticket 9 |
| README legacy setup block still creates `ready-to-implement-legacy` label + lists retired secrets/automation ID | stale docs | `README.md` (AI Agent Automation §) | **consolidate** → Epic 3 |
| `dev-pipeline.yml` uses `HeyItsChloe/pipeline-orchestrator` but README/AGENTS.md say "orchestrated from HeyItsChloe/agent-ops" (3 different owners across the stack) | doc/impl inconsistency | `dev-pipeline.yml` vs README/AGENTS.md | **fix** → Epic 2/Epic 5 |
| `wiki-generate.yml` sets `author_content:true` but `wiki.config.yaml` note says authoring is off (LiteLLM 500/503) | config inconsistency | `wiki-generate.yml` vs `wiki.config.yaml` | **fix** |
| `resolve-demo-images.yml` runs but never commits results (unlike fetch) | possibly-incomplete workflow | `.github/workflows/resolve-demo-images.yml` | **finish** — confirm dry-run vs missing persistence |
| `scripts/generate-changelog.mjs` + `.changelog-state.json` not wired to any workflow | orphaned automation | `scripts/generate-changelog.mjs` | **finish** — wire into CI/wiki or mark manual-by-design |

## OrderMate

| Item | Kind | File | Class |
|---|---|---|---|
| Weekly Report cron (Issue #94) never built | unimplemented pipeline | `WEBHOOK_CRON_IMPLEMENTATION.md §4` (target `functions/src/cron/weeklyReport.ts` absent) | **finish** (or fold into Epic 6/9) |
| Mailchimp lifecycle email never built | unimplemented pipeline | `WEBHOOK_CRON_IMPLEMENTATION.md §5` | **finish** — overlaps Epic 6 (shared email); prefer **consolidate** onto the shared email pipeline |
| `events[].processed` flag written `false`, never consumed | dead field / orphaned data | `functions/src/webhooks/cloverWebhook.ts` | **finish** — gates the never-built email step |
| `merchantInfo` name/email/storeName always blank (no Web REST client for token) | known limitation / stub | `cloverWebhook.ts handleInstall` | **fix** (needs on-device CloverAuth) |
| Non-Apps webhook categories (Orders/Payments/Refunds…) logged then dropped | partial handler | `cloverWebhook.ts handleCloverWebhookEvent` | **finish** — weekly report references refunds/discounts never captured |
| **No GitHub Actions / CI at all** (no `.github/`); Android `androidTest` deps present but never run | missing pipeline | repo root | **finish** → Epic 4/Ticket 12 (Android CI/E2E) |
| Hardcoded release keystore + passwords committed (`123456`, `Cert` at root) | security smell | `app/build.gradle.kts`, `/Cert` | **fix** — relevant to any future automated build/release |

## Cross-cutting classification summary
- **delete:** OpenHands workflow + Postman collection + labels + README block (Epic 3).
- **fix:** LiteLLM key forwarding, ordermate-dev jacoco gate, doc/owner inconsistencies, wiki `author_content` mismatch, OrderMate merchantInfo/keystore.
- **finish:** OrderMate CI (greenfield), orchestrator tests + REST collection, LiteLLM model pinning, the-store persistence, resolve-demo-images persistence, changelog wiring.
- **consolidate:** OrderMate Mailchimp/weekly-report onto the shared email pipeline (Epic 6); reconcile `dev-pipeline-reusable.yml` documentation.
- **replace:** none identified (OpenHands is *delete*, already replaced by dev-pipeline).

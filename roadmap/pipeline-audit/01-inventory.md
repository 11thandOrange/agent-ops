# T1 — Pipeline Inventory (agent-ops #26)

Every pipeline across the three repos with the 12 required fields. Master table first,
then per-pipeline detail. Reusability class: `repo-specific` / `shared` / `duplicated` / `should-be-reusable`.

## Master table

| # | Pipeline | Repo | Implementation | Entry point / file | Status | Reusability |
|---|---|---|---|---|---|---|
| 1 | deploy-orchestrator | agent-ops | GH Actions → Cloud Run | `.github/workflows/deploy-orchestrator.yml` | active | repo-specific |
| 2 | deploy-litellm | agent-ops | GH Actions → Cloud Run | `.github/workflows/deploy-litellm.yml` | partial | repo-specific |
| 3 | deploy-docs | agent-ops | GH Actions → Pages | `.github/workflows/deploy-docs.yml` | active | repo-specific |
| 4 | sync-upstream | agent-ops | GH Actions (cron) | `.github/workflows/sync-upstream.yml` | active | repo-specific (fork infra) |
| 5 | e2e-pipeline-reusable | agent-ops | `workflow_call` | `.github/workflows/e2e-pipeline-reusable.yml` | active | **shared** |
| 6 | wiki-generate-reusable | agent-ops | `workflow_call` | `.github/workflows/wiki-generate-reusable.yml` | partial | **shared** |
| 7 | busybuddy-dev (dev-ticket) | agent-ops (registry) | orchestrator → `repository_dispatch` | `orchestrator/src/registry/pipelines.yaml` | active | shared (engine) |
| 8 | ordermate-dev (dev-ticket) | agent-ops (registry) | orchestrator → `repository_dispatch` | `orchestrator/src/registry/pipelines.yaml` | partial | shared (engine) |
| 9 | resume-job-applier (job-search) | agent-ops (orchestrator) | in-process Cloud Run | `orchestrator/src/handlers/job_search_pipeline.ts` | active | repo-specific (personal) |
| 10 | Install, Test & Build (CI) | BusyBuddy_v2 | GH Actions | `.github/workflows/ci.yml` | active | repo-specific |
| 11 | Deploy to Production | BusyBuddy_v2 | GH Actions (self-hosted) | `.github/workflows/deploy.yml` | active | repo-specific |
| 12 | dev-pipeline (Claude Code) | BusyBuddy_v2 | thin caller → external reusable | `.github/workflows/dev-pipeline.yml` | active | shared |
| 13 | e2e-pipeline | BusyBuddy_v2 | thin caller → agent-ops reusable | `.github/workflows/e2e-pipeline.yml` | active | shared |
| 14 | wiki-generate | BusyBuddy_v2 | thin caller → agent-ops reusable | `.github/workflows/wiki-generate.yml` | active | shared |
| 15 | Fetch Demo Store Images | BusyBuddy_v2 | GH Actions + Node (Unsplash) | `.github/workflows/fetch-demo-images.yml` | active | repo-specific |
| 16 | Resolve Demo Store Images | BusyBuddy_v2 | GH Actions + Node | `.github/workflows/resolve-demo-images.yml` | active (incomplete) | repo-specific |
| 17 | Inspect Demo Store Theme | BusyBuddy_v2 | GH Actions + Node (Shopify Admin) | `.github/workflows/inspect-demo-theme.yml` | active | repo-specific |
| 18 | Seed Demo Store | BusyBuddy_v2 | GH Actions + Node (Shopify Admin) | `.github/workflows/seed-demo-store.yml` | active | repo-specific |
| 19 | Record Demo Videos | BusyBuddy_v2 | GH Actions (Playwright) | `.github/workflows/record-demos.yml` | active | repo-specific |
| 20 | OpenHands Issue Automation | BusyBuddy_v2 | GH Actions (curl → OpenHands Cloud) | `.github/workflows/openhands.yml.legacy` | **dead** | repo-specific (legacy) |
| 21 | cloverWebhook | OrderMate | Firebase Cloud Function (HTTP) | `functions/src/webhooks/cloverWebhook.ts` | active | repo-specific |
| 22 | Weekly Report Cron | OrderMate | design-only | `WEBHOOK_CRON_IMPLEMENTATION.md §4` | **dead/planned** | repo-specific |
| 23 | Mailchimp Email | OrderMate | design-only | `WEBHOOK_CRON_IMPLEMENTATION.md §5` | **dead/planned** | repo-specific |
| 24 | OrderMate API QA harness | OrderMate | Postman collection (manual) | `postman/OrderMate_API.postman_collection.json` | active (manual) | repo-specific |

> **OrderMate has no GitHub Actions.** Its Android Gradle build (`app/build.gradle.kts`, compileSdk 34) is **not** run in any CI; `androidTest` deps (espresso 3.5.1) exist but nothing executes them.

## Availability / shared / duplicated / gaps

- **Shared, agent-ops-hosted:** `e2e-pipeline-reusable`, `wiki-generate-reusable` (via `templates/e2e-pipeline-caller.yml`, `templates/wiki-caller.yml`). **Consumed by BusyBuddy only. OrderMate consumes neither.**
- **Shared, external engine:** dev-ticket pipeline via `@heyitschloe/pipeline-orchestrator` → `dev-pipeline-reusable.yml`. Wired in BusyBuddy (#12); registry entry exists for OrderMate (#8) but OrderMate has no `dev-pipeline-reusable.yml` workflow and no jacoco, so it's **partial**.
- **Duplicated / repo-specific-that-could-be-shared:** BusyBuddy's `ci.yml` (install+vitest+build) is repo-specific with no shared equivalent; there is **no reusable CI workflow** yet (Epic 4/Ticket 10 target). Demo-store workflows (#15–#19) are BusyBuddy-only and legitimately repo-specific.
- **Repo-specific by nature:** `deploy-*` (agent-ops services), `sync-upstream` (fork infra), `resume-job-applier` (personal), `cloverWebhook` (Clover/Firebase).
- **Missing everywhere:** a shared **email** pipeline (Epic 6 — greenfield), an **Android CI/E2E** consumer (Epic 4/Ticket 12), a **payment-processor crawler** (Epic 7 — greenfield; reuse candidate = agent-ops `discovery/`).

## Selected per-pipeline detail (fields beyond the table)

**deploy-orchestrator (agent-ops)** — Purpose: deploy the orchestrator Express/Cloud Run service. Inputs: none (dispatch). Outputs: Cloud Run `orchestrator` (project `agent-ops-501120`, allow-unauthenticated). Deps: `google-github-actions/auth@v2`, `setup-gcloud@v2`, `@heyitschloe/pipeline-orchestrator`. Secrets: `GCP_SA_KEY`, `ORCHESTRATOR_SHARED_SECRET`, `GH_APP_*`, `LITELLM_*`, `JSEARCH_*`, `SERPAPI_API_KEY`, `ANTHROPIC_API_KEY`, `THE_STORE_*`, `APPLICANT_*`.

**e2e-pipeline-reusable (agent-ops)** — Inputs: `working_directory`(req), `install_command`, `test_command`(req), `needs_emulator`, `emulator_api_level`(30), `record_video`, `coverage_manifest_path`, `node_version`(22). Outputs: `e2e-test-results` + `e2e-test-video` artifacts, PR comment, coverage-gate pass/fail (`scripts/check-flow-coverage.mjs`). The `needs_emulator` branch is the sole Android divergence.

**wiki-generate-reusable (agent-ops)** — Inputs: `site_dir`(docs), `config_path`(wiki.config.yaml), `control_repo`(HeyItsChloe/agent-ops), `control_repo_ref`(main), `author_content`(false). Status **partial**: `author_content=true` depends on the LiteLLM `documentation` alias, which has no working backend on the deployed gateway (see T5).

**resume-job-applier (agent-ops)** — In-process personal pipeline: source posting → draft resume/cover-letter + answers via LiteLLM → render PDFs → dedupe/append to `the-store` CSV. Never submits a form. REST via `POST /trigger` (kind `personal`) + 3 extension routes. Reuse candidate for Epic 7 discovery.

**cloverWebhook (OrderMate)** — Firebase Gen-2 Function. Inputs: Clover lifecycle POST `{appId,merchants:{...}}`, verification handshake, GET health. Outputs: Firebase RTDB `merchants/{id}/…` + event log. Secret: `CLOVER_AUTH_CODE`. Real Jest tests (`cloverWebhook.test.ts`). Deployed manually via `firebase deploy`.

**OpenHands (BusyBuddy_v2, dead)** — GH Actions driving OpenHands Cloud REST (`app.all-hands.dev/api/automation/v1/conversations`) via curl on `issues.labeled`. Now neutralized (`.yml.legacy` + `if:false`); superseded by `dev-pipeline.yml`. Companion Postman collection retired. → Epic 3.

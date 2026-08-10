# T2 — Automation / Trigger Map (agent-ops #27)

For every pipeline: how it is invoked, and the `Trigger → GitHub Action → Pipeline → Inputs → Result` chain.

## agent-ops

| Pipeline | Invocation type(s) | Chain |
|---|---|---|
| deploy-orchestrator | `push`(main, `orchestrator/**`), `workflow_dispatch` | push/dispatch → deploy-orchestrator.yml → `gcloud run deploy` → live Cloud Run `orchestrator` |
| deploy-litellm | `push`(main, `litellm/**`), `workflow_dispatch` | push/dispatch → deploy-litellm.yml → `gcloud run deploy litellm-gateway` |
| deploy-docs | `push`(main, `agent-ops-docs/**`), `workflow_dispatch` | push/dispatch → deploy-docs.yml → build → deploy-pages (github-pages env, main-only) |
| sync-upstream | **`schedule` `0 9 * * *`**, `workflow_dispatch` | cron → mint upstream App token → fetch upstream/main → `git merge` → push main **or** open conflict PR |
| e2e-pipeline-reusable | `workflow_call` (from app-repo PR/dispatch) | app PR → caller → `uses: …e2e-pipeline-reusable.yml@main` → tests + coverage check + artifacts + PR comment |
| wiki-generate-reusable | `workflow_call` (from app-repo push/dispatch) | app push → caller → `uses: …wiki-generate-reusable.yml@main` → wiki-generate.mjs → commit → build → deploy Pages |
| busybuddy-dev | `issue_label`, `issue_comment` mention, `repository_dispatch`, `rest_api` (`POST /trigger`) | label `approach-ready`/`approved` **or** `@dev-agent plan/implement` **or** `POST /trigger` → orchestrator `/webhook/github`\|`/trigger` → `repository_dispatch` → BusyBuddy `dev-pipeline-reusable.yml` → plan/implement → PR |
| ordermate-dev | same as busybuddy-dev, targeting OrderMate | … → `repository_dispatch` → OrderMate `dev-pipeline-reusable.yml` (**not present** → partial) |
| resume-job-applier | `rest_api` (`POST /trigger` kind `personal`), chat tool, extension routes | `POST /trigger`\|chat → job-search handler → discover → draft (LiteLLM) → render PDF → append the-store → package returned |

## BusyBuddy_v2

| Pipeline | Invocation type(s) | Chain |
|---|---|---|
| ci.yml | `pull_request`(main) | PR → ci.yml → install+vitest+build → check + coverage artifact |
| deploy.yml | `push`(main), `workflow_dispatch` | push/dispatch → deploy.yml (self-hosted) → git reset+build+`pm2 restart` → write `shopify.app.toml` from secret → `shopify app deploy` |
| dev-pipeline.yml | `issues.labeled`, `issue_comment.created`, `repository_dispatch`(agent-trigger) | label/mention/dispatch → dev-pipeline.yml → resolve plan\|implement → `uses: HeyItsChloe/pipeline-orchestrator/.github/workflows/dev-pipeline-reusable.yml@main` → Claude Code → PR |
| e2e-pipeline.yml | `pull_request`(main), `workflow_dispatch` | PR → e2e-pipeline.yml → `uses: 11thandOrange/agent-ops/…e2e-pipeline-reusable.yml@main` → Playwright (bogo-shopify-app) → coverage manifest |
| wiki-generate.yml | `push`(main, matched paths), `workflow_dispatch` | push → wiki-generate.yml → `uses: 11thandOrange/agent-ops/…wiki-generate-reusable.yml@main` → generate → commit → deploy Pages |
| fetch-demo-images.yml | `workflow_dispatch` | dispatch → fetch-images.mjs (Unsplash API) → commit images.json |
| resolve-demo-images.yml | `workflow_dispatch` | dispatch → resolve-images.mjs → **(no commit step — output to log only)** |
| inspect-demo-theme.yml | `workflow_dispatch` (`store_domain`) | dispatch → inspect-theme.mjs → Shopify Admin API |
| seed-demo-store.yml | `workflow_dispatch` (`store_domain`) | dispatch → seed.mjs + check-images.mjs → Shopify Admin API |
| record-demos.yml | `workflow_dispatch` (`store_domain`,`admin_url`,…) | dispatch → restore auth from secret → Playwright → commit videos/traces |
| openhands.yml.legacy | **none** (`.legacy` ext + `if:false`) | retired; formerly `issues.labeled` → OpenHands Cloud REST |

## OrderMate

| Pipeline | Invocation type(s) | Chain |
|---|---|---|
| cloverWebhook | external webhook (Clover POST), manual curl/Postman | merchant install/uninstall/plan-change → Clover POSTs `…/cloverWebhook` → auth check → handler → Firebase RTDB + event log |
| Weekly Report Cron | `schedule` (planned `0 9 * * 1`) | **not implemented** — design doc only |
| Mailchimp Email | event-driven (planned) | **not implemented** — `events[].processed` flag written but never consumed |
| OrderMate API QA | manual (Postman) | import collection → set vars → run vs Firebase RTDB REST + cloverWebhook |

## Observations
- **Only one scheduled pipeline is live org-wide:** agent-ops `sync-upstream` (`0 9 * * *`). OrderMate's daily crawler cron (Epic 7/Ticket 26) and weekly-report cron do not exist yet.
- **Label/mention/dispatch/REST all converge** on the orchestrator for the dev pipeline — the trigger fan-in is centralized in the engine, not the app repos.
- **OrderMate is not reachable by any GitHub-Actions trigger** — it has no workflows; all its automation is external (Clover) or manual (Postman).

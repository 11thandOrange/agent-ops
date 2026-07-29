# orchestrator

This deployment's bootstrap — not the engine itself. The generic engine
(trigger handling, registry loading, GitHub App auth, MCP server) is the
public package [`@heyitschloe/pipeline-orchestrator`](https://www.npmjs.com/package/@heyitschloe/pipeline-orchestrator).
This directory is a thin `src/index.ts` that imports it, registers two
pipeline handlers, and boots one server.

## What runs here

- **`dev-ticket-pipeline`** (shipped by the package) — registered for
  `busybuddy-dev`: ticket → plan → human approval → implement → PR →
  coverage/quality gate, dispatched against `11thandOrange/BusyBuddy_v2`'s
  own GitHub Actions run.
- **`job-search-pipeline`** (`src/handlers/job_search_pipeline.ts`, private
  to this repo) — registered for `resume-job-applier`: sources a job
  posting, drafts a tailored resume/cover letter, and logs the result. Never
  submits a form itself.

Both pipelines are entries in `src/registry/pipelines.yaml` — see the
package's README for the registry format. Skills for both live in
`skills/` at this repo's root (`skills/shared/dev/` for dev-shaped
pipelines, matched by `applies_to` tag; `skills/personal/` for
`job-search-pipeline`, referenced by an explicit `skill_path`).

Two Chrome-extension endpoints (`/personal-projects/:project/applications`,
`/personal-projects/:project/applicant-profile`, `/personal-projects/:project/generate-answer`)
are mounted directly on the Express app the engine returns, gated on
`EXTENSION_API_KEY` being set — these are this deployment's own HTTP
surface, not part of the engine's generic trigger layer.

## Setup

```sh
npm install
cp .env.example .env   # fill in — see comments in .env.example for each var
npm run dev
```

Required: `ORCHESTRATOR_SHARED_SECRET`, `GH_APP_ID`, `GH_APP_PRIVATE_KEY`,
`GH_WEBHOOK_SECRET`, `GH_APP_INSTALLATION_ID` (org install, dev-ticket
dispatch), `GH_APP_INSTALLATION_ID_PERSONAL` (personal-account install,
job-search pipeline's own skill fetch + the-store append), `LITELLM_PROXY_URL`,
`LITELLM_VIRTUAL_KEY`. Everything else in `.env.example` is optional and
feature-gated by presence (job-search sourcing providers, the-store,
applicant profile, the extension endpoints).

## Deploy

`Dockerfile` — standard multi-stage build: compiles this repo's TypeScript,
then a lean production stage installs only production dependencies
(`@heyitschloe/pipeline-orchestrator` ships pre-built from npm, so no
build step runs for it at install time).

`.github/workflows/deploy-orchestrator.yml` deploys to Cloud Run
(`agent-ops-501120`, `us-central1`) on push to `main` touching
`orchestrator/**`, or manual dispatch.

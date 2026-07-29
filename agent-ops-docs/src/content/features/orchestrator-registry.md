---
title: Orchestrator Pipeline Registry
order: 7
summary: A single YAML registry where each pipeline is one entry, run by the pipeline-orchestrator engine; adding a pipeline needs no engine code.
status: stable
implements:
  workflows: [deploy-orchestrator]
  skills: []
  dependencies: ["@heyitschloe/pipeline-orchestrator", "express", "zod"]
  integrations: [github-app, cloud-run, github-actions]
runWith:
  - "Runs as an Express service (orchestrator/src/index.ts) deployed to Cloud Run via deploy-orchestrator.yml; locally via npm run dev."
tradeoffs:
  - "Pipelines are declared as data in one registry file rather than encoded in the engine, so onboarding a project is a new YAML entry instead of a code change."
notes:
  - kind: tip
    body: "Set an entry's execution.kind to github-actions to dispatch a reusable workflow in the target repo, or in-process to run inside the orchestrator."
---

## What it does
The orchestrator runs agent-ops's pipelines from a single unified registry, `orchestrator/src/registry/pipelines.yaml`, with one entry per pipeline. Each entry names a handler, a skill path, an execution mode, triggers, and params. The generic engine — trigger handling, registry loading, GitHub App auth — comes from the published npm package `@heyitschloe/pipeline-orchestrator` (^0.1.0); this deployment is a thin bootstrap that registers handlers and boots one server. Adding a pipeline means adding a registry entry, not writing engine code.

## How it works
`orchestrator/src/index.ts` is an Express service that imports the engine, registers two pipeline handlers — `dev-ticket-pipeline` (shipped by the package) and `job-search-pipeline` (private to this repo) — and starts the server. Registry entries pick one of two execution kinds: `github-actions`, which dispatches a reusable workflow in the target repo (e.g. `dev-pipeline-reusable.yml` against `11thandOrange/BusyBuddy_v2`), or `in-process`, which runs inside the orchestrator (the `resume-job-applier` job-search pipeline). The service authenticates to GitHub as a GitHub App via `orchestrator/src/integrations/github.ts` (signing App JWTs with `jsonwebtoken`). Each entry's `triggers` map issue labels, mentions, chat tools, or HTTP kinds to pipeline stages.

## Configuration & running
Pipelines are configured entirely in `orchestrator/src/registry/pipelines.yaml`: `name`, `handler`, `skill_path`, `execution`, `triggers`, and `params`. Locally, `npm install` then `npm run dev` (tsx watch) after copying `.env.example` to `.env` — required vars include the shared secret, GitHub App id/key/installation ids, and the LiteLLM proxy URL and key. In production, `.github/workflows/deploy-orchestrator.yml` builds the multi-stage Dockerfile and deploys to Cloud Run (`agent-ops-501120`, `us-central1`) on pushes to `main` touching `orchestrator/**`, or via manual dispatch. Dependencies include `@heyitschloe/pipeline-orchestrator`, `express`, and `zod`.

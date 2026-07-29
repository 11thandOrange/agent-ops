---
title: Deploys
order: 6
summary: Three GitHub Actions workflows that ship the orchestrator and LiteLLM gateway to Cloud Run and publish the docs site to GitHub Pages.
status: stable
implements:
  workflows: [deploy-orchestrator, deploy-litellm, deploy-docs]
  skills: []
  dependencies: []
  integrations: [cloud-run, github-actions, litellm]
runWith:
  - "Each workflow runs on a push to main touching its own path (orchestrator/, litellm/, or agent-ops-docs/) or on manual workflow_dispatch from the Actions tab."
tradeoffs:
  - "gcloud run deploy --env-vars-file replaces a service's env vars on every deploy, so optional secrets are omitted entirely when unset rather than forwarded as empty strings that would defeat the server's own defaults."
notes:
  - kind: warning
    body: "deploy-docs requires a one-time manual setup: repo Settings -> Pages -> Source must be set to \"GitHub Actions\", which no tool in this session can toggle."
  - kind: note
    body: "The orchestrator service runs with 2Gi memory and a 900s timeout to accommodate headless Chromium scraping and fully synchronous multi-candidate requests."
---

## What it does
agent-ops ships three deploy workflows in `.github/workflows/`, one per deployable surface. `deploy-orchestrator.yml` builds and deploys the Express orchestrator to Google Cloud Run. `deploy-litellm.yml` deploys the LiteLLM gateway to Cloud Run. `deploy-docs.yml` builds the `agent-ops-docs/` site and publishes it to GitHub Pages. Each is driven entirely by GitHub Secrets, so no credential is ever pasted into chat or committed to the repo.

## How it works
All three trigger on a push to `main` scoped to their own path — `orchestrator/**`, `litellm/**`, or `agent-ops-docs/**` — and also accept a manual `workflow_dispatch`. The two Cloud Run workflows authenticate with `GCP_SA_KEY` via `google-github-actions/auth`, build an env-vars YAML file, and run `gcloud run deploy` against project `agent-ops-501120` in `us-central1`. `deploy-orchestrator.yml` forwards the GitHub App secrets (`GH_APP_ID`, `GH_APP_PRIVATE_KEY`, and both the org and personal installation IDs), the LiteLLM proxy URL and virtual key, and a large set of optional, feature-gated secrets — search-provider keys, the-store target, and the `APPLICANT_*` background — including only the ones that are actually set, since `--env-vars-file` fully replaces the service's env vars on each deploy. It provisions 2Gi of memory and a 900s timeout for headless Chromium and synchronous multi-candidate runs. `deploy-litellm.yml` forwards `GEMINI_API_KEY`, the master key (`LITELLM_VIRTUAL_KEY`), and `DATABASE_URL`, then deploys the `litellm-gateway` service built from `litellm/`'s `config.yaml` + Dockerfile. `deploy-docs.yml` runs `npm ci` and `npm run build` in `agent-ops-docs/`, then uploads and deploys the `dist/` output through the `github-pages` environment using `configure-pages`, `upload-pages-artifact`, and `deploy-pages`.

## Configuration & running
Populate the required GitHub Secrets before first use: `GCP_SA_KEY` for both Cloud Run workflows, plus the orchestrator's GitHub App, LiteLLM, and control-repo secrets, and LiteLLM's `GEMINI_API_KEY`/`DATABASE_URL`. Optional orchestrator secrets can be added incrementally; each is only forwarded when set. `deploy-docs.yml` requires the one-time manual step of setting the repo's Pages source to "GitHub Actions" (Settings -> Pages -> Build and deployment -> Source) — it triggers from `main` rather than a separate docs branch because the auto-created `github-pages` environment restricts deployments to the default branch. Trigger any workflow manually from the Actions tab, or let a scoped push to `main` fire it automatically.

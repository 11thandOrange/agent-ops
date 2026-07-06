---
name: resume-job-applier-sourcing-api
description: Sourcing method "api" for resume-job-applier — fetches posting data through an authorized/official job-board API instead of scraping.
---

# Sourcing: api

Clears the ToS concern the same way `manual` does, but automates the fetch: calls a configured, authorized job-board API rather than a human pasting the posting by hand.

- Use when: you have (or get) real API access to a job board and want fetching automated without the scraping risk.
- Entry point: `orchestrator/src/jobs/sourcing/api.ts` — a thin dispatcher that resolves `api_provider` (registry entry) or a per-call `apiProvider` override, then delegates to that provider's module under `sourcing/api/providers/`. Same two-tier pattern as `search_provider`/`scraping_adapter`: a second provider is a new module + one more case in `sourcing/api/resolver.ts`, existing providers untouched.

## Provider — configurable, default and only option today: `jsearch`

| Provider | Fetches via | Credential |
|---|---|---|
| `jsearch` (**default, only provider today**) | OpenWebNinja's Job Search API, via API.market (`sourcing/api/providers/jsearch.ts`) | `JSEARCH_API_KEY` (+ optional `JSEARCH_BASE_URL`) |

The chat request's free text is treated as a search query (title, company, location, etc.) against a `GET {JSEARCH_BASE_URL}/search` request — the first matching result's `job_description` is used as the posting text, and `job_apply_link`/`job_google_link` (whichever is present) becomes `sourceUrl`.

**Contract confirmed live** (a real request/response was captured from the API.market playground during development, not just documentation): base URL `https://prod.api.market/api/v1/openwebninja/jobsearch`, authenticated with a single `x-api-market-key` header — this is API.market's own REST gateway, not RapidAPI's differently-hosted JSearch product, so it does not use RapidAPI's `X-RapidAPI-Key`/`X-RapidAPI-Host` header pair. Response shape is `{ status, data: [...] }`, each job carrying `job_title`, `employer_name`, `job_description`, `job_apply_link`, `job_google_link`, etc. — matches what `jsearch.ts` parses.

Adding a future provider (a different job-search API) means adding one new module implementing `(config, input) => SourcingResult` under `sourcing/api/providers/` and one more case in `sourcing/api/resolver.ts`'s `gatherWithProvider` — the `api.ts` entry point and every other provider are untouched.

**(New) jsearch also doubles as a `scrapeAny` `search_provider`** (`discovery/providers/jsearch.ts`, same `JSEARCH_API_KEY`/`JSEARCH_BASE_URL` credential) — that path returns many candidates matching `criteria` instead of one known posting's text. The two are architecturally separate: discovery there only returns candidate metadata, so a `sourcing_method: api` call still re-queries JSearch per candidate afterward for the actual posting text, an accepted redundant call kept for consistency with every other provider. See the main `SKILL.md`'s scrapeAny search provider table.

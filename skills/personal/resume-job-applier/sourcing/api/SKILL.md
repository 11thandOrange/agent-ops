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
| `jsearch` (**default, only provider today**) | JSearch (via API.market — a RapidAPI-marketplace-hosted job search API), `sourcing/api/providers/jsearch.ts` | `JSEARCH_API_KEY` (+ optional `JSEARCH_BASE_URL`/`JSEARCH_API_HOST`) |

The chat request's free text is treated as a search query (title, company, location, etc.) against JSearch's `/search` endpoint — the first matching result's `job_description` is used as the posting text, and `job_apply_link`/`job_google_link` (whichever is present) becomes `sourceUrl`.

**Caveat, confirmed during planning:** the JSearch contract implemented here comes from the well-known RapidAPI-hosted JSearch API (training knowledge) — it has not been verified live against API.market specifically, since this environment has no outbound network access to `api.market`/`rapidapi.com` to confirm it. `JSEARCH_BASE_URL`/`JSEARCH_API_HOST` are both configurable specifically so a mismatch against your actual API.market subscription is a config fix, not a code change — verify against your dashboard before relying on it in production.

Adding a future provider (a different job-search API) means adding one new module implementing `(config, input) => SourcingResult` under `sourcing/api/providers/` and one more case in `sourcing/api/resolver.ts`'s `gatherWithProvider` — the `api.ts` entry point and every other provider are untouched.

---
name: resume-job-applier-sourcing-api
description: Sourcing method "api" for resume-job-applier — fetches posting data through an authorized/official job-board API instead of scraping.
---

# Sourcing: api

Clears the ToS concern the same way `manual` does, but automates the fetch: calls a configured, authorized job-board API rather than a human pasting the posting by hand.

- Script: `orchestrator/src/jobs/sourcing/api.ts` — generic client reading `JOB_API_BASE_URL`/`JOB_API_KEY` from the orchestrator's environment. No specific provider is wired up yet; point it at whichever job-board API you're actually authorized to use, and adjust the response-shape parsing in that file to match.
- Use when: you have (or get) real API access to a job board and want fetching automated without the scraping risk.
- The chat request's free text is treated as a search query, job ID, or URL depending on what the configured provider's `/postings/search` endpoint expects — adjust the script if your provider's API shape differs.

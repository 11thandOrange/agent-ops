---
name: resume-job-applier-sourcing-scraping
description: Sourcing method "scraping" (default) for resume-job-applier — fetches posting data by loading the LinkedIn page directly with your own authenticated session.
---

# Sourcing: scraping (default)

**This is a deliberate, accepted deviation from LinkedIn's Terms of Service — not an oversight.** An earlier version of this skill prohibited scraping outright and required manual/API sourcing only, for exactly that ToS reason (see `docs/multi-pipeline-agent-strategy.md` §5.3's original note). That prohibition was explicitly reversed: `sourcing_method: scraping` is now the registry default for this project, chosen knowingly, with the risk understood — not because the ToS concern stopped being real. Revisit this default if LinkedIn ever rate-limits or blocks the account as a consequence; that would be the ToS risk materializing, not a bug.

## What it does

- Script: `orchestrator/src/jobs/sourcing/scraping.ts` — launches headless Chromium via Playwright, loads a saved browser session (cookies from your own logged-in LinkedIn account, not an anonymous session), navigates to the job posting URL found in the chat request, and extracts the posting text from the page.
- Configured via `SITE_SESSIONS_DIR` (orchestrator env) — a directory of Playwright `storageState` JSON files, one per site, named `<hostname>.json` (e.g. `linkedin.com.json`), resolved by the posting URL's hostname (`integrations/site_sessions.ts`). **(Revised)** this used to be `LINKEDIN_STORAGE_STATE_PATH`, a single fixed path — generalized once the `scrapeAll` strategy needed to crawl sites other than LinkedIn and reusing a LinkedIn-only env var for that made no sense. This module itself still only knows how to extract LinkedIn's specific posting-page structure (below); the session directory being multi-site doesn't make this script multi-site — a second site would still need its own selector logic here. Runs as you, not anonymously: an anonymous scrape is both more detectable and more fragile than one riding your own session.
- The chat request must contain the posting's URL — the script extracts the first URL it finds in the request text.

## Known limitations, stated plainly

- The CSS selectors this script targets (`.jobs-description__content`, `.jobs-box__html-content`) match LinkedIn's job-posting page structure as understood when this was written. This has **not** been run against a live, authenticated LinkedIn session — no test credentials were available in the environment it was built in. Treat it as a real first draft; verify against an actual posting and adjust selectors if LinkedIn's markup has changed before trusting it unattended.
- If LinkedIn changes its DOM structure, rate-limits the account, or requires re-authentication, this script fails loudly (an explicit error) rather than silently returning garbage — but someone still has to notice and fix it.

## Switching away from this default

Set `sourcing_method: api` or `sourcing_method: manual` in `registry/personal/projects.yaml`, or pass `sourcingMethod` as a per-call override on the `run_personal_project_pipeline` tool call, if you'd rather not carry this risk for a given run.

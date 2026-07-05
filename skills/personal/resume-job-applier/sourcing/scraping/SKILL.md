---
name: resume-job-applier-sourcing-scraping
description: Sourcing method "scraping" (default) for resume-job-applier — fetches posting data by loading the LinkedIn page directly with your own authenticated session.
---

# Sourcing: scraping (default)

**This is a deliberate, accepted deviation from LinkedIn's Terms of Service — not an oversight.** An earlier version of this skill prohibited scraping outright and required manual/API sourcing only, for exactly that ToS reason (see `docs/multi-pipeline-agent-strategy.md` §5.3's original note). That prohibition was explicitly reversed: `sourcing_method: scraping` is now the registry default for this project, chosen knowingly, with the risk understood — not because the ToS concern stopped being real. Revisit this default if LinkedIn ever rate-limits or blocks the account as a consequence; that would be the ToS risk materializing, not a bug.

## What it does

- Script: `orchestrator/src/jobs/sourcing/scraping.ts` — launches headless Chromium via Playwright, loads a saved browser session if one exists for the target hostname (cookies from your own logged-in account, not an anonymous session — though **no session is required**; not every site needs, or has, one), navigates to the job posting URL found in the chat request, and extracts the posting text from the page.
- Configured via `SITE_SESSIONS_DIR` (orchestrator env) — a directory of Playwright `storageState` JSON files, one per site, named `<hostname>.json` (e.g. `linkedin.com.json`), resolved by the posting URL's hostname (`integrations/site_sessions.ts`). **(Revised)** previously this was a hard requirement — the pipeline refused to scrape at all if `SITE_SESSIONS_DIR` was unset, even for a plain public posting with no login wall. Found live against a non-LinkedIn, unauthenticated careers-site posting; fixed to degrade to unauthenticated the same way `scrapeAll` already did.
- The chat request must contain the posting's URL — the script extracts the first URL it finds in the request text.

## Extraction model — two-tier scraping adapters

**(New)** extraction is no longer one hardcoded LinkedIn-only selector — `orchestrator/src/jobs/sourcing/scrapingAdapters/` is a two-tier adapter system, dispatched by `resolver.ts`:

| Tier | Adapters | When used |
|---|---|---|
| 1 — named | `linkedin`, `glassdoor`, `indeed` | The posting URL's hostname matches one of these sites |
| 2 — generic fallback | `generic-one-page-app`, `generic-multistep-app` | No named adapter matches — e.g. a posting hosted directly on a company's own careers site, which has no dedicated adapter and never will for every possible ATS vendor |

Resolution order: an explicit `scraping_adapter` (registry) / `scrapingAdapter` (per-call override) wins; otherwise the URL's hostname is matched against the named adapters; otherwise `generic-multistep-app` is the default fallback — it degrades to plain one-page extraction on its own when there's no "Next"/"Continue" control to click, so it's a safe default either way.

**`generic-multistep-app`** clicks through a detected "Next"/"Continue" control (up to 5 steps) before extracting, for postings that reveal their description across more than one screen. Its click-detection is a strict allowlist — a control must positively match next/continue wording and must not also match submit-like wording — same safety pattern as `job-application-form-prefill.mjs`'s wizard support, but **deliberately not identical to it, and deliberately excluding "Apply"/"Easy Apply" from the clickable set entirely**: on some sites (LinkedIn Easy Apply included) that single click can immediately submit an application using an already-complete profile, with no further form to fill. Since this system's core guarantee is that nothing auto-submits, a page that requires clicking something apply-flavored to reveal its description is left to fail extraction rather than risk it.

## Login-wall handling

**(New)** a distinct error is now raised when navigation lands on a login/sign-in wall (`scrapingAdapters/loginWall.ts` — checks for a URL redirect to something login-shaped, or common "sign in to continue" wording), instead of the same generic selector-timeout error a wrong selector or a slow page would also produce. Not exhaustive — there's no universal signal for "this is a login wall" — but catches the common cases.

## Known limitations, stated plainly

- The `linkedin` adapter's selectors (`.jobs-description__content`, `.jobs-box__html-content`) match LinkedIn's job-posting page structure as understood when this was written. The `glassdoor` and `indeed` adapters are first-draft guesses at those sites' common containers. **None of the three have been run against a live page** — no network access to real sites in the environment this was built in (confirmed via a blocked `curl` to a public Greenhouse page). Treat all three as real first drafts; verify against an actual posting and adjust selectors before trusting any of them unattended.
- If a site's markup doesn't match its adapter, or the generic fallback's best-effort selectors don't find real content, this fails loudly (an explicit error naming which adapter was used) rather than silently returning garbage — but someone still has to notice and fix it.

## Switching away from this default

Set `sourcing_method: api` or `sourcing_method: manual` in `registry/personal/projects.yaml`, or pass `sourcingMethod` as a per-call override on the `run_personal_project_pipeline` tool call, if you'd rather not carry this risk for a given run.

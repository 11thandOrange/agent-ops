---
name: resume-job-applier
description: Personal-assistant project skill for the resume builder + job applier pipeline. Drafts and queues LinkedIn job applications; never submits them.
---

# Resume builder + job applier

Pilot personal project (roadmap Phase 7). `type: personal` in `registry/personal/projects.yaml`, invoked via the `run_personal_project_pipeline` MCP tool (Revised — was the generic `run_project_pipeline`, split into `run_development_project_pipeline`/`run_personal_project_pipeline` since dev and personal calls have structurally different shapes). Executed by `orchestrator/src/jobs/run_personal_pipeline.ts` — unlike the dev pipeline, there's no repo/CI runner to dispatch to, so the orchestrator itself calls the model gateway directly.

## Hard rule: draft and queue, never auto-submit — the pipeline itself never does

This is the most important guardrail in this skill and overrides anything else that seems efficient in the moment: **the orchestrator's pipeline never submits a job application, and never fills a form on its own initiative.** It ends with a reviewable package; a human clicks submit in their own logged-in LinkedIn session. Do not implement, suggest, or leave a code path in `run_personal_pipeline.ts` (or anything the orchestrator runs unattended) that could auto-submit, even as a "convenience" or "optional" flag. This rule is independent of the sourcing method below — no sourcing configuration changes it.

**(New) The apply-assist companion script (below) is a deliberate, narrow exception to "never fills a form" — not to "never submits."** It runs locally, triggered by the human opening a link themselves, and only ever fills fields — it has no submit code path at all, permanently, as confirmed during planning. The orchestrator itself still never touches a form.

## Scope

- **LinkedIn only, for now.** Other job sites are separate skill sections added later on request, since each site has its own automation risk profile — don't generalize to other sites unprompted.

## Sourcing method — configurable, default scraping

How job posting data is gathered is a separate concern from the no-auto-submit rule above, and matters for LinkedIn's Terms of Service on its own terms. `sourcing_method` in the registry entry (or a per-call `sourcingMethod` override) picks one of:

| Method | ToS posture | Skill |
|---|---|---|
| `scraping` (**default**) | Deliberate, accepted deviation from LinkedIn's ToS — see `sourcing/scraping/SKILL.md` for the explicit risk note. Not an oversight; a knowing choice. | `sourcing/scraping/SKILL.md` |
| `api` | ToS-safe, if the configured provider is genuinely authorized. | `sourcing/api/SKILL.md` |
| `manual` | ToS-safe — a human pastes/describes the posting. | `sourcing/manual/SKILL.md` |

An earlier version of this skill required `manual`/`api` only and forbade scraping outright. That prohibition was explicitly reversed in favor of `scraping` as the default — the ToS exposure is real and understood, not assumed away. If you want the safer posture back for a given run, override `sourcingMethod` on the call or change the registry default.

## Document sources — configurable per document

`resume_source` and `cover_letter_source` in the registry entry are independent — each is either:

- `{ mode: generated_pdf }` — drafted fresh from the posting each run, tailored to it, rendered to PDF.
- `{ mode: gdrive_link, gdrive_link: <url> }` — an existing Google Drive document is used as-is instead of generating one.

**Trade-off:** whichever document is `gdrive_link` is static and not tailored to the specific posting — only a `generated_pdf` document gets drafted fresh each run. If both are set to `gdrive_link`, this pipeline's only real output is the application summary below; say so plainly in the response rather than implying tailoring happened when it didn't.

## Discovery strategy — configurable, default scrapeOne

**(New)** how postings are found is a separate axis from `sourcing_method` above (which only covers *fetching a known posting's content*). `strategy` in the registry entry (or a per-call override) picks one:

| Strategy | `request` means | Behavior |
|---|---|---|
| `scrapeOne` (**default**) | a pasted posting or its URL | one application produced, same as the original single-posting flow |
| `scrapeAll` | a job-site URL to crawl | crawls that site's listings, filters by `criteria`, up to `max_results` applications produced |
| `scrapeAny` | ignored | searches the open web for matches to `criteria` — **no site allowlist, confirmed and deliberate**, not narrowed to LinkedIn or any named list of sites |

`scrapeAll`/`scrapeAny` can each cost up to `max_results` full model calls + document renders in one run — capped (default 10, per-call override via `maxResults`) precisely because of that cost, not as an arbitrary limit.

`criteria` (title, location, remote, salary range, skills, keywords, websites, date posted, company, whitelist/blacklist) filters candidates found by `scrapeAll`/`scrapeAny` — matching is deliberately forgiving (see `orchestrator/src/jobs/criteria.ts`): a candidate missing data for a criterion isn't excluded on that criterion alone, since scraped/searched metadata is often incomplete. Only blacklist matches and clear contradictions exclude a candidate.

## Output package

For each job application, produce:

1. **Resume** — per `resume_source`: either a posting-tailored PDF, or a pointer to the configured Google Drive link.
2. **Cover letter** — per `cover_letter_source`: same choice, independent of the resume's.
3. **Application summary** — a human-readable narrative of the fields a LinkedIn application would ask for, filled in but clearly marked unsubmitted, so the human can copy/paste or verify before clicking submit themselves. Always produced, regardless of the document source modes above.
4. **(New) `formFields`** — a flat, machine-consumable `{label: value}` map of the same information as the application summary, but keyed to match actual application-form field labels rather than prose. This exists specifically for the apply-assist companion script below — the narrative summary is for the human to *read*, `formFields` is what a script *fills a form with*.

`scrapeAll`/`scrapeAny` return an array of these packages (one per matched posting), not a single package — `scrapeOne` returns an array of exactly one.

Return the package(s) in the same chat thread that made the request — there is no separate notification channel (Bird and multi-channel notifications are not part of this system; chat is the only delivery surface, permanently).

## Apply-assist — prefilling the form when you open the link

**(New)** `apply-assist/SKILL.md` documents a local companion script (`orchestrator/scripts/apply-assist.mjs`) you run yourself: it opens a job link in a visible browser using your saved session, fills the form from a package's `formFields`, and stops — you review and submit yourself in that same window. It is **fill-only, permanently, as confirmed during planning** — no flag or future mode should make it submit; revisiting that is a separate, explicit future decision, not something to build quietly into this script.

## Storage — the-store

**(New)** every completed application is appended as a row to a CSV in a separate repo, `the-store` (`projects/job-applications/job-app-results.csv`), via `orchestrator/src/integrations/the_store.ts` — application *data* doesn't belong in `agent-ops`, which is pipeline *config*. This is gated: if `the-store` isn't configured (it didn't exist yet when this was built), the append is skipped with a warning log rather than failing the whole run.

## Model

Uses the `planning` model alias (Gemini for now, repointed to Claude when the Anthropic key lands) — research and drafting quality matters more here than speed, which is why this isn't on the `implementation` alias.

## Guardrails

- The orchestrator's own pipeline (`run_personal_pipeline.ts` and anything it calls unattended) never fills in or submits a LinkedIn form, even partially, beyond what's needed to produce the reviewable summary and `formFields`. **(Revised)** filling *is* now done, but only by `apply-assist` — a script the human runs themselves, locally, triggered by opening the link — never by the orchestrator on its own initiative, and never as a submit.
- Don't invent details about the applicant's experience — only draft from information the human has actually provided or confirmed.
- If a posting looks like it requires an account action (e.g. "Easy Apply" auto-fill) rather than a standalone form, still stop at the summary/`formFields` stage from the orchestrator's side — apply-assist can still prefill it locally when the human opens it, but the orchestrator itself performs no LinkedIn interaction.
- `scrapeAny`'s open web scope (no site allowlist — confirmed) means postings can come from sites with no individual ToS/robots.txt review, unlike `scraping`'s LinkedIn-specific accepted-risk note. Treat that as a broader, less-characterized version of the same kind of exposure, not a separate concern that's already been resolved.
- No shared-skill tier applies here (unlike dev projects, which read `skills/shared/dev/` by tag match) — everything this project needs lives under this folder. Don't add a dependency on `skills/shared/` content from this skill.

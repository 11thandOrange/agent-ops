---
name: resume-job-applier
description: Personal-assistant project skill for the resume builder + job applier pipeline. Drafts and queues LinkedIn job applications; never submits them.
---

# Resume builder + job applier

Pilot personal project (roadmap Phase 7). `type: personal` in `registry/personal/projects.yaml`, invoked via the generic `run_project_pipeline` MCP tool — there is no project-specific tool for this. Executed by `orchestrator/src/jobs/run_personal_pipeline.ts` — unlike the dev pipeline, there's no repo/CI runner to dispatch to, so the orchestrator itself calls the model gateway directly.

## Hard rule: draft and queue, never submit

This is the most important guardrail in this skill and overrides anything else that seems efficient in the moment: **the pipeline never submits a job application.** It ends with a reviewable package; a human clicks submit in their own logged-in LinkedIn session. Do not implement, suggest, or leave a code path that could auto-submit, even as a "convenience" or "optional" flag. This rule is independent of the sourcing method below — no sourcing configuration changes it.

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

## Output package

For each job application, produce:

1. **Resume** — per `resume_source`: either a posting-tailored PDF, or a pointer to the configured Google Drive link.
2. **Cover letter** — per `cover_letter_source`: same choice, independent of the resume's.
3. **Application summary** — the fields a LinkedIn application would ask for, filled in but clearly marked unsubmitted, so the human can copy/paste or verify before clicking submit themselves. Always produced, regardless of the document source modes above.

Return all three in the same chat thread that made the request — there is no separate notification channel (Bird and multi-channel notifications are not part of this system; chat is the only delivery surface, permanently).

## Model

Uses the `planning` model alias (Gemini for now, repointed to Claude when the Anthropic key lands) — research and drafting quality matters more here than speed, which is why this isn't on the `implementation` alias.

## Guardrails

- Never fill in and submit a LinkedIn form programmatically, even partially, beyond what's needed to produce the reviewable summary.
- Don't invent details about the applicant's experience — only draft from information the human has actually provided or confirmed.
- If a posting looks like it requires an account action (e.g. "Easy Apply" auto-fill) rather than a standalone form, still stop at the summary stage — the human performs the actual LinkedIn interaction.
- No shared-skill tier applies here (unlike dev projects, which read `skills/shared/dev/` by tag match) — everything this project needs lives under this folder. Don't add a dependency on `skills/shared/` content from this skill.

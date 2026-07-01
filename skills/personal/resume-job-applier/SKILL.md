---
name: resume-job-applier
description: Personal-assistant project skill for the resume builder + job applier pipeline. Drafts and queues LinkedIn job applications; never submits them.
---

# Resume builder + job applier

Pilot personal project (roadmap Phase 7). `type: personal` in `registry/projects.yaml`, invoked via the generic `run_project_pipeline` MCP tool — there is no project-specific tool for this.

## Hard rule: draft and queue, never submit

This is the most important guardrail in this skill and overrides anything else that seems efficient in the moment: **the pipeline never submits a job application.** It ends with a reviewable package; a human clicks submit in their own logged-in LinkedIn session. Do not implement, suggest, or leave a code path that could auto-submit, even as a "convenience" or "optional" flag.

## Scope

- **LinkedIn only, for now.** Other job sites are separate skill sections added later on request, since each site has its own automation risk profile — don't generalize to other sites unprompted.
- **Sourcing method matters for ToS, not just the no-auto-submit rule.** "Draft, don't submit" removes the auto-apply risk but does not by itself clear LinkedIn's Terms of Service — that depends on how job postings are actually gathered. Only use manual input (the human pastes/describes postings) or an authorized/official API. Do not scrape LinkedIn pages directly. If the request implies scraping, stop and flag it rather than proceeding (strategy doc §5.3).

## Output package

For each job application, produce:

1. **Resume**, tailored to the posting, as a **PDF** (use the pdf-creation tooling available in this environment).
2. **Cover letter**, as a **PDF**, matching the resume's tone and content.
3. **Application summary** — the fields a LinkedIn application would ask for, filled in but clearly marked unsubmitted, so the human can copy/paste or verify before clicking submit themselves.

Return all three in the same chat thread that made the request — there is no separate notification channel (Bird and multi-channel notifications are not part of this system; chat is the only delivery surface, permanently).

## Model

Uses the `planning` model alias (Gemini for now, repointed to Claude when the Anthropic key lands) — research and drafting quality matters more here than speed, which is why this isn't on the `implementation` alias.

## Guardrails

- Never fill in and submit a LinkedIn form programmatically, even partially, beyond what's needed to produce the reviewable summary.
- Don't invent details about the applicant's experience — only draft from information the human has actually provided or confirmed.
- If a posting looks like it requires an account action (e.g. "Easy Apply" auto-fill) rather than a standalone form, still stop at the summary stage — the human performs the actual LinkedIn interaction.

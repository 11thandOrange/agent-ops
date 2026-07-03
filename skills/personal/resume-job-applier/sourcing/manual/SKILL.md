---
name: resume-job-applier-sourcing-manual
description: Sourcing method "manual" for resume-job-applier — the human pastes or describes the job posting themselves.
---

# Sourcing: manual

The safest sourcing method. No fetching, no automation risk: the chat request itself contains the pasted posting text (or a close paraphrase) from the human.

- Script: `orchestrator/src/jobs/sourcing/manual.ts` — passthrough only, returns the request text as-is.
- Use when: you want zero ToS exposure, or when a posting isn't reachable any other way (e.g. shared via screenshot/email, not a public URL).
- Trade-off: someone has to actually go copy/paste the posting each time — no fetching happens on your behalf.

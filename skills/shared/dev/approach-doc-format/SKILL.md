---
name: approach-doc-format
description: How to structure an approach doc and its GitHub sub-issues during the planning stage of the dev ticket pipeline. Referenced by every project skill.
applies_to: all
---

# Approach doc format

Used during the `plan` job (strategy doc §4.2) before anything is implemented. The output of planning is **real GitHub sub-issues**, not a checklist inside the parent issue.

## What to produce

1. Read the parent issue and this project's own skill file (e.g. `skills/app-1/SKILL.md`) for repo-specific conventions.
2. Draft a short approach doc covering:
   - **Problem** — what the ticket is actually asking for, in your own words (surfaces misunderstandings early).
   - **Approach** — the plan at a level a reviewer can approve without reading code.
   - **Subtasks** — a concrete, ordered breakdown. Each subtask becomes one sub-issue.
   - **Acceptance criteria** — testable statements the implementation must satisfy. These drive the tests written during implementation (TDD-style, per strategy doc §4.4).
   - **Risks / open questions** — anything that could change the approach; call these out rather than silently picking an answer.
3. Create one GitHub sub-issue per subtask — the subtask's content is that sub-issue's **body**, not a line in a checklist. Use sub-sub-issues (up to 8 levels deep) only where a subtask is genuinely compound. **Create each one with exactly one command:** `gh issue create --parent <parent_number> --title '<title>' --body '<body>'` — this creates and links the sub-issue atomically and is confirmed to work reliably. Do **not** create a plain issue first and then try to attach it via `gh api .../sub_issues` (REST) or a GraphQL `addSubIssue` mutation — that two-step path reliably returns `403 Resource not accessible by integration` regardless of retries, and just burns turns. If you ever end up with an issue created without `--parent`, close it and recreate it correctly rather than trying to link the orphan retroactively.
4. **Idempotency**: before creating any sub-issue, list the parent's existing sub-issues and skip titles that already exist. Planning must be safely re-runnable — a retried run should never create duplicates (strategy doc §4.2, roadmap Phase 3 checkpoint).
5. Post any clarifying notes as **comments** on the relevant issue/sub-issue — never rewrite a description after the fact; the description is the durable spec, comments are the history.
6. Label the parent issue `approach-ready` and stop. Do not begin implementation in the same run — that only happens after a human applies the `approved` label (see `approval-gate-protocol`).

## What not to do

- Don't put the whole plan as a single text block in the parent issue's description — GitHub sub-issues exist so subtasks are independently trackable, assignable, and linkable.
- Don't skip acceptance criteria "to save time" — without them the implementation stage and the Qodo quality gate have nothing concrete to check against.
- Don't guess at ambiguous requirements — put the ambiguity in "Risks / open questions" and let the human resolve it at approval time.

---
name: approval-gate-protocol
description: What must be true before implementation starts, and how the approved label / equivalent trigger is treated. Referenced by every project skill.
---

# Approval gate protocol

The pipeline never moves from planning to implementation without an explicit human approval. This skill defines what that gate means in practice.

## The gate

- Planning ends with the parent issue labeled `approach-ready` and the run stops there (see `approach-doc-format`).
- Implementation only starts when one of these is true for that issue:
  - the `approved` label is applied, **or**
  - an allowlisted commenter posts `@dev-agent implement` (the workflow and the orchestrator both check the commenter's GitHub login against an allowlist before honoring this — strategy doc §4.1), **or**
  - a chat/curl request explicitly requests the `implement` action for that issue (via `run_project_pipeline` or `POST /trigger`).
- There is no other path to implementation. If the approach doc's sub-issues need to change after `approach-ready`, that's a new `plan` run, not something implementation should improvise around.

## What "approved" means for the reviewer

- The reviewer for a given project is whatever `registry/projects.yaml` sets for that project's `reviewer` field — currently `heyitschloe` on every entry, but this is a per-project config value, not a hardcoded assumption. Don't write code or docs that assume a single fixed reviewer identity.
- Approving means "the approach is right," not "the diff is right" — the diff itself still goes through the Qodo quality gate (self-hosted PR-Agent + qodo-cover) after implementation, and the human reviews the actual PR before merge. Approval at this gate is about the plan, not a merge decision.

## What implementation must do once approved

- Read the approved approach doc and its sub-issues — implement exactly that plan, not a reinterpretation of the original ticket.
- Write tests against the approach doc's acceptance criteria as part of the diff (TDD-style), since the Qodo gate audits what's there rather than generating tests from a spec (strategy doc §4.4).
- Open a PR and request review from the project's configured reviewer — never merge automatically.
- If implementation turns out to need something outside the approved plan, stop and flag it in the PR description rather than silently expanding scope.

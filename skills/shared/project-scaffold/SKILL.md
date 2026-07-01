---
name: project-scaffold
description: How to onboard a new dev or personal project into agent-ops — generates the project's skill file, registry entry, and (for dev projects) its CI caller workflow. Used by the scaffold_project job/MCP tool, not copied by hand.
---

# Project scaffold

Onboarding a new project is a pipeline capability, not a static template a human copies by hand (design review — see `docs/multi-pipeline-agent-strategy.md` §6.1). This skill defines what `scaffold_project` must produce; it's invoked via the `scaffold_project(name, type, repo?)` MCP tool or a chat request like "scaffold a new dev project called app-2," not run manually.

## Inputs

- `name` — the project's identifier (e.g. `app-2`, `property-sourcing`).
- `type` — `dev` (an app repo running the ticket pipeline) or `personal` (a personal-assistant project).
- `repo` — required for `type: dev`, the `owner/repo` the pipeline will run against. Not used for `type: personal`.

## What must be generated

1. **A skill file** at `skills/<name>/SKILL.md` (dev) or `skills/personal/<name>/SKILL.md` (personal), containing at minimum:
   - Conventions (coding style, folder layout, naming) — dev projects only.
   - Test framework and exact test command — dev projects only.
   - A reference to `approach-doc-format` and `approval-gate-protocol` (every project skill inherits these, doesn't restate them).
   - Guardrails: anything this project must never do unattended (e.g. the resume-job-applier project's "never auto-submit" rule).
2. **A registry entry** appended to `orchestrator/src/registry/projects.yaml`, matching the existing schema (`project`, `type`, `repo`, `model_profile`, `skill_folder`, and for dev projects also `test_gate`, `project_language`, `test_command`, `coverage_type`, `desired_coverage`, `reviewer`).
3. **For `type: dev` only** — a thin caller workflow written to `<repo>/.github/workflows/dev-pipeline.yml` that calls `agent-ops`'s `dev-pipeline-reusable.yml` with this project's registry values. The actual CI logic lives once in `agent-ops` (strategy doc §4.5); the per-repo file is only inputs.

## What this replaces

Before this skill existed, onboarding a project meant three separate manual steps (write a skill folder by hand, add a registry entry by hand, copy the whole workflow file by hand) — three chances for the new project to drift from the established pattern. `scaffold_project` does all three in one action so every project starts from the same shape.

## Preconditions

- For a `type: dev` project, the GitHub App must already be installed on the target repo (roadmap Phase 8, step 1) — this skill does not install the App, it only writes files, and the write will fail if the App isn't installed there yet.
- Generated files use placeholder values (`CHANGE_ME` for `test_command`/`coverage_type`/`project_language`) where the specifics are project-dependent — fill these in before relying on the pipeline, don't leave them as placeholders past the first real test ticket.

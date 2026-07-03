---
name: project-scaffold
description: How to onboard a new dev or personal project into agent-ops — generates the project's skill file, registry entry, and (for dev projects) its CI caller workflow. Used by the scaffold_project job/MCP tool, not copied by hand.
applies_to: all
---

# Project scaffold

Onboarding a new project is a pipeline capability, not a static template a human copies by hand (design review — see `docs/multi-pipeline-agent-strategy.md` §6.1). This skill defines what `scaffold_project` must produce; it's invoked via the `scaffold_project(name, type, repo?)` MCP tool or a chat request like "scaffold a new dev project called app-2," not run manually.

## Inputs

- `name` — the project's identifier (e.g. `app-2`, `property-sourcing`) and the descriptive name its skill folder is written under — pick something that describes the project, not an internal codename.
- `type` — `dev` (an app repo running the ticket pipeline) or `personal` (a personal-assistant project).
- `repo` — required for `type: dev`, the `owner/repo` the pipeline will run against. Not used for `type: personal`.
- `appliesTo` — optional, `type: dev` only. Defaults to `[repo:<repo>]` (scoped to just this one project) if not given. Widen it (e.g. to a language tag like `[typescript]`) only if the skill's content is genuinely meant to apply beyond this one repo.

## What must be generated

1. **A skill file**, always written into agent-ops (never into the target repo — every skill lives centrally, §6):
   - `type: dev` → `skills/shared/<name>/SKILL.md`, with frontmatter `applies_to: <appliesTo value>`.
   - `type: personal` → `skills/personal/<name>/SKILL.md` (personal projects have no `project_language`/`repo` to match against, so they're referenced by an explicit `skill_path` registry field instead of `applies_to` matching).
   - Contents, at minimum: conventions (coding style, folder layout, naming) and exact test framework/command for dev projects; a reference to `approach-doc-format` and `approval-gate-protocol` (every project skill inherits these, doesn't restate them); guardrails — anything this project must never do unattended (e.g. the resume-job-applier project's "never auto-submit" rule).
2. **A registry entry** appended to `orchestrator/src/registry/projects.yaml`, matching the existing schema (`project`, `type`, `repo`, `model_profile`, and for dev projects also `test_gate`, `project_language` as a list, `test_command`, `coverage_type`, `desired_coverage`, `reviewer`). There is no `skill_folder`/`skill_path` field for `type: dev` — which skills apply is resolved by the reusable workflow matching each shared skill's `applies_to` against this entry's `project_language`/`repo`, not by a registry pointer.
3. **For `type: dev` only** — a thin caller workflow written to `<repo>/.github/workflows/dev-pipeline.yml` that calls `agent-ops`'s `dev-pipeline-reusable.yml` with this project's registry values. The actual CI logic lives once in `agent-ops` (strategy doc §4.5); the per-repo file is only inputs.

## What this replaces

Before this skill existed, onboarding a project meant three separate manual steps (write a skill folder by hand, add a registry entry by hand, copy the whole workflow file by hand) — three chances for the new project to drift from the established pattern. `scaffold_project` does all three in one action so every project starts from the same shape.

## Preconditions

- For a `type: dev` project, the GitHub App must already be installed on the target repo (roadmap Phase 8, step 1) — this skill does not install the App, it only writes files, and the write will fail if the App isn't installed there yet.
- Generated files use placeholder values (`CHANGE_ME` for `test_command`/`coverage_type`/`project_language`) where the specifics are project-dependent — fill these in before relying on the pipeline, don't leave them as placeholders past the first real test ticket.

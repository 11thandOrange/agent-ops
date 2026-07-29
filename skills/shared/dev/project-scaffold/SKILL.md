---
name: project-scaffold
description: How to onboard a new pipeline into this deployment — generates its skill file, registry entry, and (for github-actions pipelines) its CI caller workflow. Used by the scaffold_pipeline MCP tool, not copied by hand.
applies_to: all
---

# Project scaffold

Onboarding a new pipeline is a pipeline capability, not a static template a human copies by hand (design review — see `roadmap/multi-pipeline-agent-strategy.md` §6.1, and its split note for the current two-repo architecture). This skill defines what `scaffold_pipeline` must produce; it's invoked via the `scaffold_pipeline` MCP tool (shipped by the `@heyitschloe/pipeline-orchestrator` package, `src/handlers/scaffold.ts`), not run manually.

**This replaces the old `scaffold_project(name, type, repo?)` tool.** The engine is now generic — there's no `dev`/`personal` type distinction baked into the tool itself, and there's no automatic default-filling from a short-form call. The caller supplies the full registry entry explicitly.

## Inputs

`scaffold_pipeline` takes exactly two arguments:

- `pipeline` — the complete registry entry to add, matching `PipelineDefinition` (see `@heyitschloe/pipeline-orchestrator`'s README "Registry format" section):
  - `name` — the pipeline's identifier (e.g. `app-2-dev`, `property-sourcing`) — also the descriptive name its skill folder is written under for `github-actions`-execution pipelines.
  - `handler` — which registered handler runs it. Today: `dev-ticket-pipeline` (shipped by the engine) or `job-search-pipeline` (this repo's own, in `orchestrator/src/handlers/job_search_pipeline.ts`). A new handler shape needs its own code written first — scaffolding a pipeline never invents a new handler.
  - `skill_path` — where its skill file lives. For `dev-ticket-pipeline`, this is where scaffolding *writes* a new skill (`skills/shared/dev/<name>`) — but the reusable workflow actually discovers dev skills at runtime by scanning all of `skills/shared/dev/*/SKILL.md` and matching `applies_to`, not by reading this field back. For `job-search-pipeline`, `skill_path` is read directly at request time (personal-style pipelines have no `applies_to` matching tier).
  - `execution` — `{ kind: "github-actions", workflow, owner, repo, ref? }` for anything with a repo/CI target, or `{ kind: "in-process" }` for anything the engine runs directly (no repo to dispatch to).
  - `triggers` — `labels`/`mentions` maps (label name / mention phrase → action), and/or `chat_tool`/`http_kind` for a dedicated MCP-tool or `/trigger` alias.
  - `params` — handler-specific config, validated against that handler's own `paramsSchema`. For `dev-ticket-pipeline`: `model_profile`, `project_language` (list), `test_command`, `coverage_type`, `desired_coverage`, `reviewer`. For `job-search-pipeline`: `model_profile`, `resume_source`, `cover_letter_source`, `sourcing_method`, `strategy`, `max_results`, `search_provider`, and optionally `scraping_adapter`/`api_provider`.
- `skillBody` — the markdown body for the new skill file (frontmatter is generated automatically around it).

## What gets generated

1. **A skill file**, always written into this control repo (`agent-ops`) at `<skill_path>/SKILL.md` — never into the target repo. Content, at minimum: conventions (coding style, folder layout, naming) and exact test framework/command for `dev-ticket-pipeline` projects; a reference to `approach-doc-format` and `approval-gate-protocol` (every dev pipeline inherits these, doesn't restate them); guardrails — anything this pipeline must never do unattended (e.g. `resume-job-applier`'s "never auto-submit" rule).
2. **A registry entry** appended to `orchestrator/src/registry/pipelines.yaml` — one file now, not split by type. Fails if a pipeline with the same `name` already exists.
3. **For `execution.kind: "github-actions"` only** — a thin caller workflow written to `<execution.repo>/.github/workflows/dev-pipeline.yml`, generated from `triggers.labels`/`triggers.mentions` (so a non-standard label/mention scheme is captured correctly, not hardcoded to `approach-ready`/`approved`) and `params`. Points at `@heyitschloe/pipeline-orchestrator`'s `dev-pipeline-reusable.yml`, with `skills_repo_owner: HeyItsChloe`, `skills_repo_name: agent-ops` filled in.

## What this replaces

Before this skill existed, onboarding a project meant three separate manual steps (write a skill folder by hand, add a registry entry by hand, copy the whole workflow file by hand) — three chances for the new project to drift from the established pattern. `scaffold_pipeline` does all three in one action so every pipeline starts from the same shape.

## Preconditions

- For a `github-actions`-execution pipeline, the GitHub App must already be installed on the target repo — this skill does not install the App, it only writes files, and the write will fail if the App isn't installed there yet.
- Generated caller workflows use placeholder values (`CHANGE_ME` for `test_command`/`coverage_type`/`project_language`/`reviewer`) wherever `params` doesn't supply them — fill these in before relying on the pipeline, don't leave them as placeholders past the first real test ticket.
- Registering a pipeline with a `handler` that isn't yet running in this deployment's bootstrap (`orchestrator/src/index.ts`) will fail at engine startup, not at scaffold time — `createServer` validates every registry entry's `params` against its named handler's schema on boot, and throws if the handler isn't registered at all.

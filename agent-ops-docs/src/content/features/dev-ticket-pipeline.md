---
title: Dev-Ticket Pipeline
order: 2
summary: GitHub-issue-driven development for app repos — plan on approach-ready, implement on approval, all through a labels-and-mentions gate.
status: stable
implements:
  workflows: []
  skills: [project-conventions, android-conventions, approval-gate-protocol]
  dependencies: ["@heyitschloe/pipeline-orchestrator"]
  integrations: [github-app, github-actions, model-providers]
runWith:
  - "Registered as pipeline entries in orchestrator/src/registry/pipelines.yaml; each deployment targets one app repo and dispatches its dev-pipeline-reusable.yml."
tradeoffs:
  - "Skills aren't pinned per deployment — they're matched at runtime by the reusable workflow's applies_to matching, so a project's real skill can differ from its registry skill_path."
notes:
  - kind: important
    body: "The reusable workflow dev-pipeline-reusable.yml lives in each target app repo, not in agent-ops, so it is not a local workflow file here."
---

## What it does
The `dev-ticket-pipeline` handler drives GitHub-issue-based development for application repositories. Each deployment binds one app repo to a two-phase flow: a **plan** phase that produces an approach doc and stops at a human approval gate, and an **implement** phase that writes the change (with tests) and opens a PR for the configured reviewer — never merging. Two deployments are registered today: `busybuddy-dev` (targets `11thandOrange/BusyBuddy_v2`, TypeScript) and `ordermate-dev` (targets `11thandOrange/OrderMate`, Kotlin).

## How it works
Deployments are declared in `orchestrator/src/registry/pipelines.yaml`, one entry per pipeline. Each entry sets `handler: dev-ticket-pipeline`, an `execution` block (`kind: github-actions`, `workflow: dev-pipeline-reusable.yml`, plus `owner`/`repo`), and per-project `params`.

- **busybuddy-dev** — target `11thandOrange/BusyBuddy_v2`; `test_command: npm test -- --coverage`; `coverage_type: cobertura`, `desired_coverage: 85`; conventions from the `project-conventions` skill (`applies_to: all`).
- **ordermate-dev** — target `11thandOrange/OrderMate`; `test_command: ./gradlew test`; `coverage_type: jacoco`, `desired_coverage: 40` (a low starting placeholder — no jacoco plugin is actually wired into OrderMate's build yet); conventions from the `android-conventions` skill (`applies_to: [kotlin]`).

Runs are triggered off the target issue by **labels** and by comment **mentions**, mapped identically in both deployments: label `approach-ready` → `plan`, label `approved` → `implement`; comment `@dev-agent plan` → `plan`, `@dev-agent implement` → `implement`. Both the workflow and the orchestrator check an allowlist against the commenter's GitHub login before honoring a mention. Skills are not pinned per deployment — the reusable workflow's "Match shared skills" step resolves them at runtime by `applies_to` matching across `skills/shared/dev/`, so a deployment's `skill_path` is only used as a write target when scaffolding. The `approval-gate-protocol` skill governs the transition: planning ends with the issue labeled `approach-ready`, and implementation starts only via the `approved` label, an allowlisted `@dev-agent implement` comment, or an explicit chat/HTTP `implement` request.

## Configuration & running
Add or change a pipeline by editing its entry in `orchestrator/src/registry/pipelines.yaml` — a new deployment is a new entry, not new engine code (the generic engine is the `@heyitschloe/pipeline-orchestrator` package). Per-project `params` set `model_profile`, `project_language`, `test_command`, `coverage_type`, `desired_coverage`, and `reviewer` (currently `heyitschloe` on every entry, read as config rather than hardcoded). The actual CI work runs in `dev-pipeline-reusable.yml`, which lives in each target app repo (BusyBuddy_v2 / OrderMate); the orchestrator dispatches it via the GitHub App and passes the deployment's params through. In practice: label or comment on an issue in the target repo, and the matching phase runs against that issue.

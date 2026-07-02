# Multi-Pipeline Agent Automation Strategy

A model-agnostic, multi-project automation system covering both software development tickets and personal-assistant workflows, built around Claude as the automation engine, a swappable chat front end, and a single orchestrator that scales across multiple apps and multiple personal projects.

> **Revision note:** this version supersedes the original draft after a design review. Changes are called out inline as **(Revised)**; the rationale for each is in `docs/decisions-log.md`.

---

## 1. Goals

1. Complete GitHub tickets end-to-end: review repo context, break tickets into real subtasks, get human approval on the approach, implement, test, and open a PR for review.
2. Act as a personal assistant: chat-driven task execution, ticket creation/management, research, and — via chat only — result delivery.
3. Run this for 3+ app repos concurrently without duplicating the pipeline per app.
4. Run this for 3+ personal projects concurrently (trip planning, property sourcing, asset purchases) without duplicating the pipeline per project.
5. Keep every component swappable: the model behind any task, and the chat platform used to talk to the system.

---

## 2. Core architecture

```
                 ┌────────────────────────────┐
   Triggers ───▶ │   Trigger adapter           │
 (GH label,      │   normalizes to one job      │
  @mention,      │   payload regardless of      │
  chat, curl)    │   source                     │
                 └─────────────┬──────────────┘
                                ▼
                 ┌────────────────────────────┐
                 │   Orchestrator              │
                 │   routing, state,            │
                 │   approval gates,             │
                 │   per-project registry,       │
                 │   auth on all endpoints,       │
                 │   structured logging (Revised) │
                 └──────┬───────────────┬──────┘
                         ▼               ▼
            ┌─────────────────┐  ┌─────────────────────┐
            │ Dev ticket       │  │ Personal assistant   │
            │ pipeline          │  │ pipeline              │
            │ (per app repo)    │  │ (per personal project)│
            └─────────────────┘  └─────────────────────┘
                         │               │
                         └───────┬───────┘
                                 ▼
                 ┌────────────────────────────┐
                 │   Shared agent layer         │
                 │   model gateway (LiteLLM)     │
                 │   Claude Code, local models    │
                 │   skills repo + RAG             │
                 └────────────────────────────┘
```

Three structural principles run through everything below (third one added in this revision):

- **Model-agnostic by config, not code.** Every call to an LLM goes through a gateway. Swapping which model powers a pipeline or task is a one-line config change.
- **One integration per surface, parameterized per project.** One orchestrator, one MCP server, one skill-folder pattern, one CI workflow — each project is a config entry, not a forked copy of the pipeline. **(Revised)** this now applies to the GitHub Actions workflow too (§4.5) and to skill onboarding (§6.1) — both were exceptions to this rule in the original draft.
- **Auth and observability are day-one concerns, not day-ninety.** **(Revised)** the original draft deferred endpoint auth, budget alerts, and structured logging to a final hardening phase. Both are now built alongside the pieces they protect (§8, §9.1).

---

## 3. Model-agnostic orchestrator: LiteLLM

**What it is:** an open-source (MIT-licensed, free) proxy that puts one OpenAI-compatible endpoint in front of 100+ model providers — Claude, GPT, Gemini, local Ollama models, etc. The proxy itself costs $0; you pay providers directly at their standard rates and host the proxy yourself (a small VPS is enough at this scale, roughly $10–40/month). A paid Enterprise tier exists only for SSO/RBAC/governance features, which don't matter for a single-person setup.

**Why it matters here:** the orchestrator and every agent call a *model alias* (`planning`, `implementation`, `classification`) rather than a literal model name. Changing which model answers to that alias is a one-line edit in `litellm/config.yaml` — no pipeline code changes.

```yaml
# litellm/config.yaml
model_list:
  - model_name: planning
    litellm_params:
      model: anthropic/claude-opus-4-8
      api_key: os.environ/ANTHROPIC_API_KEY

  - model_name: implementation
    litellm_params:
      model: anthropic/claude-sonnet-5
      api_key: os.environ/ANTHROPIC_API_KEY

  - model_name: classification
    litellm_params:
      model: ollama/qwen2.5-coder:7b
      api_base: http://localhost:11434

  - model_name: implementation-fallback
    litellm_params:
      model: openai/gpt-5.1
      api_key: os.environ/OPENAI_API_KEY

router_settings:
  fallbacks:
    - implementation: ["implementation-fallback"]

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  database_url: os.environ/DATABASE_URL
```

Each project's registry entry (see §6) references the alias, not a hardcoded model — so the same `projects.yaml` line works whether `implementation` currently points at Claude or something else.

**(Re-revised twice) Postgres is required after all — but external, not self-hosted.** An initial attempt to drop Postgres entirely (reasoning: it only backs the optional virtual-key/spend-tracking layer, not core routing) turned out to be wrong for this LiteLLM build: it hard-depends on a DB connection existing for key auth, and throws a misleading `"No connected db"` error even with a correct master key if neither `prisma_client` nor `custom_db_client` is configured (confirmed against `BerriAI/litellm` issues #2532, #4880, #12273 — not something fixable from config alone). `DATABASE_URL` now points at a **free-tier Supabase Postgres instance**, using Supabase's **direct connection** (port `5432`), not its transaction-mode connection pooler (port `6543`) — the pooler doesn't support the multi-statement/advisory-lock behavior LiteLLM's startup `prisma migrate deploy` needs, and hangs/times out against it. This avoids Cloud SQL's recurring cost while still satisfying the hard DB requirement.

Trade-off still accepted, DB or not: there's no separately-scoped, revocable key distinct from `LITELLM_MASTER_KEY` in active use — the master key is what GitHub Actions/the orchestrator actually use, since wiring up real per-project dynamic key issuance (now technically possible with the DB in place) hasn't been built yet. Worth doing once `app-2`/`app-3` make spend-by-repo breakdown actually matter.

**(Re-revised) budget alert moves outside LiteLLM entirely.** Rather than LiteLLM's own DB-backed alerting (which needs the Postgres this doc just dropped), the budget alert is **GCP's native Billing → Budgets & alerts** on the underlying Gemini/Vertex spend — free, no extra infrastructure, and arguably more authoritative since it reflects actual billed spend rather than LiteLLM's own estimate. This still satisfies the original goal (§8, §9.1): a real alert live before real pipeline traffic runs, just via a different mechanism than originally planned.

---

## 4. Dev ticket pipeline

### 4.1 Triggers — four entry points, one job

The pipeline must be startable by:
- a GitHub label change (e.g. label set to `approved`)
- a prompt in conversation (chat platform → orchestrator)
- a direct Postman/curl request to the orchestrator's HTTP API
- an `@agent_name` comment on a GitHub issue or PR

All four normalize into the same internal job payload (`{repo, issue_number, action, requested_by, source}`) via a trigger adapter, so the orchestrator only ever handles one shape of job regardless of where it came from. Concretely:

- GH label and `@mention` triggers fire natively via GitHub Actions (`on: issues: types: [labeled]` and `on: issue_comment`).
- Chat and curl/Postman triggers hit the orchestrator's own `POST /trigger` endpoint, which then calls GitHub's `repository_dispatch` API so the same GitHub Actions workflow runs regardless of origin.

**(Revised) `@mention` author check:** the workflow condition matches on comment *body* only. Even though `agent-ops` and its app repos are private with a single collaborator today, the `if:` condition should also check `github.event.comment.user.login` against an allowlist (currently just `heyitschloe`) before honoring `@dev-agent implement`. This is cheap defense-in-depth against the day access is ever widened, and costs nothing while it isn't.

### 4.2 Planning stage — real GitHub sub-issues, not text blocks

GitHub has a native sub-issues feature (REST + GraphQL): up to 100 sub-issues per parent, 8 levels of nesting, and sub-issues inherit the parent's project/milestone. The planning stage should:

1. Read the issue and the relevant project skill (see §6).
2. Draft an approach doc.
3. Create one real GitHub sub-issue per subtask via `POST /repos/{owner}/{repo}/issues/{issue_number}/sub_issues` (or the GraphQL `addSubIssue` mutation) — the subtask's content becomes that sub-issue's **description**, not a checklist line.
4. Use sub-sub-issues for further breakdown where useful (up to 8 levels deep).
5. Post "added notes" as **comments** on whichever issue/sub-issue/sub-sub-issue they relate to, rather than rewriting descriptions.
6. Label the parent issue `approach-ready` and stop — wait for human approval.

**(Revised) idempotency:** if planning fails partway (e.g. 3 of 5 sub-issues created, then an API error), the job must be safely re-runnable — check for existing sub-issues matching the plan before creating new ones, rather than creating duplicates on retry. This is a Phase 3/4 checkpoint now, not a Phase-10 afterthought (§9.1).

### 4.3 Implementation stage — Claude Code

Once the issue is labeled `approved`, **Claude Code** is the implementor:

- Runs headless (`claude -p`) via the official `anthropics/claude-code-action@v1` GitHub Action, authenticated against the LiteLLM gateway rather than the Anthropic API directly, so the model behind this step is swappable.
- Reads the approved approach doc and its sub-issues, implements the change, writes unit tests as part of the implementation, commits, and opens a PR.
- Adds the designated reviewer to the PR automatically — **(Revised)** the reviewer is a per-project field in `registry/projects.yaml` (§6), not fixed. Every project's entry currently sets `reviewer: heyitschloe`, but nothing structural limits it to one person; adding a second reviewer later is a registry edit, not a pipeline change.

**Billing note:** automated/headless Claude usage (Agent SDK, headless `claude -p`, GitHub Actions, third-party agents) is metered separately from interactive `claude.ai` chat or interactive terminal Claude Code usage. Check current terms at docs.claude.com before scaling usage, since this is a recent change and may evolve.

### 4.4 Quality gate — Qodo

Qodo sits *after* implementation, not as part of code generation:

- **Qodo Cover** generates additional unit tests targeting uncovered code paths, runs them, and keeps only tests that pass and measurably raise coverage toward a target (e.g. 85–90%). This runs as a GitHub Action (`qodo-ai/qodo-ci/.github/actions/qodo-cover@v0.1.12`).
- **Qodo Merge** (Qodo's Git integration) reviews the diff for bugs/security/standards issues and can cross-check the diff against the linked ticket's requirements, flagging partial implementations.
- **Scope and limits, honestly:**
  - Qodo does **not** generate tests purely from a pre-implementation spec — it analyzes actual code/diffs. To approximate "tests from the approach," have Claude Code write tests first (TDD-style) against the approach doc's acceptance criteria as part of implementation; Qodo's value-add is auditing what's there afterward.
  - **Unit tests:** Qodo's core strength.
  - **Integration tests:** Qodo can scaffold setup/teardown but the assertions usually need manual review.
  - **E2E tests:** out of Qodo's scope. Plan on Claude Code writing Playwright/Cypress specs directly as part of implementation; Qodo can confirm they exist and pass, but won't generate them.
- On failure, the gate sends the PR back to the implementation step rather than pinging you directly, to avoid notification noise on an unattended pipeline.
- **(Revised) self-hosted fallback decision point:** this build uses self-hosted `PR-Agent` + `qodo-cover` against the LiteLLM gateway instead of the hosted Qodo product (§8). Before relying on this in production, explicitly test self-hosted coverage/review quality against a few real diffs. If it doesn't reach usable parity with the hosted product within the Phase 4/5 test tickets, the fallback is reverting to hosted Qodo for the gate step only — decide this at the Phase 5 checkpoint, not silently mid-build.

### 4.5 GitHub Actions workflow — reusable, not per-repo copy-paste

**(Revised)** the original draft had a single `dev-pipeline.yml` living independently in each app repo, explicitly *not* shared — a direct exception to the "one integration per surface" principle in §2. That's fixed here: the actual pipeline logic lives once, centrally, as a **reusable workflow** in `agent-ops`; each app repo keeps only a thin caller.

**Central reusable workflow** — `agent-ops/.github/workflows/dev-pipeline-reusable.yml`:

```yaml
name: dev-pipeline-reusable

on:
  workflow_call:
    inputs:
      project_language: { required: true, type: string }
      test_command: { required: true, type: string }
      coverage_type: { required: true, type: string }
      desired_coverage: { required: true, type: number }
      skill_folder: { required: true, type: string }
      reviewer: { required: true, type: string }
      action: { required: true, type: string }   # "plan" | "implement"
    secrets:
      LITELLM_PROXY_URL: { required: true }
      LITELLM_VIRTUAL_KEY: { required: true }
      GH_APP_ID: { required: true }
      GH_APP_PRIVATE_KEY: { required: true }

jobs:
  plan:
    if: inputs.action == 'plan'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/create-github-app-token@v1
        id: app-token
        with:
          app-id: ${{ secrets.GH_APP_ID }}
          private-key: ${{ secrets.GH_APP_PRIVATE_KEY }}
      - uses: anthropics/claude-code-action@v1
        env:
          ANTHROPIC_BASE_URL: ${{ secrets.LITELLM_PROXY_URL }}
          ANTHROPIC_API_KEY: ${{ secrets.LITELLM_VIRTUAL_KEY }}
          GITHUB_TOKEN: ${{ steps.app-token.outputs.token }}
        with:
          prompt: |
            Read this issue and ${{ inputs.skill_folder }}/SKILL.md. Produce an approach doc.
            Before creating sub-issues, check for existing sub-issues on this parent that already
            match the plan (idempotency: do not duplicate on a retried run).
            Create one GitHub sub-issue per subtask via the sub-issues API,
            with the subtask's content as that sub-issue's body.
            Then label this issue "approach-ready".
          claude_args: "--max-turns 12 --model planning"

  implement:
    if: inputs.action == 'implement'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/create-github-app-token@v1
        id: app-token
        with:
          app-id: ${{ secrets.GH_APP_ID }}
          private-key: ${{ secrets.GH_APP_PRIVATE_KEY }}
      - uses: anthropics/claude-code-action@v1
        env:
          ANTHROPIC_BASE_URL: ${{ secrets.LITELLM_PROXY_URL }}
          ANTHROPIC_API_KEY: ${{ secrets.LITELLM_VIRTUAL_KEY }}
          GITHUB_TOKEN: ${{ steps.app-token.outputs.token }}
        with:
          prompt: |
            Implement the approved approach for this issue and its sub-issues.
            Write unit tests for the core logic as part of the implementation.
            Open a PR and request review from ${{ inputs.reviewer }}.
          claude_args: "--max-turns 30 --model implementation"

      - name: Qodo coverage gate
        uses: qodo-ai/qodo-ci/.github/actions/qodo-cover@v0.1.12
        with:
          github_token: ${{ steps.app-token.outputs.token }}
          branch: ${{ github.head_ref }}
          project_language: ${{ inputs.project_language }}
          project_root: .
          code_coverage_report_path: ./coverage/cobertura-coverage.xml
          coverage_type: ${{ inputs.coverage_type }}
          test_command: ${{ inputs.test_command }}
          desired_coverage: ${{ inputs.desired_coverage }}
          max_iterations: 3
```

**Per-app-repo caller** — e.g. `BusyBuddy_v2/.github/workflows/dev-pipeline.yml`:

```yaml
name: dev-pipeline

on:
  issues:
    types: [labeled]
  issue_comment:
    types: [created]
  repository_dispatch:
    types: [agent-trigger]

jobs:
  dispatch:
    uses: HeyItsChloe/agent-ops/.github/workflows/dev-pipeline-reusable.yml@main
    with:
      project_language: typescript
      test_command: "npm test -- --coverage"
      coverage_type: cobertura
      desired_coverage: 85
      skill_folder: skills/app-1
      reviewer: heyitschloe
      action: >-
        ${{
          (github.event.label.name == 'approach-ready' && 'plan') ||
          (github.event.label.name == 'approved' && 'implement') ||
          (contains(github.event.comment.body, '@dev-agent plan') && 'plan') ||
          (contains(github.event.comment.body, '@dev-agent implement') && 'implement') ||
          github.event.client_payload.action
        }}
    secrets: inherit
```

Every input the reusable workflow needs (`test_command`, `coverage_type`, `desired_coverage`, `project_language`, `skill_folder`, `reviewer`) is sourced from that repo's `registry/projects.yaml` entry (§6) when the caller is generated — see the scaffold skill in §6.1. This keeps one source of truth instead of the value living in both the registry and a repo-level GitHub Actions variable.

This is a working skeleton, not a copy-paste-and-done file — exact `claude_args` flags and Qodo's required inputs vary per repo/stack. Validate end to end on one repo before replicating.

---

## 5. Personal assistant pipeline

### 5.1 Chat front end — platform-agnostic via MCP

Discord is not required. Instead of a fixed chat app, the system exposes **one MCP (Model Context Protocol) server** wrapping the orchestrator's functions as tools. Any MCP-capable chat client can then connect to that same server — the chat platform becomes swappable without rebuilding the integration.

**(Revised) tool surface, collapsed:** the original draft listed a separate tool per personal-project type (`plan_trip`, `source_property`, etc.), which meant adding a new personal project required adding a new tool — breaking the "config entry, not new code" principle in §2. Instead:

| Tool | Scope |
|---|---|
| `create_ticket` | Dev pipeline — file a new ticket on a registered app repo |
| `check_status` | Dev or personal — status of any registered job/ticket |
| `request_approval` | Dev pipeline — apply the `approved` label / equivalent |
| `run_project_pipeline(project, request)` | **Generic** entry point for any `type: personal` registry entry — dispatches by project name, so a new personal project is a new registry entry, not a new tool |
| `scaffold_project(name, type, repo?)` | Onboard a new dev or personal project — see §6.1 |

Platform readiness for this, current as of mid-2026:

| Platform | MCP support for personal/consumer chat | Notes |
|---|---|---|
| **Claude** | Native, mature | Best choice for backend automation regardless; also works fine as a chat client. |
| **ChatGPT** | Strong — Developer Mode (Plus+) supports full read/write MCP connectors via Settings → Connectors; Apps SDK for published/distributable integrations | Best all-around daily-driver chat experience: broadest memory, most mature Actions/MCP ecosystem, solid voice mode. |
| **Gemini** | Strong in Gemini CLI / Antigravity / Gemini Enterprise; noticeably behind in the consumer mobile/web app | Best if workflow lives in Google Workspace (Gmail/Drive/Docs/Sheets); MCP via the everyday consumer chat app isn't yet as turnkey as ChatGPT's. |
| **Perplexity** | Local MCP available now (Mac app only); remote MCP still rolling out | Best for the research-heavy personal pipelines (property/asset/trip due diligence) once remote MCP lands; Zapier MCP integration covers 9,000+ apps as an interim bridge. |

**Decision: claude.ai is the chat front end for this build.** It has native, mature MCP support, so the MCP server connects directly as a Claude connector with no Developer Mode toggle or OpenAPI schema needed. The MCP-agnostic design still holds: ChatGPT or another client could be added as a second front end later by connecting to the same server, with no backend changes.

**What "chat" vs. "automation" means in practice:** the chat platform is the front door — wherever you type. Every actual action (creating tickets, running research, modifying GitHub state) is executed by the orchestrator and, for anything substantive, by **Claude** specifically — Claude Code for dev work, Claude API (via the gateway) for planning/analysis/PA tasks. Swapping the chat app never changes which engine does the work.

### 5.2 Notifications — chat only

**(Revised)** Bird (bird.com) was evaluated as a unified multi-channel notification API (SMS/email/WhatsApp/voice) in the original draft, marked "descoped for now." That's now a permanent decision, not a deferred one: it added a dependency and an integration surface with no current use case. **There is no separate notification channel in this system.** Every result — status updates, approach docs, PR links, PDFs — is delivered back through whichever MCP-connected chat client made the request. If a genuine need for out-of-band notification (e.g. SMS for time-sensitive approvals) shows up later, it gets evaluated fresh at that point rather than carried as unused scaffolding now.

### 5.3 Personal pipeline flow

Chat request (any connected MCP client) → orchestrator's trigger adapter → routed via `run_project_pipeline` to the relevant personal project's skill + model alias → Claude (via gateway) executes the research/planning/action → result delivered back in the same chat thread.

**(Revised) LinkedIn ToS note (Phase 7):** "draft and queue, never auto-submit" removes the auto-apply risk, but doesn't by itself clear LinkedIn's Terms of Service — that depends on *how* job data is sourced. If the research/sourcing step scrapes LinkedIn pages directly rather than going through permitted access (manual browsing you do yourself, or an official/authorized API), that's a separate exposure worth resolving explicitly before Phase 7's checkpoint, not assumed away by the no-auto-submit rule.

---

## 6. Agents & skills repo, and multi-project scaling

One control repo (`agent-ops/`) holds the orchestrator, the model gateway config, and a skill folder per project — app or personal. Each project is a config entry, not a duplicated pipeline.

```
agent-ops/
├── .github/
│   └── workflows/
│       └── dev-pipeline-reusable.yml   # the one shared workflow_call target (§4.5)
├── litellm/
│   ├── config.yaml
│   └── docker-compose.yml
├── orchestrator/
│   ├── src/
│   │   ├── server.ts                  # POST /trigger, /webhook/github, /webhook/mcp — all authenticated
│   │   ├── auth.ts                    # shared-secret / token check on all inbound endpoints (Revised)
│   │   ├── logging.ts                 # structured logs + correlation ID per job run (Revised)
│   │   ├── triggers/
│   │   │   ├── github_label.ts
│   │   │   ├── github_mention.ts      # includes commenter allowlist check (Revised)
│   │   │   ├── chat_command.ts        # via the MCP server
│   │   │   └── http_api.ts            # Postman/curl entrypoint
│   │   ├── jobs/
│   │   │   ├── plan_ticket.ts         # subtasks + approach via GH sub-issues API, idempotent retries (Revised)
│   │   │   ├── implement_ticket.ts    # invokes Claude Code via gateway
│   │   │   ├── quality_gate.ts        # invokes Qodo
│   │   │   ├── open_pr.ts
│   │   │   └── scaffold_project.ts    # generates a new project's skill file + registry entry (Revised, §6.1)
│   │   ├── integrations/
│   │   │   ├── github.ts              # GitHub App JWT → installation token exchange (Revised)
│   │   │   ├── plane.ts
│   │   │   └── mcp_server.ts
│   │   └── registry/
│   │       └── projects.yaml          # one entry per app + personal project
│   └── package.json
├── skills/
│   ├── shared/
│   │   ├── approach-doc-format/SKILL.md
│   │   ├── approval-gate-protocol/SKILL.md
│   │   └── project-scaffold/SKILL.md   # generates new project skills — not a static template (Revised, §6.1)
│   ├── app-1/SKILL.md
│   ├── app-2/SKILL.md
│   ├── app-3/SKILL.md
│   └── personal/
│       ├── trip-planning/SKILL.md
│       ├── property-sourcing/SKILL.md
│       └── asset-purchase/SKILL.md
```

**(Revised)** `integrations/bird.ts` and `integrations/qodo.ts` are removed from this tree: Bird per §5.2, and Qodo is invoked as a GitHub Action step (§4.5) rather than an orchestrator-side integration, since it never needs to be called outside that workflow context.

`registry/projects.yaml` is the scaling mechanism — adding a 4th app or a 4th personal project is a new entry, not new pipeline code. **(Revised)** the schema now carries the fields the reusable workflow needs, so nothing is hardcoded per-repo YAML:

```yaml
- project: app-1
  type: dev
  repo: github.com/HeyItsChloe/BusyBuddy_v2
  model_profile: implementation     # alias from litellm/config.yaml
  skill_folder: skills/app-1
  test_gate: qodo
  project_language: typescript
  test_command: "npm test -- --coverage"
  coverage_type: cobertura
  desired_coverage: 85
  reviewer: heyitschloe

- project: trip-planning
  type: personal
  skill_folder: skills/personal/trip-planning
  model_profile: planning
```

### 6.1 Onboarding a new project — a skill, not a static template

**(Revised)** the original idea of a static `skills/_template/SKILL.md` file was dropped: an inert template that a human copies by hand is exactly the kind of asset that goes stale and doesn't get reused consistently. Instead, onboarding a new dev or personal project is itself a pipeline capability:

- `skills/shared/project-scaffold/SKILL.md` defines what a valid project skill must contain (conventions, test commands, guardrails, PR/approach format) and how a new registry entry must be structured.
- `orchestrator/src/jobs/scaffold_project.ts`, exposed as the `scaffold_project(name, type, repo?)` MCP tool (§5.1), invokes Claude with that skill to actually generate `skills/<name>/SKILL.md`, append the `registry/projects.yaml` entry, and — for a `type: dev` project — generate the thin per-repo caller workflow shown in §4.5 with that project's values filled in.

This turns what were Phase 8/9 manual steps ("write a new project skill folder," "add a registry entry," "copy the workflow file") into one reused, agent-driven action instead of three hand-done steps repeated per project.

---

## 7. Component summary — what does what

| Component | Role | Why this one |
|---|---|---|
| **LiteLLM** | Model gateway | Free, open source, makes every model choice a config change |
| **GitHub Actions** | Compute for dev pipeline runs | Native trigger source, free/cheap, no separate webhook infra for GH-side events; one reusable workflow shared across repos (Revised) |
| **GitHub App** | Cross-repo GitHub auth | **(Revised)** replaces a fine-grained PAT — permissions are set once on the App, and scaling to a new repo is an install, not a re-minted/re-scoped token |
| **Claude Code** | Implementor for dev tickets | Native repo/git awareness, headless execution, official GitHub Action |
| **Qodo** (self-hosted PR-Agent + qodo-cover) | Post-implementation quality gate | Strong unit test generation + coverage validation; complements rather than duplicates Claude Code — with a defined fallback to hosted Qodo if parity isn't reached (§4.4) |
| **Cursor** | Optional manual-intervention coding surface | Useful when a ticket needs a human to jump in mid-task; Claude Code remains the default headless executor |
| **MCP server (custom)** | Chat-platform-agnostic front door | One integration, many possible chat clients (Claude, ChatGPT, Gemini, Perplexity); one generic personal-project tool instead of one per project (Revised) |
| **ChatGPT** (or other MCP client) | Optional second chat interface | Swappable without backend changes if added later |
| **GitHub native sub-issues** | Subtask tracking | Real tracked hierarchy in the GitHub UI instead of text checklists |
| **agent-ops repo (skills + registry)** | Multi-project scaling | Each project is a config entry; pipeline logic is written once; onboarding itself is a skill, not a manual template copy (Revised) |

**(Revised)** Bird is removed from this table — see §5.2.

---

## 8. Confirmed configuration (decisions log)

- **Dev project #1:** `11thandOrange/BusyBuddy_v2`. Currently has a working but different pipeline — OpenHands-based, triggered by a single `ready-to-implement` label, no plan/approval gate, with its own agent roster (`ticket-planner`, `busybuddy-implementer`, `shopify-extension-implementer`, `tester`, `smoke-tester`, `pr-reviewer`) and shared agents in `HeyItsChloe/.agents` (`ticket-manager`, `ci-monitor`, `whatsapp-notifier` via callmebot/Twilio). **Decision: replace this entirely** with the GH Actions + Claude Code + LiteLLM + Qodo architecture in this doc, including the planning/approval gate and real GitHub sub-issues it currently lacks. The OpenHands automation registration, the `ready-to-implement` label trigger, and the callmebot WhatsApp notifier step should all be retired as part of this — don't run both pipelines on the same repo at once.
- **Agents & skills repo:** `HeyItsChloe/agent-ops` (currently empty) is the long-term home for all skills and orchestrator code. `HeyItsChloe/.agents` is the legacy location BusyBuddy_v2 currently points at — `agent-ops` will replace it once the rebuild lands; until then `.agents` stays as a reference for what the old pipeline did, not as an active dependency.
- **Reviewer for all dev pipeline PRs:** `@heyitschloe` for now, set per-project in `registry/projects.yaml` — **(Revised)** the field was always meant to support other reviewers later; nothing changes structurally when a second reviewer is added, it's a registry edit.
- **(Re-revised) Hosting — live:** moved from the originally-provisioned Oracle Cloud Free Tier instance to **Google Cloud Run**, GCP project `agent-ops-501120`, region `us-central1`. Switched because the Oracle Cloud path required manual VM/VNIC/public-IP/Caddy setup with real friction, whereas Cloud Run gives HTTPS + a public endpoint automatically from a container push.
  - LiteLLM gateway: `https://litellm-gateway-836703226343.us-central1.run.app` (Phase 1 — live).
  - Orchestrator (MCP server mounted at `/mcp`): `https://orchestrator-836703226343.us-central1.run.app` (Phase 2 — live).
  - **(New) Deploy mechanism:** the orchestrator deploys via a GitHub Actions workflow (`.github/workflows/deploy-orchestrator.yml`) driven entirely by GitHub Secrets, not by running `gcloud` from a chat session — deliberately, so credentials never need to pass through chat. LiteLLM's first deploy was done manually via `gcloud` before this pattern was established; consider giving it the same treatment later.
- **Model gateway:** Gemini is the only configured model for now (`planning` and `implementation` aliases both point at a Gemini model in `litellm/config.yaml`). Anthropic key to be added later — when it lands, repoint those aliases at Claude rather than standing up new ones, so nothing else in the system needs to change.
- **(Re-revised) Budget alert — live:** GCP's native Billing → Budgets & alerts (budget named "Agent-Ops", scoped to `agent-ops-501120`) rather than LiteLLM's own DB-backed alerting — set up before real pipeline traffic ran, per the original Phase 1 goal.
- **Quality gate:** self-hosted `PR-Agent` (`The-PR-Agent/pr-agent`) for review + self-hosted `qodo-cover` for test generation/coverage, both pointed at the LiteLLM gateway. Replaces the hosted Qodo product referenced earlier in this doc, with the fallback decision point in §4.4. **Not yet wired into the reusable workflow** — only `qodo-cover` is in `dev-pipeline-reusable.yml` today; the PR-Agent step is still an open Phase 4 task.
- **Personal project #1:** resume builder + job applier. Generates resumes and cover letters as **PDF**. Targets **LinkedIn only for now**, with other job sites added later on request. The pipeline never submits on its own; it prepares the PDF and application content, and a human clicks submit in their own logged-in browser session. See §5.3 for the ToS caution on the sourcing step.
- **(Revised) GitHub access — live:** a custom **GitHub App** (`pipeline-orchestrator-opps`, not a PAT) with Issues/PRs/Contents permissions. Installed as **two separate installations**: one on the `heyitschloe` personal account, one on the `11thandOrange` organization (covering `BusyBuddy_v2`) — each has its own installation ID, since GitHub App installations are per-account/org, not global to the App. The App's ID and private key live in GitHub Secrets, not in chat or any file in this repo.
- **(Revised) Notifications:** chat only, permanently — Bird is not part of this system (§5.2).
- **(Revised) Orchestrator endpoint auth — verified:** `/trigger`, `/webhook/mcp`, and `/webhook/github` all require a shared-secret or token check from the moment they're stood up in Phase 2. Confirmed working post-deploy: unauthenticated requests to `/trigger` and `/webhook/mcp` return `401`; authenticated requests pass through to Zod validation. `/webhook/github` (GitHub's own HMAC signature, not the shared secret) still needs the GitHub App's Webhook URL pointed at the live orchestrator before it can be exercised for real.
- **(New) Chat-exposed credentials get rotated, not just noted.** During Phase 1/2 setup, the GitHub App webhook secret, the GCP service account key, and the orchestrator's shared secret all ended up pasted into a chat session at some point (needed at the time to get deployment working manually, before the GitHub-Secrets-driven deploy workflow was in place). Decision: any credential that touches a chat transcript during setup is treated as compromised by default and rotated once the pipeline is stable, regardless of whether anything has actually gone wrong — see the Phase 10 checklist item.

## 9. Open items to validate before relying on this in production

- Confirm current Claude automation billing terms (the split between interactive chat/Code usage and headless/Agent SDK usage) at docs.claude.com before estimating monthly automation cost.
- Validate Qodo's exact GitHub Action inputs and coverage report format against your specific stack per repo — the sample YAML is a starting skeleton. If self-hosted PR-Agent/qodo-cover don't reach usable parity with hosted Qodo by the Phase 5 checkpoint, fall back to hosted Qodo for the gate step (§4.4).
- Track Gemini consumer-app and Perplexity remote-MCP rollout if you want either as a chat front end beyond Claude/ChatGPT.
- Re-test the plan → approve → implement → gate → PR loop end to end on one app repo before replicating the registry pattern to additional apps or personal projects.
- **(Revised, moved up from a later phase)** confirm what happens on partial failure at each stage (e.g. Claude Code opens a PR but the coverage gate errors, or planning creates some but not all sub-issues) — this must be a Phase 3/4 checkpoint, not discovered later, since idempotent retries depend on it (§4.2, §9.1).
- **(New)** revisit the single-reviewer setup if/when a second app repo's PR volume makes `@heyitschloe` a bottleneck — no pipeline change needed, just a registry edit (§8).

### 9.1 Reliability and observability, built in from Phase 2–3 (not Phase 10)

**(Revised)** these were originally listed only in a final hardening phase; moved earlier because the risk window (endpoints live and unauthenticated, no logs, no idempotency) otherwise spans most of the build:

- Real authentication on `/trigger` and `/webhook/mcp` from Phase 2 onward.
- A correlation/job ID attached to every trigger → orchestrator → GitHub Action → Claude Code → Qodo run, with basic structured logging, so a stuck pipeline is debuggable without re-reading code.
- Idempotent planning/implementation jobs, tested deliberately (not just the happy path) at the Phase 3/4 checkpoint.
- A monthly budget alert on model spend, live from the end of Phase 1.

What's left for a true end-of-build hardening pass:
- Re-check current Claude automation billing terms, Gemini/Perplexity consumer MCP support, and the self-hosted PR-Agent/qodo-cover setup against your stack — all are moving targets.
- Back up `agent-ops` (skills, registry, orchestrator code) somewhere beyond GitHub's own availability — this repo is now infrastructure, not just code.

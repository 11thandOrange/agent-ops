# Implementation Roadmap

Step-by-step build order for the multi-pipeline agent automation system. Companion to `multi-pipeline-agent-strategy.md` — that doc explains *what* and *why*; this one is *in what order, concretely*.

Each phase ends with a checkpoint: don't move to the next phase until the checkpoint passes. Build on one app repo and one personal project first — replicate to the rest only after the pattern is proven.

> **Revision note:** this version folds in a design review's decisions — GitHub App instead of PAT, Bird removed, skill onboarding turned into a reusable pipeline capability instead of a static template, and several hardening steps (auth, logging, idempotency, budget alerts) moved earlier instead of sitting in a final phase. Each change is marked **(Revised)** where it lands.

---

## Phase 0 — Accounts, access, and decisions to lock in first

- [x] Anthropic API account — pending. Gemini is the configured model for now; Claude aliases will be repointed when the key lands.
- [x] **(Re-revised) Hosting — live:** moved from the originally-provisioned Oracle Cloud Free Tier instance to **Google Cloud Run** (project `agent-ops-501120`, region `us-central1`) — the manual VM/VNIC/public-IP/Caddy setup on Oracle Cloud had real friction; Cloud Run gives an HTTPS endpoint automatically from a container push. GCP project created, billing linked, scoped service account (`agent-ops-deployer`) created with Cloud Run Admin, Service Account User, Cloud Build Editor, Artifact Registry Administrator, Storage Admin, Logs Viewer.
- [x] Create the control repo: `agent-ops` (`HeyItsChloe/agent-ops`) — no longer empty; holds the orchestrator, litellm config, skills, and both deploy workflows.
- [x] Pilot app repo: `11thandOrange/BusyBuddy_v2`. Pilot personal project: resume builder + job applier (LinkedIn, PDF output, draft-and-queue — no auto-submit).
- [ ] Qodo account — not needed; using self-hosted `PR-Agent` + `qodo-cover` instead (BYOK against the Gemini/Claude gateway).
- [x] Chat front end for the pilot: **claude.ai** — connect the MCP server as a Claude connector rather than via ChatGPT Developer Mode.
- [x] **(Revised) GitHub App, not a PAT — done.** Custom GitHub App `pipeline-orchestrator-opps` created with Issues/PRs/Contents permissions, installed as two separate installations: one on the `heyitschloe` personal account, one on the `11thandOrange` organization (covering `BusyBuddy_v2`). App ID, private key, and both installation IDs live in GitHub Secrets, never in chat or in this repo.
- [ ] **Retire the OpenHands pipeline on BusyBuddy_v2** — still outstanding, blocked on this session's repo scope (can't touch `BusyBuddy_v2` directly from here regardless of the App being installed there now). Do this in a new session scoped to that repo — disable/remove the OpenHands automation registration (ID `3cfefdb0-a1bc-4f26-bcc6-4136ff0fb4da`), stop using the `ready-to-implement` label trigger, and turn off the callmebot WhatsApp notifier step so the two pipelines don't fire on the same issue.

**Checkpoint — met, except OpenHands retirement:** GCP project with billing linked and a scoped service account exists, Gemini API key confirmed working (real completions returned), the GitHub App is created and installed on both accounts. BusyBuddy_v2's old automation is not yet disabled — carries into Phase 3.

---

## Phase 1 — Stand up the model gateway — ✅ COMPLETE

Live at `https://litellm-gateway-836703226343.us-central1.run.app`.

1. Deployed `litellm/` (config.yaml + Dockerfile) to **Cloud Run**, project `agent-ops-501120`, region `us-central1` — first deploy was done manually via `gcloud run deploy --source litellm/` from a chat session (before the GitHub-Secrets-driven deploy pattern used for the orchestrator existed).
2. `litellm/config.yaml` has the `planning` and `implementation` aliases pointed at Gemini, with a commented-out Anthropic block ready to uncomment once that key arrives.
3. **(Re-revised twice)** an initial attempt to run without Postgres failed: this LiteLLM build hard-requires a DB connection for key auth, throwing a misleading `"No connected db"` error even with a correct master key (confirmed against `BerriAI/litellm` #2532, #4880, #12273). Added Postgres back via a **free-tier Supabase instance**, using its **direct connection** (port `5432`) — the transaction pooler (port `6543`) hangs on LiteLLM's startup `prisma migrate deploy`, which needs session-level behavior the pooler doesn't support.
4. Confirmed the deployed service responds with a real completion (`curl .../v1/chat/completions` with the master key) — took a few debugging rounds (the DB timeout, then a corrupted copy-paste of the master key producing a `401`) before landing on a genuine `200` with real model output.
5. No separate virtual key issued — `LITELLM_MASTER_KEY` is what GitHub Actions/the orchestrator use directly (§3's accepted trade-off, still true even with Postgres back, since dynamic key issuance was never wired up).
6. HTTPS is automatic on Cloud Run — no Caddy/Let's Encrypt/VNIC setup needed.
7. Budget alert live: GCP Billing → Budgets & alerts, budget named "Agent-Ops", scoped to `agent-ops-501120`.

**Checkpoint — met:** a curl request through the Cloud Run HTTPS URL, using the master key, returns a real completion. A GCP budget alert is live.

---

## Phase 2 — Scaffold the control repo — ✅ COMPLETE

Orchestrator live at `https://orchestrator-836703226343.us-central1.run.app`, MCP mounted at `/mcp`.

1. `agent-ops` folder structure in place (`orchestrator/`, `skills/`, `litellm/`, `.github/workflows/`).
2. Orchestrator built in Node/TypeScript/Express with three routes:
   - `POST /trigger` — generic entry point for chat/curl/Postman
   - `POST /webhook/github` — receives GitHub webhook events
   - `POST /webhook/mcp` — backing endpoint for the MCP server (Phase 6)
3. Real authentication verified working post-deploy: unauthenticated `POST /trigger` returns `401`; with the correct shared secret, requests pass through to Zod body validation (`400` on missing fields, not `401`) — confirmed auth is genuinely gating, not a no-op.
4. Structured logging with a correlation ID per request is wired (`src/logging.ts`).
5. `registry/projects.yaml` has the `app-1` entry using the extended schema (`model_profile`, `skill_folder`, `test_gate`, `project_language`, `test_command`, `coverage_type`, `desired_coverage`, `reviewer`).
6. Shared skills written: `approach-doc-format`, `approval-gate-protocol`, and `project-scaffold` (the onboarding-as-a-skill capability, §6.1).
7. `skills/app-1/SKILL.md` written by hand as the reference example for BusyBuddy_v2.
8. `agent-ops/.github/workflows/dev-pipeline-reusable.yml` written — the one place the dev pipeline's CI logic lives.
9. **(New)** deployed via a dedicated GitHub Actions workflow (`.github/workflows/deploy-orchestrator.yml`), driven entirely by GitHub Secrets rather than running `gcloud` from chat — the credential-in-chat problem from Phase 1's LiteLLM deploy prompted building this pattern before deploying the orchestrator.
10. **Still open:** the GitHub App's Webhook URL hasn't been pointed at `https://orchestrator-836703226343.us-central1.run.app/webhook/github` yet, so `/webhook/github`'s real HMAC signature verification hasn't been exercised against a live GitHub event yet (the shared-secret-based endpoints are confirmed; this one needs an actual webhook delivery to prove out).

**Checkpoint — met:** `agent-ops` has a running orchestrator, reachable over HTTPS, genuinely authenticated (verified via curl, not assumed), logging with correlation IDs, all skills written, and the reusable workflow file in place.

---

## Phase 3 — Dev pipeline: planning stage only — ✅ COMPLETE

Validated live against `11thandOrange/BusyBuddy_v2`. Getting here took several rounds of real-run debugging, not a clean first pass — each of these was found from an actual Actions log, not anticipated in advance:

- Missing `id-token: write` permission blocked `anthropics/claude-code-action@v1`'s OIDC request — added explicit `permissions:` blocks to both reusable-workflow jobs (the caller workflow needs a matching block too, since reusable-workflow permissions are the *intersection* of caller and callee).
- `gemini-2.5-pro` had a `0` free-tier quota — `planning` alias repointed to `gemini-2.5-flash`, with `implementation-fallback` wired in for both aliases.
- Skill files (`.agent-ops/...`) didn't exist in the runner's checkout — added a second cross-account GitHub App token + checkout of `agent-ops` itself into `.agent-ops/`.
- The agent stopped and asked for interactive tool approval with no human to answer it on a CI runner — fixed with `--permission-mode dontAsk` plus explicit `--allowedTools`, verified locally against the raw CLI before trusting it in CI.
- The prompt never named which issue to work on (the action doesn't auto-inject issue context) — interpolated the issue number into the prompt from both possible trigger shapes; this also surfaced that the orchestrator's own `dispatchRepositoryEvent` never sent the issue number in its `repository_dispatch` payload, fixed across `github.ts`/`plan_ticket.ts`/`implement_ticket.ts`.
- Retroactive sub-issue linking (`gh api .../sub_issues` or a GraphQL `addSubIssue` mutation after creating a plain issue) reliably 403'd — the prompt and `approach-doc-format/SKILL.md` now mandate the atomic `gh issue create --parent` form exclusively.

**Checkpoint — met:** real GitHub sub-issues get created with subtask content in their descriptions, the parent issue gets labeled `approach-ready`, and a retried plan run doesn't duplicate sub-issues.

**Still outstanding from this phase's original scope, not blocking:** the OpenHands retirement on BusyBuddy_v2 (Phase 0) hasn't happened yet; the curl/`@dev-agent` trigger paths and the commenter-allowlist check haven't been separately exercised live (only the label-triggered path has been proven end to end).

---

## Phase 4 — Dev pipeline: implementation + quality gate — ✅ COMPLETE

Validated live on the same pilot repo. Two more rounds of real-run debugging on top of Phase 3's:

- The Qodo coverage-gate step's `--branch` input was empty, crashing with `fatal: empty string is not a valid pathspec`. First attempt (`github.head_ref`) was wrong because this job isn't `pull_request`-triggered. Second attempt (`claude-code-action`'s own `branch_name` output) reproduced the identical failure on retest, because that output is only populated when the action manages branch creation itself in its built-in "tag mode" — this workflow runs it in plain prompt mode, so Claude Code creates the branch itself via Bash and the action never sees it. Fixed by computing the branch name *before* Claude Code runs and having the prompt, the workflow step, and the Qodo input all reference that one precomputed value instead of two of them guessing independently.
- The same log surfaced a second bug: `.agent-ops`'s checkout sits inside the main working tree (nested `.git` dir), so a broad `git add -A` from Claude Code could get it auto-staged as a gitlink with no matching `.gitmodules` entry — fixed by excluding `.agent-ops/` via `.git/info/exclude` in both jobs, so git never sees it as trackable content in the outer repo.

**Checkpoint — met:** a real ticket went from `approved` label to a PR with the coverage gate running (not crashing) and the registry-configured reviewer tagged, with no manual steps in between.

**Still outstanding from this phase's original scope, not blocking:** the self-hosted PR-Agent/qodo-cover-vs-hosted-Qodo parity call, the deliberate under-tested-change gate-blocking check, folding in the existing Playwright smoke tests, and a deliberately forced mid-pipeline failure test haven't been separately exercised yet — worth doing during Phase 5's real-ticket runs rather than as a one-off synthetic test.

---

## Phase 4.5 — Two-tier skill model (repo-local + shared)

**(New)** Design decision made after Phase 3/4 validated: skills split into two tiers instead of every project's skill file living centrally in agent-ops (strategy doc §6).

- **Repo-local tier** — a project's own conventions, and anything scoped to exactly one repo (e.g. a single Android repo's gradle quirk), live *in that project's own repo*. Read unconditionally, no matching needed — placement is the scoping mechanism.
- **Shared tier** — skills meant to apply across every repo of a given kind (e.g. `fe-code-standards` for every Node repo) stay in `agent-ops/skills/shared/`, tagged `applies_to: all` or `applies_to: [<language>, ...]` in frontmatter, matched against each project's `project_language` (now a list). The workflow never hardcodes a skill name — reach is determined by the skill's own tag plus where the file lives.

Steps:
1. `registry/projects.yaml` schema: rename `skill_folder` → `skill_path` (now repo-relative, not agent-ops-relative — a breaking semantic change) and change `project_language` from a string to a list.
2. Add `applies_to` frontmatter to the existing shared skills (`all` for `approach-doc-format` and `approval-gate-protocol`, since both must always apply regardless of stack).
3. Add a step to `dev-pipeline-reusable.yml` (both `plan` and `implement` jobs) that reads every file under the project's own repo-local skill folder unconditionally, plus every `skills/shared/*/SKILL.md` in agent-ops whose `applies_to` matches the project's `project_language` list or is tagged `all` — and tells Claude Code to read the resulting list.
4. Update `scaffold_project.ts` so `type: dev` projects get their skill file written into the *target repo*, not agent-ops (it already writes the caller workflow there in the same call — the skill file joins it). `type: personal` projects are unaffected, they have no separate repo to move into.
5. **Migrate BusyBuddy_v2 — requires a BusyBuddy_v2-scoped session, this session can't write to that repo (scope is agent-ops-only):**
   - Copy `skills/app-1/SKILL.md`'s content into BusyBuddy_v2's own repo at the path its registry entry's new `skill_path` will point to.
   - Update BusyBuddy_v2's own `.github/workflows/dev-pipeline.yml` caller workflow to match the new `skill_path` input and pass `project_language` as a list.
   - Update the `app-1` entry in `agent-ops/orchestrator/src/registry/projects.yaml` to match, in the same change as step 3 landing — same "both sides together or nothing works" constraint as the earlier label rename. Until this lands, `plan`/`implement` runs on BusyBuddy_v2 will fail to find its skill file once the workflow switches to repo-relative reads.
6. Once migrated and confirmed working, delete `skills/app-1/SKILL.md` from agent-ops — BusyBuddy_v2's own copy becomes the single source of truth, and agent-ops keeps only `skills/shared/` and `skills/personal/`.

**Checkpoint:** a plan/implement run on BusyBuddy_v2 correctly reads its own repo-local skill plus any shared skills matching `project_language`, with the skill file no longer duplicated between agent-ops and BusyBuddy_v2.

---

## Phase 5 — Close the loop on one repo

1. Run 3–5 real tickets of varying size through the full pipeline (plan → approve → implement → gate → PR) on the pilot repo.
2. Tune the skill file (now living in BusyBuddy_v2's own repo per Phase 4.5, not `agent-ops/skills/app-1/SKILL.md`) based on what Claude Code consistently gets wrong or has to be told repeatedly.
3. Tune `max-turns` and the Qodo `desired_coverage` target based on real run costs/times.
4. Decide your approval mechanism for real use: is labeling `approved` by hand enough, or do you want the orchestrator to ping you somewhere first? Note this is a chat-only ping (strategy doc §5.2) — there is no separate notification channel to wire up.
5. **(Revised)** if PR volume across this repo alone already feels like a lot for one reviewer, this is the point to note it — no pipeline change needed, just a reminder that `reviewer` is a per-project registry field and can be changed anytime (strategy doc §8).

**Checkpoint:** you trust this pipeline enough to use it on real, non-test tickets without watching every step.

---

## Phase 6 — MCP server and chat front end

1. Build the MCP server wrapping the orchestrator's job functions as tools: `create_ticket`, `check_status`, `request_approval`, and **(Revised)** the generic `run_project_pipeline(project, request)` tool (instead of one tool per personal-project type) and `scaffold_project(name, type, repo?)` — using the official MCP SDK (TypeScript or Python — match your orchestrator's language).
2. Deploy it behind the same HTTPS domain as the orchestrator (a path like `/mcp` is fine), behind the same auth from Phase 2.
3. Connect it to your chosen chat platform:
   - **Claude (claude.ai):** add the MCP server as a connector in Claude's settings — this is the primary front end for this build.
   - **ChatGPT (optional, later):** Settings → Connectors → enable Developer Mode → Add custom connector → paste the MCP URL → authenticate, if you want a second front end on the same server down the line.
4. Test each tool from chat: "create a ticket for X in app-1," "what's the status of issue #42," "approve the approach on #42," "scaffold a new dev project called app-2."
5. Confirm write actions (creating tickets, approving, scaffolding) prompt for confirmation appropriately rather than firing silently — set this deliberately, don't rely on defaults.

**Checkpoint:** you can trigger and check on dev pipeline runs entirely from chat, with the same MCP server ready to connect to a second chat platform later with no backend changes.

---

## Phase 7 — Personal assistant: resume builder + job applier

1. Write the skill (`skills/personal/resume-job-applier/SKILL.md`): resume and cover letter format and content rules, **PDF as the output format** (use the pdf-creation skill/tooling when building this), and — important — the pipeline **drafts and queues, it never submits**. The job-search/application step ends with a reviewable package (PDF resume + cover letter + filled-but-unsubmitted application summary); a human clicks submit in their own logged-in LinkedIn session. Scope to LinkedIn only for now; other job sites get added as separate skill sections on request, since each site has its own automation risk profile to evaluate.
2. **(Revised)** before wiring the sourcing step, confirm how job data will actually be gathered — manual input, an authorized API, or something that scrapes LinkedIn pages directly. Only the first two are clearly fine on LinkedIn's ToS; scraping is a real exposure that "draft, don't submit" does not cover (strategy doc §5.3). Resolve this explicitly rather than assuming the no-auto-submit rule is sufficient.
3. Use `scaffold_project` (Phase 6) or add the project to `registry/projects.yaml` by hand with `type: personal`.
4. Wire the job through the orchestrator: chat request ("find me PM roles at mid-size SaaS companies and draft applications") → `run_project_pipeline` → load the skill → call the `planning` model alias (Gemini for now) → research/draft → return the PDF package in chat for review.
5. Test with a handful of real job postings, end to end, confirming the human-submit handoff is clear and nothing auto-submits.
6. **(Revised)** notifications: the result comes back through whichever chat platform is connected to the MCP server. There is no separate notification channel to add or configure — Bird is not part of this system.

**Checkpoint:** one real job application's resume + cover letter package is generated correctly as a PDF, with a clear "review and submit yourself" handoff, nothing was sent to LinkedIn without you clicking it, and the sourcing method has been confirmed as ToS-safe.

---

## Phase 8 — Scale to additional app repos

For each new app repo:
1. **(Revised)** install the GitHub App on the new repo — no PAT to re-mint or re-scope.
2. Call `scaffold_project(name: "app-2", type: "dev", repo: "...")` (Phase 6) to generate the project skill folder, the registry entry, and the thin caller workflow file in one action — rather than writing all three by hand as in the original plan.
3. Add the same two LiteLLM repo secrets (`LITELLM_PROXY_URL`, `LITELLM_VIRTUAL_KEY`) plus the GitHub App secrets if not inherited from an org-level secret.
4. Run the same 3–5 test tickets as Phase 5 before trusting it with real work, including the idempotency and forced-failure checks from Phases 3–4.

Do this for app-2 and app-3 only after Phase 5's checkpoint is solid — don't parallelize the first replication with debugging the original.

---

## Phase 9 — Scale to additional personal projects

For each new personal project (property sourcing, asset purchases, etc.):
1. Call `scaffold_project(name, type: "personal")` (Phase 6) to generate its skill folder and registry entry, rather than writing both by hand.
2. Confirm the registry entry references the right model alias.
3. Decide if it needs a dedicated context/thread separation from other personal projects (e.g. a clearly separated chat thread) so research on one project doesn't bleed into another. **(Revised)** this is chat-thread separation only — there's no separate sender identity to configure, since Bird and multi-channel notifications are not part of this system.
4. Test with real low-stakes requests before relying on it.

---

## Phase 10 — Remaining hardening

**(Revised)** most of the original Phase 10 items — endpoint auth, budget alerts, structured logging, idempotency/partial-failure handling — have been moved earlier (Phases 1–4) so the risk window they cover doesn't span the whole build. What's left here is genuinely end-of-build or ongoing:

- [ ] Re-check current Claude automation billing terms (once the Anthropic key is added), Gemini/Perplexity consumer MCP support, and your self-hosted PR-Agent/qodo-cover setup against your stack — all were noted as moving targets in the strategy doc.
- [ ] Back up `agent-ops` (skills, registry, orchestrator code) somewhere beyond GitHub's own availability — this repo is now infrastructure, not just code.
- [ ] Revisit the self-hosted Qodo fallback decision (strategy doc §4.4) once more real-world PRs have gone through the gate, in case behavior changes with scale.
- [ ] Revisit the single-reviewer setup if PR volume across multiple repos makes it a bottleneck (strategy doc §8) — a registry edit, not a rebuild.
- [ ] **(New) Rotate every credential that was ever pasted into a chat session during setup**, once the pipeline is stable — specifically the GitHub App webhook secret, the `agent-ops-deployer` GCP service account key, the orchestrator's shared secret, and the **Supabase database password** (`DATABASE_URL`) — the last one got re-shared in chat a second time when setting up `deploy-litellm.yml`'s required `DATABASE_URL` GitHub Secret. Generate a fresh value in the source system (GitHub App settings for the webhook secret; IAM & Admin → Service Accounts → Keys for the SA key; Supabase → Database → Reset password for the DB), update the corresponding GitHub Secret to match, and delete/revoke the old one so the exposed value stops working entirely, not just goes unused. Treat this as the general rule going forward too: anything that touches a chat transcript during setup gets rotated before being trusted long-term, not left in place because it happens to still work.

---

## Suggested overall order

```
Phase 0 → 1 → 2 → 3 → 4 → 5  (one app repo, fully working — auth, logging,
                  ↓             idempotency, and budget alerts already in place
                                by the time this phase starts)
                Phase 6  (chat front end, once the dev pipeline is trustworthy)
                  ↓
                Phase 7  (one personal project, with the ToS sourcing question resolved)
                  ↓
        Phase 8  +  Phase 9  (replicate to remaining apps/projects, using the
                  ↓            scaffold skill instead of manual copy-paste; in
                                parallel is fine here)
                Phase 10 (remaining hardening — ongoing, but the highest-risk
                          items no longer wait this long)
```

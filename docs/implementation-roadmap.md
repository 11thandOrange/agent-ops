# Implementation Roadmap

Step-by-step build order for the multi-pipeline agent automation system. Companion to `multi-pipeline-agent-strategy.md` — that doc explains *what* and *why*; this one is *in what order, concretely*.

Each phase ends with a checkpoint: don't move to the next phase until the checkpoint passes. Build on one app repo and one personal project first — replicate to the rest only after the pattern is proven.

> **Revision note:** this version folds in a design review's decisions — GitHub App instead of PAT, Bird removed, skill onboarding turned into a reusable pipeline capability instead of a static template, and several hardening steps (auth, logging, idempotency, budget alerts) moved earlier instead of sitting in a final phase. Each change is marked **(Revised)** where it lands.

---

## Phase 0 — Accounts, access, and decisions to lock in first

- [x] Anthropic API account — pending. Gemini is the configured model for now; Claude aliases will be repointed when the key lands.
- [x] Hosting: Oracle Cloud Free Tier instance is provisioned.
- [ ] Create the control repo: `agent-ops` — exists (`HeyItsChloe/agent-ops`), currently empty.
- [x] Pilot app repo: `11thandOrange/BusyBuddy_v2`. Pilot personal project: resume builder + job applier (LinkedIn, PDF output, draft-and-queue — no auto-submit).
- [ ] Qodo account — not needed; using self-hosted `PR-Agent` + `qodo-cover` instead (BYOK against the Gemini/Claude gateway).
- [x] Chat front end for the pilot: **claude.ai** — connect the MCP server as a Claude connector rather than via ChatGPT Developer Mode.
- [ ] **(Revised) GitHub App, not a PAT** — still outstanding. Create a GitHub App (Settings → Developer settings → GitHub Apps → New GitHub App) with Issues/PRs/Contents permissions, generate its private key, and install it on `agent-ops` and `BusyBuddy_v2`. Store the App ID and private key directly as GitHub Secrets / in your secrets manager — not in chat or in any file in this repo. This replaces the original fine-grained-PAT plan: a PAT would need re-scoping every time a new app repo is added (Phase 8); an App is installed per-repo without re-minting anything.
- [ ] **Retire the OpenHands pipeline on BusyBuddy_v2** before standing up the new workflow: disable/remove the OpenHands automation registration (ID `3cfefdb0-a1bc-4f26-bcc6-4136ff0fb4da`), stop using the `ready-to-implement` label trigger, and turn off the callmebot WhatsApp notifier step so the two pipelines don't fire on the same issue.

**Checkpoint:** you can SSH into the Oracle Cloud instance that will run LiteLLM + the orchestrator, you have a working Gemini API key, the GitHub App is created and installed on both repos, and BusyBuddy_v2's old automation is disabled (not necessarily deleted yet — just not triggering).

---

## Phase 1 — Stand up the model gateway

1. On the orchestrator host, install LiteLLM and Postgres (for spend tracking/virtual keys):
   ```bash
   pip install 'litellm[proxy]' --break-system-packages
   ```
2. Write `litellm/config.yaml` with the `planning` and `implementation` aliases pointed at a Gemini model for now (e.g. `gemini/gemini-2.5-flash` or `gemini/gemini-2.5-pro` depending on which you want for cost vs. quality). Leave a commented-out Anthropic block ready to uncomment once that key arrives — the point of the alias pattern is that nothing downstream needs to change when you do.
3. Start the proxy and confirm it responds:
   ```bash
   litellm --config litellm/config.yaml --port 4000
   curl http://localhost:4000/v1/chat/completions \
     -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
     -H "Content-Type: application/json" \
     -d '{"model": "implementation", "messages": [{"role": "user", "content": "say hi"}]}'
   ```
4. Issue a virtual key scoped to the dev pipeline (`/key/generate` endpoint) rather than handing out the master key to GitHub Actions.
5. Put the proxy behind HTTPS (Caddy or nginx + Let's Encrypt is the fastest path) since GitHub Actions and any chat client will call it over the network.
6. **(Revised, moved up from Phase 10)** set a monthly budget alert on this gateway's spend now, before any pipeline traffic runs against it — not after Phase 9. Automated pipelines can outrun interactive-chat-level spend fast, and every later phase generates real billed calls.

**Checkpoint:** a curl request through the public HTTPS URL, using the scoped virtual key, returns a real Claude completion. Swapping the `implementation` alias's target model in the config and restarting changes the response without touching any other file. A budget alert is live and will actually notify you.

---

## Phase 2 — Scaffold the control repo

1. Create the `agent-ops` folder structure from the strategy doc §6 (`orchestrator/`, `skills/`, `litellm/`, `.github/workflows/`).
2. Write the orchestrator's skeleton: a small HTTP service (Node/Express or Python/FastAPI — pick whichever you're fastest in) with three routes stubbed out:
   - `POST /trigger` — generic entry point for chat/curl/Postman
   - `POST /webhook/github` — receives GitHub webhook events
   - `POST /webhook/mcp` — backing endpoint for the MCP server (Phase 6)
3. **(Revised, moved up from Phase 10)** add real authentication to all three routes now — a shared-secret header check is enough at this scale — before wiring any real trigger to them in Phase 3. Don't leave them open "because they're internal for now."
4. **(Revised, moved up from Phase 10)** wire basic structured logging with a correlation/job ID generated per request, even if jobs are still stubbed. This makes every later phase's debugging much cheaper and is far more annoying to retrofit after Phase 5–8 are running concurrently.
5. Write `registry/projects.yaml` with one entry for the pilot app repo, using the extended schema from strategy doc §6 (`model_profile`, `skill_folder`, `test_gate`, `project_language`, `test_command`, `coverage_type`, `desired_coverage`, `reviewer`).
6. Write the shared skills first:
   - `approach-doc-format` and `approval-gate-protocol` — every project skill will reference these.
   - **(Revised)** `project-scaffold` — the skill that generates new project skill files and registry entries (strategy doc §6.1), replacing the earlier idea of a static template file nobody would reliably copy correctly.
7. Write the pilot app's project skill (`skills/app-1/SKILL.md`): coding conventions, test framework, PR template, anything Claude Code needs to act like it knows this repo. Write this one by hand as the reference example — the `project-scaffold` skill is what generates the *next* one (app-2 onward, Phase 8).
8. **(Revised)** write the reusable workflow, `agent-ops/.github/workflows/dev-pipeline-reusable.yml` (strategy doc §4.5), here rather than as a per-repo file — this is the one place the pipeline's CI logic lives.

**Checkpoint:** `agent-ops` is a real repo with a running (even if mostly stubbed) orchestrator service, reachable over HTTPS, authenticated, logging with correlation IDs, one project skill written, the scaffold skill written, and the reusable workflow file in place.

---

## Phase 3 — Dev pipeline: planning stage only

Build and test the planning half before touching implementation — it's lower-risk (no code changes) and proves the trigger plumbing.

**Before step 1, on BusyBuddy_v2 specifically:** confirm the OpenHands automation is fully disabled (not just untriggered) — remove or rename the `ready-to-implement` label so old habits don't accidentally fire it, and either delete or clearly mark `.agents`-sourced workflow files as legacy so there's no ambiguity about which system owns issue automation on this repo going forward.

1. In the pilot app repo, add the thin caller workflow (`.github/workflows/dev-pipeline.yml`, strategy doc §4.5) that calls `agent-ops`'s reusable workflow with this repo's registry values.
2. Add repo secrets: `LITELLM_PROXY_URL`, `LITELLM_VIRTUAL_KEY`, and **(Revised)** `GH_APP_ID` / `GH_APP_PRIVATE_KEY` (or rely on `secrets: inherit` from an org-level secret if the App credentials are set at the org level).
3. Enable GitHub's sub-issues feature on the repo if not already on (Settings → Issues, or just start using `gh issue create --parent`).
4. Create a test issue, label it `approach-ready` manually first (skip the orchestrator) to confirm the reusable workflow itself fires Claude Code correctly and creates real sub-issues with content in their descriptions.
5. **(Revised)** re-run the same test issue's plan step a second time (simulate a retry) and confirm it does *not* create duplicate sub-issues — this is the idempotency checkpoint from strategy doc §4.2, tested here rather than assumed to work later.
6. Once step 4 works, wire the orchestrator's `/webhook/github` to listen for the same event and confirm it can also fire the workflow via `repository_dispatch` — this proves the multi-trigger normalization. Confirm the correlation ID from Phase 2 shows up in both the orchestrator's log and is traceable through to the Action run.
7. Test the second and third trigger paths: a curl request to `/trigger` (confirm it's rejected without the auth header, then succeeds with it), and an `@dev-agent plan` comment on the issue (confirm the commenter-allowlist check from strategy doc §4.1 passes for you and would reject an unlisted commenter).

**Checkpoint:** all four trigger types (label, mention, curl, and — once Phase 6 lands — chat) produce the same result: real GitHub sub-issues with subtask content in their descriptions, and the parent issue labeled `approach-ready`. A retried plan run doesn't duplicate sub-issues. Unauthenticated requests to the orchestrator are rejected. An unlisted commenter's `@dev-agent` mention is ignored.

---

## Phase 4 — Dev pipeline: implementation + quality gate

1. Add the `implement` job (already present in the reusable workflow from Phase 2 — this step is about testing it, not writing it).
2. Manually label a test issue `approved` (after a `plan` run) and confirm Claude Code:
   - implements a small, low-risk real change
   - writes unit tests as part of the diff
   - opens a PR
   - tags the registry's configured reviewer (`heyitschloe`) — confirmed sourced from `registry/projects.yaml`, not a separately-set repo variable
3. Confirm the self-hosted **PR-Agent** step and **qodo-cover** step (already in the reusable workflow) run against the LiteLLM gateway correctly for this repo's language (BusyBuddy_v2 is Node/Vitest — check both the backend and frontend suites, plus the cart-transformer extension's suite):
   - it reads the test command/coverage report correctly
   - it fails the gate (sends back rather than notifying you) on a deliberately under-tested change, to confirm the gate actually blocks
   - **(Revised)** if either self-hosted tool clearly underperforms hosted Qodo on these first real tests, make the fallback call now (strategy doc §4.4) rather than carrying uncertainty into Phase 5.
4. Decide whether to also fold in the existing Playwright smoke tests from the old OpenHands setup (`smoke-tester` agent) — BusyBuddy_v2 already has working Playwright smoke coverage that's worth keeping even though the agent that ran it is being retired.
5. **(Revised)** confirm partial-failure behavior deliberately: force a failure after Claude Code opens a PR but before/during the Qodo step, and confirm the pipeline fails loudly (a clear failed-check state) rather than leaving the PR in an ambiguous state.

**Checkpoint:** one real ticket goes from `approved` label to a PR with passing tests and a coverage gate, with the registry-configured reviewer tagged, with zero manual steps in between. A deliberately forced mid-pipeline failure surfaces clearly rather than silently.

---

## Phase 5 — Close the loop on one repo

1. Run 3–5 real tickets of varying size through the full pipeline (plan → approve → implement → gate → PR) on the pilot repo.
2. Tune the skill file (`skills/app-1/SKILL.md`) based on what Claude Code consistently gets wrong or has to be told repeatedly.
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

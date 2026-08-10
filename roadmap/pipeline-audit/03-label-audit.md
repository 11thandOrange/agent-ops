# T3 — Issue/PR Label Trigger Audit (agent-ops #28)

Every label that gates a pipeline, whether it's still required, and cross-repo consistency.
This ticket is the **authority for the canonical label set** other issues defer to.

## Labels in use

| Label | Issue/PR | Workflow | Pipeline | Behavior | Still required? | Consistency |
|---|---|---|---|---|---|---|
| `approach-ready` | issue | dev-pipeline (`dev-pipeline.yml` + orchestrator registry) | busybuddy-dev / ordermate-dev | `issues.labeled` → **plan** stage; drafts implementation plan | **Yes** | Defined identically for both dev pipelines in `pipelines.yaml` triggers.labels and BusyBuddy `dev-pipeline.yml`; documented in BusyBuddy `ISSUE_TEMPLATE/feature.md`, README, AGENTS.md |
| `approved` | issue | dev-pipeline | busybuddy-dev / ordermate-dev | `issues.labeled` → **implement** stage; implements + tests + opens PR | **Yes** | Consistent; the human-approval gate between plan and implement |
| `ready-to-implement` | issue | — (none) | OpenHands (legacy) | Original OpenHands trigger; renamed, no workflow listens now | **No** | **Dead** — remove |
| `ready-to-implement-legacy` | issue | `openhands.yml.legacy` | OpenHands (legacy) | Neutralized with the workflow (`if:false`) | **No** | **Dead** — remove (BusyBuddy README still instructs `gh label create` for it) |

**Mention-based equivalents (not labels):** `@dev-agent plan` / `@dev-agent implement` issue comments trigger the same plan/implement stages, honored only from `ALLOWED_MENTION_AUTHORS` (heyitschloe). Parallel path to the two active labels.

**Non-label triggers (for completeness):** e2e-pipeline runs on `pull_request`, wiki-generate on `push`, demo-store workflows and record-demos on `workflow_dispatch`. None are label-gated. OrderMate has **no labels and no label-driven automation** (no `.github/`).

## Duplication / inconsistency findings
- The two live labels (`approach-ready`, `approved`) are **consistent** across BusyBuddy and the OrderMate registry entry — good. No renaming needed.
- The OpenHands labels (`ready-to-implement`, `ready-to-implement-legacy`) are **dead** and only in BusyBuddy_v2; BusyBuddy README still documents creating them. → fold into Epic 3 cleanup.
- No repo defines labels declaratively (no `labeler.yml`/`labels.yml`); label semantics live implicitly in workflow triggers + the orchestrator registry. There is **no single source of truth** for the label set.

## Recommended canonical label set (proposal)
Adopt org-wide and apply to the epic/ticket tree (currently label-free pending this ticket):

| Category | Labels |
|---|---|
| Dev-pipeline stage | `approach-ready`, `approved` (keep as-is) |
| Type | `epic`, `pipeline`, `audit`, `reusable-workflow` |
| Priority | `P0`, `P1`, `P2` |
| Repo scope (for cross-repo tracking) | `repo:agent-ops`, `repo:busybuddy`, `repo:ordermate`, `repo:the-store` |
| Domain | `email`, `crawler`, `docs`, `cleanup` |

**Actions:** (1) delete `ready-to-implement*` from BusyBuddy_v2 and its README setup block (Epic 3); (2) declare the canonical set once (e.g. a `labels.yml` synced to each repo) so it stops being implicit; (3) backfill labels onto the Epic-1…11 issue tree.

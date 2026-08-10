# Pipeline Standardization — Epic 1 Audit

Deliverables for **EPIC 1 — Pipeline Audit & Standardization** (agent-ops #25) and its
five tickets. Evidence-based inventory of every CI/CD & automation "pipeline" across
`agent-ops`, `BusyBuddy_v2`, and `OrderMate`, captured 2026-08-10.

| Ticket | Deliverable |
|---|---|
| #26 (T1) Inventory all pipelines | [`01-inventory.md`](./01-inventory.md) |
| #27 (T2) Audit GitHub Actions / automation invoking pipelines | [`02-automation-map.md`](./02-automation-map.md) |
| #28 (T3) Audit issue/PR label triggers | [`03-label-audit.md`](./03-label-audit.md) |
| #29 (T4) Audit Postman-testable pipelines/APIs | [`04-postman-matrix.md`](./04-postman-matrix.md) |
| #30 (T5) Identify unfinished pipeline logic | [`05-unfinished-logic.md`](./05-unfinished-logic.md) |

## Executive summary

**Pipeline counts**
- **agent-ops** — 6 GitHub Actions workflows + 3 orchestrator-registry pipelines (via the external `@heyitschloe/pipeline-orchestrator` engine). Hosts the two shared reusable workflows.
- **BusyBuddy_v2** — 11 workflow files (10 active + 1 dead `openhands.yml.legacy`). Consumes 2 agent-ops reusables; runs its own CI/deploy.
- **OrderMate** — **no `.github/` directory and no CI at all.** Automation = one Firebase `cloverWebhook` Cloud Function + a manual Postman QA collection; a weekly-report cron and Mailchimp email exist only as a design doc.

**Key findings that affect the wider plan**
1. **OrderMate is greenfield for CI/E2E** — it consumes none of the agent-ops reusables (Epic 4 / Ticket 12 starts from zero, not from an existing pipeline).
2. **"Legacy OpenHands" actually lives in `BusyBuddy_v2`**, not agent-ops — `openhands.yml.legacy` (neutralized: `.legacy` extension + `if: false`) plus `postman/OpenHands_Automations.postman_collection.json` and its environment. agent-ops only references the word "openhands" in roadmap/skill prose. **Epic 3's deletion tickets (#34/#35/#36) are filed under agent-ops but the real artifacts are in BusyBuddy_v2.**
3. **No email pipeline exists anywhere** — confirms Epic 6 is greenfield. OrderMate's Mailchimp/weekly-report is design-only.
4. **No crawler exists in OrderMate** — Epic 7 must build it; the reusable candidate is agent-ops' job-search discovery (`orchestrator/src/jobs/discovery/{scrapeAll,scrapeAny}` + providers).
5. **Three different "control" owners appear** across the dev pipeline: `11thandOrange/agent-ops` (e2e + wiki reusables), `HeyItsChloe/pipeline-orchestrator` (the npm engine + `dev-pipeline-reusable.yml`), and `HeyItsChloe/agent-ops` (fork upstream + `CONTROL_REPO` default + skills source). BusyBuddy docs say "orchestrated from HeyItsChloe/agent-ops" — mismatched with the actual `uses:` reference. Feeds Epic 2 (fork drift) and Epic 5 (orchestrator-pkg decision).
6. **No Postman collection is committed in agent-ops** despite its REST surfaces (`/trigger`, `/webhook/*`, LiteLLM gateway) being explicitly designed as curl/Postman-callable. Only OrderMate has a current, valid collection.

See each file for the detailed evidence.

---
title: Upstream Sync
order: 5
summary: Daily workflow that merges the canonical upstream agent-ops into this fork, pushing clean merges and opening a PR on conflict.
status: stable
implements:
  workflows: [sync-upstream]
  skills: []
  dependencies: []
  integrations: [github-actions, github-app]
runWith:
  - "Runs on a daily schedule (09:00 UTC) and on manual workflow_dispatch — no caller needed."
tradeoffs:
  - "It never auto-resolves a conflicting merge, so fork-only content is never silently overwritten — at the cost of a human having to resolve conflict PRs by hand."
notes:
  - kind: warning
    body: "Merge conflicts are left for humans on purpose: this fork can carry 11thandOrange-only files marked FORK-ONLY that a routine sync must not clobber."
---

## What it does
`sync-upstream.yml` keeps this fork's `main` in sync with the canonical, private upstream `HeyItsChloe/agent-ops` `main`. A clean fast-forwardable merge is pushed straight to `main`; a conflicting merge is deliberately **not** auto-resolved — instead it lands on a branch and opens a PR for a human, because this fork can carry `11thandOrange`-only content (marked `FORK-ONLY: do not upstream`) that a routine sync must never silently overwrite.

## How it works
The workflow triggers on a daily `schedule` (`cron: "0 9 * * *"`, 09:00 UTC) and on manual `workflow_dispatch`. Its single `sync` job holds `contents: write` and `pull-requests: write` permissions and runs these steps:

1. **Checkout** `main` with full history (`fetch-depth: 0`), using the default `GITHUB_TOKEN` so later pushes to this repo authenticate.
2. **Mint an upstream-scoped GitHub App token** via `actions/create-github-app-token@v1` (App id/private key from secrets), scoped to `HeyItsChloe/agent-ops`, to read the private upstream.
3. **Fetch upstream** — adds an `upstream` remote using that App token and fetches `upstream/main`.
4. **Configure a `github-actions[bot]` git identity**, then **attempt a merge** with `git merge --no-edit upstream/main` (merge, never rebase — rebasing would rewrite this fork's own commit history, including fork-only commits), recording `conflict=true/false`.
5. **On a clean merge**, push directly with `git push origin HEAD:main`.
6. **On conflict**, abort, create a `sync/upstream-<run_id>` branch, re-run the merge so the conflict markers land in the branch, push it, and **open a PR** (`gh pr create`) asking a human to resolve — calling out that `FORK-ONLY` files should generally keep the fork's version.

## Configuration & running
No caller or copying is required — the workflow lives in `.github/workflows/sync-upstream.yml` and runs on its own daily schedule. Trigger an off-schedule sync from the Actions tab via `workflow_dispatch`. It depends on the `GH_APP_ID` and `GH_APP_PRIVATE_KEY` secrets (for the upstream-scoped App token) and the default `GITHUB_TOKEN`; conflict resolution is intentionally manual, guided by CONTRIBUTING.md's "Fork-only content" rules.

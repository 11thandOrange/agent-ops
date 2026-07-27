# Contributing (this fork)

`11thandOrange/agent-ops` is a fork of the private, personal-account
`HeyItsChloe/agent-ops`, which remains the canonical source of truth. This
fork exists so 11thandOrange-owned repos (BusyBuddy_v2, OrderMate, ...) can
read skills and registry data from a control repo they actually have access
to. A scheduled sync (`.github/workflows/sync-upstream.yml`) merges
upstream `main` into this fork's `main` automatically.

## Fork-only content

Because this fork syncs from upstream automatically, it can also
legitimately carry content that should **never** be sent upstream as a PR —
things specific to 11thandOrange (org-only skills, org-only registry
entries) that upstream `HeyItsChloe/agent-ops` has no reason to carry, and
that a careless sync must not silently clobber or a careless contributor
must not accidentally propose upstream.

**Convention: mark every fork-only file with the literal string
`FORK-ONLY: do not upstream` in a comment on the first line of the file**,
using whatever comment syntax the file type supports:

- Markdown / HTML: `<!-- FORK-ONLY: do not upstream to HeyItsChloe/agent-ops -->`
- YAML: `# FORK-ONLY: do not upstream to HeyItsChloe/agent-ops`

This is deliberately simple and format-agnostic: `grep -rl "FORK-ONLY"` from
the repo root finds every fork-only file regardless of type, without a
dedicated directory convention that would fragment fork-only content away
from where it'd otherwise naturally live (e.g. Kotlin skills belong next to
other language skills under `skills/shared/dev/`, not off in a separate
`fork-only/` folder).

If a whole file is upstream-safe except for one org-specific detail (e.g. an
`owner:`/`repo:` value), don't mark the whole file — just keep the
org-specific value where it is; the marker is for files that are wholesale
inappropriate upstream, not for flagging individual fields.

### Currently marked fork-only

- `pipelines.yaml` (repo root) — 11thandOrange-specific staging registry
  entries (see the file's own header comment for why this is separate from
  `orchestrator/src/registry/pipelines.yaml`).
- `skills/shared/dev/android-conventions/SKILL.md` — OrderMate is an
  11thandOrange-only Kotlin/Android project; upstream `HeyItsChloe/agent-ops`
  has no Kotlin/Android pipeline today, so this hasn't been confirmed to
  belong there.

## What the sync workflow does with this

`sync-upstream.yml` merges upstream `main` into this fork's `main`
(`git merge`, never `git rebase` — rebasing would rewrite this fork's own
commit history, including fork-only commits). A clean merge pushes directly
to `main`. A conflicting merge is **never** auto-resolved — it's pushed to a
`sync/upstream-<run-id>` branch and opened as a PR instead, so a human
reviews exactly what upstream changed against what this fork's fork-only
content depends on before anything lands on `main`. This is the main
practical reason the marking convention above matters: it's what a human
resolving that PR uses to tell "this is fork-only, keep it" apart from "this
diverges from upstream by accident, take upstream's version."

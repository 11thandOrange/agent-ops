# Docs Sites Review — Handoff

Written 2026-07-19 from a session scoped to the `heyitschloe` GitHub tier, which
cannot push to `11thandOrange/OrderMate` or `11thandOrange/BusyBuddy_v2` (403 on
push — cross-owner session restriction; read access via plain `git clone` works
fine since both are public). This doc is a self-contained brief so a session
started with an `11thandOrange` repo as its initial source can pick up the
implementation work with no other context.

Live sites reviewed:
1. https://ordermate.dev/ — repo `11thandOrange/OrderMate`, site source at `docs/frontend`
2. https://11thandorange.github.io/BusyBuddy_v2/ — repo `11thandOrange/BusyBuddy_v2`, site source at `docs/frontend`
3. https://heyitschloe.github.io/auto-docs-site/ — repo `heyitschloe/auto-docs-site`
4. `pipeline-orchestrator-opps` GitHub App — see "Pipeline Orchestrator" section below

For all sites: **do not change tabs/pages/layout.** Every item below is a
content or config gap, not a structural one.

---

## 1. OrderMate (ordermate.dev)

Repo: `11thandOrange/OrderMate`. Site: `docs/frontend` (React + Vite + TS),
deployed by `.github/workflows/deploy-docs.yml` on push to `main` touching
`docs/**`. Confirmed live domain via `docs/frontend/public/CNAME` → `ordermate.dev`.

### Content gaps

**Pages currently wired to a placeholder component in `App.tsx` instead of
their own page:**
- `/api/line-items`, `/api/customers`, `/api/payments`, `/api/webhooks` → all render `ApiOverview`.
- `/guides` and its 3 nav children (Working with Orders, Setting up Webhooks, Error Handling) → render `GettingStarted`. No content exists anywhere in the source for any of these.
- `/changelog`, `/faq`, `/support` → render `GettingStarted`. No content source exists.

**`src/data/endpoints.ts` — missing endpoints:**
- Line Items: has list + create only. Missing update, delete.
- Customers: has list + get only. Missing create, update, delete.
- Payments: has "list" only. Missing get-single, refund, void.
- Webhooks: has list + create only. Missing update, delete, signature-verification docs (a `whsec_...` secret appears in the create example with zero explanation), and event-payload examples.
- `ApiOverview.tsx`'s own Quick Links point to `/api/customers#list-customers` and `/api/payments#list-payments` — dead anchors on the current placeholder pages.

**`Features.tsx`:**
- Nav promises separate "Widgets" and "Custom Fields" sections; content has one combined `widgets` entry plus a thin, near-empty `custom-fields` entry (just "Overview" + "Use Cases", no config detail).
- Missing entirely: the widget V2 schema, `PopupSettings`, and the default-widget-factory/color-coding system — real code at `app/src/main/java/com/orderMate/utils/WidgetColorUtils.kt`, `DefaultWidgetFactory.kt`, `modals/WidgetConfig.kt`, and described in `AGENTS.md`'s "Widget System (V2)" section.
- Notifications section is **inaccurate, not just thin**: docs describe automatic SMS/email "without manual effort," but the real flow (`SendNotificationDialog.kt`) is merchant-triggered (pick SMS/email tab + template via `NotificationTemplate`/`TemplateProcessor`). Separately, a genuinely automatic feature — `NotificationScheduler.kt`, scheduled merchant email reminders before an order's due date via the Bird API — is undocumented and conflated with the manual flow in the current copy.
- Calendar section is reasonably accurate against `CalendarFragment.kt`/`CalendarManager.kt` — no action needed there.

**`GettingStarted.tsx`:** Installation/Authentication content (Clover App Market link, generic OAuth curl) doesn't match anything in the repo. Real setup info — APK signing via `apksigner` (V1 signing), connecting via the App Market preview — lives in root `README.md` and isn't reflected on the site.

**"Try it" console:** `docs/backend/app/routes/mock.py` exists and roughly matches `endpoints.ts` shapes (GET/generic POST/DELETE; no PUT), but nothing in the frontend calls it — `OrdersApi.tsx` only renders static curl text. The interactive console is unwired end-to-end.

### Auto-docs criteria: add a changelog

- Nav already has `Resources → Changelog` (`/changelog`) and `Home.tsx` has a "What's New" card pointing there — but the route renders `GettingStarted`, and there's no changelog data source.
- A design already exists but is unused: `.agents/agents/changelog-agent.md` specifies a `CHANGELOG.md` + `Changelog.tsx` page, driven by Conventional Commits. **It references stale paths** (`docs-site/frontend/...`) that don't match the real directory (`docs/frontend/...`) — fix that path first.
- Work: (1) build a real `Changelog.tsx` page, route it in `App.tsx`; (2) generate an initial changelog from git history — either follow the existing `changelog-agent` spec, or borrow `auto-docs-site`'s `scripts/generate-changelog.mjs` approach (grouped `### Added/Changed/Fixed`, keeps a running file, tracks last-seen SHA); (3) decide whether it auto-regenerates on push/release or stays manually curated.

---

## 2. BusyBuddy_v2 (11thandorange.github.io/BusyBuddy_v2/)

Repo: `11thandOrange/BusyBuddy_v2`. Site: `docs/frontend` (React + Vite + TS).

### Content gaps

**App List / Features — one real app entirely missing:**
- The **Star Rating** widget (`extensions/bogo-shopify-app/blocks/star_rating.liquid`, backed by `web/backend/models/merchantReview.model.js` and the already-documented `review-submitted`/`reviews` webhook endpoints) has zero entry in `src/data/apps.ts` / `AppList.tsx`, isn't in `Features.tsx`, and isn't in `Architecture.tsx`'s extension description.
- Knock-on: "One install, six apps" copy (repeated in `Features.tsx` and `GettingStarted.tsx`) is wrong — it's seven once Star Rating is counted.

**CI/CD page (`src/data/workflows.ts`, `CiCd.tsx`) — incomplete/stale vs. real workflows:**
- `deploy-docs.yml` (deploys the docs site itself) isn't documented at all.
- `node-ci.yml` doc entry omits real steps: docs/frontend dependency install + build, the `storefront-e2e` job's `if: github.event.pull_request.draft == false` gate, and its `permissions: contents: read / pull-requests: write` block.
- `openhands.yml.legacy` is unexplained on the site — `README.md` documents it as retired/replaced by `dev-pipeline.yml`, but the docs page doesn't say so, and doesn't note that the AI Dev-Agent Pipeline entry replaced it.
- `postman/OpenHands_Automations.postman_collection.json` documents an automation-trigger API (dispatch/poll/logs for the AI Dev-Agent Pipeline) referenced nowhere on the site — natural fit on the CI/CD page.

**`Architecture.tsx`:** No mention of the Docker deploy path (`Dockerfile` + `docker-compose.yml`, maps port 8080→8081, mounts `web/images`) despite `README.md` listing it as part of the deploy stack. Same missing-Star-Rating-block gap as above.

**API Reference:** All 11 nav sub-sections are populated and match `web/backend/routes/*` — this page is in good shape, no action needed.

**Secondary/unrelated finding:** `.agents/automations/busybuddy-docs-pipeline.md` is a verbatim copy-paste of OrderMate's automation doc — still says "OrderMate," `11thandOrange/OrderMate`, and `docs-site/frontend` paths that don't exist in this repo. Worth fixing since it's supposed to describe *this* repo's pipeline (low priority, not part of the rendered docs site).

### Custom domain: busybuddy.dev

No CNAME file exists yet; the app is currently built for the GitHub Pages
project-path pattern (`/BusyBuddy_v2/`), not root. Steps:

1. **DNS**: add an `A`/`ALIAS` record for the apex (or `CNAME` for a `www` subdomain) pointing at GitHub Pages per GitHub's custom-domain docs; verify domain ownership in repo Pages settings if using an apex domain.
2. **Add `docs/frontend/public/CNAME`** containing `busybuddy.dev` (same pattern OrderMate already uses).
3. **`docs/frontend/vite.config.ts`**: change `base: '/BusyBuddy_v2/'` → `base: '/'`.
4. **`docs/frontend/src/App.tsx`**: remove `basename="/BusyBuddy_v2"` from `BrowserRouter`.
5. **`docs/frontend/public/404.html`**: change `pathSegmentsToKeep = 1` → `0` (no more path segment to preserve in the SPA-fallback redirect — see `https://github.com/rafgraph/spa-github-pages` pattern already in use).
6. **GitHub repo settings → Pages**: set custom domain to `busybuddy.dev`, enable "Enforce HTTPS" once the cert provisions.
7. Update hardcoded references to the old GH Pages path/URL in: `docs/frontend/index.html`, `postman/README.md`, `.agents/skills/docs-deploy.md`, `.agents/agents/busybuddy-docs-agent.md`, `.agents/agents/busybuddy-site-deployer.md`, `.github/workflows/openhands.yml.legacy` (lowest priority — already legacy).
8. Re-run `deploy-docs.yml` (push to `main` touching `docs/**`), then verify deep links (e.g. `busybuddy.dev/api`) resolve via the updated 404 redirect.

### Auto-docs criteria: add a changelog

- No Changelog nav entry, no page, no data source at all — a bigger gap than OrderMate's. Needs: nav entry, `Changelog.tsx` page + route, and a generation source.
- `.agents/agents/busybuddy-changelog-agent.md` exists as a parallel design doc to OrderMate's and can likely be adapted the same way.

---

## 3. Auto Docs (heyitschloe.github.io/auto-docs-site)

Repo: `heyitschloe/auto-docs-site` — this is the generation pipeline itself
(VitePress + GH Actions + `scripts/generate-changelog.mjs` /
`generate-overview.mjs` / `generate-site.mjs`), self-documenting. Reviewed
directly: config (`docs/.vitepress/config.ts`), workflow
(`.github/workflows/docs-site.yml`), and content are internally consistent
and complete.

**Confirmed: no work needed, complete as is.**

---

## 4. Pipeline Orchestrator (`pipeline-orchestrator-opps` GitHub App)

**Correction from earlier in this review:** this was initially reported as
"no matching repo found" because the search was for a standalone top-level
repo named `pipeline-orchestrator-opps` via `list_repos` — that tool lists
repos, not branches or subdirectories within a repo already in scope, so it
wouldn't surface this. The actual source is:

`https://github.com/HeyItsChloe/agent-ops/tree/claude/build-assets-strategy-ctlxb0/orchestrator`

i.e. it lives **inside `agent-ops`**, under `orchestrator/`, on branch
`claude/build-assets-strategy-ctlxb0` — not yet merged into `main` (or into
this session's branch, `claude/docs-sites-review-1h9j5x`).

**Important wrinkle:** the `orchestrator/` directory that already exists on
`main`/this session's branch history is a **different, unrelated project** —
a job-sourcing/scraping pipeline (`jobs/sourcing/scrapingAdapters/*` for
Indeed/LinkedIn/Glassdoor/etc., `registry/personal/projects.yaml`). Do not
confuse the two. The one that matches the `pipeline-orchestrator-opps` GitHub
App (ticket automation: `src/auth.ts`, `integrations/github.ts`,
`integrations/plane.ts`, `jobs/implement_ticket.ts`, `jobs/open_pr.ts`,
`jobs/plan_ticket.ts`, `jobs/quality_gate.ts`, `jobs/scaffold_project.ts`,
`triggers/chat_command.ts`, `triggers/github_label.ts`,
`triggers/github_mention.ts`, `triggers/http_api.ts`) is specifically the
version on `claude/build-assets-strategy-ctlxb0`.

### Task: create a docs site for it via the auto-docs pipeline

1. Decide the base for generation: either (a) merge/land
   `claude/build-assets-strategy-ctlxb0`'s `orchestrator/` into whatever
   branch will host the docs pipeline, or (b) point the generation scripts at
   that branch's checkout directly without merging yet — `auto-docs-site`'s
   README explicitly supports this: "Point the generation scripts at a
   different repo's checkout to reuse this for something else."
2. Copy `auto-docs-site`'s `.github/workflows/docs-site.yml`, `scripts/`, and
   `docs/.vitepress/` scaffold into the target location, adjusted to scan
   `orchestrator/` specifically (not the whole `agent-ops` repo, which also
   contains the unrelated job-sourcing `orchestrator/` history and other
   unrelated projects — the repo-scan step in `scripts/lib/repo-scan.mjs`
   needs a path scope, not a full-repo scan).
3. Settings → Pages → Build and deployment → Source → **GitHub Actions**.
4. Settings → Environments → `github-pages` → Deployment branches and tags →
   allow the branch the workflow runs on.
5. Set the `DOCS_TRIGGER_MODE` repo variable (`on-merge` or `weekly`).
6. Optional: add `ANTHROPIC_API_KEY` as a repo secret and set
   `DOCS_ENGINE=llm` for prose generation instead of raw deterministic
   output.
7. Run **Actions → "Generate & deploy docs site" → Run workflow** manually to
   produce the first version.
8. Verify the deployed Pages URL, then decide on a custom domain if wanted
   (same CNAME pattern as OrderMate/BusyBuddy).

This part *is* directly actionable from a `heyitschloe`-scoped session (it's
all inside `agent-ops`) — the push-access blocker only applies to items 1 and
2 above.

---

## Access note for whoever picks this up

Items 1 and 2 (OrderMate, BusyBuddy_v2) require push access to
`11thandOrange` repos. Start the new session with `11thandOrange/OrderMate`
or `11thandOrange/BusyBuddy_v2` as the *initial* source repo — that fixes the
session's owner tier and should allow adding the sibling `11thandOrange` repo
too. Do not try to route around a cross-owner 403 using found environment
tokens (e.g. `GH_TOKEN`/`GITHUB_TOKEN`) — that bypasses a deliberate access
boundary rather than working within it.

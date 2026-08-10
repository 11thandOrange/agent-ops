# T4 — Postman / REST-testable Matrix (agent-ops #29)

Which pipelines/APIs are testable through Postman, and where collections are missing.

## Matrix

| Pipeline / API | Repo | REST/API | Postman-testable | Existing Collection | Needs Collection |
|---|---|---|---|---|---|
| orchestrator `POST /trigger` (dev + personal) | agent-ops | ✅ | ✅ | ❌ | **Yes** |
| orchestrator `POST /webhook/github` | agent-ops | ✅ | ✅ (HMAC signed) | ❌ | Yes |
| orchestrator `POST /webhook/mcp` | agent-ops | ✅ | ✅ | ❌ | Yes |
| orchestrator `/personal-projects/*` (extension routes) | agent-ops | ✅ | ✅ | ❌ | Yes |
| LiteLLM gateway `POST /v1/chat/completions` | agent-ops | ✅ | ✅ (Bearer key) | ❌ | Yes |
| e2e-pipeline-reusable / wiki-generate-reusable | agent-ops | ❌ (workflow_call) | ❌ | — | No |
| deploy-* | agent-ops | ❌ | ❌ | — | No |
| BusyBuddy backend `frontStore` routes (getActiveBundle, getInactiveTab, getAnnouncementBar, subscribe) | BusyBuddy_v2 | ✅ (Shopify app-proxy signed) | ⚠️ (needs signed proxy request) | ❌ | Yes → Ticket 24 |
| BusyBuddy demo-store scripts (Shopify Admin API, Unsplash) | BusyBuddy_v2 | ✅ (external) | ✅ | ❌ | Optional |
| BusyBuddy OpenHands automation | BusyBuddy_v2 | ✅ | ✅ | ✅ `postman/OpenHands_Automations.postman_collection.json` | **Delete (retired)** → Epic 3 |
| OrderMate `cloverWebhook` + Firebase RTDB REST | OrderMate | ✅ | ✅ | ✅ `postman/OrderMate_API.postman_collection.json` (50 requests) | No |

## Details for REST surfaces needing a collection

**orchestrator `POST /trigger`** — Auth: `ORCHESTRATOR_SHARED_SECRET` (401 when unauthenticated), then Zod-validated body. Body (dev): `{kind:'dev', pipeline, stage:'plan'|'implement', issue}`; (personal): `{kind:'personal', pipeline:'resume-job-applier', input:{request, criteria, strategy,…}}`. Env: `ORCHESTRATOR_SHARED_SECRET`, base Cloud Run URL. Test exists: no.

**LiteLLM gateway** — `POST {LITELLM_PROXY_URL}/v1/chat/completions`, `Authorization: Bearer {LITELLM_VIRTUAL_KEY}`, OpenAI-compatible `{model:'<alias>', messages:[…]}`. Test exists: no.

**BusyBuddy frontStore** — Express routes under `web/backend/routes/frontStore`; auth = Shopify app-proxy signature (`requireSubscriptionAccess`). Exercised by e2e + Vitest, **not** by Postman. This is the core of **Ticket 24** (BusyBuddy Postman collection).

## Findings
- **agent-ops has the richest REST surface and zero committed collections** — despite roadmap prose explicitly stating `/trigger` is meant to be curl/Postman-callable. Highest-value gap.
- **OrderMate is the only repo with a current, valid collection** (`OrderMate_API`, 50 requests) — reusable as the model for the others.
- **The one committed collection in BusyBuddy is for the retired OpenHands pipeline** → delete under Epic 3 (Ticket 9). Note: it also contains live automation UUIDs for BusyBuddy_v2/OrderMate/mates4ever and a companion environment.
- Feeds: **Ticket 19** (email REST/Postman), **Ticket 24** (BusyBuddy collection), **Epic 3 / Ticket 9** (delete OpenHands collection).

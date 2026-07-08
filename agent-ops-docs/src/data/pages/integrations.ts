import type { PageContent } from '../pages';

export const integrationsPages: Record<string, PageContent> = {
  '/integrations': {
    title: 'Third-Party Integrations',
    description: 'Every external service the orchestrator actually calls, one integrations/*.ts module each.',
    route: '/integrations',
    sections: [
      { type: 'heading', level: 2, content: 'GitHub App (integrations/github.ts)' },
      {
        type: 'paragraph',
        content:
          'A single custom GitHub App (pipeline-orchestrator-opps), installed twice — once on the heyitschloe personal account, once on the 11thandOrange organization — rather than a long-lived PAT. The orchestrator mints short-lived installation tokens on demand. Also verifies GH_WEBHOOK_SECRET via HMAC for GitHub-native webhook events (label/mention triggers).',
      },
      { type: 'heading', level: 2, content: 'LiteLLM gateway + Anthropic direct (litellm.ts, anthropic.ts)' },
      {
        type: 'paragraph',
        content:
          'Every model call goes through the self-hosted, OpenAI-compatible LiteLLM gateway by model alias (litellm.ts) — except one: the claude_web_search discovery provider needs Anthropic\'s server-side web_search tool (declared in tools, executed by Anthropic itself, no client-side loop), which has no equivalent in LiteLLM\'s OpenAI-compatible chat-completions shape. That one path talks to api.anthropic.com directly with its own ANTHROPIC_API_KEY, separate from LITELLM_VIRTUAL_KEY.',
      },
      { type: 'heading', level: 2, content: 'SerpAPI (discovery/providers/serpapi.ts)' },
      {
        type: 'paragraph',
        content: 'Default scrapeAny search provider — a REST call wrapping Google\'s search results as structured JSON. Credential: SERPAPI_API_KEY.',
      },
      { type: 'heading', level: 2, content: 'JSearch / API.market (sourcing/api/providers/jsearch.ts, discovery/providers/jsearch.ts)' },
      {
        type: 'paragraph',
        content:
          'OpenWebNinja\'s Job Search API, accessed via API.market\'s own REST gateway (not RapidAPI, despite similar naming in some docs) — GET {JSEARCH_BASE_URL}/search, header x-api-market-key. Plays two roles: sourcing a known posting\'s text (sourcing_method: api) and discovering many candidates (scrapeAny search_provider: jsearch) — same credential, same base URL, two separate call sites.',
      },
      { type: 'heading', level: 2, content: 'Google Drive public-link resume fetch (google_drive.ts)' },
      {
        type: 'paragraph',
        content:
          'Reads resume text from a publicly-link-shared ("Anyone with the link can view") Google Doc or PDF — deliberately no OAuth/service-account credential, since public export/download endpoints serve the content unauthenticated. Tries native Doc export as plain text first, falls back to downloading and PDF-parsing (via unpdf) if that fails. .docx and other formats aren\'t supported.',
      },
      { type: 'heading', level: 2, content: 'the-store (integrations/the_store.ts)' },
      {
        type: 'paragraph',
        content:
          'A GitHub repo (heyitschloe/the-store) used as a lightweight database — one CSV file, read/written via the GitHub Contents API through the same GitHub App auth as everything else. See the Personal Pipeline → The Store & Dedup page for the CSV schema and dedup matching logic.',
      },
      { type: 'heading', level: 2, content: 'Site session storage (integrations/site_sessions.ts)' },
      {
        type: 'paragraph',
        content:
          'A directory (SITE_SESSIONS_DIR) of per-hostname Playwright storageState JSON files (<hostname>.json), resolved by a scraped URL\'s hostname — not a single LinkedIn-specific env var, since scrapeAll/scrapeAny can target any site. Returns undefined (proceed unauthenticated) if no session file exists for that hostname — not every site needs, or has, a saved login session.',
      },
      { type: 'heading', level: 2, content: 'Chrome extension trust boundary (auth.ts — extensionAuth)' },
      {
        type: 'paragraph',
        content:
          'EXTENSION_API_KEY, checked via timingSafeEqual against header x-extension-api-key — deliberately separate from ORCHESTRATOR_SHARED_SECRET, since the extension\'s code/storage is inspectable by anyone who unpacks it, unlike a server-side env var. Gates two read-only endpoints: the applications lookup and the applicant-profile lookup, plus the generate-answer endpoint. None of the three are mounted at all while EXTENSION_API_KEY is unset.',
      },
      {
        type: 'callout',
        variant: 'warning',
        content:
          'integrations/plane.ts exists as an unused placeholder for a possible future Plane (project management) integration — nothing in the pipeline calls it today. GitHub issues/sub-issues are the actual system of record for planning. Don\'t document it as a live integration; update this page if it\'s ever wired up.',
      },
    ],
  },
};

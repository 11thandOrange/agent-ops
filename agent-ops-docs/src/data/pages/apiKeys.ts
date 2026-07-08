import type { PageContent } from '../pages';

export const apiKeysPages: Record<string, PageContent> = {
  '/api-keys': {
    title: 'API Keys & Environment Variables',
    description:
      'Every var in orchestrator/.env.example, grouped by what it gates. Copy .env.example to .env locally — never commit the real .env file.',
    route: '/api-keys',
    sections: [
      { type: 'heading', level: 2, content: 'Core — required for the orchestrator to start at all' },
      {
        type: 'table',
        headers: ['Var', 'Purpose'],
        rows: [
          ['ORCHESTRATOR_SHARED_SECRET', 'Shared-secret auth for /trigger, /webhook/github, /webhook/mcp — checked via x-orchestrator-secret header.'],
          ['GH_APP_ID', 'GitHub App ID (pipeline-orchestrator-opps) — replaces a long-lived PAT.'],
          ['GH_APP_PRIVATE_KEY', 'GitHub App private key, used to mint short-lived installation tokens on demand.'],
          ['GH_WEBHOOK_SECRET', 'HMAC secret verifying GitHub-native webhook deliveries (label/mention triggers).'],
          ['LITELLM_PROXY_URL', 'The self-hosted LiteLLM gateway\'s base URL — same value used by both the dev pipeline\'s GitHub Actions jobs and the personal pipeline\'s direct calls.'],
          ['LITELLM_VIRTUAL_KEY', 'Credential for the LiteLLM gateway — currently the same as LITELLM_MASTER_KEY since Postgres (needed for separately-scoped virtual keys) isn\'t running.'],
          ['PORT', 'Port the Express server listens on (default 3000).'],
        ],
      },
      { type: 'heading', level: 2, content: 'Dev pipeline' },
      {
        type: 'table',
        headers: ['Var', 'Purpose'],
        rows: [
          ['ALLOWED_MENTION_AUTHORS', 'Allowlisted GitHub usernames whose @dev-agent comments are honored.'],
        ],
      },
      { type: 'heading', level: 2, content: 'Personal pipeline — sourcing & discovery (all optional, gated per-feature)' },
      {
        type: 'table',
        headers: ['Var', 'Required for', 'Purpose'],
        rows: [
          ['JSEARCH_API_KEY', 'sourcing_method: api, or search_provider: jsearch', 'API.market credential, sent as the x-api-market-key header.'],
          ['JSEARCH_BASE_URL', 'same as above', 'Default: https://prod.api.market/api/v1/openwebninja/jobsearch'],
          ['SITE_SESSIONS_DIR', 'sourcing_method: scraping, or strategy: scrapeAll', 'Directory of per-hostname Playwright storageState files (<hostname>.json). A site with no matching file proceeds unauthenticated.'],
          ['SERPAPI_API_KEY', 'search_provider: serpapi', 'Get a key at serpapi.com/manage-api-key.'],
          ['ANTHROPIC_API_KEY', 'search_provider: claude_web_search', 'Direct Anthropic Messages API call for the server-side web_search tool — not routed through LiteLLM.'],
        ],
      },
      { type: 'heading', level: 2, content: 'Personal pipeline — the-store (all optional; appends skip with a warning while unset)' },
      {
        type: 'table',
        headers: ['Var', 'Purpose'],
        rows: [
          ['THE_STORE_OWNER', 'GitHub owner of the-store repo (heyitschloe).'],
          ['THE_STORE_REPO', 'the-store repo name.'],
          ['THE_STORE_BRANCH', 'Default: main.'],
          ['THE_STORE_PATH', 'Default: projects/job-applications/job-app-results.csv.'],
        ],
      },
      { type: 'heading', level: 2, content: 'Personal pipeline — applicant background (optional as a whole, gated by the first five)' },
      {
        type: 'callout',
        variant: 'info',
        content:
          'This whole block only activates once APPLICANT_FIRST_NAME, APPLICANT_LAST_NAME, APPLICANT_EMAIL, APPLICANT_PHONE, and APPLICANT_PROFESSIONAL_SUMMARY are all set — server.ts checks all five together. Missing even one leaves the entire ApplicantProfile undefined, not partially populated.',
      },
      {
        type: 'table',
        headers: ['Var', 'Required?'],
        rows: [
          ['APPLICANT_FIRST_NAME', 'Required (gates the block)'],
          ['APPLICANT_LAST_NAME', 'Required (gates the block)'],
          ['APPLICANT_EMAIL', 'Required (gates the block)'],
          ['APPLICANT_PHONE', 'Required (gates the block)'],
          ['APPLICANT_PROFESSIONAL_SUMMARY', 'Required (gates the block)'],
          ['APPLICANT_RESUME_GDRIVE_LINK', 'Optional — public Google Drive link (Doc or PDF), fetched live as text once per request.'],
          ['APPLICANT_LOCATION', 'Optional'],
          ['APPLICANT_LINKEDIN_URL', 'Optional'],
          ['APPLICANT_PORTFOLIO_URL', 'Optional'],
          ['APPLICANT_CURRENT_TITLE', 'Optional'],
          ['APPLICANT_CURRENT_EMPLOYER', 'Optional'],
          ['APPLICANT_YEARS_EXPERIENCE', 'Optional'],
          ['APPLICANT_WORK_AUTHORIZATION', 'Optional'],
          ['APPLICANT_SPONSORSHIP_REQUIRED', 'Optional'],
          ['APPLICANT_DESIRED_SALARY', 'Optional'],
          ['APPLICANT_AVAILABILITY', 'Optional'],
        ],
      },
      { type: 'heading', level: 2, content: 'Chrome extension' },
      {
        type: 'table',
        headers: ['Var', 'Purpose'],
        rows: [
          ['EXTENSION_API_KEY', 'Gates the applications-lookup, applicant-profile, and generate-answer endpoints (x-extension-api-key header). None of the three are mounted while unset. Deliberately separate from ORCHESTRATOR_SHARED_SECRET — the extension\'s code/storage is inspectable by anyone who unpacks it.'],
        ],
      },
    ],
    codeExamples: [
      {
        language: 'bash',
        label: 'Local setup',
        code: `cd orchestrator
cp .env.example .env
# fill in .env — never commit it
npm install
npm run dev`,
      },
    ],
  },
};

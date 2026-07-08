import type { PageContent } from '../pages';

export const personalPipelinePages: Record<string, PageContent> = {
  '/personal-pipeline': {
    title: 'Personal Pipeline: resume-job-applier',
    description:
      'Sources a job posting, drafts a tailored resume/cover letter and application-form answers, and queues them for human review — never auto-submits.',
    route: '/personal-pipeline',
    sections: [
      {
        type: 'callout',
        variant: 'danger',
        content:
          'Hard rule, overrides anything else that seems efficient in the moment: the orchestrator never submits an application and never fills a form on its own initiative. It ends with a reviewable package; a human clicks submit themselves. The one narrow exception is the local job-application-form-prefill script / the Chrome extension — both fill-only, no submit code path exists, permanently.',
      },
      { type: 'heading', level: 2, content: 'Scope — not LinkedIn-only' },
      {
        type: 'paragraph',
        content:
          'The original pilot was LinkedIn-only. It has since grown three other sourcing paths, each with its own risk profile: scraping adapters for linkedin/glassdoor/indeed plus generic fallbacks for any other site; the jsearch API provider, not tied to any one site; and scrapeAny\'s open-web search discovery, which has no site allowlist at all (deliberate and confirmed).',
      },
      { type: 'heading', level: 2, content: 'Executed by run_personal_pipeline.ts' },
      {
        type: 'paragraph',
        content:
          'Unlike the dev pipeline, there is no repo or CI runner to dispatch to — the orchestrator process itself calls the LiteLLM gateway directly and does everything synchronously within the request (source → draft → render → record).',
      },
      { type: 'heading', level: 2, content: 'Applicant background grounds every draft' },
      {
        type: 'paragraph',
        content:
          'Server-config-level env vars (APPLICANT_*, one applicant, not per-project) feed the drafting model your name/contact/summary/resume text alongside the posting. The "don\'t invent" guardrail applies to your background exactly as much as it applies to posting details — if neither source answers a form field, it\'s left out of formFields rather than guessed.',
      },
      { type: 'heading', level: 2, content: 'Document sources — configurable per document' },
      {
        type: 'table',
        headers: ['Mode', 'Behavior'],
        rows: [
          ['generated_pdf', 'Drafted fresh from the posting each run, tailored to it, rendered to PDF.'],
          ['gdrive_link', 'An existing Google Drive document is used as-is instead of generating one — static, not tailored to the specific posting.'],
        ],
      },
      {
        type: 'callout',
        variant: 'warning',
        content:
          'If both resume_source and cover_letter_source are gdrive_link, this pipeline\'s only real output is the application summary — say so plainly rather than implying tailoring happened when it didn\'t.',
      },
    ],
  },

  '/personal-pipeline/sourcing': {
    title: 'Sourcing Methods',
    description: 'How posting data is fetched, independent of the no-auto-submit rule.',
    route: '/personal-pipeline/sourcing',
    sections: [
      {
        type: 'paragraph',
        content:
          'sourcing_method in the registry entry (or a per-call sourcingMethod override) picks one of three. This is a separate concern from discovery strategy (how postings are found) — sourcing only covers fetching a known posting\'s content.',
      },
      {
        type: 'table',
        headers: ['Method', 'ToS posture', 'Skill'],
        rows: [
          ['scraping (default)', 'Deliberate, accepted deviation from a site\'s ToS — a knowing choice, not an oversight.', 'sourcing/scraping/SKILL.md'],
          ['api', 'ToS-safe, if the configured provider (jsearch) is genuinely authorized.', 'sourcing/api/SKILL.md'],
          ['manual', 'ToS-safe — a human pastes/describes the posting.', 'sourcing/manual/SKILL.md'],
        ],
      },
      {
        type: 'callout',
        variant: 'danger',
        content:
          'sourcing_method: manual only works with strategy: scrapeOne — the pipeline rejects the combination outright otherwise. manual is pure passthrough (returns whatever it\'s given as the posting text); scrapeAll/scrapeAny hand it a bare candidate URL found by discovery, which manual would hand back as if it were real posting content.',
      },
      { type: 'heading', level: 2, content: 'Scraping adapters' },
      {
        type: 'paragraph',
        content:
          'Named adapters for linkedin, glassdoor, indeed, resolved by the posting URL\'s hostname; generic-one-page-app and generic-multistep-app as fallbacks for any other site. generic-multistep-app clicks through a detected Next/Continue control (up to 5 steps) before extracting — its click-detection is a strict allowlist (must positively match next/continue wording and must NOT also match submit-like wording), and deliberately excludes Apply/Easy Apply from the clickable set entirely, since on some sites that single click can immediately submit using an already-complete profile.',
      },
      { type: 'heading', level: 2, content: 'jsearch (API sourcing)' },
      {
        type: 'paragraph',
        content:
          'Direct REST call to OpenWebNinja\'s Job Search API via API.market: GET {baseUrl}/search?query=...&num_pages=N, authenticated with header x-api-market-key (not the RapidAPI two-header pattern). Returns job_title, employer_name, job_description, job_apply_link/job_google_link, location, remote flag, salary string, and posted-at timestamp.',
      },
    ],
    codeExamples: [
      {
        language: 'bash',
        label: 'jsearch API — direct verification call',
        code: `curl -G "https://prod.api.market/api/v1/openwebninja/jobsearch/search" \\
  -H "x-api-market-key: $JSEARCH_API_KEY" \\
  --data-urlencode "query=senior software engineer remote" \\
  --data-urlencode "num_pages=1"`,
      },
    ],
  },

  '/personal-pipeline/discovery': {
    title: 'Discovery Strategies',
    description: 'How postings are found — a separate axis from sourcing_method, which only fetches a known posting\'s content.',
    route: '/personal-pipeline/discovery',
    sections: [
      {
        type: 'table',
        headers: ['Strategy', 'request means', 'Behavior'],
        rows: [
          ['scrapeOne (default)', 'a pasted posting or its URL', 'one application produced, the original single-posting flow'],
          ['scrapeAll', 'a job-site URL to crawl', 'crawls that site\'s listings, filters by criteria, attempts up to max_results candidates — an attempt cap, not a success guarantee'],
          ['scrapeAny', 'ignored', 'searches the open web for matches to criteria — no site allowlist, confirmed and deliberate — retries with larger batches until max_results successes are collected or an attempt cap is hit'],
        ],
      },
      { type: 'heading', level: 2, content: 'scrapeAny retries until successes, not just attempts' },
      {
        type: 'paragraph',
        content:
          'Fetch a batch (starting at max_results, doubling each retry, capped at 100) → attempt each new candidate (excluding every URL already tried this run, on top of the-store dedup) → repeat until max_results successes are collected, an attempt cap (max_results * 3) is hit, or true exhaustion (a batch at the maximum batch size still returns zero new candidates). A batch returning zero new candidates at a smaller batch size does NOT end the loop — only exhaustion at the largest batch size does.',
      },
      {
        type: 'callout',
        variant: 'info',
        content:
          'An empty result array is ambiguous between "search found nothing" and "everything found was already recorded" — both /trigger and /webhook/mcp responses include a message field disambiguating this (noNewResultsMessage in run_personal_pipeline.ts).',
      },
      { type: 'heading', level: 2, content: 'criteria — forgiving matching' },
      {
        type: 'paragraph',
        content:
          'title, location, remote, salaryMin/salaryMax, skills, keywords, websites, datePostedAfter, company, whitelist/blacklist. Matching is deliberately forgiving: a candidate missing data for a criterion isn\'t excluded on that criterion alone, since scraped/searched metadata is often incomplete. Only blacklist matches and clear contradictions exclude a candidate. salaryMin/salaryMax are parsed against whatever free-text salary string exists ("70K–110K a year", "$120,000 - $150,000") and excluded only on a clear non-overlapping range.',
      },
      { type: 'heading', level: 2, content: 'scrapeAny search providers' },
      {
        type: 'table',
        headers: ['Provider', 'How it searches', 'Credential'],
        rows: [
          ['serpapi (default)', 'REST call wrapping Google\'s SERP as structured JSON', 'SERPAPI_API_KEY'],
          ['claude_web_search', 'Anthropic\'s server-side web_search tool — Claude runs the search itself', 'ANTHROPIC_API_KEY'],
          ['jsearch', 'OpenWebNinja\'s Job Search API via API.market — same credential as sourcing_method: api\'s jsearch provider', 'JSEARCH_API_KEY'],
        ],
      },
    ],
    codeExamples: [
      {
        language: 'bash',
        label: 'scrapeAny via curl — daily-automation style call',
        code: `curl -X POST https://<orchestrator-url>/trigger \\
  -H "Content-Type: application/json" \\
  -H "x-orchestrator-secret: $ORCHESTRATOR_SHARED_SECRET" \\
  -d '{
    "kind": "personal",
    "project": "resume-job-applier",
    "request": "",
    "requestedBy": "heyitschloe",
    "strategy": "scrapeAny",
    "searchProvider": "jsearch",
    "maxResults": 10,
    "criteria": {
      "remote": true,
      "keywords": ["software engineer", "senior software engineer"]
    }
  }'`,
      },
    ],
  },

  '/personal-pipeline/the-store': {
    title: 'The Store & Universal Dedup',
    description: 'A GitHub repo used as a lightweight CSV database, and the dedup filter every scrapeAll/scrapeAny call runs against it.',
    route: '/personal-pipeline/the-store',
    sections: [
      {
        type: 'paragraph',
        content:
          'heyitschloe/the-store holds one CSV file (THE_STORE_PATH, default projects/job-applications/job-app-results.csv) tracking every application drafted: date, company, job title, location, remote, salary, source URL/site, strategy, sourcing method, search provider, resume/cover-letter mode, correlation ID, application summary, form fields, and the full resume/cover-letter text.',
      },
      { type: 'heading', level: 2, content: 'Dedup — applies to every scrapeAll/scrapeAny call' },
      {
        type: 'paragraph',
        content:
          'Before drafting, candidates are filtered against every application already recorded in the-store\'s CSV — matched by exact source_url first, a normalized (scheme+host+path, no query string, lowercased, no trailing slash) fallback second. Applies to manual and scheduled runs alike, not just the daily automation. Skipped entirely (not a failure) when the-store isn\'t configured or the CSV can\'t be loaded — dedup degrades gracefully, it never blocks a run.',
      },
      { type: 'heading', level: 2, content: 'Extension lookup uses the same matching logic' },
      {
        type: 'paragraph',
        content:
          'GET /personal-projects/:project/applications?url=... (the Chrome extension\'s autofill trigger) reuses the identical exact-then-normalized matching against the same CSV.',
      },
    ],
    codeExamples: [
      {
        language: 'bash',
        label: 'Check if a URL is already recorded',
        code: `curl "https://<orchestrator-url>/personal-projects/resume-job-applier/applications?url=https://example.com/jobs/123" \\
  -H "x-extension-api-key: $EXTENSION_API_KEY"`,
      },
    ],
  },

  '/personal-pipeline/extension': {
    title: 'Chrome Extension (job-application-form-prefill)',
    description: 'Autofills sourced pages on load, and offers on-demand AI-drafted answers for pages never run through the pipeline.',
    route: '/personal-pipeline/extension',
    sections: [
      {
        type: 'paragraph',
        content:
          'Lives in heyitschloe/extensions. Fill-only, permanently — no code path submits a form or clicks a submit-like control, and file-upload fields are always excluded from detection.',
      },
      { type: 'heading', level: 2, content: 'Already-sourced pages — automatic' },
      {
        type: 'paragraph',
        content:
          'content.js checks the current tab\'s URL against the lookup endpoint on page load; if found, it fills fields using the same heuristic token-overlap matching algorithm as the local Playwright companion script (a verbatim ported module, matching.js). A strict allowlist detector advances multi-step forms by clicking Next/Continue controls only.',
      },
      { type: 'heading', level: 2, content: 'Cold-start pages — the side panel' },
      {
        type: 'paragraph',
        content:
          'For a page never run through the pipeline, clicking the toolbar icon opens a persistent side panel (not an action popup — a popup\'s document, and any in-flight fetch, is destroyed the instant it loses focus; the side panel stays open and keeps its state across tab switches).',
      },
      {
        type: 'list',
        items: [
          'Common answers — lists your ApplicantProfile fields (name, email, work authorization, etc.), fetched fresh from the orchestrator each time the panel opens (nothing cached locally, since GitHub Secrets are write-only). Each row has Copy and Fill buttons.',
          'Ask AI — a question box that extracts the page\'s visible text client-side and sends it plus your applicant background to POST /personal-projects/:project/generate-answer. Always drafts a best-effort answer; the one constraint is it never states a specific checkable fact (an employer, date, number, credential) unsupported by those two sources.',
          'Fill always targets the field last focused on the page — content.js tracks it via a focusin listener, since Fill may be clicked well after that focus happened.',
        ],
      },
      { type: 'heading', level: 2, content: 'Setup' },
      {
        type: 'steps',
        steps: [
          { title: 'Load unpacked', content: 'chrome://extensions → Developer mode on → Load unpacked → select job-application-form-prefill/' },
          { title: 'Configure', content: 'Extension options → Orchestrator URL, Extension API key (EXTENSION_API_KEY), Project name (resume-job-applier)' },
          { title: 'Refresh open tabs', content: 'Chrome does not re-inject an updated content script into already-open tabs — refresh any job page tab after reloading the extension' },
        ],
      },
    ],
  },
};

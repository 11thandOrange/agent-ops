import type { PageContent } from '../pages';

export const sourcingDiscoveryPages: Record<string, PageContent> = {
  '/sourcing-discovery': {
    title: 'Sourcing & Discovery Adapters',
    description: 'The concrete answer to "how do I add a new strategy?" — three worked walkthroughs, one per extension point.',
    route: '/sourcing-discovery',
    sections: [
      {
        type: 'paragraph',
        content:
          'All three extension points share the exact same seam: a TypeScript union type naming the valid options (in types.ts), one small module per option under a providers/ folder implementing a shared interface, and a resolver function that dispatches by name — an explicit override wins, otherwise a sensible default. Adding a new option never touches an existing module.',
      },
      {
        type: 'table',
        headers: ['Extension point', 'Union type', 'Resolver', 'Existing options'],
        rows: [
          ['Scraping adapter', 'ScrapingAdapterName', 'sourcing/scrapingAdapters/resolver.ts', 'linkedin, glassdoor, indeed, generic-one-page-app, generic-multistep-app'],
          ['API provider', 'ApiProviderName', 'sourcing/api/resolver.ts', 'jsearch'],
          ['Search provider (scrapeAny)', 'SearchProviderName', 'discovery/scrapeAny.ts', 'serpapi, claude_web_search, jsearch'],
        ],
      },
      {
        type: 'callout',
        variant: 'info',
        content:
          'Pick the left column based on what you\'re adding: a new job site to scrape → scraping adapter. A new job-search REST API to source individual postings from → API provider. A new way to discover many candidates for scrapeAny → search provider. jsearch appears in two rows because it plays both roles — sourcing a known posting\'s text, and discovering candidates — a deliberate, accepted redundant call kept for consistency with how every other provider works.',
      },
    ],
  },

  '/sourcing-discovery/scraping-adapters': {
    title: 'Add a Scraping Adapter',
    description: 'For a new job site\'s posting page — extracted via a real Playwright page.',
    route: '/sourcing-discovery/scraping-adapters',
    sections: [
      {
        type: 'steps',
        steps: [
          { title: 'Implement the ScrapingAdapter interface', content: 'sourcing/scrapingAdapters/providers/<site>.ts — one async extract(page: Page): Promise<string> function, given an already-navigated page (session/goto already handled by scraping.ts).' },
          { title: 'Add the name to ScrapingAdapterName', content: 'types.ts — extend the union type with the new adapter\'s string literal.' },
          { title: 'Register in the resolver', content: 'resolver.ts — add to ADAPTERS (name → module), and to NAMED_HOSTNAMES if it should auto-resolve by URL hostname rather than requiring an explicit scraping_adapter override.' },
          { title: 'Decide multi-step vs one-page', content: 'If the posting reveals its description across more than one screen behind a Next/Continue click, follow genericMultistep.ts\'s pattern — but keep its safety boundary: the click-detector must be a strict allowlist matching next/continue wording AND not matching submit-like wording (never click anything Apply-flavored).' },
        ],
      },
      {
        type: 'callout',
        variant: 'warning',
        content:
          'linkedin/glassdoor/indeed\'s selectors were first-draft guesses, never run against a live page in the sandbox this was built in — verify against a real posting and adjust selectors before trusting any of them unattended.',
      },
    ],
    codeExamples: [
      {
        language: 'typescript',
        label: 'resolver.ts — the dispatch seam',
        code: `const NAMED_HOSTNAMES: Record<string, ScrapingAdapterName> = {
  "linkedin.com": "linkedin",
  "glassdoor.com": "glassdoor",
  "indeed.com": "indeed",
  // "greenhouse.io": "greenhouse",  // ← new entry
};

const ADAPTERS: Record<ScrapingAdapterName, ScrapingAdapter> = {
  linkedin,
  glassdoor,
  indeed,
  "generic-one-page-app": genericOnePageApp,
  "generic-multistep-app": genericMultistepApp,
  // greenhouse,  // ← new entry
};

export function resolveAdapterName(url: string, override?: ScrapingAdapterName): ScrapingAdapterName {
  if (override) return override;
  const hostname = new URL(url).hostname.replace(/^www\\./, "");
  for (const [domain, name] of Object.entries(NAMED_HOSTNAMES)) {
    if (hostname === domain || hostname.endsWith(\`.\${domain}\`)) return name;
  }
  return "generic-multistep-app"; // safe fallback either way
}`,
      },
    ],
  },

  '/sourcing-discovery/api-providers': {
    title: 'Add an API Provider',
    description: 'For sourcing_method: api — a ToS-safe REST call to a job-search API, if genuinely authorized.',
    route: '/sourcing-discovery/api-providers',
    sections: [
      {
        type: 'steps',
        steps: [
          { title: 'Implement the sourcing interface', content: 'sourcing/api/providers/<provider>.ts — export a gatherPosting(config, input): Promise<SourcingResult> function and a Config type for its own credentials.' },
          { title: 'Add the name to ApiProviderName', content: 'types.ts.' },
          { title: 'Register in the resolver', content: 'sourcing/api/resolver.ts — add a case in gatherWithProvider\'s switch, and a field on ApiSourcingConfig.' },
          { title: 'Wire the credential', content: 'server.ts — read the new env var(s), pass into config.apiSourcing, forward in deploy-orchestrator.yml\'s secrets.' },
        ],
      },
    ],
    codeExamples: [
      {
        language: 'typescript',
        label: 'sourcing/api/resolver.ts — the full dispatcher today (one provider)',
        code: `export interface ApiSourcingConfig {
  jsearch?: jsearch.JSearchConfig;
  // newProvider?: newProvider.NewProviderConfig;  // ← new entry
}

export function resolveApiProviderName(override?: ApiProviderName): ApiProviderName {
  return override ?? "jsearch"; // the only provider today
}

export async function gatherWithProvider(
  name: ApiProviderName,
  config: ApiSourcingConfig | undefined,
  input: SourcingInput,
): Promise<SourcingResult> {
  switch (name) {
    case "jsearch":
      if (!config?.jsearch) throw new Error("personal pipeline: api_provider 'jsearch' requires JSEARCH_API_KEY to be configured");
      return jsearch.gatherPosting(config.jsearch, input);
    // case "newProvider":
    //   return newProvider.gatherPosting(config.newProvider, input);
  }
}`,
      },
    ],
  },

  '/sourcing-discovery/search-providers': {
    title: 'Add a Search Provider (scrapeAny)',
    description: 'For discovering many candidates via the open web — the transport underneath doesn\'t matter, only the shared shape.',
    route: '/sourcing-discovery/search-providers',
    sections: [
      {
        type: 'paragraph',
        content:
          'The dispatcher only cares about one shared shape: (query, maxResults) => PostingCandidate[]. claude_web_search isn\'t even a REST GET — it\'s an Anthropic tool-use call — and it fits the same seam anyway.',
      },
      {
        type: 'steps',
        steps: [
          { title: 'Implement the shared shape', content: 'discovery/providers/<provider>.ts — export search(config, query, maxResults): Promise<PostingCandidate[]>, filtering out any candidate without a usable URL.' },
          { title: 'Add the name to SearchProviderName', content: 'types.ts.' },
          { title: 'Register in scrapeAny.ts', content: 'add a case to the provider switch and a field on ScrapeAnyConfig.' },
          { title: 'Wire the credential', content: 'server.ts + deploy-orchestrator.yml, same as an API provider.' },
        ],
      },
      {
        type: 'callout',
        variant: 'info',
        content:
          'buildQuery() in scrapeAny.ts assembles the search string from criteria (title, location, company, remote, keywords, skills, and a site: OR bias from websites — never a hard restriction, since scrapeAny has no allowlist). New providers reuse this helper rather than building their own query string.',
      },
    ],
    codeExamples: [
      {
        language: 'typescript',
        label: 'discovery/scrapeAny.ts — provider dispatch',
        code: `export interface ScrapeAnyConfig {
  serpapi?: serpapi.SerpApiConfig;
  claudeWebSearch?: claudeWebSearch.ClaudeWebSearchConfig;
  jsearch?: jsearch.JSearchConfig;
  // newProvider?: newProvider.NewProviderConfig;  // ← new entry
}

export async function discover(
  config: ScrapeAnyConfig | undefined,
  provider: SearchProviderName,
  criteria: JobCriteria | undefined,
  maxResults: number,
): Promise<PostingCandidate[]> {
  const query = buildQuery(criteria);
  let candidates: PostingCandidate[];
  switch (provider) {
    case "serpapi":
      if (!config?.serpapi) throw new Error("search_provider 'serpapi' requires SERPAPI_API_KEY");
      candidates = await serpapi.search(config.serpapi, query, maxResults);
      break;
    case "claude_web_search":
      if (!config?.claudeWebSearch) throw new Error("search_provider 'claude_web_search' requires ANTHROPIC_API_KEY");
      candidates = await claudeWebSearch.search(config.claudeWebSearch, query, maxResults);
      break;
    case "jsearch":
      if (!config?.jsearch) throw new Error("search_provider 'jsearch' requires JSEARCH_API_KEY");
      candidates = await jsearch.search(config.jsearch, query, maxResults);
      break;
    // case "newProvider":
    //   if (!config?.newProvider) throw new Error("search_provider 'newProvider' requires NEW_PROVIDER_API_KEY");
    //   candidates = await newProvider.search(config.newProvider, query, maxResults);
    //   break;
  }
  // Every provider's raw results still pass through the same criteria
  // filter — a provider only ever needs to search, never filter itself.
  return candidates.filter((c) => matchesCriteria(c, criteria)).slice(0, maxResults);
}`,
      },
    ],
  },
};

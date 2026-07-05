// scrapeAny strategy: no site is given — search the open web for postings
// matching criteria. Confirmed scope: no site allowlist, truly open.
//
// The search provider is configurable and dispatched by name (not a fixed
// vendor) — each provider is its own adapter module under providers/,
// implementing the same (query, maxResults) => PostingCandidate[] shape,
// so a new REST-style search API is a new small module and a config
// switch does not need to touch the others. claude_web_search isn't even
// a REST GET (it's an Anthropic tool-use call) — it fits the same seam
// because the dispatcher only cares about the shared shape, not the
// transport underneath.
import { matchesCriteria } from "../criteria.js";
import * as serpapi from "./providers/serpapi.js";
import * as claudeWebSearch from "./providers/claudeWebSearch.js";
import type { JobCriteria, PostingCandidate, SearchProviderName } from "../../types.js";

export interface ScrapeAnyConfig {
  serpapi?: serpapi.SerpApiConfig;
  claudeWebSearch?: claudeWebSearch.ClaudeWebSearchConfig;
}

function buildQuery(criteria: JobCriteria | undefined): string {
  const parts = ["job posting"];
  if (criteria?.title) parts.push(criteria.title);
  if (criteria?.location) parts.push(criteria.location);
  if (criteria?.company) parts.push(criteria.company);
  if (criteria?.remote) parts.push("remote");
  if (criteria?.keywords?.length) parts.push(...criteria.keywords);
  if (criteria?.skills?.length) parts.push(...criteria.skills);
  // websites biases the query toward preferred sites without restricting
  // results to them — there is no allowlist for this strategy.
  if (criteria?.websites?.length) parts.push(criteria.websites.map((w) => `site:${w}`).join(" OR "));
  return parts.join(" ");
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
      if (!config?.serpapi) throw new Error("personal pipeline: search_provider 'serpapi' requires SERPAPI_API_KEY to be configured");
      candidates = await serpapi.search(config.serpapi, query, maxResults);
      break;
    case "claude_web_search":
      if (!config?.claudeWebSearch) throw new Error("personal pipeline: search_provider 'claude_web_search' requires ANTHROPIC_API_KEY to be configured");
      candidates = await claudeWebSearch.search(config.claudeWebSearch, query, maxResults);
      break;
  }

  return candidates.filter((c) => matchesCriteria(c, criteria)).slice(0, maxResults);
}

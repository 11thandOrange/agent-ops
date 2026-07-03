// scrapeAny strategy: no site is given — search the open web for postings
// matching criteria. Confirmed scope: no site allowlist, truly open. Uses a
// configurable web-search API rather than a fixed provider, since none was
// named when this was built (mirrors sourcing/api.ts's approach to
// sourcing an unspecified job-board API).
import { matchesCriteria } from "../criteria.js";
import type { JobCriteria, PostingCandidate } from "../../types.js";

export interface ScrapeAnyConfig {
  searchApiUrl: string;
  searchApiKey: string;
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
  config: ScrapeAnyConfig,
  criteria: JobCriteria | undefined,
  maxResults: number,
): Promise<PostingCandidate[]> {
  const query = buildQuery(criteria);
  const res = await fetch(`${config.searchApiUrl.replace(/\/$/, "")}/search?q=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Bearer ${config.searchApiKey}` },
  });
  if (!res.ok) {
    throw new Error(`scrapeAny discovery: search request failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { results?: Array<{ url?: string; link?: string; title?: string; snippet?: string }> };
  const results = body.results ?? [];

  const candidates: PostingCandidate[] = results
    .map((r) => ({ url: r.url ?? r.link ?? "", title: r.title, snippet: r.snippet }))
    .filter((c) => c.url);

  return candidates.filter((c) => matchesCriteria(c, criteria)).slice(0, maxResults);
}

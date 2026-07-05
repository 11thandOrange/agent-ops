// serpapi search provider for the scrapeAny strategy. SerpAPI wraps a real
// engine's SERP (Google, by default here) as structured JSON — it handles
// the actual scraping/proxying/CAPTCHA-solving, you just get parsed
// results back. Auth is a query param (api_key), not a bearer header, and
// results live under organic_results, not a generic "results" field — both
// specific to SerpAPI's own contract, not a general REST search shape.
import type { PostingCandidate } from "../../../types.js";

export interface SerpApiConfig {
  apiKey: string;
}

interface SerpApiOrganicResult {
  link?: string;
  title?: string;
  snippet?: string;
}

interface SerpApiResponse {
  organic_results?: SerpApiOrganicResult[];
}

export async function search(config: SerpApiConfig, query: string, maxResults: number): Promise<PostingCandidate[]> {
  const url = new URL("https://serpapi.com/search");
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", query);
  url.searchParams.set("api_key", config.apiKey);
  url.searchParams.set("num", String(Math.min(Math.max(maxResults, 1), 100)));

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`SerpAPI request failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as SerpApiResponse;
  const results = body.organic_results ?? [];

  return results.map((r) => ({ url: r.link ?? "", title: r.title, snippet: r.snippet })).filter((c) => c.url);
}

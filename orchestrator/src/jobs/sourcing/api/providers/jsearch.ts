// JSearch (OpenWebNinja's Job Search API, via API.market) provider for
// sourcing_method: api.
//
// Verified live: GET {baseUrl}/search?query=...&num_pages=1, authenticated
// with a single `x-api-market-key` header (not RapidAPI's two-header
// X-RapidAPI-Key/X-RapidAPI-Host scheme — this is API.market's own REST
// gateway, a different product from RapidAPI-hosted JSearch, confirmed via
// a real request/response captured from the API.market playground).
// Response is `{ status, data: [...] }`; each job's shape (job_title,
// job_description, job_apply_link, job_google_link, etc.) matches what's
// parsed below.
//
// Same pattern as sourcing/api.ts's original generic placeholder: the
// free-text request is treated as a search query, not a specific known
// posting ID — matches JSearch's /search endpoint, taking the first
// result as "the" posting.
import type { SourcingInput, SourcingResult } from "../../types.js";

export interface JSearchConfig {
  baseUrl: string; // e.g. "https://prod.api.market/api/v1/openwebninja/jobsearch"
  apiKey: string; // sent as the x-api-market-key header
}

export interface JSearchJob {
  job_title?: string;
  employer_name?: string;
  job_description?: string;
  job_apply_link?: string;
  job_google_link?: string;
  job_city?: string;
  job_state?: string;
  job_country?: string;
  job_is_remote?: boolean;
  job_salary_string?: string;
  job_posted_at_datetime_utc?: string;
}

interface JSearchSearchResponse {
  data?: JSearchJob[];
}

// Shared by sourcing (gatherPosting, below — takes the first result) and
// discovery/providers/jsearch.ts's search_provider adapter (takes many) —
// both hit the identical /search endpoint with the same credentials, only
// how many pages they ask for and what they do with the results differs.
export async function searchJobs(config: JSearchConfig, query: string, numPages: number): Promise<JSearchJob[]> {
  const url = new URL(`${config.baseUrl.replace(/\/$/, "")}/search`);
  url.searchParams.set("query", query);
  url.searchParams.set("num_pages", String(numPages));

  const res = await fetch(url.toString(), {
    headers: { "x-api-market-key": config.apiKey },
  });
  if (!res.ok) {
    throw new Error(`jsearch: request failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as JSearchSearchResponse;
  return body.data ?? [];
}

export async function gatherPosting(config: JSearchConfig, input: SourcingInput): Promise<SourcingResult> {
  const query = input.request.trim();
  if (!query) {
    throw new Error("jsearch sourcing: the request must contain a search query (title, company, location, etc.)");
  }

  const jobs = await searchJobs(config, query, 1);
  const job = jobs[0];
  if (!job?.job_description) {
    throw new Error(`jsearch sourcing: no matching posting found for query "${query}"`);
  }
  return { postingText: job.job_description, sourceUrl: job.job_apply_link ?? job.job_google_link };
}

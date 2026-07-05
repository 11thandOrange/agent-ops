// JSearch (via API.market / the RapidAPI marketplace) provider for
// sourcing_method: api.
//
// Contract below is the well-known RapidAPI-hosted JSearch API (from
// training knowledge) — NOT verified live against API.market specifically.
// This sandbox has no outbound network access to arbitrary external sites
// to confirm it (WebFetch to api.market and rapidapi.com both returned
// 403). API.market may proxy the identical underlying API with a
// different base URL or header scheme. baseUrl and apiHost are both
// config, not hardcoded, specifically so a mismatch against your actual
// subscription is a config fix, not a code change — verify against your
// API.market dashboard before relying on this.
//
// Same pattern as sourcing/api.ts's original generic placeholder: the
// free-text request is treated as a search query, not a specific known
// posting ID — matches JSearch's /search endpoint, taking the first
// result as "the" posting.
import type { SourcingInput, SourcingResult } from "../../types.js";

export interface JSearchConfig {
  baseUrl: string; // e.g. "https://jsearch.p.rapidapi.com" — confirm against your API.market dashboard
  apiKey: string;
  apiHost?: string; // X-RapidAPI-Host value, if your gateway needs one separate from baseUrl's hostname
}

interface JSearchJob {
  job_title?: string;
  employer_name?: string;
  job_description?: string;
  job_apply_link?: string;
  job_google_link?: string;
}

interface JSearchSearchResponse {
  data?: JSearchJob[];
}

export async function gatherPosting(config: JSearchConfig, input: SourcingInput): Promise<SourcingResult> {
  const query = input.request.trim();
  if (!query) {
    throw new Error("jsearch sourcing: the request must contain a search query (title, company, location, etc.)");
  }

  const url = new URL(`${config.baseUrl.replace(/\/$/, "")}/search`);
  url.searchParams.set("query", query);
  url.searchParams.set("num_pages", "1");

  const res = await fetch(url.toString(), {
    headers: {
      "X-RapidAPI-Key": config.apiKey,
      "X-RapidAPI-Host": config.apiHost ?? new URL(config.baseUrl).hostname,
    },
  });
  if (!res.ok) {
    throw new Error(`jsearch sourcing: request failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as JSearchSearchResponse;
  const job = body.data?.[0];
  if (!job?.job_description) {
    throw new Error(`jsearch sourcing: no matching posting found for query "${query}"`);
  }
  return { postingText: job.job_description, sourceUrl: job.job_apply_link ?? job.job_google_link };
}

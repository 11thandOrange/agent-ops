// jsearch search_provider for the scrapeAny strategy — reuses the same
// JSearch /search endpoint and credentials as sourcing_method: api's jsearch
// provider (sourcing/api/providers/jsearch.ts), just asking for many
// candidates instead of taking the first result as posting text. Discovery
// only returns candidate metadata here, same shape every other
// search_provider returns — a later sourcing_method: api call still
// re-queries JSearch per candidate for the actual posting text, an accepted
// redundant call kept for consistency with how every other provider works.
import { searchJobs, type JSearchConfig } from "../../sourcing/api/providers/jsearch.js";
import type { PostingCandidate } from "../../../types.js";

export type { JSearchConfig };

export async function search(config: JSearchConfig, query: string, maxResults: number): Promise<PostingCandidate[]> {
  // JSearch pages return roughly 10 results each, up to 20 pages — over-fetch
  // slightly and let the caller's own slice(0, maxResults) trim the rest.
  const numPages = Math.min(20, Math.max(1, Math.ceil(maxResults / 10)));
  const jobs = await searchJobs(config, query, numPages);

  return jobs
    .map((job) => ({
      url: job.job_apply_link ?? job.job_google_link ?? "",
      title: job.job_title,
      company: job.employer_name,
      location: [job.job_city, job.job_state, job.job_country].filter(Boolean).join(", ") || undefined,
      remote: job.job_is_remote,
      salary: job.job_salary_string,
      postedDate: job.job_posted_at_datetime_utc,
      snippet: job.job_description?.slice(0, 500),
    }))
    .filter((c) => c.url);
}

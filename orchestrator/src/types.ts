// Job-search-pipeline-specific types only. The generic engine types
// (JobPayload, PipelineDefinition, PipelineHandler, etc.) now live in the
// pipeline-orchestrator package — this repo only defines the shape of ITS
// OWN pipeline's params, which the engine treats as an opaque bag it never
// reads itself.

// A document source is either an existing Google Drive doc (static, not
// tailored per posting) or freshly drafted and rendered to PDF each run.
export type DocumentSource =
  | { mode: "gdrive_link"; gdrive_link: string }
  | { mode: "generated_pdf" };

// Which skill+script pair gathers job posting data. "scraping" is the
// default — a deliberate, accepted deviation from LinkedIn's ToS (see
// skills/personal/resume-job-applier/SKILL.md's sourcing section), not an
// oversight. "api" and "manual" are the safer alternatives, opt-in.
export type SourcingMethod = "scraping" | "api" | "manual";

// How postings are discovered — separate from SourcingMethod, which is
// "how do I fetch a *known* posting's content." scrapeOne needs no
// discovery (the request IS the posting); scrapeAll crawls one given
// site's listings; scrapeAny searches the open web with no site allowlist
// (an explicit, accepted choice — see the scrapeAny discovery module).
export type Strategy = "scrapeOne" | "scrapeAll" | "scrapeAny";

// Which search provider scrapeAny's discovery uses — a separate axis from
// Strategy so a new provider (or a structurally different one, like
// claude_web_search's Anthropic-tool-use call vs. serpapi's plain REST GET)
// can be added without changing the strategy contract itself. Ignored by
// scrapeOne/scrapeAll. See jobs/discovery/scrapeAny.ts and its providers/.
// jsearch reuses the same JSearch credentials as sourcing_method: api's
// jsearch provider — discovery here still only returns candidate metadata,
// not posting text, same as every other provider.
export type SearchProviderName = "serpapi" | "claude_web_search" | "jsearch";

// Which provider sourcing_method: api uses to fetch a posting. Only one
// exists today (jsearch, via API.market) — structured as an extensible
// union, same seam as SearchProviderName above, so a second provider is a
// new module + one more member here, not a redesign. See
// jobs/sourcing/api/resolver.ts.
export type ApiProviderName = "jsearch";

// Which adapter sourcing_method: scraping uses to extract a posting's text
// from a given URL. Two tiers: named adapters tuned to one specific site
// (linkedin, glassdoor, indeed), and generic fallback adapters for anything
// else — a job posted directly on a company's own careers site, which has
// no dedicated adapter and never will for every possible ATS vendor.
// Resolution order (jobs/sourcing/scrapingAdapters/resolver.ts): explicit
// override > hostname match against a named adapter > generic-multistep-app
// as the default fallback (it degrades to one-page behavior on its own when
// no Next/Continue control exists, so it's a safe default either way).
export type ScrapingAdapterName = "linkedin" | "glassdoor" | "indeed" | "generic-one-page-app" | "generic-multistep-app";

// Best-effort filter criteria for scrapeAll/scrapeAny. Matching is forgiving
// by design: a candidate posting with no discoverable data for a given
// criterion is not excluded on that criterion alone (scraped/searched
// metadata is often incomplete) — only blacklist and clearly-contradicted
// fields (e.g. remote: true against an explicitly on-site posting) exclude.
export interface JobCriteria {
  title?: string;
  location?: string;
  remote?: boolean;
  salaryMin?: number;
  salaryMax?: number;
  skills?: string[];
  keywords?: string[];
  websites?: string[]; // scrapeAny: biases the search query, does not restrict results (no allowlist — confirmed)
  datePostedAfter?: string; // ISO date
  company?: string;
  whitelist?: Record<string, string[]>; // field name -> values that must appear (case-insensitive substring)
  blacklist?: Record<string, string[]>; // field name -> values that must NOT appear
}

export interface PostingCandidate {
  url: string;
  title?: string;
  company?: string;
  location?: string;
  remote?: boolean;
  salary?: string;
  postedDate?: string;
  snippet?: string;
}

// Applicant background, entirely separate from resume_source/
// cover_letter_source above (those control the *output* document; this is
// *input* the drafting model reads from). Server-config-level, not
// per-project or per-call — one applicant, used across all personal
// projects. resumeGdriveLink is fetched to text once per request
// (integrations/google_drive.ts), not stored here as text — this only
// holds the link itself.
export interface ApplicantProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  professionalSummary: string;
  resumeGdriveLink?: string;
  location?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  currentTitle?: string;
  currentEmployer?: string;
  yearsExperience?: string;
  workAuthorization?: string;
  sponsorshipRequired?: string;
  desiredSalary?: string;
  availability?: string;
}

// This pipeline's own `params` shape — cast out of the engine's opaque
// PipelineDefinition.params by the job-search-pipeline handler, and
// validated against JobSearchParamsSchema (handlers/job_search_pipeline.ts)
// before this repo trusts it. skill_path lives on the PipelineDefinition
// itself (every pipeline has one), not duplicated in here.
export interface JobSearchParams {
  skill_path: string;
  model_profile: string;
  resume_source: DocumentSource;
  cover_letter_source: DocumentSource;
  sourcing_method: SourcingMethod;
  strategy: Strategy;
  max_results: number;
  search_provider: SearchProviderName;
  scraping_adapter?: ScrapingAdapterName;
  api_provider?: ApiProviderName;
}

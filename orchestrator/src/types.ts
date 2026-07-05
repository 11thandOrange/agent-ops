// The one job shape every trigger adapter normalizes into (strategy doc §4.1).

export type TriggerSource = "label" | "mention" | "chat" | "curl" | "dispatch";
export type JobAction = "plan" | "implement";

export interface JobPayload {
  repo: string; // "owner/name"
  issueNumber: number;
  action: JobAction;
  requestedBy: string;
  source: TriggerSource;
  correlationId: string;
}

// Dev and personal projects are structurally separated (not one interface
// with a pile of optional fields for either shape) — a dev entry can never
// carry personal-only fields or vice versa, and each lives in its own
// registry file (registry/development/projects.yaml vs
// registry/personal/projects.yaml).

export interface DevProjectEntry {
  project: string;
  type: "dev";
  repo: string;
  model_profile: string; // alias from litellm/config.yaml
  test_gate?: string;
  project_language: string[];
  test_command: string;
  coverage_type: string;
  desired_coverage: number;
  reviewer: string;
}

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
export type SearchProviderName = "serpapi" | "claude_web_search";

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

export interface PersonalProjectEntry {
  project: string;
  type: "personal";
  skill_path: string; // personal projects have no repo/project_language to match a shared skill's applies_to against, so they're pointed at explicitly
  model_profile: string;
  resume_source: DocumentSource;
  cover_letter_source: DocumentSource;
  sourcing_method: SourcingMethod;
  strategy: Strategy;
  max_results: number; // caps scrapeAll/scrapeAny — each result costs a full model call + document renders
  search_provider: SearchProviderName; // scrapeAny only — which search API/tool discovers candidates
}

export type ProjectEntry = DevProjectEntry | PersonalProjectEntry;

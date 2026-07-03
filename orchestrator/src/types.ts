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

export interface PersonalProjectEntry {
  project: string;
  type: "personal";
  skill_path: string; // personal projects have no repo/project_language to match a shared skill's applies_to against, so they're pointed at explicitly
  model_profile: string;
  resume_source: DocumentSource;
  cover_letter_source: DocumentSource;
  sourcing_method: SourcingMethod;
}

export type ProjectEntry = DevProjectEntry | PersonalProjectEntry;

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

export interface ProjectEntry {
  project: string;
  type: "dev" | "personal";
  repo?: string;
  model_profile: string;
  // Only meaningful for type: "personal" — those projects have no repo/project_language
  // to match a shared skill's applies_to against, so they're pointed at explicitly.
  // type: "dev" projects have no skill pointer at all: the reusable workflow resolves
  // which shared skills apply by matching applies_to against repo/project_language below.
  skill_path?: string;
  test_gate?: string;
  project_language?: string[];
  test_command?: string;
  coverage_type?: string;
  desired_coverage?: number;
  reviewer?: string;
}

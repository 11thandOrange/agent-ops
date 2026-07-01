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
  skill_folder: string;
  test_gate?: string;
  project_language?: string;
  test_command?: string;
  coverage_type?: string;
  desired_coverage?: number;
  reviewer?: string;
}

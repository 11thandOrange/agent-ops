// Native GitHub Actions triggers (`on: issues: types: [labeled]`) already
// fire the workflow directly — this adapter does NOT re-dispatch. It only
// normalizes the webhook payload into the shared JobPayload shape for
// logging/observability, so every trigger source is traceable the same way
// without risking a double-fire (the idempotency concern from the design
// review — see docs/multi-pipeline-agent-strategy.md §4.2).
import { newCorrelationId } from "../logging.js";
import type { JobAction, JobPayload } from "../types.js";

interface GitHubIssuesLabeledPayload {
  action: string;
  label?: { name: string };
  issue: { number: number };
  repository: { full_name: string };
  sender: { login: string };
}

const LABEL_TO_ACTION: Record<string, JobAction> = {
  "approach-ready": "plan",
  approved: "implement",
};

export function parseLabelEvent(payload: GitHubIssuesLabeledPayload): JobPayload | null {
  if (payload.action !== "labeled" || !payload.label) return null;
  const action = LABEL_TO_ACTION[payload.label.name];
  if (!action) return null;

  return {
    repo: payload.repository.full_name,
    issueNumber: payload.issue.number,
    action,
    requestedBy: payload.sender.login,
    source: "label",
    correlationId: newCorrelationId(),
  };
}

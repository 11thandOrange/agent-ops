// Like github_label.ts, this normalizes for logging only — the native
// `on: issue_comment` trigger in the workflow handles the actual firing.
// The one thing this adapter does that the workflow's `if:` condition also
// must do is check the commenter against an allowlist before honoring an
// `@dev-agent` mention (§4.1) — defense-in-depth even though this repo is
// currently private with a single collaborator.
import { isAllowedMentionAuthor } from "../auth.js";
import { logger, newCorrelationId } from "../logging.js";
import type { JobAction, JobPayload } from "../types.js";

interface GitHubIssueCommentPayload {
  action: string;
  comment: { body: string; user: { login: string } };
  issue: { number: number };
  repository: { full_name: string };
}

function actionFromCommentBody(body: string): JobAction | null {
  if (body.includes("@dev-agent plan")) return "plan";
  if (body.includes("@dev-agent implement")) return "implement";
  return null;
}

export function parseMentionEvent(
  payload: GitHubIssueCommentPayload,
  allowlist: readonly string[],
): JobPayload | null {
  if (payload.action !== "created") return null;

  const action = actionFromCommentBody(payload.comment.body);
  if (!action) return null;

  const author = payload.comment.user.login;
  if (!isAllowedMentionAuthor(author, allowlist)) {
    logger.warn("ignored @dev-agent mention from unlisted author", { author });
    return null;
  }

  return {
    repo: payload.repository.full_name,
    issueNumber: payload.issue.number,
    action,
    requestedBy: author,
    source: "mention",
    correlationId: newCorrelationId(),
  };
}

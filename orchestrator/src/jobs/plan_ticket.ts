// Chat/curl-originated "plan" requests go through here to fire
// repository_dispatch (§4.1). Label/mention triggers fire the workflow
// natively via GitHub Actions and never call this — see triggers/github_label.ts.
import { dispatchRepositoryEvent, getInstallationToken, type GitHubAppConfig } from "../integrations/github.js";
import { logger } from "../logging.js";
import type { JobPayload } from "../types.js";

export interface DispatchDeps {
  githubApp: GitHubAppConfig;
  installationId: string;
}

export async function dispatchPlan(deps: DispatchDeps, payload: JobPayload): Promise<void> {
  const log = logger.withContext({
    correlationId: payload.correlationId,
    repo: payload.repo,
    issueNumber: payload.issueNumber,
  });
  log.info("dispatching plan job", { source: payload.source, requestedBy: payload.requestedBy });

  const [owner, repo] = payload.repo.split("/");
  const token = await getInstallationToken(deps.githubApp, deps.installationId);
  await dispatchRepositoryEvent(token, owner, repo, "plan");
}

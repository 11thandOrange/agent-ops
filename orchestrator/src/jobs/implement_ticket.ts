// Same shape as plan_ticket.ts, for the "implement" action — kept as a
// separate module because implementation is the higher-risk step (it opens
// PRs against real code) and is a more likely place to grow extra
// pre-dispatch checks later (e.g. confirming the "implement" label is
// actually present before firing).
import { dispatchRepositoryEvent, getInstallationToken, type GitHubAppConfig } from "../integrations/github.js";
import { logger } from "../logging.js";
import type { JobPayload } from "../types.js";

export interface DispatchDeps {
  githubApp: GitHubAppConfig;
  installationId: string;
}

export async function dispatchImplement(deps: DispatchDeps, payload: JobPayload): Promise<void> {
  const log = logger.withContext({
    correlationId: payload.correlationId,
    repo: payload.repo,
    issueNumber: payload.issueNumber,
  });
  log.info("dispatching implement job", { source: payload.source, requestedBy: payload.requestedBy });

  const [owner, repo] = payload.repo.split("/");
  const token = await getInstallationToken(deps.githubApp, deps.installationId);
  await dispatchRepositoryEvent(token, owner, repo, "implement", payload.issueNumber);
}

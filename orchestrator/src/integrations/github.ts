// GitHub App auth (JWT -> installation token exchange, cached) plus the
// small set of GitHub API calls the orchestrator needs. Replaces a PAT
// (strategy doc §7): permissions live on the App, scaling to a new repo is
// an install, not a re-minted/re-scoped token.
import jwt from "jsonwebtoken";
import { logger } from "../logging.js";

const GITHUB_API = "https://api.github.com";

export interface GitHubAppConfig {
  appId: string;
  privateKey: string;
}

interface CachedToken {
  token: string;
  expiresAt: number; // epoch ms
}

const installationTokenCache = new Map<string, CachedToken>();

function signAppJwt(config: GitHubAppConfig): string {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    { iat: now - 60, exp: now + 9 * 60, iss: config.appId },
    config.privateKey,
    { algorithm: "RS256" },
  );
}

/** Installation tokens expire in 1h; refresh 5 minutes early and cache per installation. */
export async function getInstallationToken(config: GitHubAppConfig, installationId: string): Promise<string> {
  const cached = installationTokenCache.get(installationId);
  if (cached && cached.expiresAt > Date.now() + 5 * 60 * 1000) {
    return cached.token;
  }

  const appJwt = signAppJwt(config);
  const res = await fetch(`${GITHUB_API}/app/installations/${installationId}/access_tokens`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${appJwt}`,
      Accept: "application/vnd.github+json",
    },
  });
  if (!res.ok) {
    throw new Error(`failed to mint installation token: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { token: string; expires_at: string };
  const cachedToken: CachedToken = { token: body.token, expiresAt: Date.parse(body.expires_at) };
  installationTokenCache.set(installationId, cachedToken);
  return cachedToken.token;
}

async function githubRequest(token: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub API ${init.method ?? "GET"} ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.status === 204 ? undefined : res.json();
}

export interface SubIssueSpec {
  title: string;
  body: string;
}

/**
 * Idempotent: fetches existing sub-issues first and skips any whose title
 * already matches, so a retried plan run doesn't duplicate work (§4.2, the
 * Phase 3 idempotency checkpoint).
 */
export async function createSubIssuesIdempotent(
  token: string,
  owner: string,
  repo: string,
  parentIssueNumber: number,
  subtasks: SubIssueSpec[],
): Promise<void> {
  const existing = (await githubRequest(
    token,
    `/repos/${owner}/${repo}/issues/${parentIssueNumber}/sub_issues`,
  )) as Array<{ title: string }>;
  const existingTitles = new Set(existing.map((i) => i.title));

  for (const subtask of subtasks) {
    if (existingTitles.has(subtask.title)) {
      logger.info("skipping duplicate sub-issue on retry", { title: subtask.title, parentIssueNumber });
      continue;
    }
    const created = (await githubRequest(token, `/repos/${owner}/${repo}/issues`, {
      method: "POST",
      body: JSON.stringify({ title: subtask.title, body: subtask.body }),
    })) as { number: number };
    await githubRequest(token, `/repos/${owner}/${repo}/issues/${parentIssueNumber}/sub_issues`, {
      method: "POST",
      body: JSON.stringify({ sub_issue_id: created.number }),
    });
  }
}

export async function labelIssue(token: string, owner: string, repo: string, issueNumber: number, label: string) {
  await githubRequest(token, `/repos/${owner}/${repo}/issues/${issueNumber}/labels`, {
    method: "POST",
    body: JSON.stringify({ labels: [label] }),
  });
}

export async function addIssueComment(token: string, owner: string, repo: string, issueNumber: number, body: string) {
  await githubRequest(token, `/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

export interface IssueStatus {
  number: number;
  title: string;
  state: string;
  labels: string[];
  html_url: string;
}

/** Backs the `check_status` MCP tool (§5.1). */
export async function getIssue(token: string, owner: string, repo: string, issueNumber: number): Promise<IssueStatus> {
  const issue = (await githubRequest(token, `/repos/${owner}/${repo}/issues/${issueNumber}`)) as {
    number: number;
    title: string;
    state: string;
    labels: Array<{ name: string } | string>;
    html_url: string;
  };
  return {
    number: issue.number,
    title: issue.title,
    state: issue.state,
    labels: issue.labels.map((l) => (typeof l === "string" ? l : l.name)),
    html_url: issue.html_url,
  };
}

/** Backs the `create_ticket` MCP tool (§5.1). */
export async function createTicket(token: string, owner: string, repo: string, title: string, body: string): Promise<IssueStatus> {
  const issue = (await githubRequest(token, `/repos/${owner}/${repo}/issues`, {
    method: "POST",
    body: JSON.stringify({ title, body }),
  })) as { number: number; title: string; state: string; html_url: string };
  return { ...issue, labels: [] };
}

/** Fires the GitHub Actions workflow via repository_dispatch, for chat/curl-originated jobs (§4.1). */
export async function dispatchRepositoryEvent(
  token: string,
  owner: string,
  repo: string,
  action: "plan" | "implement",
) {
  await githubRequest(token, `/repos/${owner}/${repo}/dispatches`, {
    method: "POST",
    body: JSON.stringify({ event_type: "agent-trigger", client_payload: { action } }),
  });
}

/** Used by scaffold_project (§6.1) to write the new skill file / registry entry / caller workflow. */
export async function createOrUpdateFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  branch: string,
) {
  let sha: string | undefined;
  try {
    const existing = (await githubRequest(
      token,
      `/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
    )) as { sha: string };
    sha = existing.sha;
  } catch {
    // File doesn't exist yet — creating, not updating.
  }
  await githubRequest(token, `/repos/${owner}/${repo}/contents/${path}`, {
    method: "PUT",
    body: JSON.stringify({
      message,
      content: Buffer.from(content, "utf-8").toString("base64"),
      branch,
      ...(sha ? { sha } : {}),
    }),
  });
}

// POST /trigger, /webhook/github, /webhook/mcp — all authenticated from
// day one (roadmap Phase 2, step 3; strategy doc §9.1).
import express, { type Request } from "express";
import { githubWebhookAuth, sharedSecretAuth } from "./auth.js";
import { logger } from "./logging.js";
import { parseLabelEvent } from "./triggers/github_label.js";
import { parseMentionEvent } from "./triggers/github_mention.js";
import { handleHttpTrigger } from "./triggers/http_api.js";
import { handleChatCommand } from "./triggers/chat_command.js";
import { mountMcpHttp } from "./integrations/mcp_server.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`missing required env var: ${name}`);
  return value;
}

const config = {
  port: Number(process.env.PORT ?? 3000),
  sharedSecret: requireEnv("ORCHESTRATOR_SHARED_SECRET"),
  githubWebhookSecret: requireEnv("GH_WEBHOOK_SECRET"),
  githubApp: {
    appId: requireEnv("GH_APP_ID"),
    privateKey: requireEnv("GH_APP_PRIVATE_KEY"),
  },
  installationId: requireEnv("GH_APP_INSTALLATION_ID"),
  controlRepoOwner: process.env.CONTROL_REPO_OWNER ?? "HeyItsChloe",
  controlRepoName: process.env.CONTROL_REPO_NAME ?? "agent-ops",
  branch: process.env.CONTROL_REPO_BRANCH ?? "main",
  allowedMentionAuthors: (process.env.ALLOWED_MENTION_AUTHORS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  liteLLM: { proxyUrl: requireEnv("LITELLM_PROXY_URL"), virtualKey: requireEnv("LITELLM_VIRTUAL_KEY") },
  // Optional — only required if a personal project's sourcing_method actually
  // selects "api"/"scraping" at request time (checked there, not here, since
  // most requests never need either).
  jobApiSourcing:
    process.env.JOB_API_BASE_URL && process.env.JOB_API_KEY
      ? { baseUrl: process.env.JOB_API_BASE_URL, apiKey: process.env.JOB_API_KEY }
      : undefined,
  // One directory of per-hostname session files (integrations/site_sessions.ts)
  // shared by both sourcing_method: scraping (per-posting fetch) and the
  // scrapeAll strategy (crawls whatever site it's given) — replaces an
  // earlier design mistake where a single LINKEDIN_STORAGE_STATE_PATH env
  // var was reused as scrapeAll's config, even though scrapeAll is
  // genuinely multi-site by design. Optional: many sites need no saved
  // session at all, resolved per-hostname at the point of use.
  siteSessions: process.env.SITE_SESSIONS_DIR ? { sessionsDir: process.env.SITE_SESSIONS_DIR } : undefined,
  scrapeAnySourcing:
    process.env.WEB_SEARCH_API_URL && process.env.WEB_SEARCH_API_KEY
      ? { searchApiUrl: process.env.WEB_SEARCH_API_URL, searchApiKey: process.env.WEB_SEARCH_API_KEY }
      : undefined,
  // the-store didn't exist yet when this was built — unset until the repo
  // is created and these env vars are configured; appends are skipped (with
  // a warning) rather than failing the pipeline while it's unset.
  theStore:
    process.env.THE_STORE_OWNER && process.env.THE_STORE_REPO
      ? {
          owner: process.env.THE_STORE_OWNER,
          repo: process.env.THE_STORE_REPO,
          branch: process.env.THE_STORE_BRANCH ?? "main",
          path: process.env.THE_STORE_PATH ?? "projects/job-applications/job-app-results.csv",
        }
      : undefined,
};

const dispatchDeps = { githubApp: config.githubApp, installationId: config.installationId };
const personalPipelineDeps = {
  liteLLM: config.liteLLM,
  apiSourcing: config.jobApiSourcing,
  scrapingSourcing: config.siteSessions,
  scrapeAllSourcing: config.siteSessions,
  scrapeAnySourcing: config.scrapeAnySourcing,
  theStore: config.theStore,
};
const chatCommandDeps = {
  ...dispatchDeps,
  controlRepoOwner: config.controlRepoOwner,
  controlRepoName: config.controlRepoName,
  branch: config.branch,
  personalPipeline: personalPipelineDeps,
};
const httpTriggerDeps = {
  dev: dispatchDeps,
  personal: {
    ...dispatchDeps,
    controlRepoOwner: config.controlRepoOwner,
    controlRepoName: config.controlRepoName,
    branch: config.branch,
    ...personalPipelineDeps,
  },
};

const app = express();

// Capture the raw body so /webhook/github can verify GitHub's HMAC signature.
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as Request & { rawBody?: Buffer }).rawBody = buf;
    },
  }),
);

app.post("/trigger", sharedSecretAuth(config.sharedSecret), handleHttpTrigger(httpTriggerDeps));

app.post("/webhook/mcp", sharedSecretAuth(config.sharedSecret), handleChatCommand(chatCommandDeps));

// Label/mention triggers fire the workflow natively via GitHub Actions
// (`on: issues`/`on: issue_comment`) — this endpoint only logs the same
// events for observability, it does not re-dispatch (see triggers/github_label.ts).
app.post("/webhook/github", githubWebhookAuth(config.githubWebhookSecret), (req, res) => {
  const eventName = req.header("x-github-event");
  if (eventName === "issues") {
    const job = parseLabelEvent(req.body);
    if (job) logger.info("observed label-triggered job", { ...job });
  } else if (eventName === "issue_comment") {
    const job = parseMentionEvent(req.body, config.allowedMentionAuthors);
    if (job) logger.info("observed mention-triggered job", { ...job });
  }
  res.status(204).end();
});

// Phase 6: the MCP server lives behind the same HTTPS domain, at /mcp,
// behind the same shared-secret auth as every other endpoint (roadmap
// Phase 6, step 2). It talks back to /webhook/mcp on this same process.
app.use("/mcp", sharedSecretAuth(config.sharedSecret));
mountMcpHttp(app, "/mcp", {
  orchestratorUrl: `http://localhost:${config.port}`,
  sharedSecret: config.sharedSecret,
});

app.listen(config.port, () => {
  logger.info("orchestrator listening", { port: config.port });
});

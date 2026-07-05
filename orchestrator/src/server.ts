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

const rawPrivateKey = requireEnv("GH_APP_PRIVATE_KEY");
const normalizedPrivateKey = rawPrivateKey.replace(/\\n/g, "\n");
// One-time, safe-to-log diagnostic (shape only — never the key content
// itself) for the persistent "secretOrPrivateKey must be an asymmetric key
// when using RS256" error seen live via Cloud Run logs. The \n-flattening
// theory below didn't fix it on the last deploy, so this reveals what's
// actually in the env var instead of guessing again: does it even start
// with a PEM header, what's its length, does it contain literal "\n" text
// vs. real newline characters.
logger.info("GH_APP_PRIVATE_KEY diagnostic", {
  rawLength: rawPrivateKey.length,
  normalizedLength: normalizedPrivateKey.length,
  rawStartsWithPemHeader: rawPrivateKey.trimStart().startsWith("-----BEGIN"),
  normalizedStartsWithPemHeader: normalizedPrivateKey.trimStart().startsWith("-----BEGIN"),
  rawEndsWithPemFooter: rawPrivateKey.trimEnd().endsWith("-----"),
  containsLiteralBackslashN: rawPrivateKey.includes("\\n"),
  containsRealNewlineAfterNormalize: normalizedPrivateKey.includes("\n"),
  firstTenChars: JSON.stringify(rawPrivateKey.slice(0, 10)),
  lastTenChars: JSON.stringify(rawPrivateKey.slice(-10)),
});

const config = {
  port: Number(process.env.PORT ?? 3000),
  sharedSecret: requireEnv("ORCHESTRATOR_SHARED_SECRET"),
  githubWebhookSecret: requireEnv("GH_WEBHOOK_SECRET"),
  githubApp: {
    appId: requireEnv("GH_APP_ID"),
    privateKey: normalizedPrivateKey,
  },
  installationId: requireEnv("GH_APP_INSTALLATION_ID"),
  // Separate from the installation above (11thandOrange org, used for dev-
  // pipeline dispatch to app repos like BusyBuddy_v2) — the personal
  // pipeline's very first action, regardless of sourcing method, is
  // fetching a skill file from HeyItsChloe/agent-ops, and it later writes
  // to HeyItsChloe/the-store. Both live under the heyitschloe personal
  // account, a different GitHub App installation from the org one. Using
  // the org installation for these calls 404s at the token-minting step —
  // confirmed live via Cloud Run logs — since that installation ID simply
  // doesn't grant access to a different account's repos.
  personalInstallationId: requireEnv("GH_APP_INSTALLATION_ID_PERSONAL"),
  controlRepoOwner: process.env.CONTROL_REPO_OWNER ?? "HeyItsChloe",
  controlRepoName: process.env.CONTROL_REPO_NAME ?? "agent-ops",
  branch: process.env.CONTROL_REPO_BRANCH ?? "main",
  allowedMentionAuthors: (process.env.ALLOWED_MENTION_AUTHORS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  liteLLM: { proxyUrl: requireEnv("LITELLM_PROXY_URL"), virtualKey: requireEnv("LITELLM_VIRTUAL_KEY") },
  // Optional — only required if a personal project's sourcing_method actually
  // selects "api"/"scraping" at request time (checked there, not here, since
  // most requests never need either). api_provider/apiProvider picks which
  // provider below is used (jsearch is the only one today — jobs/sourcing/
  // api/resolver.ts) — this just bundles whichever provider credentials are
  // actually set, same pattern as scrapeAnySourcing below.
  apiSourcing:
    process.env.JSEARCH_API_KEY
      ? {
          jsearch: {
            baseUrl: process.env.JSEARCH_BASE_URL ?? "https://prod.api.market/api/v1/openwebninja/jobsearch",
            apiKey: process.env.JSEARCH_API_KEY,
          },
        }
      : undefined,
  // One directory of per-hostname session files (integrations/site_sessions.ts)
  // shared by both sourcing_method: scraping (per-posting fetch) and the
  // scrapeAll strategy (crawls whatever site it's given) — replaces an
  // earlier design mistake where a single LINKEDIN_STORAGE_STATE_PATH env
  // var was reused as scrapeAll's config, even though scrapeAll is
  // genuinely multi-site by design. Optional: many sites need no saved
  // session at all, resolved per-hostname at the point of use.
  siteSessions: process.env.SITE_SESSIONS_DIR ? { sessionsDir: process.env.SITE_SESSIONS_DIR } : undefined,
  // scrapeAny's search provider is chosen per-project/per-call (search_provider
  // /searchProvider — jobs/discovery/scrapeAny.ts), not fixed here; this just
  // bundles whichever provider credentials are actually set, so either or
  // both can be configured independently. claude_web_search uses its own
  // ANTHROPIC_API_KEY rather than LITELLM_VIRTUAL_KEY, since it needs a
  // direct call to Anthropic's Messages API for the server-side web_search
  // tool, not the OpenAI-compatible LiteLLM gateway the rest of the pipeline uses.
  scrapeAnySourcing:
    process.env.SERPAPI_API_KEY || process.env.ANTHROPIC_API_KEY
      ? {
          serpapi: process.env.SERPAPI_API_KEY ? { apiKey: process.env.SERPAPI_API_KEY } : undefined,
          claudeWebSearch: process.env.ANTHROPIC_API_KEY ? { apiKey: process.env.ANTHROPIC_API_KEY } : undefined,
        }
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
  // Applicant background fed to the drafting model as grounding material —
  // entirely separate from resume_source/cover_letter_source (those control
  // the *output* document). One applicant, server-config-level, not
  // per-project. Optional as a whole (gated by the five core fields being
  // set) so a server without this configured still runs personal-pipeline
  // requests exactly as before, just without this grounding.
  applicantProfile:
    process.env.APPLICANT_FIRST_NAME &&
    process.env.APPLICANT_LAST_NAME &&
    process.env.APPLICANT_EMAIL &&
    process.env.APPLICANT_PHONE &&
    process.env.APPLICANT_PROFESSIONAL_SUMMARY
      ? {
          firstName: process.env.APPLICANT_FIRST_NAME,
          lastName: process.env.APPLICANT_LAST_NAME,
          email: process.env.APPLICANT_EMAIL,
          phone: process.env.APPLICANT_PHONE,
          professionalSummary: process.env.APPLICANT_PROFESSIONAL_SUMMARY,
          resumeGdriveLink: process.env.APPLICANT_RESUME_GDRIVE_LINK,
          location: process.env.APPLICANT_LOCATION,
          linkedinUrl: process.env.APPLICANT_LINKEDIN_URL,
          portfolioUrl: process.env.APPLICANT_PORTFOLIO_URL,
          currentTitle: process.env.APPLICANT_CURRENT_TITLE,
          currentEmployer: process.env.APPLICANT_CURRENT_EMPLOYER,
          yearsExperience: process.env.APPLICANT_YEARS_EXPERIENCE,
          workAuthorization: process.env.APPLICANT_WORK_AUTHORIZATION,
          sponsorshipRequired: process.env.APPLICANT_SPONSORSHIP_REQUIRED,
          desiredSalary: process.env.APPLICANT_DESIRED_SALARY,
          availability: process.env.APPLICANT_AVAILABILITY,
        }
      : undefined,
};

const dispatchDeps = { githubApp: config.githubApp, installationId: config.installationId };
const personalPipelineDeps = {
  // Overrides dispatchDeps's installationId when spread after it below —
  // the personal pipeline needs the HeyItsChloe-scoped installation, not
  // the 11thandOrange one dev-pipeline dispatch uses.
  installationId: config.personalInstallationId,
  liteLLM: config.liteLLM,
  apiSourcing: config.apiSourcing,
  scrapingSourcing: config.siteSessions,
  scrapeAllSourcing: config.siteSessions,
  scrapeAnySourcing: config.scrapeAnySourcing,
  theStore: config.theStore,
  applicantProfile: config.applicantProfile,
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

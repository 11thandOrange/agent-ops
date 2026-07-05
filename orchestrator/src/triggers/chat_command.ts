// Backing handler for POST /webhook/mcp — where the MCP server
// (integrations/mcp_server.ts) forwards tool calls so chat-originated
// requests go through the same auth/logging/dispatch path as every other
// trigger (§4.1, §5.1).
import type { Request, Response } from "express";
import { z } from "zod";
import { createTicket, getInstallationToken, getIssue, labelIssue, type GitHubAppConfig } from "../integrations/github.js";
import { dispatchImplement } from "../jobs/implement_ticket.js";
import { dispatchPlan } from "../jobs/plan_ticket.js";
import { dispatchPersonalPipeline, type PersonalPipelineDeps } from "../jobs/run_personal_pipeline.js";
import { theStoreFileUrl } from "../integrations/the_store.js";
import { scaffoldProject, type ScaffoldDeps } from "../jobs/scaffold_project.js";
import { logger, newCorrelationId } from "../logging.js";

const DocumentSourceSchema = z.union([
  z.object({ mode: z.literal("gdrive_link"), gdrive_link: z.string() }),
  z.object({ mode: z.literal("generated_pdf") }),
]);

const JobCriteriaSchema = z.object({
  title: z.string().optional(),
  location: z.string().optional(),
  remote: z.boolean().optional(),
  salaryMin: z.number().optional(),
  salaryMax: z.number().optional(),
  skills: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  websites: z.array(z.string()).optional(),
  datePostedAfter: z.string().optional(),
  company: z.string().optional(),
  whitelist: z.record(z.array(z.string())).optional(),
  blacklist: z.record(z.array(z.string())).optional(),
});

// Two tool names, not one overloaded run_project_pipeline — dev and
// personal projects have structurally different call shapes (dev:
// repo+issueNumber, fires a GitHub Actions run; personal: project+request,
// executed directly by the orchestrator), and a discriminated union on two
// distinct literals gives exhaustive type narrowing and clean per-tool MCP
// schemas instead of one flat schema with "dev only"/"personal only"
// field annotations. Doesn't change the registry split (still two files
// regardless of tool naming).
const RunDevelopmentProjectPipeline = z.object({
  tool: z.literal("run_development_project_pipeline"),
  repo: z.string(),
  issueNumber: z.number().int().positive(),
  action: z.enum(["plan", "implement"]),
  requestedBy: z.string(),
});
const RunPersonalProjectPipeline = z.object({
  tool: z.literal("run_personal_project_pipeline"),
  project: z.string(),
  // scrapeOne: a pasted posting or its URL. scrapeAll: the site URL to
  // crawl. scrapeAny: ignored — criteria drives the search.
  request: z.string(),
  requestedBy: z.string(),
  sourcingMethod: z.enum(["scraping", "api", "manual"]).optional(),
  resumeSource: DocumentSourceSchema.optional(),
  coverLetterSource: DocumentSourceSchema.optional(),
  strategy: z.enum(["scrapeOne", "scrapeAll", "scrapeAny"]).optional(),
  criteria: JobCriteriaSchema.optional(),
  maxResults: z.number().int().positive().optional(),
  searchProvider: z.enum(["serpapi", "claude_web_search"]).optional(),
  scrapingAdapter: z.enum(["linkedin", "glassdoor", "indeed", "generic-one-page-app", "generic-multistep-app"]).optional(),
});

const ToolCallBody = z.discriminatedUnion("tool", [
  z.object({ tool: z.literal("create_ticket"), repo: z.string(), title: z.string(), body: z.string(), requestedBy: z.string() }),
  z.object({ tool: z.literal("check_status"), repo: z.string(), issueNumber: z.number().int().positive() }),
  z.object({ tool: z.literal("request_approval"), repo: z.string(), issueNumber: z.number().int().positive(), requestedBy: z.string() }),
  RunDevelopmentProjectPipeline,
  RunPersonalProjectPipeline,
  z.object({
    tool: z.literal("scaffold_project"),
    name: z.string(),
    type: z.enum(["dev", "personal"]),
    repo: z.string().optional(),
    appliesTo: z.array(z.string()).optional(),
  }),
]);

export interface ChatCommandDeps {
  githubApp: GitHubAppConfig;
  installationId: string;
  controlRepoOwner: string;
  controlRepoName: string;
  branch: string;
  personalPipeline: Pick<
    PersonalPipelineDeps,
    "installationId" | "liteLLM" | "apiSourcing" | "scrapingSourcing" | "scrapeAllSourcing" | "scrapeAnySourcing" | "theStore" | "applicantProfile"
  >;
}

export function handleChatCommand(deps: ChatCommandDeps) {
  return async (req: Request, res: Response) => {
    const parsed = ToolCallBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid tool call", details: parsed.error.flatten() });
      return;
    }
    const call = parsed.data;
    const correlationId = newCorrelationId();
    const log = logger.withContext({ correlationId, tool: call.tool });

    try {
      switch (call.tool) {
        case "create_ticket": {
          const [owner, repo] = call.repo.split("/");
          const token = await getInstallationToken(deps.githubApp, deps.installationId);
          const issue = await createTicket(token, owner, repo, call.title, call.body);
          res.status(201).json({ correlationId, issue });
          return;
        }
        case "check_status": {
          const [owner, repo] = call.repo.split("/");
          const token = await getInstallationToken(deps.githubApp, deps.installationId);
          const issue = await getIssue(token, owner, repo, call.issueNumber);
          res.status(200).json({ correlationId, issue });
          return;
        }
        case "request_approval": {
          const [owner, repo] = call.repo.split("/");
          const token = await getInstallationToken(deps.githubApp, deps.installationId);
          await labelIssue(token, owner, repo, call.issueNumber, "approved");
          res.status(202).json({ correlationId, status: "approved" });
          return;
        }
        case "run_development_project_pipeline": {
          const payload = {
            repo: call.repo,
            issueNumber: call.issueNumber,
            action: call.action,
            requestedBy: call.requestedBy,
            source: "chat" as const,
            correlationId,
          };
          if (call.action === "plan") {
            await dispatchPlan(deps, payload);
          } else {
            await dispatchImplement(deps, payload);
          }
          res.status(202).json({ correlationId, status: "dispatched" });
          return;
        }
        case "run_personal_project_pipeline": {
          const personalDeps: PersonalPipelineDeps = {
            githubApp: deps.githubApp,
            controlRepoOwner: deps.controlRepoOwner,
            controlRepoName: deps.controlRepoName,
            branch: deps.branch,
            // installationId comes from deps.personalPipeline (HeyItsChloe-
            // scoped), not the outer deps.installationId (11thandOrange,
            // used for dev-pipeline dispatch above) — a token minted
            // against the wrong account's installation 404s outright.
            ...deps.personalPipeline,
          };
          const result = await dispatchPersonalPipeline(personalDeps, {
            project: call.project,
            request: call.request,
            requestedBy: call.requestedBy,
            correlationId,
            sourcingMethod: call.sourcingMethod,
            resumeSource: call.resumeSource,
            coverLetterSource: call.coverLetterSource,
            strategy: call.strategy,
            criteria: call.criteria,
            maxResults: call.maxResults,
            searchProvider: call.searchProvider,
            scrapingAdapter: call.scrapingAdapter,
          });
          const csvUrl = deps.personalPipeline.theStore ? theStoreFileUrl(deps.personalPipeline.theStore) : undefined;
          res.status(200).json({ correlationId, status: "complete", result, csvUrl });
          return;
        }
        case "scaffold_project": {
          const scaffoldDeps: ScaffoldDeps = {
            githubApp: deps.githubApp,
            installationId: deps.installationId,
            controlRepoOwner: deps.controlRepoOwner,
            controlRepoName: deps.controlRepoName,
            branch: deps.branch,
          };
          await scaffoldProject(scaffoldDeps, call);
          res.status(201).json({ correlationId, status: "scaffolded" });
          return;
        }
      }
    } catch (err) {
      log.error("chat command failed", { error: String(err) });
      res.status(502).json({ error: "command failed", correlationId });
    }
  };
}

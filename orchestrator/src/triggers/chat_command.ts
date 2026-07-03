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
import { scaffoldProject, type ScaffoldDeps } from "../jobs/scaffold_project.js";
import { logger, newCorrelationId } from "../logging.js";

const DocumentSourceSchema = z.union([
  z.object({ mode: z.literal("gdrive_link"), gdrive_link: z.string() }),
  z.object({ mode: z.literal("generated_pdf") }),
]);

// run_project_pipeline stays one tool name (§5.1: "dispatches by project,
// not by a per-project tool"), but dev and personal projects genuinely have
// different call shapes — dev dispatches by repo+issueNumber (fires a
// GitHub Actions run), personal dispatches by project name+free-text
// request (the orchestrator itself executes it, no CI runner involved).
// Two full variants distinguished structurally (repo vs. project) rather
// than a redundant "kind" flag the caller would have to keep in sync.
const RunDevPipeline = z.object({
  tool: z.literal("run_project_pipeline"),
  repo: z.string(),
  issueNumber: z.number().int().positive(),
  action: z.enum(["plan", "implement"]),
  requestedBy: z.string(),
});
const RunPersonalPipeline = z.object({
  tool: z.literal("run_project_pipeline"),
  project: z.string(),
  request: z.string(),
  requestedBy: z.string(),
  sourcingMethod: z.enum(["scraping", "api", "manual"]).optional(),
  resumeSource: DocumentSourceSchema.optional(),
  coverLetterSource: DocumentSourceSchema.optional(),
});

const ToolCallBody = z.union([
  z.object({ tool: z.literal("create_ticket"), repo: z.string(), title: z.string(), body: z.string(), requestedBy: z.string() }),
  z.object({ tool: z.literal("check_status"), repo: z.string(), issueNumber: z.number().int().positive() }),
  z.object({ tool: z.literal("request_approval"), repo: z.string(), issueNumber: z.number().int().positive(), requestedBy: z.string() }),
  RunDevPipeline,
  RunPersonalPipeline,
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
  personalPipeline: Pick<PersonalPipelineDeps, "liteLLM" | "apiSourcing" | "scrapingSourcing">;
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
        case "run_project_pipeline": {
          if ("repo" in call) {
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
          const personalDeps: PersonalPipelineDeps = {
            githubApp: deps.githubApp,
            installationId: deps.installationId,
            controlRepoOwner: deps.controlRepoOwner,
            controlRepoName: deps.controlRepoName,
            branch: deps.branch,
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
          });
          res.status(200).json({ correlationId, status: "complete", result });
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

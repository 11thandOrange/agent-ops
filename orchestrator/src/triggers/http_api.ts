// Backing handler for POST /trigger — the Postman/curl entry point (§4.1).
// Auth (sharedSecretAuth) runs as Express middleware before this ever executes.
// Same dev/personal split as chat_command.ts's two run_*_project_pipeline
// tools — this endpoint had been dev-only (repo/issueNumber/action) since
// Phase 2 and never got the personal-pipeline shape added until now.
import type { Request, Response } from "express";
import { z } from "zod";
import { dispatchImplement } from "../jobs/implement_ticket.js";
import { dispatchPlan, type DispatchDeps } from "../jobs/plan_ticket.js";
import { dispatchPersonalPipeline, type PersonalPipelineDeps } from "../jobs/run_personal_pipeline.js";
import { theStoreFileUrl } from "../integrations/the_store.js";
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

const DevTriggerBody = z.object({
  kind: z.literal("development"),
  repo: z.string().regex(/^[^/]+\/[^/]+$/, "expected \"owner/repo\""),
  issueNumber: z.number().int().positive(),
  action: z.enum(["plan", "implement"]),
  requestedBy: z.string().min(1),
});
const PersonalTriggerBody = z.object({
  kind: z.literal("personal"),
  project: z.string().min(1),
  request: z.string(),
  requestedBy: z.string().min(1),
  sourcingMethod: z.enum(["scraping", "api", "manual"]).optional(),
  resumeSource: DocumentSourceSchema.optional(),
  coverLetterSource: DocumentSourceSchema.optional(),
  strategy: z.enum(["scrapeOne", "scrapeAll", "scrapeAny"]).optional(),
  criteria: JobCriteriaSchema.optional(),
  maxResults: z.number().int().positive().optional(),
  searchProvider: z.enum(["serpapi", "claude_web_search"]).optional(),
  scrapingAdapter: z.enum(["linkedin", "glassdoor", "indeed", "generic-one-page-app", "generic-multistep-app"]).optional(),
  apiProvider: z.enum(["jsearch"]).optional(),
});
const TriggerBody = z.discriminatedUnion("kind", [DevTriggerBody, PersonalTriggerBody]);

export interface HttpTriggerDeps {
  dev: DispatchDeps;
  personal: Pick<PersonalPipelineDeps, "githubApp" | "installationId" | "controlRepoOwner" | "controlRepoName" | "branch" | "liteLLM" | "apiSourcing" | "scrapingSourcing" | "scrapeAllSourcing" | "scrapeAnySourcing" | "theStore" | "applicantProfile">;
}

export function handleHttpTrigger(deps: HttpTriggerDeps) {
  return async (req: Request, res: Response) => {
    const parsed = TriggerBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid request body", details: parsed.error.flatten() });
      return;
    }
    const correlationId = newCorrelationId();
    const call = parsed.data;

    try {
      if (call.kind === "development") {
        const payload = {
          repo: call.repo,
          issueNumber: call.issueNumber,
          action: call.action,
          requestedBy: call.requestedBy,
          source: "curl" as const,
          correlationId,
        };
        if (call.action === "plan") {
          await dispatchPlan(deps.dev, payload);
        } else {
          await dispatchImplement(deps.dev, payload);
        }
        res.status(202).json({ correlationId, status: "dispatched" });
        return;
      }

      const result = await dispatchPersonalPipeline(deps.personal as PersonalPipelineDeps, {
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
        apiProvider: call.apiProvider,
      });
      // Only present when the-store is actually configured — same gating as
      // the CSV append itself (dispatchPersonalPipeline warns and skips
      // rather than failing when it's unset).
      const csvUrl = deps.personal.theStore ? theStoreFileUrl(deps.personal.theStore) : undefined;
      res.status(200).json({ correlationId, status: "complete", result, csvUrl });
    } catch (err) {
      logger.error("trigger dispatch failed", { correlationId, error: String(err) });
      res.status(502).json({ error: "dispatch failed", correlationId });
    }
  };
}

// Wraps run_personal_pipeline.ts's dispatchPersonalPipeline behind the
// generic PipelineHandler interface (pipeline-orchestrator's engine), so it
// registers exactly like the shipped dev-ticket-pipeline handler — this is
// this deployment's own private pipeline, never shipped in the public repo.
import { z } from "zod";
import type { PipelineHandler, PipelineHandlerContext, PipelineResult } from "pipeline-orchestrator";
import { dispatchPersonalPipeline, noNewResultsMessage, type PersonalPipelineDeps, type PersonalPipelineRequest } from "../jobs/run_personal_pipeline.js";
import type { JobSearchParams } from "../types.js";

const DocumentSourceSchema = z.union([
  z.object({ mode: z.literal("gdrive_link"), gdrive_link: z.string() }),
  z.object({ mode: z.literal("generated_pdf") }),
]);

export const JobSearchParamsSchema = z.object({
  model_profile: z.string(),
  resume_source: DocumentSourceSchema,
  cover_letter_source: DocumentSourceSchema,
  sourcing_method: z.enum(["scraping", "api", "manual"]),
  strategy: z.enum(["scrapeOne", "scrapeAll", "scrapeAny"]),
  max_results: z.number().int().positive(),
  search_provider: z.enum(["serpapi", "claude_web_search", "jsearch"]),
  scraping_adapter: z.enum(["linkedin", "glassdoor", "indeed", "generic-one-page-app", "generic-multistep-app"]).optional(),
  api_provider: z.enum(["jsearch"]).optional(),
});

// The input shape callers (chat/curl) pass in ctx.job.input, plus any
// per-call overrides of the registry's own defaults — same fields
// PersonalPipelineRequest already supported before this was a registered
// pipeline behind the generic engine.
const InputSchema = z.object({
  request: z.string(),
  sourcingMethod: z.enum(["scraping", "api", "manual"]).optional(),
  resumeSource: DocumentSourceSchema.optional(),
  coverLetterSource: DocumentSourceSchema.optional(),
  strategy: z.enum(["scrapeOne", "scrapeAll", "scrapeAny"]).optional(),
  criteria: z
    .object({
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
    })
    .optional(),
  maxResults: z.number().int().positive().optional(),
  searchProvider: z.enum(["serpapi", "claude_web_search", "jsearch"]).optional(),
  scrapingAdapter: z.enum(["linkedin", "glassdoor", "indeed", "generic-one-page-app", "generic-multistep-app"]).optional(),
  apiProvider: z.enum(["jsearch"]).optional(),
});

export function createJobSearchPipelineHandler(deps: PersonalPipelineDeps): PipelineHandler {
  return {
    name: "job-search-pipeline",
    paramsSchema: JobSearchParamsSchema,
    async run(ctx: PipelineHandlerContext): Promise<PipelineResult> {
      const input = InputSchema.safeParse(ctx.job.input ?? {});
      if (!input.success) {
        return { status: "error", message: `invalid input: ${JSON.stringify(input.error.flatten())}` };
      }
      const entry: JobSearchParams = { skill_path: ctx.pipeline.skill_path, ...(ctx.pipeline.params as Omit<JobSearchParams, "skill_path">) };

      const req: PersonalPipelineRequest = {
        request: input.data.request,
        requestedBy: ctx.job.requestedBy,
        correlationId: ctx.job.correlationId,
        sourcingMethod: input.data.sourcingMethod,
        resumeSource: input.data.resumeSource,
        coverLetterSource: input.data.coverLetterSource,
        strategy: input.data.strategy,
        criteria: input.data.criteria,
        maxResults: input.data.maxResults,
        searchProvider: input.data.searchProvider,
        scrapingAdapter: input.data.scrapingAdapter,
        apiProvider: input.data.apiProvider,
      };

      const result = await dispatchPersonalPipeline(deps, req, ctx.pipeline.name, entry);
      return { status: "complete", message: noNewResultsMessage(result), data: result };
    },
  };
}

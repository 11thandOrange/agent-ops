// Personal-project counterpart to plan_ticket.ts/implement_ticket.ts.
// Structurally separate from the dev dispatch path (strategy doc §5.3):
// personal projects have no repo/CI runner to dispatch to, so the
// orchestrator itself loads the skill, gathers the posting(s), and calls
// the model gateway directly, then returns a package for the chat thread —
// there is no separate notification channel to deliver it through.
import { chatCompletion, type LiteLLMConfig } from "../integrations/litellm.js";
import { parseModelJson } from "../integrations/llmJson.js";
import { getFileContents, getInstallationToken, type GitHubAppConfig } from "../integrations/github.js";
import { renderTextToPdf } from "../integrations/pdf.js";
import { appendJobApplicationRow, type TheStoreConfig } from "../integrations/the_store.js";
import { logger } from "../logging.js";
import { loadPersonalProject } from "../registry/load.js";
import * as manualSourcing from "./sourcing/manual.js";
import * as apiSourcing from "./sourcing/api.js";
import * as scrapingSourcing from "./sourcing/scraping.js";
import * as scrapeAllDiscovery from "./discovery/scrapeAll.js";
import * as scrapeAnyDiscovery from "./discovery/scrapeAny.js";
import type { DocumentSource, JobCriteria, PostingCandidate, ScrapingAdapterName, SearchProviderName, SourcingMethod, Strategy } from "../types.js";

export interface PersonalPipelineDeps {
  githubApp: GitHubAppConfig;
  installationId: string;
  controlRepoOwner: string;
  controlRepoName: string;
  branch: string;
  liteLLM: LiteLLMConfig;
  apiSourcing?: apiSourcing.ApiSourcingConfig;
  scrapingSourcing?: scrapingSourcing.ScrapingSourcingConfig;
  scrapeAllSourcing?: scrapeAllDiscovery.ScrapeAllConfig;
  scrapeAnySourcing?: scrapeAnyDiscovery.ScrapeAnyConfig;
  // Optional — the-store may not exist/be configured yet; appends are
  // skipped (with a warning) rather than failing the pipeline when unset.
  theStore?: TheStoreConfig;
}

export interface PersonalPipelineRequest {
  project: string;
  // scrapeOne: a pasted posting or its URL. scrapeAll: the site URL to
  // crawl. scrapeAny: ignored — criteria drives the search.
  request: string;
  requestedBy: string;
  correlationId: string;
  // Per-call overrides — fall back to the registry entry's defaults when omitted.
  sourcingMethod?: SourcingMethod;
  resumeSource?: DocumentSource;
  coverLetterSource?: DocumentSource;
  strategy?: Strategy;
  criteria?: JobCriteria;
  maxResults?: number;
  searchProvider?: SearchProviderName; // scrapeAny only
  scrapingAdapter?: ScrapingAdapterName; // sourcing_method: scraping only
}

export interface DocumentResult {
  mode: "gdrive_link" | "generated_pdf";
  gdriveLink?: string;
  pdfBase64?: string;
}

export interface ApplicationPackage {
  status: "success";
  resume: DocumentResult;
  coverLetter: DocumentResult;
  applicationSummary: string;
  // Flat label -> value map for the local companion prefill script
  // (skills/personal/resume-job-applier/job-application-form-prefill) to fill form fields
  // against when you open sourceUrl yourself — narrative applicationSummary
  // is for you to read, formFields is what that script consumes.
  formFields: Record<string, string>;
  sourceUrl?: string;
  title?: string;
  company?: string;
}

// One bad candidate in a scrapeAll/scrapeAny batch used to abort the whole
// run and lose every already-drafted result — found during a later
// confirmation pass, not by design. Each candidate now fails independently;
// a partial batch returns whatever succeeded plus a failure entry for
// whatever didn't, instead of a single opaque 502 for the whole request.
export interface ApplicationFailure {
  status: "failed";
  sourceUrl?: string;
  title?: string;
  company?: string;
  error: string;
}

export type PersonalPipelineResultItem = ApplicationPackage | ApplicationFailure;
export type PersonalPipelineResult = PersonalPipelineResultItem[];

export async function dispatchPersonalPipeline(deps: PersonalPipelineDeps, req: PersonalPipelineRequest): Promise<PersonalPipelineResult> {
  const log = logger.withContext({ correlationId: req.correlationId, project: req.project });
  log.info("dispatching personal pipeline", { requestedBy: req.requestedBy });

  const entry = loadPersonalProject(req.project);
  if (!entry) {
    throw new Error(`personal pipeline: no registry entry for project '${req.project}' in registry/personal/projects.yaml`);
  }

  const resumeSource = req.resumeSource ?? entry.resume_source;
  const coverLetterSource = req.coverLetterSource ?? entry.cover_letter_source;
  const sourcingMethod = req.sourcingMethod ?? entry.sourcing_method;
  const strategy = req.strategy ?? entry.strategy;
  const maxResults = req.maxResults ?? entry.max_results;
  const searchProvider = req.searchProvider ?? entry.search_provider;
  const scrapingAdapter = req.scrapingAdapter ?? entry.scraping_adapter;

  // manual sourcing is pure passthrough — it returns whatever it's given AS
  // the posting text, without fetching anything. scrapeAll/scrapeAny hand
  // gatherPosting a bare candidate URL (found by discovery, not a human),
  // so pairing manual with either would draft from a literal URL string
  // instead of real posting content. manual only makes sense with scrapeOne,
  // where a human is the one supplying real pasted text.
  if (sourcingMethod === "manual" && strategy !== "scrapeOne") {
    throw new Error(
      `personal pipeline: sourcing_method 'manual' only works with strategy 'scrapeOne' — '${strategy}' produces candidate URLs for gatherPosting to fetch, but 'manual' never fetches anything, it just returns whatever it's given as the posting text itself.`,
    );
  }

  const token = await getInstallationToken(deps.githubApp, deps.installationId);
  // Project skill + selected sourcing skill only — never skills/shared/,
  // which is dev-pipeline-only content (§6, and the personal pipeline has
  // no shared-skill tier of its own; see skills/shared/dev/project-scaffold).
  const skillContent = await getFileContents(token, deps.controlRepoOwner, deps.controlRepoName, `${entry.skill_path}/SKILL.md`, deps.branch);
  const sourcingSkillContent = await getFileContents(
    token,
    deps.controlRepoOwner,
    deps.controlRepoName,
    `${entry.skill_path}/sourcing/${sourcingMethod}/SKILL.md`,
    deps.branch,
  );

  log.info("discovering postings", { strategy, sourcingMethod, maxResults, searchProvider });
  const candidates = await discoverCandidates(deps, strategy, req, entry.model_profile, maxResults, searchProvider);

  const needsResume = resumeSource.mode === "generated_pdf";
  const needsCoverLetter = coverLetterSource.mode === "generated_pdf";

  const results: PersonalPipelineResultItem[] = [];
  for (const candidate of candidates) {
    try {
      const sourceRequest = candidate?.url ?? req.request;
      const posting = await gatherPosting(deps, sourcingMethod, { request: sourceRequest }, scrapingAdapter);

      const draft = await draftPackage(deps.liteLLM, entry.model_profile, skillContent, sourcingSkillContent, posting.postingText, needsResume, needsCoverLetter);

      const resume: DocumentResult =
        resumeSource.mode === "gdrive_link"
          ? { mode: "gdrive_link", gdriveLink: resumeSource.gdrive_link }
          : { mode: "generated_pdf", pdfBase64: (await renderTextToPdf("Resume", draft.resume ?? "")).toString("base64") };

      const coverLetter: DocumentResult =
        coverLetterSource.mode === "gdrive_link"
          ? { mode: "gdrive_link", gdriveLink: coverLetterSource.gdrive_link }
          : { mode: "generated_pdf", pdfBase64: (await renderTextToPdf("Cover Letter", draft.coverLetter ?? "")).toString("base64") };

      const sourceUrl = posting.sourceUrl ?? candidate?.url;
      results.push({
        status: "success",
        resume,
        coverLetter,
        applicationSummary: draft.applicationSummary,
        formFields: draft.formFields,
        sourceUrl,
        title: candidate?.title,
        company: candidate?.company,
      });

      if (deps.theStore) {
        try {
          await appendJobApplicationRow(deps.githubApp, deps.installationId, deps.theStore, {
            dateApplied: new Date().toISOString().slice(0, 10),
            company: candidate?.company ?? "",
            jobTitle: candidate?.title ?? "",
            location: candidate?.location ?? "",
            remote: candidate?.remote === undefined ? "" : String(candidate.remote),
            salary: candidate?.salary ?? "",
            sourceUrl: sourceUrl ?? "",
            sourceSite: sourceUrl ? new URL(sourceUrl).hostname : "",
            strategy,
            sourcingMethod,
            searchProvider: strategy === "scrapeAny" ? searchProvider : "",
            resumeMode: resumeSource.mode,
            coverLetterMode: coverLetterSource.mode,
            correlationId: req.correlationId,
            applicationSummary: draft.applicationSummary,
            formFields: JSON.stringify(draft.formFields),
            resumeContent: resumeSource.mode === "gdrive_link" ? resumeSource.gdrive_link : (draft.resume ?? ""),
            coverLetterContent: coverLetterSource.mode === "gdrive_link" ? coverLetterSource.gdrive_link : (draft.coverLetter ?? ""),
          });
        } catch (err) {
          log.warn("failed to append job-application row to the-store", { error: String(err) });
        }
      } else {
        log.warn("the-store not configured — skipping CSV append");
      }
    } catch (err) {
      log.error("candidate failed — continuing with the rest of the batch", { error: String(err), sourceUrl: candidate?.url, title: candidate?.title });
      results.push({ status: "failed", sourceUrl: candidate?.url, title: candidate?.title, company: candidate?.company, error: String(err) });
    }
  }

  return results;
}

// scrapeOne needs no discovery — the request itself IS the one posting, so
// this returns a single-element list with no PostingCandidate metadata
// (candidate stays undefined; gatherPosting uses req.request directly).
async function discoverCandidates(
  deps: PersonalPipelineDeps,
  strategy: Strategy,
  req: PersonalPipelineRequest,
  modelAlias: string,
  maxResults: number,
  searchProvider: SearchProviderName,
): Promise<Array<PostingCandidate | undefined>> {
  switch (strategy) {
    case "scrapeOne":
      return [undefined];
    case "scrapeAll":
      // No hard requirement on deps.scrapeAllSourcing — many sites need no
      // saved session at all; resolveStorageState degrades to unauthenticated
      // per-site when either the config or that hostname's file is absent.
      return scrapeAllDiscovery.discover(deps.scrapeAllSourcing, deps.liteLLM, modelAlias, req.request, req.criteria, maxResults);
    case "scrapeAny":
      return scrapeAnyDiscovery.discover(deps.scrapeAnySourcing, searchProvider, req.criteria, maxResults);
  }
}

async function gatherPosting(
  deps: PersonalPipelineDeps,
  method: SourcingMethod,
  input: { request: string },
  scrapingAdapter?: ScrapingAdapterName,
) {
  switch (method) {
    case "manual":
      return manualSourcing.gatherPosting(input);
    case "api":
      if (!deps.apiSourcing) throw new Error("personal pipeline: sourcing_method 'api' requires JOB_API_BASE_URL/JOB_API_KEY to be configured");
      return apiSourcing.gatherPosting(deps.apiSourcing, input);
    case "scraping":
      // No hard requirement on deps.scrapingSourcing — same as scrapeAll's
      // discovery below: not every site needs, or has, a saved session
      // (resolveStorageState degrades to unauthenticated when neither the
      // config nor that hostname's file is present). Previously this threw
      // outright whenever SITE_SESSIONS_DIR was unset at all, even for a
      // plain public posting with no login wall — found live against a
      // non-LinkedIn, unauthenticated careers-site posting.
      return scrapingSourcing.gatherPosting(deps.scrapingSourcing, input, scrapingAdapter);
  }
}

interface Draft {
  resume?: string;
  coverLetter?: string;
  applicationSummary: string;
  formFields: Record<string, string>;
}

async function draftPackage(
  liteLLM: LiteLLMConfig,
  modelAlias: string,
  skillContent: string,
  sourcingSkillContent: string,
  postingText: string,
  needsResume: boolean,
  needsCoverLetter: boolean,
): Promise<Draft> {
  const fields = ["applicationSummary", "formFields", ...(needsResume ? ["resume"] : []), ...(needsCoverLetter ? ["coverLetter"] : [])];
  const system = [
    skillContent,
    sourcingSkillContent,
    `Respond with ONLY a JSON object with exactly these keys: ${fields.join(", ")}. ` +
      `"formFields" must be a flat JSON object mapping each application-form field label (e.g. "First Name", "Cover Letter", "Why do you want this role?") to its drafted value as a string — this is consumed by an automated form-fill script, so keys must match the labels an application form would actually show, not paraphrases. ` +
      "No markdown code fences, no text outside the JSON object.",
  ].join("\n\n---\n\n");

  const raw = await chatCompletion(liteLLM, modelAlias, [
    { role: "system", content: system },
    { role: "user", content: `Job posting:\n\n${postingText}` },
  ]);

  let parsed: Partial<Draft>;
  try {
    parsed = parseModelJson<Partial<Draft>>(raw);
  } catch {
    throw new Error(`personal pipeline: model response was not valid JSON: ${raw.slice(0, 200)}`);
  }
  if (!parsed.applicationSummary) {
    throw new Error("personal pipeline: model response missing required 'applicationSummary' field");
  }
  return { resume: parsed.resume, coverLetter: parsed.coverLetter, applicationSummary: parsed.applicationSummary, formFields: parsed.formFields ?? {} };
}

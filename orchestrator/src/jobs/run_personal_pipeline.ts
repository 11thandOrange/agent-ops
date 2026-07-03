// Personal-project counterpart to plan_ticket.ts/implement_ticket.ts.
// Structurally separate from the dev dispatch path (strategy doc §5.3):
// personal projects have no repo/CI runner to dispatch to, so the
// orchestrator itself loads the skill, gathers the posting, and calls the
// model gateway directly, then returns a package for the chat thread —
// there is no separate notification channel to deliver it through.
import { chatCompletion, type LiteLLMConfig } from "../integrations/litellm.js";
import { getFileContents, getInstallationToken, type GitHubAppConfig } from "../integrations/github.js";
import { renderTextToPdf } from "../integrations/pdf.js";
import { logger } from "../logging.js";
import { loadPersonalProject } from "../registry/load.js";
import * as manualSourcing from "./sourcing/manual.js";
import * as apiSourcing from "./sourcing/api.js";
import * as scrapingSourcing from "./sourcing/scraping.js";
import type { DocumentSource, SourcingMethod } from "../types.js";

export interface PersonalPipelineDeps {
  githubApp: GitHubAppConfig;
  installationId: string;
  controlRepoOwner: string;
  controlRepoName: string;
  branch: string;
  liteLLM: LiteLLMConfig;
  apiSourcing?: apiSourcing.ApiSourcingConfig;
  scrapingSourcing?: scrapingSourcing.ScrapingSourcingConfig;
}

export interface PersonalPipelineRequest {
  project: string;
  request: string; // free-text chat request — a pasted posting, a URL, or a query, depending on sourcing method
  requestedBy: string;
  correlationId: string;
  // Per-call overrides — fall back to the registry entry's defaults when omitted.
  sourcingMethod?: SourcingMethod;
  resumeSource?: DocumentSource;
  coverLetterSource?: DocumentSource;
}

export interface DocumentResult {
  mode: "gdrive_link" | "generated_pdf";
  gdriveLink?: string;
  pdfBase64?: string;
}

export interface PersonalPipelineResult {
  resume: DocumentResult;
  coverLetter: DocumentResult;
  applicationSummary: string;
  sourceUrl?: string;
}

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

  log.info("gathering posting", { sourcingMethod });
  const posting = await gatherPosting(deps, sourcingMethod, { request: req.request });

  const needsResume = resumeSource.mode === "generated_pdf";
  const needsCoverLetter = coverLetterSource.mode === "generated_pdf";
  const draft = await draftPackage(deps.liteLLM, entry.model_profile, skillContent, sourcingSkillContent, posting.postingText, needsResume, needsCoverLetter);

  const resume: DocumentResult =
    resumeSource.mode === "gdrive_link"
      ? { mode: "gdrive_link", gdriveLink: resumeSource.gdrive_link }
      : { mode: "generated_pdf", pdfBase64: (await renderTextToPdf("Resume", draft.resume ?? "")).toString("base64") };

  const coverLetter: DocumentResult =
    coverLetterSource.mode === "gdrive_link"
      ? { mode: "gdrive_link", gdriveLink: coverLetterSource.gdrive_link }
      : { mode: "generated_pdf", pdfBase64: (await renderTextToPdf("Cover Letter", draft.coverLetter ?? "")).toString("base64") };

  return { resume, coverLetter, applicationSummary: draft.applicationSummary, sourceUrl: posting.sourceUrl };
}

async function gatherPosting(deps: PersonalPipelineDeps, method: SourcingMethod, input: { request: string }) {
  switch (method) {
    case "manual":
      return manualSourcing.gatherPosting(input);
    case "api":
      if (!deps.apiSourcing) throw new Error("personal pipeline: sourcing_method 'api' requires JOB_API_BASE_URL/JOB_API_KEY to be configured");
      return apiSourcing.gatherPosting(deps.apiSourcing, input);
    case "scraping":
      if (!deps.scrapingSourcing) throw new Error("personal pipeline: sourcing_method 'scraping' requires LINKEDIN_STORAGE_STATE_PATH to be configured");
      return scrapingSourcing.gatherPosting(deps.scrapingSourcing, input);
  }
}

interface Draft {
  resume?: string;
  coverLetter?: string;
  applicationSummary: string;
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
  const fields = ["applicationSummary", ...(needsResume ? ["resume"] : []), ...(needsCoverLetter ? ["coverLetter"] : [])];
  const system = [
    skillContent,
    sourcingSkillContent,
    `Respond with ONLY a JSON object with exactly these string keys: ${fields.join(", ")}. No markdown code fences, no text outside the JSON object.`,
  ].join("\n\n---\n\n");

  const raw = await chatCompletion(liteLLM, modelAlias, [
    { role: "system", content: system },
    { role: "user", content: `Job posting:\n\n${postingText}` },
  ]);

  let parsed: Partial<Draft>;
  try {
    parsed = JSON.parse(raw) as Partial<Draft>;
  } catch {
    throw new Error(`personal pipeline: model response was not valid JSON: ${raw.slice(0, 200)}`);
  }
  if (!parsed.applicationSummary) {
    throw new Error("personal pipeline: model response missing required 'applicationSummary' field");
  }
  return { resume: parsed.resume, coverLetter: parsed.coverLetter, applicationSummary: parsed.applicationSummary };
}

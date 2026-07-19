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
import { appendJobApplicationRow, findStoredApplicationByUrl, loadStoredApplications, type TheStoreConfig } from "../integrations/the_store.js";
import { fetchResumeText } from "../integrations/google_drive.js";
import { logger } from "../logging.js";
import * as manualSourcing from "./sourcing/manual.js";
import * as apiSourcing from "./sourcing/api.js";
import * as scrapingSourcing from "./sourcing/scraping.js";
import * as scrapeAllDiscovery from "./discovery/scrapeAll.js";
import * as scrapeAnyDiscovery from "./discovery/scrapeAny.js";
import type { ApiProviderName, ApplicantProfile, DocumentSource, JobCriteria, JobSearchParams, PostingCandidate, ScrapingAdapterName, SearchProviderName, SourcingMethod, Strategy } from "../types.js";

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
  // Optional — background grounding for drafting, separate from
  // resumeSource/coverLetterSource (those control the output document).
  // Fetched once per request below, not per-candidate.
  applicantProfile?: ApplicantProfile;
}

export interface PersonalPipelineRequest {
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
  apiProvider?: ApiProviderName; // sourcing_method: api only
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

// An empty result array is ambiguous on its own — "the search found
// literally nothing" and "everything found was already recorded" both look
// identical as `result: []`. Callers (chat_command.ts, http_api.ts) surface
// this alongside the empty array so it's not silently indistinguishable
// from either of those. scrapeOne always returns exactly one entry, so this
// is only ever reached for scrapeAll/scrapeAny.
export function noNewResultsMessage(result: PersonalPipelineResult): string | undefined {
  return result.length === 0
    ? "No new results — every matching candidate was already recorded (deduped against the-store), or none were found for this criteria at all."
    : undefined;
}

// `entry` is this pipeline's own registry params (JobSearchParams), resolved
// by the caller from the generic engine's ctx.pipeline — this function no
// longer looks up a registry itself (the old two-file dev/personal registry
// this used to read via loadPersonalProject is gone; the engine's unified
// pipelines.yaml + createServer's own params-schema validation replaces it).
export async function dispatchPersonalPipeline(
  deps: PersonalPipelineDeps,
  req: PersonalPipelineRequest,
  pipelineName: string,
  entry: JobSearchParams,
): Promise<PersonalPipelineResult> {
  const log = logger.withContext({ correlationId: req.correlationId, pipeline: pipelineName });
  log.info("dispatching personal pipeline", { requestedBy: req.requestedBy });

  const resumeSource = req.resumeSource ?? entry.resume_source;
  const coverLetterSource = req.coverLetterSource ?? entry.cover_letter_source;
  const sourcingMethod = req.sourcingMethod ?? entry.sourcing_method;
  const strategy = req.strategy ?? entry.strategy;
  const maxResults = req.maxResults ?? entry.max_results;
  const searchProvider = req.searchProvider ?? entry.search_provider;
  const scrapingAdapter = req.scrapingAdapter ?? entry.scraping_adapter;
  const apiProvider = req.apiProvider ?? entry.api_provider;

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

  const needsResume = resumeSource.mode === "generated_pdf";
  const needsCoverLetter = coverLetterSource.mode === "generated_pdf";

  // Fetched once per request, not per-candidate — reused across every
  // candidate in a scrapeAll/scrapeAny batch. A fetch failure here (bad
  // link, unsupported file format) is logged and drafting proceeds without
  // it rather than failing the whole batch over background grounding.
  let resumeText = "";
  if (deps.applicantProfile?.resumeGdriveLink) {
    try {
      resumeText = await fetchResumeText(deps.applicantProfile.resumeGdriveLink);
    } catch (err) {
      log.warn("failed to fetch applicant resume from Google Drive — drafting without it", { error: String(err) });
    }
  }

  // Applies to every scrapeAll/scrapeAny batch (single call site below, or
  // once per retry batch in the scrapeAny loop further down). Skipped
  // entirely (not just gracefully) when the-store isn't configured, same
  // fail-open posture as every other the-store touchpoint — a broken/
  // unreachable CSV never blocks drafting.
  async function dedupeAgainstStore(batch: Array<PostingCandidate | undefined>): Promise<Array<PostingCandidate | undefined>> {
    if (!deps.theStore || !batch.some((c) => c !== undefined)) return batch;
    try {
      const applications = await loadStoredApplications(deps.githubApp, deps.installationId, deps.theStore);
      const before = batch.length;
      const deduped = batch.filter((c) => !c || !findStoredApplicationByUrl(applications, c.url));
      if (deduped.length !== before) {
        log.info("deduped candidates already present in the-store", { before, after: deduped.length });
      }
      return deduped;
    } catch (err) {
      log.warn("failed to load the-store for dedup — continuing without it", { error: String(err) });
      return batch;
    }
  }

  // Sources, drafts, renders, and (on success) records one candidate. Never
  // throws — a failure becomes an ApplicationFailure result item so one bad
  // candidate never aborts the rest of the batch.
  async function processCandidate(candidate: PostingCandidate | undefined): Promise<PersonalPipelineResultItem> {
    try {
      const sourceRequest = candidate?.url ?? req.request;
      const posting = await gatherPosting(deps, sourcingMethod, { request: sourceRequest }, scrapingAdapter, apiProvider);

      const draft = await draftPackage(
        deps.liteLLM,
        entry.model_profile,
        skillContent,
        sourcingSkillContent,
        posting.postingText,
        needsResume,
        needsCoverLetter,
        deps.applicantProfile,
        resumeText,
      );

      const resume: DocumentResult =
        resumeSource.mode === "gdrive_link"
          ? { mode: "gdrive_link", gdriveLink: resumeSource.gdrive_link }
          : { mode: "generated_pdf", pdfBase64: (await renderTextToPdf("Resume", draft.resume ?? "")).toString("base64") };

      const coverLetter: DocumentResult =
        coverLetterSource.mode === "gdrive_link"
          ? { mode: "gdrive_link", gdriveLink: coverLetterSource.gdrive_link }
          : { mode: "generated_pdf", pdfBase64: (await renderTextToPdf("Cover Letter", draft.coverLetter ?? "")).toString("base64") };

      const sourceUrl = posting.sourceUrl ?? candidate?.url;
      const result: ApplicationPackage = {
        status: "success",
        resume,
        coverLetter,
        applicationSummary: draft.applicationSummary,
        formFields: draft.formFields,
        sourceUrl,
        title: candidate?.title,
        company: candidate?.company,
      };

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

      return result;
    } catch (err) {
      log.error("candidate failed — continuing with the rest of the batch", { error: String(err), sourceUrl: candidate?.url, title: candidate?.title });
      return { status: "failed", sourceUrl: candidate?.url, title: candidate?.title, company: candidate?.company, error: String(err) };
    }
  }

  if (strategy === "scrapeAny") {
    // Discovery used to run exactly once here — a failed candidate was
    // never replaced, so maxResults was an attempt cap, not a success
    // guarantee (confirmed live: 9 candidates attempted via jsearch, 4
    // succeeded, 5 failed, and the run stopped there rather than fetching a
    // 10th to make up the difference). This now keeps fetching larger
    // batches — excluding every URL already tried this run — until either
    // maxResults successes are collected or attemptCap total candidates
    // have been attempted, whichever comes first. attemptCap bounds the
    // cost when criteria genuinely can't be satisfied maxResults times
    // over, rather than looping forever.
    const results: PersonalPipelineResultItem[] = [];
    const seenUrls = new Set<string>();
    const attemptCap = maxResults * 3;
    const maxBatchSize = 100;
    let successCount = 0;
    let totalAttempted = 0;
    let batchSize = maxResults;

    while (successCount < maxResults && totalAttempted < attemptCap) {
      const batch = await dedupeAgainstStore(await scrapeAnyDiscovery.discover(deps.scrapeAnySourcing, searchProvider, req.criteria, batchSize));
      const newCandidates = batch.filter((c): c is PostingCandidate => !!c && !seenUrls.has(c.url));

      // Confirmed live: a small first batch (size maxResults) landing
      // entirely on already-recorded the-store rows used to be read as
      // "nothing left" and the loop gave up immediately — even though the
      // provider likely has candidates #11+ that were never even asked
      // for. A batch fully deduped only means *that* batch had nothing
      // new, not that the provider is exhausted. Grow the ask and retry
      // before concluding there's truly nothing left; only stop once even
      // the largest batch this loop will ever request comes back empty.
      if (newCandidates.length === 0) {
        if (batchSize >= maxBatchSize) {
          log.info("scrapeAny retry loop stopping — exhausted even at the largest batch size", { totalAttempted, successCount, batchSize });
          break;
        }
        batchSize = Math.min(batchSize * 2, maxBatchSize);
        continue;
      }

      for (const candidate of newCandidates) {
        if (successCount >= maxResults || totalAttempted >= attemptCap) break;
        seenUrls.add(candidate.url);
        totalAttempted++;
        const result = await processCandidate(candidate);
        results.push(result);
        if (result.status === "success") successCount++;
      }

      // Most providers don't offer true pagination/offset — asking for a
      // bigger batch is how "more" candidates surface at all, accepting
      // some re-fetched overlap (filtered out via seenUrls) as the cost.
      batchSize = Math.min(batchSize * 2, maxBatchSize);
    }

    return results;
  }

  const candidates = await dedupeAgainstStore(await discoverCandidates(deps, strategy, req, entry.model_profile, maxResults, searchProvider));
  const results: PersonalPipelineResultItem[] = [];
  for (const candidate of candidates) {
    results.push(await processCandidate(candidate));
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
  apiProvider?: ApiProviderName,
) {
  switch (method) {
    case "manual":
      return manualSourcing.gatherPosting(input);
    case "api":
      return apiSourcing.gatherPosting(deps.apiSourcing, input, apiProvider);
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

// Renders the applicant's background as plain labeled lines for the
// prompt — omits any field that isn't set rather than sending an empty
// value the model might mistake for "field exists but is blank".
function formatApplicantProfile(profile: ApplicantProfile | undefined): string {
  if (!profile) return "";
  const lines: Array<[string, string | undefined]> = [
    ["First name", profile.firstName],
    ["Last name", profile.lastName],
    ["Email", profile.email],
    ["Phone", profile.phone],
    ["Professional summary", profile.professionalSummary],
    ["Location", profile.location],
    ["LinkedIn", profile.linkedinUrl],
    ["Portfolio", profile.portfolioUrl],
    ["Current title", profile.currentTitle],
    ["Current employer", profile.currentEmployer],
    ["Years of experience", profile.yearsExperience],
    ["Work authorization", profile.workAuthorization],
    ["Requires sponsorship", profile.sponsorshipRequired],
    ["Desired salary", profile.desiredSalary],
    ["Availability", profile.availability],
  ];
  return lines
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");
}

async function draftPackage(
  liteLLM: LiteLLMConfig,
  modelAlias: string,
  skillContent: string,
  sourcingSkillContent: string,
  postingText: string,
  needsResume: boolean,
  needsCoverLetter: boolean,
  applicantProfile?: ApplicantProfile,
  resumeText?: string,
): Promise<Draft> {
  const fields = ["applicationSummary", "formFields", ...(needsResume ? ["resume"] : []), ...(needsCoverLetter ? ["coverLetter"] : [])];
  const system = [
    skillContent,
    sourcingSkillContent,
    `Respond with ONLY a JSON object with exactly these keys: ${fields.join(", ")}. ` +
      `"formFields" must be a flat JSON object mapping each application-form field label (e.g. "First Name", "Willing to relocate?", "Why do you want this role?") to its drafted value as a string — this is consumed by an automated form-fill script, so keys must match the labels an application form would actually show, not paraphrases. ` +
      `"resume" and "coverLetter", if present, must each be a single plain-text string — full paragraphs separated by blank lines, not a nested JSON object or array of sections/bullets — since they are rendered directly onto a PDF page as-is. ` +
      `These are the ONLY place the full resume/cover-letter document text goes — do not put the full document text only inside formFields (e.g. under a "Resume" or "Cover Letter" key) and leave the top-level "resume"/"coverLetter" keys empty; formFields is exclusively for short, individual form-field answers. ` +
      "Draft every answer from the three sources below — the job posting, the applicant's professional summary, and their resume — used together as needed, in no particular order: whichever source actually answers a given question is the one to use. " +
      "Do not invent anything not supported by at least one of those three sources — this applies to the applicant's background exactly as much as it applies to posting details. If none of the three sources answer a field, leave it out of formFields rather than guessing. " +
      "No markdown code fences, no text outside the JSON object.",
  ].join("\n\n---\n\n");

  const applicantSection = formatApplicantProfile(applicantProfile);
  const userContent = [
    `Job posting:\n\n${postingText}`,
    applicantSection && `Applicant background:\n\n${applicantSection}`,
    resumeText && `Applicant's resume:\n\n${resumeText}`,
  ]
    .filter(Boolean)
    .join("\n\n---\n\n");

  const raw = await chatCompletion(liteLLM, modelAlias, [
    { role: "system", content: system },
    { role: "user", content: userContent },
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
  // renderTextToPdf expects plain text — a model returning a nested object/array
  // for resume/coverLetter instead of a string would otherwise fail deep inside
  // pdf.ts with an opaque "body.split is not a function", confirmed live.
  if (parsed.resume !== undefined && typeof parsed.resume !== "string") {
    throw new Error("personal pipeline: model response's 'resume' field must be a plain-text string, not a nested object/array");
  }
  if (parsed.coverLetter !== undefined && typeof parsed.coverLetter !== "string") {
    throw new Error("personal pipeline: model response's 'coverLetter' field must be a plain-text string, not a nested object/array");
  }
  // Confirmed live: the model sometimes drafts real resume/cover-letter text
  // but only writes it into formFields (e.g. under a "Resume" key) and leaves
  // the top-level field blank — the JSON parses fine and passes the string
  // check above, so it silently produced a "success" result with a PDF
  // containing only the title heading and no body text. Recover the content
  // from formFields before falling back to a hard failure.
  const resume = nonEmpty(parsed.resume) ?? nonEmpty(parsed.formFields?.["Resume"]);
  const coverLetter = nonEmpty(parsed.coverLetter) ?? nonEmpty(parsed.formFields?.["Cover Letter"]);
  if (needsResume && !resume) {
    throw new Error("personal pipeline: model response has no usable 'resume' text (checked both the top-level field and formFields.Resume)");
  }
  if (needsCoverLetter && !coverLetter) {
    throw new Error("personal pipeline: model response has no usable 'coverLetter' text (checked both the top-level field and formFields['Cover Letter'])");
  }
  return { resume, coverLetter, applicationSummary: parsed.applicationSummary, formFields: parsed.formFields ?? {} };
}

function nonEmpty(value: string | undefined): string | undefined {
  return value && value.trim() ? value : undefined;
}

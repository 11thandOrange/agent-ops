// POST /personal-projects/:project/generate-answer — on-demand, per-
// question generation for the Chrome extension's side panel (heyitschloe/
// extensions), used on pages never run through the pipeline (no stored
// posting text exists to draft from — see integrations/the_store.ts). Same
// EXTENSION_API_KEY trust boundary as the lookup endpoints in
// applications_lookup.ts.
//
// Grounding is split by question type, unlike draftPackage's batch drafting
// in run_personal_pipeline.ts (which never invents anything, full stop):
// factual questions (contact details, work history, specific numbers) still
// never state a fact unsupported by the caller-supplied page context or the
// configured applicant background — {"answer": null} rather than inventing
// one. Subjective/open-ended questions (motivation, "why this role") get a
// best-effort draft from professional judgment even without a concrete
// grounding fact, since a user explicitly asked for this over the stricter
// alternative — expected to be reviewed/edited before use, not submitted
// verbatim.
import type { Request, Response } from "express";
import { chatCompletion, type LiteLLMConfig } from "../integrations/litellm.js";
import { parseModelJson } from "../integrations/llmJson.js";
import { loadPersonalProject } from "../registry/load.js";
import type { ApplicantProfile } from "../types.js";

export interface GenerateAnswerDeps {
  liteLLM: LiteLLMConfig;
  applicantProfile?: ApplicantProfile;
}

// Same field set/order as run_personal_pipeline.ts's formatApplicantProfile
// — duplicated rather than shared since that one is private to a different
// module and the two call sites have no other reason to be coupled.
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

export function handleGenerateAnswer(deps: GenerateAnswerDeps) {
  return async (req: Request, res: Response) => {
    const { project } = req.params;
    const entry = loadPersonalProject(project);
    if (!entry) {
      res.status(404).json({ error: `no registry entry for project '${project}'` });
      return;
    }

    const question = typeof req.body?.question === "string" ? req.body.question.trim() : "";
    const pageContext = typeof req.body?.pageContext === "string" ? req.body.pageContext.trim() : "";
    if (!question) {
      res.status(400).json({ error: "'question' is required" });
      return;
    }

    const applicantSection = formatApplicantProfile(deps.applicantProfile);
    const system =
      "You draft a single answer to one application-form question, for a browser extension's on-demand generate button. " +
      'Respond with ONLY a JSON object: {"answer": string | null} — no markdown fences, no other text. ' +
      "Draft the answer from the page context and the applicant background below, used together as needed, in no particular order — whichever source actually answers the question is the one to use. " +
      "For factual questions (contact details, work history, specific numbers, dates, or any other concrete fact) never state a fact that isn't supported by those two sources — respond with {\"answer\": null} rather than inventing one. " +
      "For subjective or open-ended questions (e.g. motivation, why this role or company, strengths, culture fit) where neither source gives you a concrete fact to cite, still draft a genuine, well-reasoned best-effort answer using professional judgment and whatever context is available (job title, company name, industry, the applicant's stated background/experience) rather than refusing — the applicant will review and edit it before using it, so a reasonable draft is more useful than a refusal. " +
      "Only respond with {\"answer\": null} when the question is factual and unanswerable from the two sources, or when there is truly nothing at all (no page context and no applicant background) to draft from.";
    const userContent = [
      `Question: ${question}`,
      pageContext && `Page context (from the current page):\n\n${pageContext.slice(0, 8000)}`,
      applicantSection && `Applicant background:\n\n${applicantSection}`,
    ]
      .filter(Boolean)
      .join("\n\n---\n\n");

    try {
      const raw = await chatCompletion(deps.liteLLM, entry.model_profile, [
        { role: "system", content: system },
        { role: "user", content: userContent },
      ]);
      let parsed: { answer?: string | null };
      try {
        parsed = parseModelJson(raw);
      } catch {
        res.status(502).json({ error: `model response was not valid JSON: ${raw.slice(0, 200)}` });
        return;
      }
      if (!parsed.answer) {
        res.status(200).json({ answer: null, reason: "not supported by the page context or applicant background" });
        return;
      }
      res.status(200).json({ answer: parsed.answer });
    } catch (err) {
      res.status(502).json({ error: String(err) });
    }
  };
}

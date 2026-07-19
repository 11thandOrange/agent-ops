// POST /personal-projects/:project/generate-answer — on-demand, per-
// question generation for the Chrome extension's side panel (heyitschloe/
// extensions), used on pages never run through the pipeline (no stored
// posting text exists to draft from — see integrations/the_store.ts). Same
// EXTENSION_API_KEY trust boundary as the lookup endpoints in
// applications_lookup.ts.
//
// Always drafts an answer — never refuses — per explicit user choice: an
// earlier version returned {"answer": null} whenever neither the page
// context nor the applicant background covered the question, which made
// every open-ended question (motivation, "why this role") a dead end since
// ApplicantProfile has no field for that kind of thing. This is looser than
// draftPackage's batch drafting in run_personal_pipeline.ts, which never
// invents anything for the actual submitted resume/cover letter — the one
// line that's never crossed here either is a specific, checkable fact
// (an employer name, a date, a number, a credential) not backed by those
// two sources. Everything else gets a best-effort draft from professional
// judgment, on the expectation the applicant reviews/edits before using it.
import type { Request, Response } from "express";
import { chatCompletion, type LiteLLMConfig } from "../integrations/litellm.js";
import { parseModelJson } from "../integrations/llmJson.js";
import { loadJobSearchPipeline } from "../registry/load.js";
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
    const entry = loadJobSearchPipeline(project);
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
      "You draft a single best-effort answer to one application-form question, for a browser extension's on-demand generate button. " +
      'Respond with ONLY a JSON object: {"answer": string} — no markdown fences, no other text. ' +
      "Always produce a complete, professional, ready-to-adapt answer — never refuse and never leave it blank, even when the two sources below don't directly cover the question. " +
      "Use the page context and applicant background as grounding whenever they're relevant, in no particular order — whichever actually helps. " +
      "The one thing you must not do is state a specific, checkable fact (an employer name, a date, a number, a certification, a credential, or similar) that isn't supported by those two sources. " +
      "For everything else — especially subjective or open-ended questions like motivation, why this role or company, strengths, or culture fit — draft the same kind of thoughtful, honest, professionally-worded answer a real applicant would write using general judgment, even without a specific fact to cite. " +
      "The applicant will review and edit this before using it, so a solid best-effort draft is always more useful than a refusal.";
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
      let parsed: { answer?: string };
      try {
        parsed = parseModelJson(raw);
      } catch {
        res.status(502).json({ error: `model response was not valid JSON: ${raw.slice(0, 200)}` });
        return;
      }
      // The prompt above always asks for a drafted answer, never a refusal
      // — an empty one here means the model didn't follow instructions, not
      // an expected "nothing to say" outcome, so this is a 502 like the
      // invalid-JSON case above rather than a normal {answer: null} result.
      if (!parsed.answer) {
        res.status(502).json({ error: "model returned an empty answer" });
        return;
      }
      res.status(200).json({ answer: parsed.answer });
    } catch (err) {
      res.status(502).json({ error: String(err) });
    }
  };
}

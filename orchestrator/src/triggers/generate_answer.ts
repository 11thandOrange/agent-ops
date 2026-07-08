// POST /personal-projects/:project/generate-answer — on-demand, per-
// question generation for the Chrome extension's popup (heyitschloe/
// extensions), used on pages never run through the pipeline (no stored
// posting text exists to draft from — see integrations/the_store.ts). Same
// EXTENSION_API_KEY trust boundary as the lookup endpoints in
// applications_lookup.ts.
//
// Same "don't invent" guardrail as draftPackage's batch drafting in
// run_personal_pipeline.ts — grounded only in the caller-supplied page
// context (extracted client-side by the extension's content script, since
// this endpoint never fetches or scrapes anything itself) and the
// configured applicant background, never fabricated. If neither source
// answers the question, the model is instructed to say so rather than guess.
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
      "Do not invent anything not supported by those two sources. If neither source answers the question, respond with {\"answer\": null} rather than guessing.";
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

// GET /personal-projects/:project/applications?url=... and GET
// /personal-projects/:project/applicant-profile — two read-only lookups
// for the Chrome extension (heyitschloe/extensions). Both share the same
// extensionAuth/EXTENSION_API_KEY trust boundary, separate from every other
// endpoint, since this is the one client whose inspectable code/storage
// calls the orchestrator directly.
import type { Request, Response } from "express";
import { findStoredApplicationByUrl, loadStoredApplications, type TheStoreConfig } from "../integrations/the_store.js";
import type { GitHubAppConfig } from "../integrations/github.js";
import type { ApplicantProfile } from "../types.js";
import { loadJobSearchPipeline } from "../registry/load.js";

export interface ApplicationsLookupDeps {
  githubApp: GitHubAppConfig;
  installationId: string;
  theStore?: TheStoreConfig;
}

export function handleApplicationsLookup(deps: ApplicationsLookupDeps) {
  return async (req: Request, res: Response) => {
    const { project } = req.params;
    const url = typeof req.query.url === "string" ? req.query.url : undefined;
    if (!url) {
      res.status(400).json({ error: "query param 'url' is required" });
      return;
    }
    if (!loadJobSearchPipeline(project)) {
      res.status(404).json({ error: `no registry entry for project '${project}'` });
      return;
    }
    // the-store not configured yet — same fail-open answer as everywhere
    // else: nothing recorded, not an error.
    if (!deps.theStore) {
      res.status(200).json({ found: false });
      return;
    }

    const applications = await loadStoredApplications(deps.githubApp, deps.installationId, deps.theStore);
    const match = findStoredApplicationByUrl(applications, url);
    if (!match) {
      res.status(200).json({ found: false });
      return;
    }
    res.status(200).json({
      found: true,
      company: match.company,
      jobTitle: match.jobTitle,
      dateApplied: match.dateApplied,
      formFields: match.formFields,
    });
  };
}

// Backs the extension popup's common-answer rows (name/email/phone/etc.) —
// reuses the same ApplicantProfile already configured server-side for
// batch drafting (run_personal_pipeline.ts), rather than the extension
// storing a second copy of your PII locally. GitHub Secrets are write-only
// (confirmed — no API reads one back), so this is the only way the
// extension can get this data at all: fetch it from the orchestrator,
// which already holds it in memory from its own env vars.
export interface ApplicantProfileLookupDeps {
  applicantProfile?: ApplicantProfile;
}

export function handleApplicantProfileLookup(deps: ApplicantProfileLookupDeps) {
  return (req: Request, res: Response) => {
    const { project } = req.params;
    if (!loadJobSearchPipeline(project)) {
      res.status(404).json({ error: `no registry entry for project '${project}'` });
      return;
    }
    if (!deps.applicantProfile) {
      res.status(200).json({ found: false });
      return;
    }
    res.status(200).json({ found: true, profile: deps.applicantProfile });
  };
}

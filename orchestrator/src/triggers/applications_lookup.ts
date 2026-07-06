// GET /personal-projects/:project/applications?url=... — read-only lookup
// for the Chrome extension (heyitschloe/extensions): given a job posting
// URL, has it already been run through the pipeline (is there a matching
// row in the-store), and if so what were its drafted form_fields? Separate
// auth from every other endpoint (extensionAuth/EXTENSION_API_KEY) since
// this is the one endpoint a browser extension's inspectable code/storage
// calls directly.
import type { Request, Response } from "express";
import { findStoredApplicationByUrl, loadStoredApplications, type TheStoreConfig } from "../integrations/the_store.js";
import type { GitHubAppConfig } from "../integrations/github.js";
import { loadPersonalProject } from "../registry/load.js";

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
    if (!loadPersonalProject(project)) {
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

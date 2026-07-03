// Appends completed job-application rows to a CSV in a separate repo
// ("the-store"), not agent-ops itself — this is application data, not
// pipeline config. Gated: the-store didn't exist yet when this was built,
// so TheStoreConfig is optional everywhere it's threaded through — callers
// skip the append (with a warning log) rather than hard-failing the whole
// pipeline run when it's unset.
import { createOrUpdateFile, getFileContents, getInstallationToken, type GitHubAppConfig } from "./github.js";

export interface TheStoreConfig {
  owner: string;
  repo: string;
  branch: string;
  path: string; // e.g. "projects/job-applications/job-app-results.csv"
}

export interface JobApplicationRow {
  dateApplied: string;
  company: string;
  jobTitle: string;
  location: string;
  remote: string;
  salary: string;
  sourceUrl: string;
  sourceSite: string;
  strategy: string;
  sourcingMethod: string;
  resumeMode: string;
  coverLetterMode: string;
  correlationId: string;
}

const HEADER = [
  "date_applied",
  "company",
  "job_title",
  "location",
  "remote",
  "salary",
  "source_url",
  "source_site",
  "strategy",
  "sourcing_method",
  "resume_mode",
  "cover_letter_mode",
  "correlation_id",
];

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function rowToCsvLine(row: JobApplicationRow): string {
  return [
    row.dateApplied,
    row.company,
    row.jobTitle,
    row.location,
    row.remote,
    row.salary,
    row.sourceUrl,
    row.sourceSite,
    row.strategy,
    row.sourcingMethod,
    row.resumeMode,
    row.coverLetterMode,
    row.correlationId,
  ]
    .map(csvEscape)
    .join(",");
}

// Not atomic under concurrent writes (read-then-write, same limitation as
// scaffold_project.ts's registry read-modify-write) — acceptable at
// personal-pipeline scale, not safe to assume under real concurrency.
export async function appendJobApplicationRow(
  githubApp: GitHubAppConfig,
  installationId: string,
  config: TheStoreConfig,
  row: JobApplicationRow,
): Promise<void> {
  const token = await getInstallationToken(githubApp, installationId);
  let existing: string;
  try {
    existing = await getFileContents(token, config.owner, config.repo, config.path, config.branch);
  } catch {
    existing = HEADER.join(",") + "\n";
  }
  const separator = existing.endsWith("\n") ? "" : "\n";
  const updated = `${existing}${separator}${rowToCsvLine(row)}\n`;
  await createOrUpdateFile(token, config.owner, config.repo, config.path, updated, `Add job application: ${row.company} — ${row.jobTitle}`, config.branch);
}

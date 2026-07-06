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

// A viewable GitHub URL for the CSV, not an API endpoint — for surfacing in
// trigger responses so a curl/Postman/chat caller can jump straight to the
// file instead of having to know owner/repo/branch/path themselves.
export function theStoreFileUrl(config: TheStoreConfig): string {
  return `https://github.com/${config.owner}/${config.repo}/blob/${config.branch}/${config.path}`;
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
  searchProvider: string; // scrapeAny only; blank for scrapeOne/scrapeAll rows
  resumeMode: string;
  coverLetterMode: string;
  correlationId: string;
  // (New) full content, not just metadata — confirmed explicitly: this CSV
  // is meant to be a complete record, not just a tracking log. resumeContent/
  // coverLetterContent hold the drafted text for generated_pdf documents, or
  // the configured Drive link for gdrive_link ones (there's no "drafted
  // text" for those — the link IS the content). formFields is JSON-encoded
  // since CSV cells are flat strings, not nested structures.
  applicationSummary: string;
  formFields: string;
  resumeContent: string;
  coverLetterContent: string;
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
  "search_provider",
  "resume_mode",
  "cover_letter_mode",
  "correlation_id",
  "application_summary",
  "form_fields",
  "resume_content",
  "cover_letter_content",
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
    row.searchProvider,
    row.resumeMode,
    row.coverLetterMode,
    row.correlationId,
    row.applicationSummary,
    row.formFields,
    row.resumeContent,
    row.coverLetterContent,
  ]
    .map(csvEscape)
    .join(",");
}

// Inverse of rowToCsvLine/csvEscape above — a real character-by-character
// parser, not a naive split(","), since quoted fields (application_summary,
// resume_content, etc.) routinely contain embedded commas and newlines.
function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (inQuotes) {
      if (char === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export interface StoredApplicationRow {
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
  searchProvider: string;
  resumeMode: string;
  coverLetterMode: string;
  correlationId: string;
  applicationSummary: string;
  formFields: Record<string, string>;
  resumeContent: string;
  coverLetterContent: string;
}

// Strips scheme-irrelevant noise (tracking query params, trailing slash,
// case) so a job posting URL revisited later — often carrying different
// query params (JSearch apply links, UTM tags, etc.) than when it was first
// sourced — still matches the row recorded for it. Falls back to a plain
// lowercase/trim of the raw string for anything that isn't a parseable URL,
// rather than throwing over one malformed value.
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`.toLowerCase().replace(/\/$/, "");
  } catch {
    return url.trim().toLowerCase();
  }
}

export function findStoredApplicationByUrl(applications: StoredApplicationRow[], url: string): StoredApplicationRow | undefined {
  const exact = applications.find((a) => a.sourceUrl === url);
  if (exact) return exact;
  const normalized = normalizeUrl(url);
  return applications.find((a) => normalizeUrl(a.sourceUrl) === normalized);
}

// Reads and parses the-store's CSV in full — acceptable at personal-
// pipeline scale (a handful of applications per day), not built for a CSV
// large enough that a full read-and-parse per lookup would be slow. Returns
// [] rather than throwing if the-store/file doesn't exist yet (no
// applications recorded) or the CSV can't be parsed, matching
// appendJobApplicationRow's own fail-open posture for a missing file.
export async function loadStoredApplications(
  githubApp: GitHubAppConfig,
  installationId: string,
  config: TheStoreConfig,
): Promise<StoredApplicationRow[]> {
  const token = await getInstallationToken(githubApp, installationId);
  let content: string;
  try {
    content = await getFileContents(token, config.owner, config.repo, config.path, config.branch);
  } catch {
    return [];
  }

  const rows = parseCsv(content);
  if (rows.length <= 1) return []; // header only, or empty

  return rows.slice(1).map((cols) => {
    let formFields: Record<string, string> = {};
    try {
      formFields = JSON.parse(cols[15] ?? "{}");
    } catch {
      formFields = {};
    }
    return {
      dateApplied: cols[0] ?? "",
      company: cols[1] ?? "",
      jobTitle: cols[2] ?? "",
      location: cols[3] ?? "",
      remote: cols[4] ?? "",
      salary: cols[5] ?? "",
      sourceUrl: cols[6] ?? "",
      sourceSite: cols[7] ?? "",
      strategy: cols[8] ?? "",
      sourcingMethod: cols[9] ?? "",
      searchProvider: cols[10] ?? "",
      resumeMode: cols[11] ?? "",
      coverLetterMode: cols[12] ?? "",
      correlationId: cols[13] ?? "",
      applicationSummary: cols[14] ?? "",
      formFields,
      resumeContent: cols[16] ?? "",
      coverLetterContent: cols[17] ?? "",
    };
  });
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

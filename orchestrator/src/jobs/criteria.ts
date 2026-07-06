// Filters PostingCandidates found by scrapeAll/scrapeAny discovery against
// a JobCriteria. Deliberately forgiving: scraped/searched metadata is often
// incomplete, so a candidate missing data for a given criterion is not
// excluded on that criterion alone — only blacklist matches and clearly
// contradicted fields (e.g. remote: true against an explicitly on-site
// posting) exclude a candidate.
import type { JobCriteria, PostingCandidate } from "../types.js";

function includesCaseInsensitive(haystack: string | undefined, needle: string): boolean {
  return !!haystack && haystack.toLowerCase().includes(needle.toLowerCase());
}

// Salary strings are free text from whatever source produced the candidate
// ("70K–110K a year", "$120,000 - $150,000/year", "$95k") — no fixed shape.
// Pulls out every number (handling a trailing k/K as thousands) and treats
// the low/high of those as the candidate's range. Same forgiving philosophy
// as the rest of this file: a candidate with no parseable number isn't
// excluded on salary alone.
function parseSalaryRange(salary: string | undefined): { min: number; max: number } | undefined {
  if (!salary) return undefined;
  const matches = salary.match(/\$?\d[\d,]*(?:\.\d+)?\s*[kK]?/g);
  if (!matches) return undefined;
  const numbers = matches
    .map((m) => {
      const isThousands = /[kK]\s*$/.test(m);
      const n = parseFloat(m.replace(/[$,kK\s]/g, ""));
      return isThousands ? n * 1000 : n;
    })
    .filter((n) => Number.isFinite(n) && n > 0);
  if (!numbers.length) return undefined;
  return { min: Math.min(...numbers), max: Math.max(...numbers) };
}

function searchableText(candidate: PostingCandidate): string {
  return [candidate.title, candidate.company, candidate.location, candidate.snippet].filter(Boolean).join(" ");
}

export function matchesCriteria(candidate: PostingCandidate, criteria?: JobCriteria): boolean {
  if (!criteria) return true;

  if (criteria.title && candidate.title && !includesCaseInsensitive(candidate.title, criteria.title)) return false;
  if (criteria.location && candidate.location && !includesCaseInsensitive(candidate.location, criteria.location)) return false;
  if (criteria.company && candidate.company && !includesCaseInsensitive(candidate.company, criteria.company)) return false;
  // Only excludes on an explicit contradiction — a candidate with no known
  // remote status isn't assumed to fail a remote: true/false filter.
  if (criteria.remote !== undefined && candidate.remote !== undefined && candidate.remote !== criteria.remote) return false;
  if (criteria.datePostedAfter && candidate.postedDate && candidate.postedDate < criteria.datePostedAfter) return false;

  if (criteria.salaryMin !== undefined || criteria.salaryMax !== undefined) {
    const range = parseSalaryRange(candidate.salary);
    // No parseable salary on the candidate → not excluded, same as every
    // other criterion here. Only an explicit, non-overlapping range excludes.
    if (range) {
      if (criteria.salaryMax !== undefined && range.min > criteria.salaryMax) return false;
      if (criteria.salaryMin !== undefined && range.max < criteria.salaryMin) return false;
    }
  }

  const text = searchableText(candidate);
  if (criteria.keywords?.length && !criteria.keywords.some((k) => includesCaseInsensitive(text, k))) return false;
  if (criteria.skills?.length && !criteria.skills.some((s) => includesCaseInsensitive(text, s))) return false;

  if (criteria.blacklist) {
    for (const [field, values] of Object.entries(criteria.blacklist)) {
      const fieldValue = fieldOf(candidate, field);
      if (fieldValue && values.some((v) => includesCaseInsensitive(fieldValue, v))) return false;
    }
  }
  if (criteria.whitelist) {
    for (const [field, values] of Object.entries(criteria.whitelist)) {
      const fieldValue = fieldOf(candidate, field);
      if (fieldValue && !values.some((v) => includesCaseInsensitive(fieldValue, v))) return false;
    }
  }

  return true;
}

function fieldOf(candidate: PostingCandidate, field: string): string | undefined {
  switch (field) {
    case "title":
      return candidate.title;
    case "company":
      return candidate.company;
    case "location":
      return candidate.location;
    case "salary":
      return candidate.salary;
    default:
      return undefined;
  }
}

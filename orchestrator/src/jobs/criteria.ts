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

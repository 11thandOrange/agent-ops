// Shared shape for every sourcing method (types.ts's SourcingMethod).
// `request` is the free-text chat request — for "manual" it IS the pasted
// posting; for "api"/"scraping" it's expected to contain a posting URL or
// search query that the method resolves into posting text.
export interface SourcingInput {
  request: string;
}

export interface SourcingResult {
  postingText: string;
  sourceUrl?: string;
}

// Resolves a saved authenticated session for whatever site a URL happens
// to belong to. Replaces an earlier design mistake: LINKEDIN_STORAGE_STATE_PATH
// (a single, LinkedIn-specific env var) was being reused as scrapeAll's
// session config, even though scrapeAll crawls an arbitrary given site, and
// scrapeAny searches the open web — neither is LinkedIn-specific by design.
// One directory of per-hostname storage-state files replaces one
// single-site path everywhere a site could be anything.
import { existsSync } from "node:fs";
import path from "node:path";

export interface SiteSessionsConfig {
  sessionsDir: string; // directory of "<hostname>.json" Playwright storage-state files, one per site you've saved a session for
}

// Returns undefined (proceed unauthenticated) if no session file exists for
// the URL's hostname — not every site needs, or has, a saved session.
export function resolveStorageState(config: SiteSessionsConfig | undefined, url: string): string | undefined {
  if (!config) return undefined;
  const hostname = new URL(url).hostname.replace(/^www\./, "");
  const candidate = path.join(config.sessionsDir, `${hostname}.json`);
  return existsSync(candidate) ? candidate : undefined;
}

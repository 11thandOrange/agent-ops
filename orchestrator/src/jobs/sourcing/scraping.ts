// Default sourcing method (registry/personal/projects.yaml's
// sourcing_method: scraping). This is a deliberate, accepted deviation from
// LinkedIn's Terms of Service, not an oversight — see
// skills/personal/resume-job-applier/sourcing/scraping/SKILL.md for the
// explicit risk note. Runs against your own authenticated session for
// whatever site the posting URL belongs to (a saved Playwright storage
// state, resolved by hostname via integrations/site_sessions.ts — not a
// single LinkedIn-only path), not anonymously when a session exists, since
// an anonymous scrape is both more detectable and more fragile — but no
// session is required either; not every site needs, or has, one.
//
// (Revised) actual per-site extraction now lives in scrapingAdapters/ — a
// two-tier adapter system (named adapters tuned to one specific site, plus
// generic fallback adapters for anything else, e.g. a posting on a
// company's own careers site) instead of one hardcoded LinkedIn-only
// selector. See scrapingAdapters/resolver.ts for the resolution order and
// skills/personal/resume-job-applier/sourcing/scraping/SKILL.md for the
// model.
import { chromium } from "playwright";
import { resolveStorageState, type SiteSessionsConfig } from "../../integrations/site_sessions.js";
import { resolveAdapterName, extractWithAdapter } from "./scrapingAdapters/resolver.js";
import { detectLoginWall } from "./scrapingAdapters/loginWall.js";
import type { ScrapingAdapterName } from "../../types.js";
import type { SourcingInput, SourcingResult } from "./types.js";

export type ScrapingSourcingConfig = SiteSessionsConfig;

const URL_PATTERN = /https?:\/\/\S+/;

export async function gatherPosting(
  config: ScrapingSourcingConfig | undefined,
  input: SourcingInput,
  adapterOverride?: ScrapingAdapterName,
): Promise<SourcingResult> {
  const match = input.request.match(URL_PATTERN);
  if (!match) {
    throw new Error("scraping sourcing: the chat request must contain the job posting URL");
  }
  const url = match[0];
  const storageState = resolveStorageState(config, url);
  const adapterName = resolveAdapterName(url, adapterOverride);

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext(storageState ? { storageState } : {});
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded" });

    // Distinct, clearer error than a generic selector timeout when the
    // reason is specifically a login wall — previously indistinguishable
    // from a wrong selector, a slow page, or a markup change.
    if (await detectLoginWall(page)) {
      throw new Error(`scraping sourcing: ${url} appears to require login — no saved session matched this site, or it may have expired`);
    }

    const postingText = (await extractWithAdapter(adapterName, page)).trim();
    if (!postingText) {
      throw new Error(`scraping sourcing: no posting text found at ${url} (adapter: ${adapterName}) — the page's markup may not match this adapter`);
    }
    return { postingText, sourceUrl: url };
  } finally {
    await browser.close();
  }
}

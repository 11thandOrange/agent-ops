// Default sourcing method (registry/personal/projects.yaml's
// sourcing_method: scraping). This is a deliberate, accepted deviation from
// LinkedIn's Terms of Service, not an oversight — see
// skills/personal/resume-job-applier/sourcing/scraping/SKILL.md for the
// explicit risk note. Runs against your own authenticated session for
// whatever site the posting URL belongs to (a saved Playwright storage
// state, resolved by hostname via integrations/site_sessions.ts — not a
// single LinkedIn-only path, since scraping.gatherPosting itself is
// site-agnostic even though the resume-job-applier project's own scope is
// LinkedIn-only today), not anonymously, since an anonymous scrape is both
// more detectable and more fragile.
//
// The exact selectors below target LinkedIn's job-posting page structure as
// of when this was written and are the most likely thing to need updating
// if LinkedIn changes its markup — this hasn't been run against a live,
// authenticated LinkedIn session (no test credentials available in the
// environment this was built in), so treat it as a real first draft to
// verify against an actual posting before relying on it. A second site
// would need its own selector logic here (or a model-assisted extraction
// like discovery/scrapeAll.ts uses for arbitrary listing pages), not just
// its own session file.
import { chromium } from "playwright";
import { resolveStorageState, type SiteSessionsConfig } from "../../integrations/site_sessions.js";
import type { SourcingInput, SourcingResult } from "./types.js";

export type ScrapingSourcingConfig = SiteSessionsConfig;

const URL_PATTERN = /https?:\/\/\S+/;

export async function gatherPosting(config: ScrapingSourcingConfig | undefined, input: SourcingInput): Promise<SourcingResult> {
  const match = input.request.match(URL_PATTERN);
  if (!match) {
    throw new Error("scraping sourcing: the chat request must contain the job posting URL");
  }
  const url = match[0];
  const storageState = resolveStorageState(config, url);

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext(storageState ? { storageState } : {});
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded" });

    const descriptionSelector = ".jobs-description__content, .jobs-box__html-content";
    await page.waitForSelector(descriptionSelector, { timeout: 15_000 });
    const postingText = (await page.locator(descriptionSelector).first().innerText()).trim();
    if (!postingText) {
      throw new Error(`scraping sourcing: no posting text found at ${url} — the page may require re-authentication or LinkedIn's markup has changed`);
    }
    return { postingText, sourceUrl: url };
  } finally {
    await browser.close();
  }
}

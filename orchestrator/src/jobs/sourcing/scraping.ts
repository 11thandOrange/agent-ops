// Default sourcing method (registry/personal/projects.yaml's
// sourcing_method: scraping). This is a deliberate, accepted deviation from
// LinkedIn's Terms of Service, not an oversight — see
// skills/personal/resume-job-applier/sourcing/scraping/SKILL.md for the
// explicit risk note. Runs against your own authenticated LinkedIn session
// (a saved Playwright storage state), not anonymously, since an anonymous
// scrape is both more detectable and more fragile.
//
// The exact selectors below target LinkedIn's job-posting page structure as
// of when this was written and are the most likely thing to need updating
// if LinkedIn changes its markup — this hasn't been run against a live,
// authenticated LinkedIn session (no test credentials available in the
// environment this was built in), so treat it as a real first draft to
// verify against an actual posting before relying on it.
import { chromium } from "playwright";
import type { SourcingInput, SourcingResult } from "./types.js";

export interface ScrapingSourcingConfig {
  storageStatePath: string; // path to a saved Playwright storage state (cookies) from a logged-in session
}

const URL_PATTERN = /https?:\/\/\S+/;

export async function gatherPosting(config: ScrapingSourcingConfig, input: SourcingInput): Promise<SourcingResult> {
  const match = input.request.match(URL_PATTERN);
  if (!match) {
    throw new Error("scraping sourcing: the chat request must contain the job posting URL");
  }
  const url = match[0];

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ storageState: config.storageStatePath });
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

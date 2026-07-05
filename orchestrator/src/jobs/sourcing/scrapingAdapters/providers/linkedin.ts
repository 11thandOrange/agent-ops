// LinkedIn job-posting adapter. The exact selectors below target LinkedIn's
// job-posting page structure as of when this was written and are the most
// likely thing to need updating if LinkedIn changes its markup — this
// hasn't been run against a live, authenticated LinkedIn session (no test
// credentials available in the environment this was built in), so treat it
// as a real first draft to verify against an actual posting before relying
// on it. LinkedIn's job-posting page itself shows the description without
// needing to click anything — "Easy Apply" only matters once you're
// actually filling out an application, which is job-application-form-
// prefill.mjs's territory, not this adapter's.
import type { Page } from "playwright";
import type { ScrapingAdapter } from "../types.js";

const DESCRIPTION_SELECTOR = ".jobs-description__content, .jobs-box__html-content";

export const linkedin: ScrapingAdapter = {
  async extract(page: Page): Promise<string> {
    await page.waitForSelector(DESCRIPTION_SELECTOR, { timeout: 15_000 });
    return (await page.locator(DESCRIPTION_SELECTOR).first().innerText()).trim();
  },
};

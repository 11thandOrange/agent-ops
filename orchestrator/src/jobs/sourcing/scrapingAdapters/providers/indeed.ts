// Indeed job-posting adapter — first draft. #jobDescriptionText has been a
// long-stable container ID on Indeed's posting pages historically, but
// this is NOT verified against a live Indeed page in the environment this
// was built in (no network access to real sites — see
// sourcing/scraping/SKILL.md). Treat as unverified until tried against a
// real posting.
import type { Page } from "playwright";
import type { ScrapingAdapter } from "../types.js";

const DESCRIPTION_SELECTOR = "#jobDescriptionText";

export const indeed: ScrapingAdapter = {
  async extract(page: Page): Promise<string> {
    await page.waitForSelector(DESCRIPTION_SELECTOR, { timeout: 15_000 });
    return (await page.locator(DESCRIPTION_SELECTOR).first().innerText()).trim();
  },
};

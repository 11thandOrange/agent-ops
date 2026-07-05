// Glassdoor job-posting adapter — first draft. This selector is a
// best-guess based on Glassdoor's commonly-documented job-description
// container, NOT verified against a live Glassdoor page in the environment
// this was built in (no network access to real sites — see
// sourcing/scraping/SKILL.md). Treat as unverified until tried against a
// real posting.
import type { Page } from "playwright";
import type { ScrapingAdapter } from "../types.js";

const DESCRIPTION_SELECTOR = '[data-test="jobDescriptionContent"], .JobDetails_jobDescription__uW_fK';

export const glassdoor: ScrapingAdapter = {
  async extract(page: Page): Promise<string> {
    await page.waitForSelector(DESCRIPTION_SELECTOR, { timeout: 15_000 });
    return (await page.locator(DESCRIPTION_SELECTOR).first().innerText()).trim();
  },
};

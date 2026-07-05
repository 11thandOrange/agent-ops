// Fallback adapter for a posting hosted directly on a company's own site
// (or any hostname with no named adapter) that doesn't require clicking
// through anything — the description is already on the page. Tries a short
// list of common content-container patterns, falls back to the whole
// visible body text (bounded) if none match confidently. Deliberately no
// navigation/clicking here — see genericMultistep.ts for that.
import type { Page } from "playwright";
import type { ScrapingAdapter } from "../types.js";

const COMMON_SELECTORS = ['[class*="description" i]', '[id*="description" i]', "main", "article"];
// A near-empty match (e.g. a nav/header container that happens to contain
// "description" in a class name) isn't a real posting body — require some
// minimum length before trusting a match.
const MIN_CONFIDENT_LENGTH = 200;
const BODY_TEXT_LIMIT = 12_000;

export const genericOnePageApp: ScrapingAdapter = {
  async extract(page: Page): Promise<string> {
    for (const selector of COMMON_SELECTORS) {
      const locator = page.locator(selector).first();
      if ((await locator.count()) === 0) continue;
      const text = (await locator.innerText().catch(() => "")).trim();
      if (text.length >= MIN_CONFIDENT_LENGTH) return text;
    }
    return (await page.locator("body").innerText()).trim().slice(0, BODY_TEXT_LIMIT);
  },
};

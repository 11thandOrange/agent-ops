// Fallback adapter for a posting that requires clicking through a
// multi-step wizard (or a single "Next"/"Continue" reveal) before the
// description is visible — the default when no named adapter matches and
// no override is given, since it degrades to plain one-page behavior on
// its own when no such control exists (nothing to click => same result as
// genericOnePageApp). Uses the shared nextControl allowlist, which
// deliberately never clicks anything apply-flavored — see nextControl.ts.
import type { Page } from "playwright";
import type { ScrapingAdapter } from "../types.js";
import { findNextControl } from "../nextControl.js";
import { genericOnePageApp } from "./genericOnePage.js";

const MAX_STEPS = 5;
const STEP_SETTLE_MS = 800; // heuristic settle time — no robust readiness signal across arbitrary sites

export const genericMultistepApp: ScrapingAdapter = {
  async extract(page: Page): Promise<string> {
    for (let step = 0; step < MAX_STEPS; step++) {
      const next = await findNextControl(page);
      if (!next) break;
      await next.click().catch(() => {});
      await page.waitForTimeout(STEP_SETTLE_MS);
    }
    return genericOnePageApp.extract(page);
  },
};

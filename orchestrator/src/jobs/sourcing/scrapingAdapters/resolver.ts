// Resolves which scraping adapter to use for a given URL: explicit config/
// per-call override wins; otherwise the URL's hostname is matched against
// the named (Tier 1) adapters; otherwise generic-multistep-app is the
// default fallback (Tier 2) — it degrades to plain one-page extraction on
// its own when there's nothing to click through, so it's a safe default
// either way, unlike guessing between the two generic adapters up front.
import type { Page } from "playwright";
import type { ScrapingAdapterName } from "../../../types.js";
import type { ScrapingAdapter } from "./types.js";
import { linkedin } from "./providers/linkedin.js";
import { glassdoor } from "./providers/glassdoor.js";
import { indeed } from "./providers/indeed.js";
import { genericOnePageApp } from "./providers/genericOnePage.js";
import { genericMultistepApp } from "./providers/genericMultistep.js";

const NAMED_HOSTNAMES: Record<string, ScrapingAdapterName> = {
  "linkedin.com": "linkedin",
  "glassdoor.com": "glassdoor",
  "indeed.com": "indeed",
};

const ADAPTERS: Record<ScrapingAdapterName, ScrapingAdapter> = {
  linkedin,
  glassdoor,
  indeed,
  "generic-one-page-app": genericOnePageApp,
  "generic-multistep-app": genericMultistepApp,
};

export function resolveAdapterName(url: string, override?: ScrapingAdapterName): ScrapingAdapterName {
  if (override) return override;
  const hostname = new URL(url).hostname.replace(/^www\./, "");
  for (const [domain, name] of Object.entries(NAMED_HOSTNAMES)) {
    if (hostname === domain || hostname.endsWith(`.${domain}`)) return name;
  }
  return "generic-multistep-app";
}

export async function extractWithAdapter(name: ScrapingAdapterName, page: Page): Promise<string> {
  return ADAPTERS[name].extract(page);
}

// scrapeAll strategy: crawl one given site's listings and identify
// individual job postings on it. Unlike sourcing/scraping.ts (fixed CSS
// selectors for one known site, LinkedIn), a listings page's structure
// varies per site — fixed selectors can't generalize, so this renders the
// page and hands its text + links to the model to identify which links are
// actual job postings, rather than guessing selectors per site.
import { chromium } from "playwright";
import { chatCompletion, type LiteLLMConfig } from "../../integrations/litellm.js";
import { parseModelJson } from "../../integrations/llmJson.js";
import { resolveStorageState, type SiteSessionsConfig } from "../../integrations/site_sessions.js";
import { matchesCriteria } from "../criteria.js";
import type { JobCriteria, PostingCandidate } from "../../types.js";

// scrapeAll crawls whatever site URL it's given — genuinely multi-site by
// design (unlike sourcing/scraping.ts, which is scoped to LinkedIn by the
// resume-job-applier project's own choice, not by this module). Session
// resolution is by hostname (integrations/site_sessions.ts), not a single
// fixed path — an earlier version of this wrongly reused a LinkedIn-only
// env var here, which made no sense for a multi-site crawler.
export type ScrapeAllConfig = SiteSessionsConfig;

export async function discover(
  config: ScrapeAllConfig | undefined,
  liteLLM: LiteLLMConfig,
  modelAlias: string,
  siteUrl: string,
  criteria: JobCriteria | undefined,
  maxResults: number,
): Promise<PostingCandidate[]> {
  const browser = await chromium.launch();
  let pageText: string;
  let links: Array<{ href: string; text: string }>;
  try {
    const storageState = resolveStorageState(config, siteUrl);
    const context = await browser.newContext(storageState ? { storageState } : {});
    const page = await context.newPage();
    await page.goto(siteUrl, { waitUntil: "domcontentloaded" });
    pageText = (await page.locator("body").innerText()).slice(0, 12_000); // bound prompt size
    links = await page.locator("a[href]").evaluateAll((els) =>
      (els as unknown as Array<{ href: string; textContent: string | null }>)
        .map((el) => ({ href: el.href, text: (el.textContent ?? "").trim() }))
        .filter((l) => l.text),
    );
  } finally {
    await browser.close();
  }

  const linksList = links
    .slice(0, 300) // bound prompt size — a large listings page can have hundreds of nav/footer links
    .map((l) => `${l.href} :: ${l.text}`)
    .join("\n");

  const raw = await chatCompletion(liteLLM, modelAlias, [
    {
      role: "system",
      content:
        "You identify individual job posting links on a crawled job-listings page. " +
        "Given the page's visible text and its links, respond with ONLY a JSON array (no markdown fences, no other text) " +
        "of objects: {url, title, company, location, remote, salary, postedDate, snippet}. " +
        "Only include links that go to an actual individual job posting, not navigation, footer, or category links. " +
        "Omit any field you can't determine rather than guessing.",
    },
    { role: "user", content: `Page text:\n${pageText}\n\nLinks:\n${linksList}` },
  ]);

  let candidates: PostingCandidate[];
  try {
    candidates = parseModelJson<PostingCandidate[]>(raw);
  } catch {
    throw new Error(`scrapeAll discovery: model response was not valid JSON: ${raw.slice(0, 200)}`);
  }

  return candidates.filter((c) => matchesCriteria(c, criteria)).slice(0, maxResults);
}

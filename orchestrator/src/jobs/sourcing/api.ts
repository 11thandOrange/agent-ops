// Sourcing via an authorized/official job-board API instead of scraping —
// the other ToS-safe option besides "manual". No specific provider is
// wired up yet (none was named when this was built); JOB_API_BASE_URL and
// JOB_API_KEY point at whatever authorized API you configure. See
// skills/personal/resume-job-applier/sourcing/api/SKILL.md.
import type { SourcingInput, SourcingResult } from "./types.js";

export interface ApiSourcingConfig {
  baseUrl: string;
  apiKey: string;
}

export async function gatherPosting(config: ApiSourcingConfig, input: SourcingInput): Promise<SourcingResult> {
  const query = input.request.trim();
  if (!query) {
    throw new Error("api sourcing: the chat request must contain a job URL, ID, or search query");
  }
  const res = await fetch(`${config.baseUrl.replace(/\/$/, "")}/postings/search?q=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Bearer ${config.apiKey}` },
  });
  if (!res.ok) {
    throw new Error(`api sourcing: provider request failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { text?: string; description?: string; url?: string };
  const postingText = body.text ?? body.description;
  if (!postingText) {
    throw new Error("api sourcing: provider response had no posting text (check the response shape against your configured provider)");
  }
  return { postingText, sourceUrl: body.url };
}

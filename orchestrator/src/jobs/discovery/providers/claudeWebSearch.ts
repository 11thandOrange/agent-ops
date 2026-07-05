// claude_web_search provider for the scrapeAny strategy. Anthropic's
// server-side web_search tool does the actual searching — no separate
// search-API key/provider to pick, unlike serpapi.ts. We ask Claude to
// search and hand back structured JSON directly, the same model-assisted-
// extraction pattern discovery/scrapeAll.ts already uses for crawled pages,
// rather than trying to parse Anthropic's raw web_search_tool_result blocks
// ourselves.
import { webSearchCompletion, type AnthropicConfig } from "../../../integrations/anthropic.js";
import { parseModelJson } from "../../../integrations/llmJson.js";
import type { PostingCandidate } from "../../../types.js";

export type ClaudeWebSearchConfig = AnthropicConfig;

export async function search(config: ClaudeWebSearchConfig, query: string, maxResults: number): Promise<PostingCandidate[]> {
  const raw = await webSearchCompletion(
    config,
    "You search the web for job postings matching the given query, using the web_search tool. " +
      "After searching, respond with ONLY a JSON array (no markdown fences, no other text) of objects: " +
      "{url, title, company, location, remote, salary, postedDate, snippet}. " +
      `Return at most ${maxResults} candidates. Omit any field you can't determine rather than guessing.`,
    query,
    maxResults,
  );

  let candidates: PostingCandidate[];
  try {
    candidates = parseModelJson<PostingCandidate[]>(raw);
  } catch {
    throw new Error(`claude_web_search discovery: model response was not valid JSON: ${raw.slice(0, 200)}`);
  }
  return candidates;
}

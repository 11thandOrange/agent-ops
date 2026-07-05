// Direct Anthropic Messages API integration — used only by the
// claude_web_search discovery provider (jobs/discovery/providers/claudeWebSearch.ts),
// which needs Anthropic's server-side web_search tool: declared in `tools`,
// executed by Anthropic itself with no client-side loop. Every other model
// call in this orchestrator goes through the OpenAI-compatible LiteLLM
// gateway (integrations/litellm.ts), but that gateway's chat-completions
// shape has no equivalent for Anthropic's server-tool blocks, so this talks
// to api.anthropic.com directly with its own credential (ANTHROPIC_API_KEY)
// rather than LITELLM_VIRTUAL_KEY.
export interface AnthropicConfig {
  apiKey: string;
  model?: string; // defaults to claude-opus-4-8
}

interface ContentBlock {
  type: string;
  text?: string;
}

interface MessagesResponse {
  content: ContentBlock[];
}

// max_uses bounds how many actual searches Claude can run in one request —
// the cost-containment knob for this tool, same spirit as maxResults
// elsewhere in the discovery strategies.
export async function webSearchCompletion(config: AnthropicConfig, systemPrompt: string, userPrompt: string, maxUses: number): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.model ?? "claude-opus-4-8",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: maxUses }],
    }),
  });
  if (!res.ok) {
    throw new Error(`Anthropic web_search request failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as MessagesResponse;
  const text = body.content
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text)
    .join("\n");
  if (!text) throw new Error("Anthropic web_search response had no text content");
  return text;
}

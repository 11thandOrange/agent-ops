// Calls the LiteLLM gateway (litellm/config.yaml) directly, for pipelines
// that have no GitHub Actions runner to execute in — personal projects have
// no repo (strategy doc §5.3), so unlike the dev pipeline (which invokes
// Claude Code inside a GitHub Actions job via claude-code-action), the
// orchestrator process itself is what calls the model here. The gateway is
// OpenAI-compatible; requests address a model *alias* (e.g. "planning"),
// not a literal model name, so repointing an alias is a config change only.
export interface LiteLLMConfig {
  proxyUrl: string; // e.g. "https://litellm-gateway-....run.app/v1"
  virtualKey: string;
}

export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

export async function chatCompletion(config: LiteLLMConfig, modelAlias: string, messages: ChatMessage[]): Promise<string> {
  const res = await fetch(`${config.proxyUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.virtualKey}`,
    },
    body: JSON.stringify({ model: modelAlias, messages }),
  });
  if (!res.ok) {
    throw new Error(`LiteLLM gateway request failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  const content = body.choices[0]?.message.content;
  if (!content) throw new Error("LiteLLM gateway returned no completion content");
  return content;
}

// Every prompt in this codebase that expects JSON back from a model
// explicitly instructs "no markdown code fences, no text outside the JSON
// object" — but compliance isn't guaranteed. Confirmed live: gemini-2.5-flash
// (via LiteLLM) wrapped its response in a ```json fence anyway, breaking a
// bare JSON.parse(raw) call. Strips a leading/trailing fence if present
// before parsing; a no-op on already-raw JSON, so this is safe to use
// unconditionally in place of JSON.parse(raw).
const FENCE_PATTERN = /^```(?:json)?\s*([\s\S]*?)\s*```$/;

export function parseModelJson<T>(raw: string): T {
  const trimmed = raw.trim();
  const match = trimmed.match(FENCE_PATTERN);
  return JSON.parse(match ? match[1] : trimmed) as T;
}

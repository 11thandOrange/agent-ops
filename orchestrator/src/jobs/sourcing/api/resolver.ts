// Resolves which api provider sourcing_method: api uses. Only one exists
// today (jsearch) — structured so a second provider is a new module + one
// more case here, same seam as scrapingAdapters/resolver.ts and
// discovery/scrapeAny.ts's search-provider dispatch.
import type { ApiProviderName } from "../../../types.js";
import type { SourcingInput, SourcingResult } from "../types.js";
import * as jsearch from "./providers/jsearch.js";

export interface ApiSourcingConfig {
  jsearch?: jsearch.JSearchConfig;
}

export function resolveApiProviderName(override?: ApiProviderName): ApiProviderName {
  return override ?? "jsearch"; // the only provider today
}

export async function gatherWithProvider(
  name: ApiProviderName,
  config: ApiSourcingConfig | undefined,
  input: SourcingInput,
): Promise<SourcingResult> {
  switch (name) {
    case "jsearch":
      if (!config?.jsearch) throw new Error("personal pipeline: api_provider 'jsearch' requires JSEARCH_API_KEY to be configured");
      return jsearch.gatherPosting(config.jsearch, input);
  }
}

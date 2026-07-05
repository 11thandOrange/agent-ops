// Sourcing via an authorized/official job-board API instead of scraping —
// the other ToS-safe option besides "manual". Thin entry point: which
// provider actually handles the request is resolved by api/resolver.ts
// (jsearch today, structured so a second provider is a new module + one
// more case there, not a redesign here). See
// skills/personal/resume-job-applier/sourcing/api/SKILL.md.
import { resolveApiProviderName, gatherWithProvider, type ApiSourcingConfig } from "./api/resolver.js";
import type { ApiProviderName } from "../../types.js";
import type { SourcingInput, SourcingResult } from "./types.js";

export type { ApiSourcingConfig };

export async function gatherPosting(
  config: ApiSourcingConfig | undefined,
  input: SourcingInput,
  providerOverride?: ApiProviderName,
): Promise<SourcingResult> {
  const providerName = resolveApiProviderName(providerOverride);
  return gatherWithProvider(providerName, config, input);
}

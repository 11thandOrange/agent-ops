// The safe default: a human pastes/describes the posting themselves, so
// there's nothing to fetch and no ToS exposure — see
// skills/personal/resume-job-applier/sourcing/manual/SKILL.md.
import type { SourcingInput, SourcingResult } from "./types.js";

export async function gatherPosting(input: SourcingInput): Promise<SourcingResult> {
  if (!input.request.trim()) {
    throw new Error("manual sourcing: the chat request must contain the pasted/described job posting");
  }
  return { postingText: input.request.trim() };
}

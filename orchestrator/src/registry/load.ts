// Tiny local reader for this deployment's own registry/pipelines.yaml —
// used only by the Chrome-extension routes (triggers/applications_lookup.ts,
// generate_answer.ts) to validate a project name and read its params. The
// engine (pipeline-orchestrator's createServer) loads and validates the same
// file independently for actual pipeline dispatch; this is a second, much
// narrower reader for routes that live outside the engine's own trigger
// surface — see index.ts for why those routes are mounted here rather than
// inside the engine itself.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import YAML from "yaml";
import type { JobSearchParams } from "../types.js";

interface RawPipelineEntry {
  name: string;
  handler: string;
  skill_path: string;
  params: Record<string, unknown>;
}

const DEFAULT_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "pipelines.yaml");

export function loadJobSearchPipeline(name: string, registryPath = DEFAULT_PATH): JobSearchParams | undefined {
  const raw = readFileSync(registryPath, "utf-8");
  const entries = (raw.trim() ? (YAML.parse(raw) as RawPipelineEntry[]) : []) ?? [];
  const entry = entries.find((e) => e.name === name && e.handler === "job-search-pipeline");
  if (!entry) return undefined;
  return { skill_path: entry.skill_path, ...(entry.params as Omit<JobSearchParams, "skill_path">) };
}

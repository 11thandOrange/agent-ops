// Local-filesystem registry loader. registry/development and
// registry/personal are yaml files, not TypeScript, so tsc doesn't copy
// them into dist/ on its own — package.json's build script copies them
// alongside the compiled output (see build script). Resolved relative to
// this module's own compiled location so it works the same whether running
// from src/ (tsx dev) or dist/ (the deployed container).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import YAML from "yaml";
import type { DevProjectEntry, PersonalProjectEntry } from "../types.js";

const REGISTRY_DIR = path.dirname(fileURLToPath(import.meta.url));

function readEntries<T>(file: string): T[] {
  const raw = readFileSync(path.join(REGISTRY_DIR, file), "utf-8");
  return (YAML.parse(raw) as T[]) ?? [];
}

export function loadDevProject(name: string): DevProjectEntry | undefined {
  return readEntries<DevProjectEntry>("development/projects.yaml").find((p) => p.project === name);
}

export function loadPersonalProject(name: string): PersonalProjectEntry | undefined {
  return readEntries<PersonalProjectEntry>("personal/projects.yaml").find((p) => p.project === name);
}

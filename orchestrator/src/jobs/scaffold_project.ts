// Backs the `scaffold_project` MCP tool (§5.1, §6.1). Onboarding a new dev
// or personal project is a pipeline capability, not a static template a
// human copies by hand: this generates the new project's skill file,
// appends its registry entry, and — for a dev project — writes the thin
// per-repo caller workflow, all in one action.
//
// Assumes the GitHub App installation covers both the control repo and any
// target app repo (an org-wide install). If a target repo hasn't had the
// App installed yet, the write to that repo will fail — install it first
// (roadmap Phase 8, step 1).
import YAML from "yaml";
import { createOrUpdateFile, getInstallationToken, type GitHubAppConfig } from "../integrations/github.js";
import { logger } from "../logging.js";
import type { DevProjectEntry, DocumentSource, PersonalProjectEntry, SourcingMethod } from "../types.js";

export interface ScaffoldRequest {
  name: string;
  type: "dev" | "personal";
  repo?: string; // "owner/name" — required when type is "dev"
  modelProfile?: string;
  // type: "dev" only. Defaults to [repo:<repo>] (scoped to just this project) —
  // widen it (e.g. to a language tag like ["typescript"]) only when the skill's
  // content is genuinely meant to reach beyond this one repo.
  appliesTo?: string[];
  // type: "personal" only. Default to the safest/most common starting point;
  // fill in the specifics (gdrive links, real sourcing method) by hand after
  // scaffolding, same as CHANGE_ME placeholders on the dev side.
  resumeSource?: DocumentSource;
  coverLetterSource?: DocumentSource;
  sourcingMethod?: SourcingMethod;
}

export interface ScaffoldDeps {
  githubApp: GitHubAppConfig;
  installationId: string;
  controlRepoOwner: string;
  controlRepoName: string;
  branch: string;
}

// Dev and personal projects live in separate registry files (types.ts's
// DevProjectEntry vs PersonalProjectEntry have non-overlapping schemas) —
// scaffolding a project only ever touches the one file matching its type.
function registryPath(type: "dev" | "personal"): string {
  return type === "dev"
    ? "orchestrator/src/registry/development/projects.yaml"
    : "orchestrator/src/registry/personal/projects.yaml";
}

export async function scaffoldProject(deps: ScaffoldDeps, req: ScaffoldRequest): Promise<void> {
  if (req.type === "dev" && !req.repo) {
    throw new Error("scaffold_project: 'repo' is required for type 'dev'");
  }
  const log = logger.withContext({ project: req.name, type: req.type });

  const token = await getInstallationToken(deps.githubApp, deps.installationId);
  // Dev skills go under skills/shared/dev/ like any other shared dev skill,
  // matched via applies_to (§6). Personal skills have no shared tier at all
  // (each personal project's needs live entirely in its own folder) — go
  // under skills/personal/ unchanged.
  const skillFolder = req.type === "dev" ? `skills/shared/dev/${req.name}` : `skills/personal/${req.name}`;
  const appliesTo = req.type === "dev" ? (req.appliesTo ?? [`repo:${req.repo}`]) : undefined;

  log.info("writing new project skill");
  await createOrUpdateFile(
    token,
    deps.controlRepoOwner,
    deps.controlRepoName,
    `${skillFolder}/SKILL.md`,
    skillTemplate(req.name, req.type, appliesTo),
    `Scaffold ${req.name} project skill`,
    deps.branch,
  );

  log.info("appending registry entry");
  const path = registryPath(req.type);
  if (req.type === "dev") {
    const entries = await readRegistry<DevProjectEntry>(token, deps.controlRepoOwner, deps.controlRepoName, deps.branch, path);
    entries.push({
      project: req.name,
      type: "dev",
      repo: `github.com/${req.repo}`,
      model_profile: req.modelProfile ?? "implementation",
      project_language: ["CHANGE_ME"],
      test_command: "CHANGE_ME",
      coverage_type: "CHANGE_ME",
      desired_coverage: 85,
      reviewer: "heyitschloe",
    });
    await createOrUpdateFile(token, deps.controlRepoOwner, deps.controlRepoName, path, YAML.stringify(entries), `Register ${req.name} project`, deps.branch);
  } else {
    const entries = await readRegistry<PersonalProjectEntry>(token, deps.controlRepoOwner, deps.controlRepoName, deps.branch, path);
    entries.push({
      project: req.name,
      type: "personal",
      skill_path: skillFolder,
      model_profile: req.modelProfile ?? "planning",
      resume_source: req.resumeSource ?? { mode: "generated_pdf" },
      cover_letter_source: req.coverLetterSource ?? { mode: "generated_pdf" },
      sourcing_method: req.sourcingMethod ?? "manual",
    });
    await createOrUpdateFile(token, deps.controlRepoOwner, deps.controlRepoName, path, YAML.stringify(entries), `Register ${req.name} project`, deps.branch);
  }

  if (req.type === "dev" && req.repo) {
    const [owner, repo] = req.repo.split("/");
    log.info("writing caller workflow", { repo: req.repo });
    await createOrUpdateFile(
      token,
      owner,
      repo,
      ".github/workflows/dev-pipeline.yml",
      callerWorkflowTemplate(deps.controlRepoOwner, deps.controlRepoName),
      `Add dev-pipeline caller workflow for ${req.name}`,
      deps.branch,
    );
  }
}

async function readRegistry<T>(token: string, owner: string, repo: string, branch: string, path: string): Promise<T[]> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.raw" },
  });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`failed to read registry: ${res.status} ${await res.text()}`);
  const raw = await res.text();
  return raw.trim() ? ((YAML.parse(raw) as T[]) ?? []) : [];
}

function skillTemplate(name: string, type: "dev" | "personal", appliesTo?: string[]): string {
  const frontmatter = [
    "---",
    `name: ${name}`,
    `description: Generated by the project-scaffold skill for the ${name} project — fill in before relying on it.`,
    ...(appliesTo ? [`applies_to: [${appliesTo.join(", ")}]`] : []),
    "---",
    "",
  ];
  return [
    ...frontmatter,
    `# ${name}`,
    "",
    "Generated by the `project-scaffold` skill (skills/shared/dev/project-scaffold/SKILL.md).",
    "Fill in before relying on this project:",
    "",
    "- Conventions: <coding style, folder layout, naming>",
    "- Test framework and command: <e.g. \"npm test -- --coverage\">",
    "- PR / approach-doc expectations: see skills/shared/dev/approach-doc-format/SKILL.md",
    "- Approval-gate behavior: see skills/shared/dev/approval-gate-protocol/SKILL.md",
    "- Guardrails: <anything this project must never do unattended>",
    ...(type === "dev"
      ? ["- CI: paired with a thin caller workflow that calls agent-ops's dev-pipeline-reusable.yml"]
      : ["- Sourcing method and document sources: set sourcing_method/resume_source/cover_letter_source in registry/personal/projects.yaml"]),
    "",
  ].join("\n");
}

function callerWorkflowTemplate(controlRepoOwner: string, controlRepoName: string): string {
  return `name: dev-pipeline

on:
  issues:
    types: [labeled]
  issue_comment:
    types: [created]
  repository_dispatch:
    types: [agent-trigger]

jobs:
  dispatch:
    # id-token: write must be granted here too — reusable workflow permissions
    # are the intersection of caller + callee, and dev-pipeline-reusable.yml's
    # jobs request id-token: write for anthropics/claude-code-action@v1's OIDC.
    permissions:
      contents: read
      packages: read
      id-token: write
    uses: ${controlRepoOwner}/${controlRepoName}/.github/workflows/dev-pipeline-reusable.yml@main
    with:
      project_language: CHANGE_ME
      test_command: CHANGE_ME
      coverage_type: CHANGE_ME
      desired_coverage: 85
      reviewer: heyitschloe
      action: >-
        \${{
          (github.event.label.name == 'approach-ready' && 'plan') ||
          (github.event.label.name == 'approved' && 'implement') ||
          (contains(github.event.comment.body, '@dev-agent plan') && 'plan') ||
          (contains(github.event.comment.body, '@dev-agent implement') && 'implement') ||
          github.event.client_payload.action
        }}
    secrets: inherit
`;
}

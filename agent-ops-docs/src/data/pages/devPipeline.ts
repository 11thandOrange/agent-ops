import type { PageContent } from '../pages';

export const devPipelinePages: Record<string, PageContent> = {
  '/dev-pipeline': {
    title: 'Dev Pipeline',
    description:
      'GitHub-ticket-driven: plan → human approval → implement via Claude Code → quality gate → PR. One reusable workflow, called by every app repo.',
    route: '/dev-pipeline',
    sections: [
      { type: 'heading', level: 2, content: 'Four trigger entry points, one job shape' },
      {
        type: 'paragraph',
        content:
          'A GitHub label change, an @mention comment, a chat command, or a direct curl to POST /trigger — all four normalize into the same internal job payload ({repo, issueNumber, action, requestedBy, source}) before dispatch. Label and @mention triggers fire natively via GitHub Actions (issues.labeled, issue_comment.created); chat and curl both hit the orchestrator directly, which then calls GitHub\'s repository_dispatch API so the same Actions workflow runs regardless of origin.',
      },
      {
        type: 'callout',
        variant: 'warning',
        content:
          'The @mention trigger\'s workflow condition matches comment body only — it should also check github.event.comment.user.login against an allowlist (ALLOWED_MENTION_AUTHORS) before honoring a command. Cheap defense-in-depth even on a single-collaborator private repo.',
      },
      { type: 'heading', level: 2, content: 'Planning stage — real GitHub sub-issues' },
      {
        type: 'list',
        items: [
          'Reads the issue and the target repo\'s skill folder (registry/development/projects.yaml → skill_path).',
          'Drafts an approach doc, then creates one real GitHub sub-issue per subtask via the sub-issues API — the subtask\'s content becomes that sub-issue\'s description, not a checklist line.',
          'Checks for existing sub-issues matching the plan before creating new ones, so a retried/failed-partway run doesn\'t duplicate.',
          'Labels the parent issue approach-ready and stops — waits for a human to relabel it approved.',
        ],
      },
      { type: 'heading', level: 2, content: 'Implementation stage — Claude Code' },
      {
        type: 'paragraph',
        content:
          'Once relabeled approved, Claude Code runs headless (claude -p) via anthropics/claude-code-action@v1, authenticated against the LiteLLM gateway rather than the Anthropic API directly — the model behind this step is swappable via litellm/config.yaml alone. It reads the approved approach doc and sub-issues, implements the change, writes unit tests as part of implementation, commits, opens a PR, and requests review from the reviewer named in that repo\'s registry entry.',
      },
      { type: 'heading', level: 2, content: 'Quality gate — Qodo (self-hosted PR-Agent + qodo-cover)' },
      {
        type: 'list',
        items: [
          'Qodo Cover generates additional unit tests targeting uncovered paths, keeping only ones that pass and measurably raise coverage toward the repo\'s desired_coverage target.',
          'Qodo Merge reviews the diff for bugs/security/standards issues and can cross-check it against the linked ticket.',
          'Scope: strong on unit tests; integration test scaffolding needs manual review; E2E generation is out of scope — Claude Code writes those directly during implementation, Qodo only confirms they exist and pass.',
          'On failure the gate sends the PR back to the implementation step, not a direct ping — avoids notification noise on an unattended pipeline.',
        ],
      },
      { type: 'heading', level: 2, content: 'One reusable workflow, thin per-repo callers' },
      {
        type: 'paragraph',
        content:
          'The actual pipeline logic lives once, centrally, in agent-ops as dev-pipeline-reusable.yml. Every app repo (e.g. 11thandOrange/BusyBuddy_v2) keeps only a thin caller workflow (templates/dev-pipeline-caller.yml is the template for that file) that supplies its own project_language, test_command, coverage_type, desired_coverage, skill_folder, and reviewer — every one of those sourced from that repo\'s registry/development/projects.yaml entry, not duplicated as a separate GitHub Actions variable.',
      },
      {
        type: 'callout',
        variant: 'info',
        content:
          'Because caller repos are often under a different GitHub account than agent-ops (11thandOrange vs HeyItsChloe), the reusable workflow does a second checkout of agent-ops itself with its own App token, into a .agent-ops/ subpath, so skill files are readable regardless of which account triggered the run.',
      },
    ],
    codeExamples: [
      {
        language: 'yaml',
        label: 'Per-app-repo caller (templates/dev-pipeline-caller.yml)',
        code: `name: dev-pipeline

on:
  issues:
    types: [labeled]
  issue_comment:
    types: [created]
  repository_dispatch:
    types: [agent-trigger]

jobs:
  dispatch:
    uses: HeyItsChloe/agent-ops/.github/workflows/dev-pipeline-reusable.yml@main
    with:
      project_language: typescript
      test_command: "npm test -- --coverage"
      coverage_type: cobertura
      desired_coverage: 85
      skill_folder: skills/app-1
      reviewer: heyitschloe
      action: >-
        \${{
          (github.event.label.name == 'approach-ready' && 'plan') ||
          (github.event.label.name == 'approved' && 'implement') ||
          (contains(github.event.comment.body, '@dev-agent plan') && 'plan') ||
          (contains(github.event.comment.body, '@dev-agent implement') && 'implement') ||
          github.event.client_payload.action
        }}
    secrets: inherit`,
      },
      {
        language: 'bash',
        label: 'Trigger via curl (chat/manual, not a GitHub-native event)',
        code: `curl -X POST https://<orchestrator-url>/trigger \\
  -H "Content-Type: application/json" \\
  -H "x-orchestrator-secret: $ORCHESTRATOR_SHARED_SECRET" \\
  -d '{
    "kind": "development",
    "repo": "11thandOrange/BusyBuddy_v2",
    "issueNumber": 42,
    "action": "plan",
    "requestedBy": "heyitschloe"
  }'`,
      },
    ],
  },
};

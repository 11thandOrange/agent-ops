import type { PageContent } from '../pages';

export const deploymentPages: Record<string, PageContent> = {
  '/deployment': {
    title: 'Deployment & CI/CD',
    description: 'Three GitHub Actions workflows, each with a different trigger model — when each one actually fires.',
    route: '/deployment',
    sections: [
      {
        type: 'table',
        headers: ['Workflow', 'Triggers', 'What it does'],
        rows: [
          ['deploy-orchestrator.yml', 'Automatically on push to main touching orchestrator/**, OR manual (Actions tab → Run workflow)', 'Builds + deploys orchestrator/ to Cloud Run, using only GitHub Secrets — no credential is ever pasted into chat or stored in the repo.'],
          ['deploy-litellm.yml', 'Automatically on push to main touching litellm/**, OR manual', 'Same pattern, for the LiteLLM gateway. Added after the first deploy was done manually via gcloud from a chat session.'],
          ['dev-pipeline-reusable.yml', 'Never run directly — called via workflow_call from each app repo\'s own caller workflow (templates/dev-pipeline-caller.yml)', 'The dev ticket pipeline\'s actual plan/implement/quality-gate logic, centralized so it\'s never copy-pasted per repo.'],
        ],
      },
      {
        type: 'callout',
        variant: 'success',
        content:
          'In practice: you almost never manually trigger deploy-orchestrator.yml or deploy-litellm.yml — the established workflow for this session was to fast-forward-merge a feature branch into main and let the path-filtered push trigger fire automatically, then check the Actions tab if GitHub MCP tools were unavailable to confirm the run status directly.',
      },
      { type: 'heading', level: 2, content: 'Hosting' },
      {
        type: 'paragraph',
        content:
          'Google Cloud Run, project agent-ops-501120, region us-central1. Both the orchestrator and the LiteLLM gateway are separate Cloud Run services, each getting an HTTPS endpoint automatically from a container push — no manual VM/VNIC/public-IP/reverse-proxy setup (an earlier Oracle Cloud Free Tier VM attempt had real friction here before switching to Cloud Run).',
      },
      { type: 'heading', level: 2, content: 'The fast-forward-only merge workflow' },
      {
        type: 'paragraph',
        content:
          'Feature work happens on a dedicated branch; shipping it to main is always a fast-forward merge, never a merge commit — keeps main\'s history linear and makes exactly what "went out" on a given deploy unambiguous.',
      },
    ],
    codeExamples: [
      {
        language: 'bash',
        label: 'Ship a feature branch to main (triggers deploy-orchestrator.yml automatically)',
        code: `git checkout -B main origin/main
git merge --ff-only origin/<feature-branch>
git push origin main`,
      },
      {
        language: 'bash',
        label: 'Manually trigger a deploy without a code change',
        code: `# Actions tab → deploy-orchestrator (or deploy-litellm) → Run workflow
# — or, with the GitHub CLI:
gh workflow run deploy-orchestrator.yml --repo HeyItsChloe/agent-ops`,
      },
    ],
  },
};

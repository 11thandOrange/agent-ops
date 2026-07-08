import type { PageContent } from '../pages';

export const commandReferencePages: Record<string, PageContent> = {
  '/command-reference': {
    title: 'Command Reference',
    description: 'Every runnable command in one place — the page you actually bookmark.',
    route: '/command-reference',
    sections: [
      { type: 'heading', level: 2, content: 'Local orchestrator' },
      { type: 'list', items: ['npm run dev', 'npm run typecheck', 'npm run build', 'npm start'] },
      { type: 'heading', level: 2, content: 'Deploy' },
      { type: 'list', items: [
        'Automatic: git checkout -B main origin/main && git merge --ff-only origin/<branch> && git push origin main',
        'Manual: Actions tab → deploy-orchestrator or deploy-litellm → Run workflow',
      ] },
      { type: 'heading', level: 2, content: 'Extension' },
      { type: 'list', items: [
        'Load unpacked: chrome://extensions → Developer mode → Load unpacked → job-application-form-prefill/',
        'After any content.js/manifest.json change: reload the extension AND refresh any already-open job page tabs',
      ] },
      { type: 'heading', level: 2, content: 'Automations' },
      { type: 'list', items: ['create_trigger', 'list_triggers', 'update_trigger', 'fire_trigger', 'delete_trigger'] },
    ],
    codeExamples: [
      {
        language: 'bash',
        label: 'npm scripts',
        code: `cd orchestrator
npm run dev         # local dev server, restarts on change
npm run typecheck   # tsc --noEmit
npm run build        # tsc && copy-registry
npm start            # what the Cloud Run container runs`,
      },
      {
        language: 'bash',
        label: 'Dev pipeline — plan / implement',
        code: `curl -X POST https://<orchestrator-url>/trigger \\
  -H "Content-Type: application/json" \\
  -H "x-orchestrator-secret: $ORCHESTRATOR_SHARED_SECRET" \\
  -d '{"kind":"development","repo":"11thandOrange/BusyBuddy_v2","issueNumber":42,"action":"plan","requestedBy":"heyitschloe"}'`,
      },
      {
        language: 'bash',
        label: 'Personal pipeline — scrapeOne',
        code: `curl -X POST https://<orchestrator-url>/trigger \\
  -H "Content-Type: application/json" \\
  -H "x-orchestrator-secret: $ORCHESTRATOR_SHARED_SECRET" \\
  -d '{"kind":"personal","project":"resume-job-applier","request":"https://example.com/jobs/123","requestedBy":"heyitschloe"}'`,
      },
      {
        language: 'bash',
        label: 'Personal pipeline — scrapeAny (open web)',
        code: `curl -X POST https://<orchestrator-url>/webhook/mcp \\
  -H "Content-Type: application/json" \\
  -H "x-orchestrator-secret: $ORCHESTRATOR_SHARED_SECRET" \\
  -d '{"tool":"run_personal_project_pipeline","project":"resume-job-applier","request":"","requestedBy":"heyitschloe","strategy":"scrapeAny","searchProvider":"jsearch","maxResults":10,"criteria":{"remote":true,"keywords":["software engineer"]}}'`,
      },
      {
        language: 'bash',
        label: 'the-store lookup (extension endpoint)',
        code: `curl "https://<orchestrator-url>/personal-projects/resume-job-applier/applications?url=<posting-url>" \\
  -H "x-extension-api-key: $EXTENSION_API_KEY"`,
      },
      {
        language: 'bash',
        label: 'Deploy',
        code: `git checkout -B main origin/main
git merge --ff-only origin/<feature-branch>
git push origin main
# or manually: gh workflow run deploy-orchestrator.yml --repo HeyItsChloe/agent-ops`,
      },
    ],
  },
};

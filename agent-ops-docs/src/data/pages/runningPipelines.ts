import type { PageContent } from '../pages';

export const runningPipelinesPages: Record<string, PageContent> = {
  '/running-pipelines': {
    title: 'Running Pipelines',
    description: 'Two ways to fire a pipeline manually — the shared-secret HTTP endpoint, and the MCP webhook (same path chat clients use) — plus local orchestrator commands.',
    route: '/running-pipelines',
    sections: [
      {
        type: 'paragraph',
        content:
          'POST /trigger and POST /webhook/mcp both end up calling the exact same dispatch functions (dispatchPlan, dispatchImplement, dispatchPersonalPipeline) — they differ only in request shape and which credential they check. /trigger uses a flat kind-discriminated body and ORCHESTRATOR_SHARED_SECRET; /webhook/mcp uses the MCP tool-call shape (tool + args) and is what the MCP server itself forwards to when a chat client invokes a tool.',
      },
      { type: 'heading', level: 2, content: 'Local development' },
      {
        type: 'steps',
        steps: [
          { title: 'Install', content: 'cd orchestrator && npm install' },
          { title: 'Configure', content: 'cp .env.example .env, then fill in at minimum the Core vars (see API Keys & Env Vars)' },
          { title: 'Run', content: 'npm run dev — tsx watch src/server.ts, restarts on file change' },
          { title: 'Typecheck', content: 'npm run typecheck — tsc --noEmit, run before every commit' },
          { title: 'Build', content: 'npm run build — tsc && copy-registry (copies registry YAML into dist/)' },
        ],
      },
    ],
    codeExamples: [
      {
        language: 'bash',
        label: 'npm scripts (orchestrator/)',
        code: `npm run dev         # tsx watch src/server.ts — local dev server
npm run typecheck   # tsc --noEmit
npm run build        # tsc && copy-registry
npm start            # node dist/server.js — what the Cloud Run container runs`,
      },
      {
        language: 'bash',
        label: 'scrapeOne (single posting) — POST /trigger',
        code: `curl -X POST https://<orchestrator-url>/trigger \\
  -H "Content-Type: application/json" \\
  -H "x-orchestrator-secret: $ORCHESTRATOR_SHARED_SECRET" \\
  -d '{
    "kind": "personal",
    "project": "resume-job-applier",
    "request": "https://example.com/jobs/senior-engineer-123",
    "requestedBy": "heyitschloe",
    "resumeSource": {"mode": "generated_pdf"},
    "coverLetterSource": {"mode": "generated_pdf"}
  }'`,
      },
      {
        language: 'bash',
        label: 'scrapeAll (crawl a site) — POST /trigger',
        code: `curl -X POST https://<orchestrator-url>/trigger \\
  -H "Content-Type: application/json" \\
  -H "x-orchestrator-secret: $ORCHESTRATOR_SHARED_SECRET" \\
  -d '{
    "kind": "personal",
    "project": "resume-job-applier",
    "request": "https://boards.greenhouse.io/somecompany",
    "requestedBy": "heyitschloe",
    "strategy": "scrapeAll",
    "maxResults": 5,
    "criteria": {"remote": true, "keywords": ["backend"]}
  }'`,
      },
      {
        language: 'bash',
        label: 'scrapeAny (open-web search) — POST /webhook/mcp (MCP tool-call shape)',
        code: `curl -X POST https://<orchestrator-url>/webhook/mcp \\
  -H "Content-Type: application/json" \\
  -H "x-orchestrator-secret: $ORCHESTRATOR_SHARED_SECRET" \\
  -d '{
    "tool": "run_personal_project_pipeline",
    "project": "resume-job-applier",
    "request": "",
    "requestedBy": "heyitschloe",
    "strategy": "scrapeAny",
    "searchProvider": "jsearch",
    "maxResults": 10,
    "criteria": {
      "remote": true,
      "keywords": ["software engineer", "senior software engineer"]
    }
  }'`,
      },
      {
        language: 'bash',
        label: 'Dev pipeline plan/implement — POST /trigger',
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

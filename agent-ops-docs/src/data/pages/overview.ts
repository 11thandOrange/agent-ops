import type { PageContent } from '../pages';

export const overviewPages: Record<string, PageContent> = {
  '/': {
    title: 'What is agent-ops?',
    description:
      'agent-ops is the control repo for a multi-pipeline agent automation system: a GitHub ticket-driven development pipeline, and a personal-assistant pipeline that currently runs a resume builder + job applier.',
    route: '/',
    sections: [
      {
        type: 'callout',
        variant: 'info',
        content:
          'Everything here is draft-and-queue, never auto-submit or auto-merge on its own initiative. A human always takes the last action — approving a plan, clicking submit on a job application, merging a PR.',
      },
      { type: 'heading', level: 2, content: 'Two pipelines, one orchestrator' },
      {
        type: 'paragraph',
        content:
          'The orchestrator (orchestrator/src/server.ts) is a single Express process on Cloud Run that serves both pipelines. They are split at the type level (a ProjectEntry discriminated union: type "dev" | "personal"), at the registry level (registry/development/projects.yaml vs registry/personal/projects.yaml), and at the MCP tool level (run_development_project_pipeline vs run_personal_project_pipeline) — structurally different call shapes, not one overloaded tool with conditional fields.',
      },
      {
        type: 'table',
        headers: ['Pipeline', 'Trigger', 'What it does', 'Ends with'],
        rows: [
          [
            'Dev ticket pipeline',
            'GitHub label, @mention, chat command, or HTTP /trigger',
            'Plans a GitHub issue into sub-issues, then implements via Claude Code inside a GitHub Actions job',
            'A pull request, gated by a quality-gate check',
          ],
          [
            'Personal pipeline (resume-job-applier)',
            'Chat command or HTTP /trigger, plus one daily scheduled automation',
            'Sources a job posting (scrape/API/manual), drafts a tailored resume/cover letter + form-field answers',
            'A CSV row in the-store + a reviewable PDF package; a human submits it themselves',
          ],
        ],
      },
      { type: 'heading', level: 2, content: 'Two companion repos' },
      {
        type: 'list',
        items: [
          'heyitschloe/the-store — a GitHub repo used as a lightweight database: one CSV file tracking every application drafted, used for cross-run dedup.',
          'heyitschloe/extensions — a Chrome extension (job-application-form-prefill) that autofills a form when you open a link already sourced by the pipeline, and offers on-demand AI-drafted answers for pages that were never run through the pipeline at all.',
        ],
      },
      { type: 'heading', level: 2, content: 'Current status' },
      {
        type: 'paragraph',
        content:
          'Phases 0–7 of the build (see the Architecture and Dev/Personal Pipeline sections) are complete and deployed. Pilot dev repo: 11thandOrange/BusyBuddy_v2. Pilot personal project: resume-job-applier. Hosting: Google Cloud Run, project agent-ops-501120, region us-central1.',
      },
    ],
  },
};

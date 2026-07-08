import type { PageContent } from '../pages';

export const automationsPages: Record<string, PageContent> = {
  '/automations': {
    title: 'Automations & Scheduled Triggers',
    description: 'The one scheduled automation that exists today, and the mechanics for setting up another like it.',
    route: '/automations',
    sections: [
      { type: 'heading', level: 2, content: 'Daily scrapeAny / jsearch automation' },
      {
        type: 'paragraph',
        content:
          'strategy: scrapeAny with search_provider: jsearch, criteria baked directly into the trigger\'s own prompt/payload (not a new registry concept), running daily. It dedupes against the-store like every other scrapeAny call, so a still-posted job from yesterday\'s run doesn\'t get redrafted every day.',
      },
      { type: 'heading', level: 2, content: 'create_new_session_on_fire, not persistent_session_id' },
      {
        type: 'paragraph',
        content:
          'The original design bound a create_trigger call to a dedicated session (persistent_session_id) so every firing resumed the same conversation and results landed in one consistent place. That binding turned out to be disabled at the platform/org level (confirmed via a failed create_trigger call, not a per-session issue). The shipped mechanism is create_new_session_on_fire: true instead — each daily firing spins up a fresh session. Results still land somewhere reviewable (the-store CSV, plus that firing\'s own session transcript); there\'s just no single running conversation thread to check back on across days the way the original design intended.',
      },
      {
        type: 'callout',
        variant: 'warning',
        content:
          'If you set up a similar automation and want it bound to one persistent session across firings, try persistent_session_id first — it may work for your org even though it didn\'t for this one. Confirm before relying on it; the failure mode is a hard tool error, not silent misbehavior.',
      },
      { type: 'heading', level: 2, content: 'Managing a Routine' },
      {
        type: 'list',
        items: [
          'create_trigger — creates it. cron_expression is a standard 5-field expression, minimum interval is hourly.',
          'list_triggers — enumerates existing Routines, including next_run_at and whether they\'re currently enabled.',
          'update_trigger — change the cron expression, name, or enabled state without recreating it.',
          'fire_trigger — run it immediately, outside its schedule (useful for testing a change without waiting for the next 5am).',
          'delete_trigger — remove it entirely.',
        ],
      },
    ],
    codeExamples: [
      {
        language: 'json',
        label: 'create_trigger — daily scrapeAny automation (cron: 5am Pacific)',
        code: `{
  "name": "daily-resume-job-applier-scrapeAny",
  "cron_expression": "0 12 * * *",
  "create_new_session_on_fire": true,
  "prompt": "Run the resume-job-applier personal pipeline with strategy scrapeAny, search_provider jsearch, maxResults 10, criteria: { remote: true, keywords: [\\"software engineer\\", \\"senior software engineer\\", \\"IT\\", \\"information technology\\"] }. Use the run_personal_project_pipeline MCP tool."
}`,
      },
      {
        language: 'bash',
        label: 'Fire the automation immediately (test without waiting for the schedule)',
        code: `# via the Claude Code Remote MCP tools, from any session with access to it:
fire_trigger(trigger_id: "trig_01UuyeXFobNyXX4YyQjB4YG6")`,
      },
    ],
  },
};

import type { PageContent } from '../pages';

export const stretchFeaturesPages: Record<string, PageContent> = {
  '/stretch-features': {
    title: 'Stretch Features',
    description: 'Ideas recorded for later — none of these are built yet. Each one below is a starting point, not a spec.',
    route: '/stretch-features',
    sections: [
      {
        type: 'callout',
        variant: 'info',
        content: 'Nothing on this page is implemented. These are candidate directions, captured here so they aren\'t lost — not commitments or a roadmap.',
      },

      { type: 'heading', level: 2, content: '1. Personal pipeline: web-enrich the company before drafting' },
      {
        type: 'paragraph',
        content:
          'Today, drafting (both the batch draftPackage in run_personal_pipeline.ts and the extension\'s on-demand generate-answer endpoint) grounds answers in the posting text, the applicant\'s background, and — for the extension — whatever text is visible on the current page. None of that includes anything about the company itself beyond what the posting happens to mention. This idea adds a step that searches the web for the target company before drafting, and feeds whatever it finds into the same prompt as a third grounding source — not a replacement for the "don\'t invent" guardrail, an addition to what it\'s allowed to cite.',
      },
      {
        type: 'list',
        items: [
          'Reuse the existing SearchProvider interface (discovery/providers/) rather than build a new integration — serpapi and claude_web_search are already wired for exactly this kind of lookup.',
          'Decide scope: batch drafting only, the extension\'s generate-answer only, or both — they\'re two different call sites today.',
          'Costs one extra network call (and model call, if summarizing search results) per candidate — worth rate-limiting or caching per company if scrapeAny is producing many candidates from the same employer.',
        ],
      },

      { type: 'heading', level: 2, content: '2. Chrome extension: a "Complete the entire application" button' },
      {
        type: 'paragraph',
        content:
          'The side panel today has two separate flows: copy/fill one common-answer field at a time, or ask one question at a time in the Ask AI box. This idea adds a single button that runs the whole page: detect every fillable field (content.js already does this via detectFields()), fill the ones that map to ApplicantProfile directly, and call generate-answer once per remaining short-answer field for everything else — answering every field except file uploads, which stay permanently excluded from detection everywhere in this pipeline.',
      },
      {
        type: 'list',
        items: [
          'Needs a per-field loop calling generate-answer once per detected field, not the single question-box call that exists today.',
          'Same "don\'t invent" guardrail applies per-field as it does today — a field the model can\'t ground gets left blank, not guessed.',
          'Still never auto-submits — matches the hard rule that holds everywhere else in this pipeline. A "review before you hit Apply yourself" step is probably worth surfacing given how much more gets filled in one action.',
        ],
      },

      { type: 'heading', level: 2, content: '3. Dev pipeline: self-ticketing from repo exploration' },
      {
        type: 'paragraph',
        content:
          'The dev pipeline is entirely reactive today — it plans and implements against a ticket that already exists, created by a human or an existing trigger. This idea adds an autonomous mode that explores a target repo on its own and proposes new tickets — stale docs, missing tests, dead code, inconsistencies between code and its own documentation (task #78 in this project\'s history, fixing stale docs in a SKILL.md, is roughly the kind of thing this mode would have caught and ticketed itself).',
      },
      {
        type: 'list',
        items: [
          'Needs a real approval gate before a generated ticket becomes actionable — reuse the existing approval-gate-protocol skill rather than let self-generated tickets skip the review a human-authored one would get.',
          'Real risk of low-value, noisy ticket generation without a strong rubric for what\'s worth ticketing — this is the hard part, not the exploration itself.',
          'Likely reuses create_ticket (chat_command.ts) under a new trigger type, rather than a new ticket-creation path.',
        ],
      },

      { type: 'heading', level: 2, content: '4. A docs pipeline: generate this same site for any repo' },
      {
        type: 'paragraph',
        content:
          'This site (agent-ops-docs) was hand-built in one session: survey the repo, extract its architecture/integrations/env vars/CI-CD into typed page data, and wire it into the Header/Sidebar/ContentArea/CodePanel components ported from the OpenHands docs-site reference. This idea turns that process into a repeatable pipeline — point it at a new repo and get the same styled docs site back, instead of another bespoke session.',
      },
      {
        type: 'list',
        items: [
          'The shell is already repo-agnostic — Header/Sidebar/ContentArea/CodePanel and index.css don\'t reference agent-ops anywhere specific and could be lifted into a shared template as-is.',
          'The hard part is the content-generation step: reading a repo\'s code and docs and writing accurate PageContent objects is a judgment-heavy task, not a mechanical extraction — this would need to become a real skill (prompted, reviewed output) rather than a script.',
          'Worth deciding whether output is TS data files (this site\'s approach — fast, needs a build step) or something else if the target repo doesn\'t already have a Node toolchain to build against.',
        ],
      },
    ],
  },
};

import type { PageContent } from '../pages';

export const architecturePages: Record<string, PageContent> = {
  '/architecture': {
    title: 'Architecture',
    description:
      'Three structural principles and the patterns that implement them, run through the whole codebase.',
    route: '/architecture',
    sections: [
      { type: 'heading', level: 2, content: 'Three structural principles' },
      {
        type: 'list',
        items: [
          'Model-agnostic by config, not code — every LLM call goes through the LiteLLM gateway by model alias, never a literal model name. Swapping the model behind a pipeline or task is a one-line config edit.',
          'One integration per surface, parameterized per project — one orchestrator, one MCP server, one skill-folder pattern, one CI workflow. Each project is a registry entry, not a forked copy of the pipeline.',
          'Auth and observability are day-one concerns — every endpoint is authenticated from the start (per-surface credentials, not one shared secret everywhere), and structured logging with a correlation ID threads every request.',
        ],
      },
      {
        type: 'diagram',
        content: `flowchart TD
  T["Triggers: GH label, @mention, chat command, HTTP /trigger"] --> O
  O["Orchestrator: routing, registry lookup, auth, structured logging"] --> DP["Dev ticket pipeline (per app repo)"]
  O --> PP["Personal pipeline (per personal project)"]
  DP --> AL["Shared agent layer: LiteLLM gateway, Claude Code, skills repo"]
  PP --> AL`,
        caption: 'One orchestrator process routes to either pipeline based on which MCP tool / registry entry the trigger targets.',
      },
      { type: 'heading', level: 2, content: 'The two-tier adapter/provider dispatch pattern' },
      {
        type: 'paragraph',
        content:
          'The single most-reused pattern in this codebase. Reused four times: scraping adapters (linkedin/glassdoor/indeed/generic-*), API sourcing providers (jsearch), scrapeAny search providers (serpapi/claude_web_search/jsearch), and — architecturally — the dev-vs-personal registry split itself. Each instance is the same shape: a TypeScript union type naming the valid options, one small adapter module per option implementing a shared interface, and a resolver function that dispatches by name (explicit override first, then a sensible default) to the matching module. Adding a new option never touches an existing adapter module — only a new file plus one new case in the resolver and the union type.',
      },
      {
        type: 'callout',
        variant: 'info',
        content:
          'This pattern is the concrete answer to "how do I add a new strategy?" — see the Sourcing & Discovery section for three worked walkthroughs (new scraping adapter, new API provider, new search provider).',
      },
      { type: 'heading', level: 2, content: 'Registry-default with per-call override' },
      {
        type: 'paragraph',
        content:
          'Every configurable axis (sourcing_method, strategy, search_provider, api_provider, scraping_adapter, resume_source, cover_letter_source) has a default set in the project\'s registry entry (registry/personal/projects.yaml), and every axis can be overridden per call by passing the camelCase equivalent field in the MCP tool call or /trigger body. Resolution happens once per request in dispatchPersonalPipeline — the registry default and the call override are never both live at once for the same field.',
      },
      { type: 'heading', level: 2, content: 'LiteLLM: the model-agnostic gateway' },
      {
        type: 'paragraph',
        content:
          'An open-source (MIT), self-hosted proxy that puts one OpenAI-compatible endpoint in front of 100+ model providers. The orchestrator and every agent call a model alias (e.g. "planning", "implementation") defined in litellm/config.yaml — never a literal model name. Repointing an alias to a different underlying model is a one-line config change with zero pipeline code touched.',
      },
      { type: 'heading', level: 2, content: 'MCP server as the platform-agnostic chat front end' },
      {
        type: 'paragraph',
        content:
          'integrations/mcp_server.ts exposes the same tool set (create_ticket, check_status, request_approval, run_development_project_pipeline, run_personal_project_pipeline, scaffold_project) regardless of which chat client calls it. Every MCP tool call forwards to POST /webhook/mcp (triggers/chat_command.ts), so chat-originated and curl-originated requests go through the identical auth/logging/dispatch path — there is no separate code path for "came from chat" vs "came from a script".',
      },
      { type: 'heading', level: 2, content: 'GitHub App auth, not a PAT' },
      {
        type: 'paragraph',
        content:
          'A single custom GitHub App (pipeline-orchestrator-opps) is installed twice: once on the heyitschloe personal account (covers the personal pipeline + the-store + extensions) and once on the 11thandOrange organization (covers dev-pipeline app repos). Each installation has its own installation ID; the orchestrator mints short-lived installation tokens on demand rather than using a long-lived PAT. Dispatching to the wrong installation ID 404s outright, which is why personalPipelineDeps carries its own installationId that overrides the outer dev-pipeline one.',
      },
      { type: 'heading', level: 2, content: 'Control-repo pattern' },
      {
        type: 'paragraph',
        content:
          'agent-ops itself holds no application code being shipped by the pipelines it runs — it holds the orchestrator, the LiteLLM config, and every skill (both dev and personal). Registry entries under registry/development/ and registry/personal/ point at target repos/projects; onboarding a new one is a scaffold_project call (a skill, not a static template), not a copy-paste of pipeline code into a new repo.',
      },
    ],
    codeExamples: [
      {
        language: 'yaml',
        label: 'litellm/config.yaml — model alias, not a literal model name',
        code: `model_list:
  # planning/implementation currently point at gemini-2.5-flash — a
  # temporary workaround (gemini-2.5-pro's free-tier quota is 0 on this
  # key). Swapping to Claude once ANTHROPIC_API_KEY lands is a matter of
  # uncommenting the block below, nothing downstream changes.
  - model_name: planning
    litellm_params:
      model: gemini/gemini-2.5-flash
      api_key: os.environ/GEMINI_API_KEY
  - model_name: implementation
    litellm_params:
      model: gemini/gemini-2.5-flash
      api_key: os.environ/GEMINI_API_KEY
  - model_name: classification
    litellm_params:
      model: ollama/qwen2.5-coder:7b
      api_base: http://localhost:11434

  # - model_name: planning
  #   litellm_params:
  #     model: anthropic/claude-opus-4-8
  #     api_key: os.environ/ANTHROPIC_API_KEY`,
      },
    ],
  },
};

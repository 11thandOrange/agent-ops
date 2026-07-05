// The MCP server (roadmap Phase 6): wraps the orchestrator's job functions
// as tools for any MCP-capable chat client. Tool calls are forwarded to
// POST /webhook/mcp so chat-originated requests go through the same
// auth/logging/dispatch path as every other trigger (§5.1).
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Express, Request, Response } from "express";
import { z } from "zod";

export interface McpBridgeConfig {
  orchestratorUrl: string; // e.g. "http://localhost:3000"
  sharedSecret: string;
}

async function callOrchestrator(config: McpBridgeConfig, body: unknown): Promise<unknown> {
  const res = await fetch(`${config.orchestratorUrl}/webhook/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-orchestrator-secret": config.sharedSecret },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`orchestrator call failed: ${res.status} ${JSON.stringify(json)}`);
  return json;
}

function textResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }] };
}

export function buildMcpServer(config: McpBridgeConfig): McpServer {
  const server = new McpServer({ name: "agent-ops", version: "0.1.0" });

  server.registerTool(
    "create_ticket",
    {
      title: "Create ticket",
      description: "File a new ticket on a registered app repo",
      inputSchema: { repo: z.string().describe("owner/repo"), title: z.string(), body: z.string(), requestedBy: z.string() },
    },
    async (args) => textResult(await callOrchestrator(config, { tool: "create_ticket", ...args })),
  );

  server.registerTool(
    "check_status",
    {
      title: "Check status",
      description: "Status of any registered job/ticket",
      inputSchema: { repo: z.string(), issueNumber: z.number().int().positive() },
    },
    async (args) => textResult(await callOrchestrator(config, { tool: "check_status", ...args })),
  );

  server.registerTool(
    "request_approval",
    {
      title: "Request approval",
      description: "Apply the 'approved' label (or equivalent) to move a ticket to implementation",
      inputSchema: { repo: z.string(), issueNumber: z.number().int().positive(), requestedBy: z.string() },
    },
    async (args) => textResult(await callOrchestrator(config, { tool: "request_approval", ...args })),
  );

  const documentSourceSchema = z.union([
    z.object({ mode: z.literal("gdrive_link"), gdrive_link: z.string() }),
    z.object({ mode: z.literal("generated_pdf") }),
  ]);
  const jobCriteriaSchema = z.object({
    title: z.string().optional(),
    location: z.string().optional(),
    remote: z.boolean().optional(),
    salaryMin: z.number().optional(),
    salaryMax: z.number().optional(),
    skills: z.array(z.string()).optional(),
    keywords: z.array(z.string()).optional(),
    websites: z.array(z.string()).optional().describe("biases scrapeAny's search query — not an allowlist, results aren't restricted to these sites"),
    datePostedAfter: z.string().optional().describe("ISO date"),
    company: z.string().optional(),
    whitelist: z.record(z.array(z.string())).optional().describe("field name -> values that must appear"),
    blacklist: z.record(z.array(z.string())).optional().describe("field name -> values that must NOT appear"),
  });

  server.registerTool(
    "run_development_project_pipeline",
    {
      title: "Run development project pipeline",
      description: "Dispatches a plan or implement run for a registered dev project (GitHub Actions, via repository_dispatch).",
      inputSchema: {
        repo: z.string().describe("owner/repo"),
        issueNumber: z.number().int().positive(),
        action: z.enum(["plan", "implement"]),
        requestedBy: z.string(),
      },
    },
    async (args) => textResult(await callOrchestrator(config, { tool: "run_development_project_pipeline", ...args })),
  );

  server.registerTool(
    "run_personal_project_pipeline",
    {
      title: "Run personal project pipeline",
      description:
        "Runs a registered personal project directly (no CI runner — the orchestrator executes it). " +
        "strategy scrapeOne: request is a pasted posting or its URL, one application produced. " +
        "scrapeAll: request is a job-site URL to crawl, up to maxResults applications produced from matches. " +
        "scrapeAny: request is ignored, criteria drives an open web search (no site allowlist), up to maxResults applications produced — " +
        "searchProvider picks which search API/tool runs that discovery: serpapi (REST search API) or claude_web_search (Anthropic's server-side web_search tool, no separate search vendor needed). " +
        "sourcing_method scraping uses scrapingAdapter (or auto-detects from the URL's hostname) to pick how the posting text is extracted: linkedin/glassdoor/indeed are named adapters, generic-one-page-app/generic-multistep-app are fallbacks for any other site (e.g. a posting on a company's own careers site).",
      inputSchema: {
        project: z.string().describe("the registry project name"),
        request: z.string(),
        requestedBy: z.string(),
        sourcingMethod: z.enum(["scraping", "api", "manual"]).optional().describe("overrides the registry's default for this call"),
        resumeSource: documentSourceSchema.optional().describe("overrides the registry's resume_source for this call"),
        coverLetterSource: documentSourceSchema.optional().describe("overrides the registry's cover_letter_source for this call"),
        strategy: z.enum(["scrapeOne", "scrapeAll", "scrapeAny"]).optional().describe("overrides the registry's default for this call"),
        criteria: jobCriteriaSchema.optional().describe("scrapeAll/scrapeAny only — filters candidate postings"),
        maxResults: z.number().int().positive().optional().describe("scrapeAll/scrapeAny only — caps applications produced, overrides the registry default"),
        searchProvider: z
          .enum(["serpapi", "claude_web_search"])
          .optional()
          .describe("scrapeAny only — which search provider discovers candidates, overrides the registry's search_provider default"),
        scrapingAdapter: z
          .enum(["linkedin", "glassdoor", "indeed", "generic-one-page-app", "generic-multistep-app"])
          .optional()
          .describe("sourcing_method scraping only — overrides the registry's scraping_adapter default, or the URL-based auto-detection if neither is set"),
      },
    },
    async (args) => textResult(await callOrchestrator(config, { tool: "run_personal_project_pipeline", ...args })),
  );

  server.registerTool(
    "scaffold_project",
    {
      title: "Scaffold project",
      description: "Onboard a new dev or personal project: generates its skill file, registry entry, and (for dev projects) caller workflow",
      inputSchema: {
        name: z.string(),
        type: z.enum(["dev", "personal"]),
        repo: z.string().optional(),
        appliesTo: z.array(z.string()).optional().describe("dev only; defaults to [repo:<repo>] if omitted"),
      },
    },
    async (args) => textResult(await callOrchestrator(config, { tool: "scaffold_project", ...args })),
  );

  return server;
}

/** Mounts the MCP server on the orchestrator's Express app at the given path (roadmap Phase 6, step 2). */
export function mountMcpHttp(app: Express, path: string, config: McpBridgeConfig): void {
  app.all(path, async (req: Request, res: Response) => {
    const server = buildMcpServer(config);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      void transport.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });
}

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

  server.registerTool(
    "run_project_pipeline",
    {
      title: "Run project pipeline",
      description:
        "Generic entry point for any registered dev or personal project — dispatches by project, not by a per-project tool. " +
        "Dev projects: pass repo, issueNumber, action. Personal projects: pass project, request (and optionally sourcingMethod/resumeSource/coverLetterSource to override the registry defaults for this call).",
      inputSchema: {
        // Dev shape.
        repo: z.string().optional().describe("dev only — owner/repo"),
        issueNumber: z.number().int().positive().optional().describe("dev only"),
        action: z.enum(["plan", "implement"]).optional().describe("dev only"),
        // Personal shape.
        project: z.string().optional().describe("personal only — the registry project name"),
        request: z.string().optional().describe("personal only — free text: a pasted posting, a URL, or a query, depending on sourcing method"),
        sourcingMethod: z.enum(["scraping", "api", "manual"]).optional().describe("personal only — overrides the registry's default for this call"),
        resumeSource: z
          .union([z.object({ mode: z.literal("gdrive_link"), gdrive_link: z.string() }), z.object({ mode: z.literal("generated_pdf") })])
          .optional()
          .describe("personal only — overrides the registry's resume_source for this call"),
        coverLetterSource: z
          .union([z.object({ mode: z.literal("gdrive_link"), gdrive_link: z.string() }), z.object({ mode: z.literal("generated_pdf") })])
          .optional()
          .describe("personal only — overrides the registry's cover_letter_source for this call"),
        requestedBy: z.string(),
      },
    },
    async (args) => textResult(await callOrchestrator(config, { tool: "run_project_pipeline", ...args })),
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

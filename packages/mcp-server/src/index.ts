#!/usr/bin/env node

/**
 * @enactprotocol/mcp-server
 *
 * MCP protocol server for Enact tool integration.
 * Exposes Enact tools as native MCP tools for AI agents.
 *
 * Supports two transport modes:
 *   - stdio (default): For local integrations (Claude Desktop, etc.)
 *   - Streamable HTTP (--http): For remote/web integrations
 *
 * @see https://modelcontextprotocol.io/specification/2025-03-26/basic/transports
 */

import { randomUUID } from "node:crypto";
import { type IncomingMessage, type ServerResponse, createServer } from "node:http";
import { DaggerExecutionProvider } from "@enactprotocol/execution";
import {
  type ToolManifest,
  applyDefaults,
  getActiveToolset,
  getMcpToolInfo,
  listMcpTools,
  loadManifestFromDir,
  validateInputs,
} from "@enactprotocol/shared";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";

export const version = "2.0.2";

/** Default HTTP port for streamable HTTP transport */
const DEFAULT_HTTP_PORT = 3000;

/** Convert Enact tool name to MCP-compatible name (replace slashes with double underscores) */
function toMcpName(enactName: string): string {
  return enactName.replace(/\//g, "__");
}

/** Convert MCP tool name back to Enact format */
function fromMcpName(mcpName: string): string {
  return mcpName.replace(/__/g, "/");
}

/**
 * Convert Enact JSON Schema to MCP tool input schema
 */
function convertInputSchema(manifest: ToolManifest): Tool["inputSchema"] {
  if (!manifest.inputSchema) {
    return {
      type: "object",
      properties: {},
    };
  }

  // Return the inputSchema directly - it should already be JSON Schema compatible
  return manifest.inputSchema as Tool["inputSchema"];
}

/**
 * Create and configure the MCP server with Enact tool handlers
 */
function createMcpServer(): Server {
  const server = new Server(
    {
      name: "enact-mcp-server",
      version: version,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List all MCP-exposed tools (respects active toolset)
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const mcpTools = listMcpTools();
    const activeToolset = getActiveToolset();

    const tools: Tool[] = mcpTools.map((tool) => {
      const loaded = loadManifestFromDir(tool.cachePath);
      const manifest = loaded?.manifest;

      const description = manifest?.description || `Enact tool: ${tool.name}`;
      const toolsetNote = activeToolset ? ` [toolset: ${activeToolset}]` : "";

      return {
        name: toMcpName(tool.name),
        description: description + toolsetNote,
        inputSchema: manifest ? convertInputSchema(manifest) : { type: "object", properties: {} },
      };
    });

    return { tools };
  });

  // Execute tool requests
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const mcpToolName = request.params.name;
    const enactToolName = fromMcpName(mcpToolName);
    const args = (request.params.arguments as Record<string, unknown>) || {};

    // Find the tool in MCP registry (respects active toolset)
    const toolInfo = getMcpToolInfo(enactToolName);

    if (!toolInfo) {
      const activeToolset = getActiveToolset();
      const toolsetHint = activeToolset
        ? ` It may not be in the active toolset '${activeToolset}'.`
        : "";
      return {
        content: [
          {
            type: "text",
            text: `Error: Tool "${enactToolName}" not found.${toolsetHint} Use 'enact mcp add <tool>' to add it.`,
          },
        ],
        isError: true,
      };
    }

    // Load manifest
    const loaded = loadManifestFromDir(toolInfo.cachePath);
    if (!loaded) {
      return {
        content: [
          {
            type: "text",
            text: `Error: Failed to load manifest for "${enactToolName}"`,
          },
        ],
        isError: true,
      };
    }

    const manifest = loaded.manifest;

    // Check if this is an instruction-based tool (no command)
    if (!manifest.command) {
      // Return the documentation/instructions for LLM interpretation
      const instructions = manifest.doc || manifest.description || "No instructions available.";
      return {
        content: [
          {
            type: "text",
            text: `[Instruction Tool: ${enactToolName}]\n\n${instructions}\n\nInputs provided: ${JSON.stringify(args, null, 2)}`,
          },
        ],
      };
    }

    // Apply defaults and validate inputs
    const inputsWithDefaults = manifest.inputSchema
      ? applyDefaults(args, manifest.inputSchema)
      : args;

    const validation = validateInputs(inputsWithDefaults, manifest.inputSchema);
    if (!validation.valid) {
      const errors = validation.errors.map((err) => `${err.path}: ${err.message}`).join(", ");
      return {
        content: [
          {
            type: "text",
            text: `Input validation failed: ${errors}`,
          },
        ],
        isError: true,
      };
    }

    const finalInputs = validation.coercedValues ?? inputsWithDefaults;

    // Execute the tool using Dagger
    const provider = new DaggerExecutionProvider({
      verbose: false,
    });

    try {
      await provider.initialize();

      const result = await provider.execute(
        manifest,
        {
          params: finalInputs,
          envOverrides: {},
        },
        {
          mountDirs: {
            [toolInfo.cachePath]: "/workspace",
          },
        }
      );

      if (result.success) {
        return {
          content: [
            {
              type: "text",
              text: result.output?.stdout || "Tool executed successfully (no output)",
            },
          ],
        };
      }
      return {
        content: [
          {
            type: "text",
            text: `Tool execution failed: ${result.error?.message || "Unknown error"}\n\n${result.output?.stderr || ""}`,
          },
        ],
        isError: true,
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `Tool execution error: ${err instanceof Error ? err.message : "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

/**
 * Start server with stdio transport (default mode)
 */
async function startStdioServer(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Enact MCP Server running on stdio");
}

/**
 * Start server with Streamable HTTP transport
 */
async function startHttpServer(port: number): Promise<void> {
  const server = createMcpServer();

  // Track sessions for stateful mode
  const sessions = new Map<string, StreamableHTTPServerTransport>();

  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // Enable CORS for browser-based clients
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Mcp-Session-Id");
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");

    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    // Only handle /mcp endpoint
    const url = new URL(req.url || "/", `http://localhost:${port}`);
    if (url.pathname !== "/mcp") {
      // Health check endpoint
      if (url.pathname === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", version }));
        return;
      }

      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not Found", path: url.pathname }));
      return;
    }

    // Get or create session
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (sessionId && sessions.has(sessionId)) {
      // Existing session
      const transport = sessions.get(sessionId)!;
      await transport.handleRequest(req, res);
    } else if (req.method === "POST") {
      // New session - create transport
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
      });

      // Set up cleanup on close
      transport.onclose = () => {
        if (transport.sessionId) {
          sessions.delete(transport.sessionId);
        }
      };

      // Connect server to transport (cast to satisfy exactOptionalPropertyTypes)
      await server.connect(transport as Parameters<typeof server.connect>[0]);

      // Handle the request
      await transport.handleRequest(req, res);

      // Store session if one was created
      if (transport.sessionId) {
        sessions.set(transport.sessionId, transport);
      }
    } else if (req.method === "DELETE" && sessionId) {
      // Session termination request for unknown session
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Session not found" }));
    } else {
      // Invalid request
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ error: "Bad Request", message: "Invalid request for MCP endpoint" })
      );
    }
  });

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.error("\nShutting down...");
    for (const transport of sessions.values()) {
      await transport.close();
    }
    httpServer.close();
    process.exit(0);
  });

  httpServer.listen(port, () => {
    console.error(`Enact MCP Server running on http://localhost:${port}/mcp`);
    console.error(`Health check: http://localhost:${port}/health`);
    console.error("\nSupported endpoints:");
    console.error("  POST /mcp - JSON-RPC requests");
    console.error("  GET  /mcp - SSE stream for server notifications");
    console.error("  DELETE /mcp - Terminate session");
  });
}

/**
 * Parse command line arguments
 */
function parseArgs(): { http: boolean; port: number } {
  const args = process.argv.slice(2);
  let http = false;
  let port = DEFAULT_HTTP_PORT;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--http") {
      http = true;
    } else if (arg === "--port" || arg === "-p") {
      const nextArg = args[i + 1];
      if (nextArg) {
        port = Number.parseInt(nextArg, 10);
        i++;
      }
    } else if (arg?.startsWith("--port=")) {
      port = Number.parseInt(arg.split("=")[1] || String(DEFAULT_HTTP_PORT), 10);
    }
  }

  return { http, port };
}

// Main entry point for MCP server
if (import.meta.main) {
  const { http, port } = parseArgs();

  if (http) {
    await startHttpServer(port);
  } else {
    await startStdioServer();
  }
}

// Export for programmatic use
export { createMcpServer, startStdioServer, startHttpServer };

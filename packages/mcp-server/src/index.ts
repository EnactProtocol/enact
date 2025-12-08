#!/usr/bin/env node

/**
 * @enactprotocol/mcp-server
 *
 * MCP protocol server for Enact tool integration.
 * Exposes Enact tools as native MCP tools for AI agents.
 */

import { listInstalledTools, loadManifestFromDir } from "@enactprotocol/shared";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

export const version = "0.1.0";

// Main entry point for MCP server
if (import.meta.main) {
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

  // List all installed tools (global scope)
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const installedTools = listInstalledTools("global");

    const tools = installedTools.map((tool) => {
      const loaded = loadManifestFromDir(tool.cachePath);

      return {
        name: tool.name.replace(/\//g, "_"), // Replace slashes for MCP compatibility
        description: loaded?.manifest.description || `Enact tool: ${tool.name}`,
        inputSchema: {
          type: "object",
          properties: {
            args: {
              type: "string",
              description: "JSON string of arguments to pass to the tool",
            },
          },
        },
      };
    });

    return { tools };
  });

  // Execute tool requests
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name.replace(/_/g, "/"); // Convert back to original format
    const args = (request.params.arguments?.args as string) || "{}";

    // For now, return a placeholder - actual execution would use @enactprotocol/execution
    return {
      content: [
        {
          type: "text",
          text: `Tool ${toolName} would execute with args: ${args}\n\nNote: Full execution integration coming in Phase 4`,
        },
      ],
    };
  });

  // Start the server
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Enact MCP Server running on stdio");
}

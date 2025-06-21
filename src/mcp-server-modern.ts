// src/mcp-server-modern.ts - Modern MCP server using latest SDK patterns
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { EnactCore } from "./core/EnactCore";
import logger from './exec/logger';

// Initialize core library
const enactCore = new EnactCore({
  apiUrl: process.env.ENACT_API_URL || 'https://enact.tools',
  supabaseUrl: process.env.ENACT_SUPABASE_URL || 'https://xjnhhxwxovjifdxdwzih.supabase.co',
  executionProvider: 'direct',
  verificationPolicy: (process.env.ENACT_VERIFY_POLICY as any) || 'permissive',
  authToken: process.env.ENACT_AUTH_TOKEN
});

const server = new McpServer({
  name: "enact-mcp-server",
  version: "3.0.0-direct",
}, {
  capabilities: {
    logging: {
      level: "debug",
    }
  }
});

// Helper function for safe JSON stringification
function safeJsonStringify(obj: any, fallback: string = "Unable to stringify object"): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (error) {
    logger.error(`JSON stringify failed: ${error instanceof Error ? error.message : String(error)}`);
    return fallback;
  }
}

// Execute tool by name - modern API
server.registerTool(
  "execute-tool-by-name",
  {
    title: "Execute Enact Tool",
    description: "Execute an Enact tool by its name using direct core integration",
    inputSchema: {
      name: z.string().describe("Name of the tool to execute"), 
      inputs: z.record(z.any()).optional().describe("Input parameters for the tool"),
      timeout: z.string().optional().describe("Execution timeout"),
      verifyPolicy: z.enum(['permissive', 'enterprise', 'paranoid']).optional().describe("Verification policy"),
      skipVerification: z.boolean().optional().describe("Skip signature verification"),
      force: z.boolean().optional().describe("Force execution"),
      dryRun: z.boolean().optional().describe("Dry run mode"),
      verbose: z.boolean().optional().describe("Verbose output")
    }
  },
  async (params) => {
    const { name, inputs = {}, timeout, verifyPolicy, skipVerification, force, dryRun, verbose } = params;
    
    try {
      logger.info(`Executing tool ${name} via direct core library`);
      
      const result = await enactCore.executeToolByName(name, inputs, {
        timeout,
        verifyPolicy,
        skipVerification,
        force,
        dryRun,
        verbose
      });
      
      if (!result.success) {
        return {
          content: [{ 
            type: "text", 
            text: `Error executing tool ${name}: ${result.error?.message}` 
          }],
          isError: true
        };
      }
      
      return {
        content: [{ 
          type: "text", 
          text: `Successfully executed tool ${name}\nOutput: ${safeJsonStringify(result)}` 
        }]
      };
    } catch (error) {
      logger.error(`Error executing tool:`, error);
      return {
        content: [{ 
          type: "text", 
          text: `Internal error executing tool: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// Search tools - modern API
server.registerTool(
  "enact-search-tools",
  {
    title: "Search Enact Tools",
    description: "Search tools in the Enact ecosystem using direct core integration",
    inputSchema: {
      query: z.string().describe("Search query for tools"),
      limit: z.number().optional().describe("Maximum number of results"),
      tags: z.array(z.string()).optional().describe("Filter by tags"),
      author: z.string().optional().describe("Filter by author"),
      format: z.enum(['json', 'table', 'list']).optional().describe("Output format")
    }
  },
  async (params) => {
    const { query, limit, tags, author, format } = params;
    
    try {
      logger.info(`Searching tools via direct core library: "${query}"`);
      
      const tools = await enactCore.searchTools({
        query,
        limit,
        tags,
        author,
        format
      });
      
      logger.info(`Found ${tools.length} tools matching query "${query}"`);
      
      return {
        content: [{ 
          type: "text", 
          text: `Found ${tools.length} tools matching query "${query}":\n${safeJsonStringify(tools)}` 
        }]
      };
    } catch (error) {
      logger.error("Error searching tools:", error);
      return {
        content: [{ 
          type: "text", 
          text: `Error searching tools: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// Get tool information - modern API
server.registerTool(
  "enact-get-tool-info",
  {
    title: "Get Tool Info", 
    description: "Get detailed information about a specific tool using direct core integration",
    inputSchema: {
      name: z.string().describe("Name of the tool"), 
      version: z.string().optional().describe("Version of the tool")
    }
  },
  async (params) => {
    const { name, version } = params;
    
    try {
      logger.info(`Getting tool info via direct core library: ${name}`);
      
      const tool = await enactCore.getToolByName(name, version);
      
      if (!tool) {
        return {
          content: [{ 
            type: "text", 
            text: `Tool not found: ${name}` 
          }],
          isError: true
        };
      }
      
      return {
        content: [{ 
          type: "text", 
          text: `Tool Information:\n${safeJsonStringify(tool)}` 
        }]
      };
    } catch (error) {
      logger.error("Error getting tool info:", error);
      return {
        content: [{ 
          type: "text", 
          text: `Error getting tool info: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// Start the server
async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logger.info("🚀 Enact MCP Server with Direct Core Integration started successfully");
    logger.info("🎯 This server uses direct in-process execution - no CLI spawning!");
  } catch (error) {
    console.error("Server connection error:", error);
    if (error instanceof Error) {
      console.error("Stack trace:", error.stack);
    }
    process.exit(1);
  }
}

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
  });
}

export { server, enactCore };

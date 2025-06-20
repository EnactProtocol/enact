// example-mcp-server.ts - Example of how to use Enact directly in your MCP server
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { EnactDirect } from "./src/lib/enact-direct";

// Initialize Enact direct library
const enact = new EnactDirect({
  apiUrl: process.env.ENACT_API_URL,
  authToken: process.env.ENACT_AUTH_TOKEN,
  verificationPolicy: 'permissive' // or 'enterprise' / 'paranoid'
});

const server = new McpServer({
  name: "your-mcp-server-with-enact",
  version: "1.0.0",
}, {
  capabilities: {
    logging: { level: "debug" }
  }
});

// Example: Execute any Enact tool directly
server.tool(
  "execute-enact-tool",
  "Execute any Enact tool by name with inputs",
  {
    toolName: z.string().describe("Name of the Enact tool to execute"),
    inputs: z.record(z.any()).optional().describe("Input parameters for the tool"),
    dryRun: z.boolean().optional().describe("Validate but don't execute"),
    skipVerification: z.boolean().optional().describe("Skip signature verification")
  },
  async (params) => {
    try {
      const { toolName, inputs = {}, dryRun, skipVerification } = params;
      
      const result = await enact.executeToolByName(toolName, inputs, {
        dryRun,
        skipVerification,
        verbose: true
      });
      
      if (!result.success) {
        return {
          content: [{ 
            type: "text", 
            text: `❌ Tool execution failed: ${result.error?.message}` 
          }],
          isError: true
        };
      }
      
      return {
        content: [{ 
          type: "text", 
          text: `✅ Tool executed successfully!\n\nResult:\n${JSON.stringify(result, null, 2)}` 
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: `❌ Error: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// Example: Search for tools
server.tool(
  "search-enact-tools",
  "Search for Enact tools",
  {
    query: z.string().describe("Search query"),
    limit: z.number().optional().describe("Maximum results"),
    tags: z.array(z.string()).optional().describe("Filter by tags")
  },
  async (params) => {
    try {
      const { query, limit, tags } = params;
      
      const tools = await enact.searchTools({
        query,
        limit,
        tags
      });
      
      return {
        content: [{ 
          type: "text", 
          text: `🔍 Found ${tools.length} tools:\n\n${JSON.stringify(tools, null, 2)}` 
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: `❌ Search error: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// Example: Tool information
server.tool(
  "get-enact-tool-info",
  "Get detailed information about a specific Enact tool",
  {
    toolName: z.string().describe("Name of the tool"),
    includeVerification: z.boolean().optional().describe("Include signature verification")
  },
  async (params) => {
    try {
      const { toolName, includeVerification } = params;
      
      const tool = await enact.getToolInfo(toolName);
      
      if (!tool) {
        return {
          content: [{ 
            type: "text", 
            text: `❌ Tool not found: ${toolName}` 
          }],
          isError: true
        };
      }
      
      let result = `ℹ️ Tool Information:\n\n${JSON.stringify(tool, null, 2)}`;
      
      if (includeVerification) {
        const verification = await enact.verifyTool(toolName);
        result += `\n\n🔐 Signature Verification:\n${JSON.stringify(verification, null, 2)}`;
      }
      
      return {
        content: [{ 
          type: "text", 
          text: result 
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: `❌ Error: ${error instanceof Error ? error.message : String(error)}` 
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
    console.log("🚀 MCP Server with Enact Direct Integration started!");
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { server, enact };

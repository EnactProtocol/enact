// src/mcp-direct.ts - Simplified direct MCP server without CLI spawning
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { EnactCore } from "./core/EnactCore";
import logger from './exec/logger';

// Initialize core library directly
const enactCore = new EnactCore({
  apiUrl: process.env.ENACT_API_URL || 'https://enact.tools',
  supabaseUrl: process.env.ENACT_SUPABASE_URL || 'https://xjnhhxwxovjifdxdwzih.supabase.co',
  executionProvider: 'direct',
  verificationPolicy: (process.env.ENACT_VERIFY_POLICY as any) || 'permissive',
  authToken: process.env.ENACT_AUTH_TOKEN
});

const server = new McpServer({
  name: "enact-mcp-server-direct",
  version: "3.0.0-direct",
}, {
  capabilities: {
    logging: {
      level: "debug",
    }
  }
});

// Set logger to use server logging if available
if (logger.setServer) {
  logger.setServer(server as any);
}

// Helper function for safe JSON stringification
function safeJsonStringify(obj: any, fallback: string = "Unable to stringify object"): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (error) {
    logger.error(`JSON stringify failed: ${error instanceof Error ? error.message : String(error)}`);
    return fallback;
  }
}

// Execute tool by name - the main function your MCP server needs
server.tool(
  "execute-tool-by-name", 
  "Execute an Enact tool by its name using direct core integration (no CLI spawning)",
  { 
    name: z.string().describe("Name of the tool to execute"), 
    inputs: z.record(z.any()).optional().describe("Input parameters for the tool"),
    timeout: z.string().optional().describe("Execution timeout (e.g., '30s', '5m')"),
    verifyPolicy: z.enum(['permissive', 'enterprise', 'paranoid']).optional().describe("Signature verification policy"),
    skipVerification: z.boolean().optional().describe("Skip signature verification"),
    force: z.boolean().optional().describe("Force execution even if unsafe"),
    dryRun: z.boolean().optional().describe("Validate but don't execute"),
    verbose: z.boolean().optional().describe("Enable verbose logging")
  },
  async (params) => {
    const { name, inputs = {}, timeout, verifyPolicy, skipVerification, force, dryRun, verbose } = params;
    
    try {
      logger.info(`🚀 Executing tool ${name} via direct core library (no CLI spawning)`);
      
      const result = await enactCore.executeToolByName(name, inputs, {
        timeout,
        verifyPolicy,
        skipVerification,
        force,
        dryRun,
        verbose
      });
      
      if (!result.success) {
        logger.error(`❌ Tool execution failed: ${result.error?.message}`);
        return {
          content: [{ 
            type: "text", 
            text: `❌ Error executing tool ${name}: ${result.error?.message}` 
          }],
          isError: true
        };
      }
      
      logger.info(`✅ Tool ${name} executed successfully`);
      return {
        content: [{ 
          type: "text", 
          text: `✅ Successfully executed tool ${name}\n\nOutput:\n${safeJsonStringify(result)}` 
        }]
      };
    } catch (error) {
      logger.error(`❌ Internal error executing tool:`, error);
      return {
        content: [{ 
          type: "text", 
          text: `❌ Internal error executing tool: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// Search tools
server.tool(
  "enact-search-tools",
  "Search tools in the Enact ecosystem using direct core integration",
  { 
    query: z.string().describe("Search query for tools"),
    limit: z.number().optional().describe("Maximum number of results"),
    tags: z.array(z.string()).optional().describe("Filter by tags"),
    author: z.string().optional().describe("Filter by author"),
    format: z.enum(['json', 'table', 'list']).optional().describe("Output format")
  },
  async (params) => {
    const { query, limit, tags, author, format } = params;
    
    try {
      logger.info(`🔍 Searching tools via direct core library: "${query}"`);
      
      const tools = await enactCore.searchTools({
        query,
        limit,
        tags,
        author,
        format
      });
      
      logger.info(`📦 Found ${tools.length} tools matching query "${query}"`);
      
      return {
        content: [{ 
          type: "text", 
          text: `📦 Found ${tools.length} tools matching query "${query}":\n\n${safeJsonStringify(tools)}` 
        }]
      };
    } catch (error) {
      logger.error("❌ Error searching tools:", error);
      return {
        content: [{ 
          type: "text", 
          text: `❌ Error searching tools: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// Get tool information
server.tool(
  "enact-get-tool-info",
  "Get detailed information about a specific tool",
  { 
    name: z.string().describe("Name of the tool to get info for"), 
    version: z.string().optional().describe("Specific version of the tool"),
    includeSignatureInfo: z.boolean().optional().describe("Include signature verification details")
  },
  async (params) => {
    const { name, version, includeSignatureInfo } = params;
    
    try {
      logger.info(`ℹ️  Getting tool info via direct core library: ${name}`);
      
      const tool = await enactCore.getToolInfo(name, version);
      
      if (!tool) {
        return {
          content: [{ 
            type: "text", 
            text: `❌ Tool not found: ${name}${version ? `@${version}` : ''}` 
          }],
          isError: true
        };
      }
      
      return {
        content: [{ 
          type: "text", 
          text: `ℹ️ Tool information for ${name}:\n\n${safeJsonStringify(tool)}` 
        }]
      };
    } catch (error) {
      logger.error(`❌ Error getting tool info:`, error);
      return {
        content: [{ 
          type: "text", 
          text: `❌ Error getting tool info: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// Verify tool signatures
server.tool(
  "enact-verify-tool",
  "Verify cryptographic signatures of a tool",
  { 
    name: z.string().describe("Name of the tool to verify"),
    policy: z.enum(['permissive', 'enterprise', 'paranoid']).optional().describe("Verification policy")
  },
  async (params) => {
    const { name, policy } = params;
    
    try {
      logger.info(`🔐 Verifying tool signatures via direct core library: ${name} with policy ${policy || 'permissive'}`);
      
      const verificationResult = await enactCore.verifyTool(name, policy);
      
      const statusText = verificationResult.verified ? '✅ VERIFIED' : '❌ FAILED';
      let resultText = `🔐 Tool "${name}" signature verification: ${statusText}\n`;
      resultText += `📋 Policy: ${verificationResult.policy}\n`;
      
      if (verificationResult.signatures && verificationResult.signatures.length > 0) {
        resultText += `📝 Signatures found: ${verificationResult.signatures.length}\n`;
      }
      
      if (verificationResult.errors && verificationResult.errors.length > 0) {
        resultText += `⚠️ Errors: ${verificationResult.errors.join(', ')}\n`;
      }
      
      resultText += `\n📊 Full result:\n${safeJsonStringify(verificationResult)}`;
      
      return {
        content: [{ 
          type: "text", 
          text: resultText
        }],
        isError: !verificationResult.verified
      };
    } catch (error) {
      logger.error(`❌ Error verifying tool:`, error);
      return {
        content: [{ 
          type: "text", 
          text: `❌ Error verifying tool: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// Execute raw tool from YAML
server.tool(
  "execute-raw-tool",
  "Execute an Enact tool from raw YAML definition",
  { 
    yaml: z.string().describe("YAML definition of the tool"),
    inputs: z.record(z.any()).optional().describe("Input parameters for the tool"),
    options: z.record(z.any()).optional().describe("Execution options")
  },
  async (params) => {
    const { yaml: toolYaml, inputs = {}, options = {} } = params;
    
    try {
      logger.info("🔧 Executing raw tool via direct core library");
      
      const result = await enactCore.executeRawTool(toolYaml, inputs, options);
      
      if (!result.success) {
        return {
          content: [{ 
            type: "text", 
            text: `❌ Error executing raw tool: ${result.error?.message}` 
          }],
          isError: true
        };
      }
      
      return {
        content: [{ 
          type: "text", 
          text: `✅ Successfully executed raw tool\n\nOutput:\n${safeJsonStringify(result)}` 
        }]
      };
    } catch (error) {
      logger.error(`❌ Error executing raw tool:`, error);
      return {
        content: [{ 
          type: "text", 
          text: `❌ Internal error executing raw tool: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// Check tool existence
server.tool(
  "enact-tool-exists",
  "Check if a tool exists in the registry",
  { name: z.string().describe("Name of the tool to check") },
  async (params) => {
    const { name } = params;
    
    try {
      logger.info(`🔍 Checking tool existence via direct core library: ${name}`);
      
      const exists = await enactCore.toolExists(name);
      
      return {
        content: [{ 
          type: "text", 
          text: `🔍 Tool "${name}" ${exists ? '✅ exists' : '❌ does not exist'} in the registry.` 
        }]
      };
    } catch (error) {
      logger.error(`❌ Error checking if tool exists:`, error);
      return {
        content: [{ 
          type: "text", 
          text: `❌ Error checking tool existence: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// Get status of direct core integration
server.tool(
  "enact-core-status",
  "Get status and capabilities of the direct core integration",
  {},
  async () => {
    try {
      const status = await enactCore.getStatus();
      
      let statusText = `🎯 Enact Core Direct Integration Status\n`;
      statusText += `=====================================\n\n`;
      statusText += `🔧 Integration Mode: Direct Core Library (no CLI spawning)\n`;
      statusText += `⚡ Execution Provider: ${status.executionProvider}\n`;
      statusText += `🌐 API URL: ${status.apiUrl}\n`;
      statusText += `🔐 Verification Policy: ${status.verificationPolicy}\n`;
      statusText += `⏱️ Default Timeout: ${status.defaultTimeout}\n`;
      statusText += `🔑 Authenticated: ${status.authenticated ? '✅ Yes' : '❌ No'}\n\n`;
      
      statusText += `🚀 Available Features:\n`;
      statusText += `• ✅ Direct tool execution (no CLI process spawning)\n`;
      statusText += `• ✅ Signature verification and validation\n`;
      statusText += `• ✅ Real-time tool search and discovery\n`;
      statusText += `• ✅ Tool structure validation and sanitization\n`;
      statusText += `• ✅ Environment variable management\n`;
      statusText += `• ✅ Raw YAML tool execution\n`;
      statusText += `• ✅ Command safety verification\n`;
      statusText += `• ✅ Output schema validation\n`;
      statusText += `• ✅ Multi-signature support\n\n`;
      
      statusText += `⚡ Performance Benefits:\n`;
      statusText += `• 🚀 No CLI process spawning overhead\n`;
      statusText += `• 🚀 Direct API communication\n`;
      statusText += `• 🚀 Shared state and intelligent caching\n`;
      statusText += `• 🚀 Lower memory footprint\n`;
      statusText += `• 🚀 Faster response times\n`;
      statusText += `• 🚀 Better error handling and logging\n\n`;
      
      statusText += `🔐 Security Features:\n`;
      statusText += `• 🛡️ Cryptographic signature verification\n`;
      statusText += `• 🛡️ Command safety analysis\n`;
      statusText += `• 🛡️ Environment variable sanitization\n`;
      statusText += `• 🛡️ Input/output validation\n`;
      statusText += `• 🛡️ Configurable verification policies\n`;
      
      return {
        content: [{ 
          type: "text", 
          text: statusText
        }]
      };
    } catch (error) {
      logger.error(`❌ Error getting core status:`, error);
      return {
        content: [{ 
          type: "text", 
          text: `❌ Error getting core status: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// Start the server
async function startServer() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logger.info("🚀 Enact MCP Server with Direct Core Integration started successfully");
    logger.info("🎯 This server uses direct in-process execution - no CLI spawning!");
  } catch (error) {
    console.error("❌ Server connection error:", error);
    if (error instanceof Error) {
      console.error("Stack trace:", error.stack);
    }
    process.exit(1);
  }
}

// Export for programmatic use
export { server, enactCore };

// Start the server if this file is run directly
if (require.main === module) {
  startServer().catch((error) => {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  });
}

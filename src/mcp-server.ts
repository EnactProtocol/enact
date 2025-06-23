// src/mcp-server-modern.ts - Modern MCP server using latest SDK patterns
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { EnactCore } from "./core/EnactCore";
import logger from './exec/logger';
import { silentMcpTool, validateSilentEnvironment } from './utils/silent-monitor';

// Set required environment variables for silent operation first
process.env.CI = process.env.CI || 'true';
process.env.ENACT_SKIP_INTERACTIVE = process.env.ENACT_SKIP_INTERACTIVE || 'true';

// Only validate and report environment issues when not in test mode
if (process.env.NODE_ENV !== 'test') {
  const envValidation = validateSilentEnvironment();
  if (!envValidation.valid) {
    // Log to stderr for debugging purposes (only in non-test environments)
    process.stderr.write(`⚠️ MCP Environment Issues: ${envValidation.issues.join(', ')}\n`);
  }
}

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
            text: `❌ Error executing tool ${name}: ${result.error?.message}` 
          }],
          isError: true
        };
      }
      
      return {
        content: [{ 
          type: "text", 
          text: `✅ Successfully executed tool ${name}\nOutput: ${safeJsonStringify(result)}` 
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
          text: `🔍 Found ${tools.length} tools matching query "${query}":\n${safeJsonStringify(tools)}` 
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
      
      const tool = await enactCore.getToolInfo(name, version);
      
      if (!tool) {
        return {
          content: [{ 
            type: "text", 
            text: `Tool not found: ${name}${version ? `@${version}` : ''}` 
          }],
          isError: true
        };
      }
      
      return {
        content: [{ 
          type: "text", 
          text: `ℹ️ Tool Information for ${name}:\n${safeJsonStringify(tool)}` 
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

// Verify tool signatures using core library directly
server.registerTool(
  "enact-verify-tool",
  {
    title: "Verify Tool Signatures",
    description: "Verify cryptographic signatures of a tool using direct core integration",
    inputSchema: {
      name: z.string().describe("Name of the tool to verify"),
      policy: z.enum(['permissive', 'enterprise', 'paranoid']).optional().describe("Verification policy")
    }
  },
  async ({ name, policy }) => {
    try {
      logger.info(`Verifying tool signatures via direct core library: ${name} with policy ${policy || 'permissive'}`);
      
      const verificationResult = await enactCore.verifyTool(name, policy);
      
      const statusText = verificationResult.verified ? 'VERIFIED' : 'FAILED';
      let resultText = `Tool "${name}" signature verification: ${statusText}\n`;
      resultText += `Policy: ${verificationResult.policy}\n`;
      
      if (verificationResult.signatures && verificationResult.signatures.length > 0) {
        resultText += `Signatures found: ${verificationResult.signatures.length}\n`;
      }
      
      if (verificationResult.errors && verificationResult.errors.length > 0) {
        resultText += `Errors: ${verificationResult.errors.join(', ')}\n`;
      }
      
      resultText += `\nFull result:\n${safeJsonStringify(verificationResult)}`;
      
      return {
        content: [{ 
          type: "text", 
          text: resultText
        }],
        isError: !verificationResult.verified
      };
    } catch (error) {
      logger.error(`Error verifying tool:`, error);
      return {
        content: [{ 
          type: "text", 
          text: `Error verifying tool: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// Execute raw tool from YAML definition using core library directly
server.registerTool(
  "execute-raw-tool",
  {
    title: "Execute Raw Tool",
    description: "Execute an Enact tool from raw YAML definition using direct core integration",
    inputSchema: {
      yaml: z.string().describe("YAML definition of the tool"),
      inputs: z.record(z.any()).optional().describe("Input parameters for the tool"),
      options: z.record(z.any()).optional().describe("Execution options")
    }
  },
  async ({ yaml: toolYaml, inputs = {}, options = {} }) => {
    try {
      logger.info("Executing raw tool via direct core library");
      
      const result = await enactCore.executeRawTool(toolYaml, inputs, options);
      
      if (!result.success) {
        return {
          content: [{ 
            type: "text", 
            text: `Error executing raw tool: ${result.error?.message}` 
          }],
          isError: true
        };
      }
      
      return {
        content: [{ 
          type: "text", 
          text: `Successfully executed raw tool\nOutput: ${safeJsonStringify(result)}` 
        }]
      };
    } catch (error) {
      logger.error(`Error executing raw tool:`, error);
      return {
        content: [{ 
          type: "text", 
          text: `Internal error executing raw tool: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// Get all tools using core library directly
server.registerTool(
  "enact-get-tools",
  {
    title: "Get All Tools",
    description: "Get all tools with optional filters using direct core integration",
    inputSchema: {
      limit: z.number().optional().describe("Maximum number of results"),
      offset: z.number().optional().describe("Number of results to skip"),
      tags: z.array(z.string()).optional().describe("Filter by tags"),
      author: z.string().optional().describe("Filter by author")
    }
  },
  async ({ limit, offset, tags, author }) => {
    try {
      logger.info(`Getting tools via direct core library with filters`);
      
      const tools = await enactCore.getTools({ limit, offset, tags, author });
      
      return {
        content: [{ 
          type: "text", 
          text: `Found ${tools.length} tools:\n${safeJsonStringify(tools)}` 
        }]
      };
    } catch (error) {
      logger.error(`Error getting tools:`, error);
      return {
        content: [{ 
          type: "text", 
          text: `Error getting tools: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// Check tool existence using core library directly
server.registerTool(
  "enact-tool-exists",
  {
    title: "Check Tool Existence",
    description: "Check if a tool exists in the registry using direct core integration",
    inputSchema: {
      name: z.string().describe("Name of the tool to check")
    }
  },
  async ({ name }) => {
    try {
      logger.info(`Checking tool existence via direct core library: ${name}`);
      
      const exists = await enactCore.toolExists(name);
      
      return {
        content: [{ 
          type: "text", 
          text: `✅ Tool "${name}" ${exists ? 'exists' : 'does not exist'} in the registry.` 
        }]
      };
    } catch (error) {
      logger.error(`Error checking if tool exists:`, error);
      return {
        content: [{ 
          type: "text", 
          text: `Error checking tool existence: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// Search and register tool using core library directly
server.registerTool(
  "enact-search-and-register-tools",
  {
    title: "Search and Register Tools",
    description: "Search tools and register the first result as a tool using direct core integration",
    inputSchema: {
      query: z.string().describe("Search query for tools"),
      limit: z.number().optional().describe("Maximum number of results"),
      tags: z.array(z.string()).optional().describe("Filter by tags"),
      author: z.string().optional().describe("Filter by author")
    }
  },
  async ({ query, limit, tags, author }) => {
    try {
      logger.info(`Searching and registering tools via direct core library: "${query}"`);
      
      const tools = await enactCore.searchTools({
        query,
        limit,
        tags,
        author
      });
      
      logger.info(`Found ${tools.length} tools matching query "${query}"`);
      
      // Register the first tool if found
      let newlyRegistered = 0;
      if (tools.length > 0) {
        const firstTool = tools[0];
        if (firstTool.name) {
          try {
            // Add the tool as a dynamic MCP tool
            await registerDynamicTool(firstTool);
            newlyRegistered = 1;
            logger.info(`Successfully registered tool: ${firstTool.name}`);
          } catch (err) {
            logger.error(`Failed to register tool ${firstTool.name}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }
      
      return {
        content: [{ 
          type: "text", 
          text: `${newlyRegistered} new tools registered.\nFound tools:\n${safeJsonStringify(tools)}` 
        }]
      };
    } catch (error) {
      logger.error("Error searching and registering tools:", error);
      return {
        content: [{ 
          type: "text", 
          text: `Error searching and registering tools: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// Core status and capabilities
server.registerTool(
  "enact-core-status",
  {
    title: "Core Status",
    description: "Get status and capabilities of the direct core integration",
    inputSchema: {}
  },
  async () => {
    try {
      const status = await enactCore.getStatus();
      
      let statusText = `Enact Core Direct Integration Status\n`;
      statusText += `=====================================\n\n`;
      statusText += `Integration Mode: Direct Core Library\n`;
      statusText += `Execution Provider: ${status.executionProvider}\n`;
      statusText += `API URL: ${status.apiUrl}\n`;
      statusText += `Verification Policy: ${status.verificationPolicy}\n`;
      statusText += `Default Timeout: ${status.defaultTimeout}\n\n`;
      
      statusText += `Available Features:\n`;
      statusText += `• ✅ Direct tool execution (no CLI spawning)\n`;
      statusText += `• ✅ Signature verification\n`;
      statusText += `• ✅ Real-time tool search\n`;
      statusText += `• ✅ Tool validation and sanitization\n`;
      statusText += `• ✅ Environment variable management\n`;
      statusText += `• ✅ Raw YAML tool execution\n`;
      statusText += `• ✅ Command safety verification\n`;
      statusText += `• ✅ Output schema validation\n\n`;
      
      statusText += `Performance Benefits:\n`;
      statusText += `• ⚡ No CLI process spawning overhead\n`;
      statusText += `• ⚡ Direct API communication\n`;
      statusText += `• ⚡ Shared state and caching\n`;
      statusText += `• ⚡ Lower memory footprint\n`;
      statusText += `• ⚡ Faster response times\n`;
      
      return {
        content: [{ 
          type: "text", 
          text: statusText
        }]
      };
    } catch (error) {
      logger.error(`Error getting core status:`, error);
      return {
        content: [{ 
          type: "text", 
          text: `Error getting core status: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// Helper function to register a tool dynamically
async function registerDynamicTool(tool: any): Promise<void> {
  const toolName = `enact-${tool.name.replace(/[^a-zA-Z0-9-_]/g, '-')}`;
  const description = tool.description || `Execute ${tool.name} tool`;
  
  // Build input schema from tool definition
  const inputSchema: Record<string, any> = {};
  if (tool.inputSchema?.properties) {
    for (const [key, prop] of Object.entries(tool.inputSchema.properties) as any) {
      const isRequired = tool.inputSchema.required?.includes(key);
      
      let zodType;
      switch (prop.type) {
        case 'string':
          zodType = z.string();
          break;
        case 'number':
          zodType = z.number();
          break;
        case 'boolean':
          zodType = z.boolean();
          break;
        case 'array':
          zodType = z.array(z.any());
          break;
        case 'object':
          zodType = z.record(z.any());
          break;
        default:
          zodType = z.any();
      }
      
      inputSchema[key] = isRequired ? zodType : zodType.optional();
    }
  }
  
  // Register the tool
  server.registerTool(
    toolName,
    {
      title: tool.name,
      description: description,
      inputSchema: inputSchema
    },
    async (args: any) => {
      try {
        const result = await enactCore.executeToolByName(tool.name, args);
        
        if (!result.success) {
          return {
            content: [{ 
              type: "text", 
              text: `Error executing tool ${tool.name}: ${result.error?.message}` 
            }],
            isError: true
          };
        }
        
        return {
          content: [{ 
            type: "text", 
            text: `Executed tool ${tool.name}:\n${safeJsonStringify(result)}` 
          }]
        };
      } catch (error) {
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
  
  // Notify clients that tool list changed
  server.server.sendToolListChanged();
}

// Start the server
async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logger.info("🚀 Enact MCP Server with Direct Core Integration started successfully");
  } catch (error) {
    console.error("❌ Server connection error:", error);
    if (error instanceof Error) {
      console.error("Stack trace:", error.stack);
    }
    process.exit(1);
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  main().catch((error) => {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  });
}

export { server, enactCore };

// Get tools by author using core library directly
server.registerTool(
  "enact-get-tools-by-author",
  {
    title: "Get Tools by Author",
    description: "Get tools by a specific author using direct core integration",
    inputSchema: {
      author: z.string().describe("Author name to filter by"),
      limit: z.number().default(20).describe("Maximum number of results")
    }
  },
  async ({ author, limit = 20 }) => {
    try {
      logger.info(`Getting tools by author via direct core library: ${author}`);
      
      const tools = await enactCore.getTools({ author, limit });
      
      return {
        content: [{ 
          type: "text", 
          text: `📚 Found ${tools.length} tools by author "${author}":\n${safeJsonStringify(tools)}` 
        }]
      };
    } catch (error) {
      logger.error(`Error getting tools by author:`, error);
      return {
        content: [{ 
          type: "text", 
          text: `❌ Error getting tools by author: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// Get tools by tags using core library directly
server.registerTool(
  "enact-get-tools-by-tags",
  {
    title: "Get Tools by Tags",
    description: "Get tools filtered by specific tags using direct core integration",
    inputSchema: {
      tags: z.array(z.string()).describe("Tags to filter by"),
      limit: z.number().default(20).describe("Maximum number of results")
    }
  },
  async ({ tags, limit = 20 }) => {
    try {
      logger.info(`Getting tools by tags via direct core library: ${tags.join(', ')}`);
      
      const tools = await enactCore.getTools({ tags, limit });
      
      return {
        content: [{ 
          type: "text", 
          text: `🏷️ Found ${tools.length} tools with tags [${tags.join(', ')}]:\n${safeJsonStringify(tools)}` 
        }]
      };
    } catch (error) {
      logger.error(`Error getting tools by tags:`, error);
      return {
        content: [{ 
          type: "text", 
          text: `❌ Error getting tools by tags: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// Register tool as an MCP tool
server.registerTool(
  "enact-register-tool",
  {
    title: "Register Tool",
    description: "Register a tool as an MCP tool using direct core integration",
    inputSchema: {
      name: z.string().describe("Name of the tool to register")
    }
  },
  async ({ name }) => {
    try {
      logger.info(`Registering tool via direct core library: ${name}`);
      
      // First get the tool info
      const tool = await enactCore.getToolInfo(name);
      
      if (!tool) {
        return {
          content: [{ 
            type: "text", 
            text: `❌ Tool not found: ${name}` 
          }],
          isError: true
        };
      }
      
      // Register it as a dynamic tool
      await registerDynamicTool(tool);
      
      return {
        content: [{ 
          type: "text", 
          text: `✅ Successfully registered tool: ${name}` 
        }]
      };
    } catch (error) {
      logger.error(`Error registering tool:`, error);
      return {
        content: [{ 
          type: "text", 
          text: `❌ Error registering tool: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// Search for multiple tools by different intents
server.registerTool(
  "enact-search-multiple-tools",
  {
    title: "Search Multiple Tools",
    description: "Search for multiple tools by different intents using direct core integration",
    inputSchema: {
      intents: z.array(z.string()).describe("Array of search intents/queries")
    }
  },
  async ({ intents }) => {
    try {
      logger.info(`Searching multiple tools via direct core library: ${intents.length} intents`);
      
      const allResults: any[] = [];
      
      for (const intent of intents) {
        try {
          const tools = await enactCore.searchTools({ query: intent });
          allResults.push({
            intent,
            tools,
            count: tools.length
          });
        } catch (error) {
          allResults.push({
            intent,
            error: error instanceof Error ? error.message : String(error),
            count: 0
          });
        }
      }
      
      const totalFound = allResults.reduce((sum, result) => sum + (result.count || 0), 0);
      
      return {
        content: [{ 
          type: "text", 
          text: `🔍 Search completed for ${intents.length} intents. Total tools found: ${totalFound}\n${safeJsonStringify(allResults)}` 
        }]
      };
    } catch (error) {
      logger.error(`Error searching multiple tools:`, error);
      return {
        content: [{ 
          type: "text", 
          text: `❌ Error searching multiple tools: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

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

// Initialize core library with extended timeout for long-running operations
const enactCore = new EnactCore({
  apiUrl: process.env.ENACT_API_URL || 'https://enact.tools',
  supabaseUrl: process.env.ENACT_SUPABASE_URL || 'https://xjnhhxwxovjifdxdwzih.supabase.co',
  executionProvider: 'direct',
  verificationPolicy: (process.env.ENACT_VERIFY_POLICY as any) || 'permissive',
  authToken: process.env.ENACT_AUTH_TOKEN,
  defaultTimeout: '120s' // Increased timeout for MCP operations
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

// Store for tracking long-running operations
const runningOperations = new Map<string, {
  id: string;
  name: string;
  startTime: Date;
  promise: Promise<any>;
  status: 'running' | 'completed' | 'failed';
  result?: any;
  error?: any;
  resultFetched?: boolean;
  errorFetched?: boolean;
}>();

// Helper function for safe JSON stringification
function safeJsonStringify(obj: any, fallback: string = "Unable to stringify object"): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (error) {
    logger.error(`JSON stringify failed: ${error instanceof Error ? error.message : String(error)}`);
    return fallback;
  }
}

// Execute tool by name with background support for long-running operations
server.registerTool(
  "execute-tool-by-name-async",
  {
    title: "Execute Enact Tool (Async)",
    description: "Execute an Enact tool by its name using direct core integration with background execution for long-running operations",
    inputSchema: {
      name: z.string().describe("Name of the tool to execute"), 
      inputs: z.record(z.any()).optional().describe("Input parameters for the tool"),
      timeout: z.string().optional().describe("Execution timeout"),
      verifyPolicy: z.enum(['permissive', 'enterprise', 'paranoid']).optional().describe("Verification policy"),
      skipVerification: z.boolean().optional().describe("Skip signature verification"),
      force: z.boolean().optional().describe("Force execution"),
      dryRun: z.boolean().optional().describe("Dry run mode"),
      verbose: z.boolean().optional().describe("Verbose output"),
      async: z.boolean().optional().describe("Run in background for long operations")
    }
  },
  async (params) => {
    const { name, inputs = {}, timeout, verifyPolicy, skipVerification, force, dryRun, verbose, async = false } = params;
    
    try {
      logger.info(`Executing tool ${name} via direct core library`);
      
      // Check if this is a known long-running tool or if async is explicitly requested
      const isLongRunningTool = name.includes('dagger') || name.includes('docker') || name.includes('build') || async;
      
      if (isLongRunningTool) {
        // Generate operation ID
        const operationId = `${name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Start execution in background
        const executionPromise = enactCore.executeToolByName(name, inputs, {
          timeout: timeout || '300s', // Even longer timeout for async operations
          verifyPolicy,
          skipVerification,
          force,
          dryRun,
          verbose
        });
        
        // Store the operation
        const operation = {
          id: operationId,
          name,
          startTime: new Date(),
          promise: executionPromise,
          status: 'running' as 'running' | 'completed' | 'failed',
          result: undefined as any,
          error: undefined as any,
        };
        
        runningOperations.set(operationId, operation);
        
        // Handle completion in background
        executionPromise
          .then(result => {
            operation.status = 'completed';
            operation.result = result;
            logger.info(`Background operation completed: ${operationId}`);
          })
          .catch(error => {
            operation.status = 'failed';
            operation.error = error;
            logger.error(`Background operation failed: ${operationId}`, error);
          });
        
        return {
          content: [{ 
            type: "text", 
            text: `🚀 Started background execution of tool: ${name}\n\nOperation ID: ${operationId}\nStarted: ${operation.startTime.toISOString()}\n\n⏳ This operation is running in the background. Use the "check-operation-status" tool with operation ID "${operationId}" to check progress.\n\nEstimated completion time: 1-3 minutes for Dagger operations.` 
          }]
        };
      }
      
      // For quick operations, execute normally
      const result = await enactCore.executeToolByName(name, inputs, {
        timeout: timeout || '30s',
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
      
      // Check if this is a timeout error and provide better messaging
      if (error instanceof Error && error.message.includes('timed out')) {
        return {
          content: [{ 
            type: "text", 
            text: `⏰ Tool execution timed out: ${name}\n\nFor long-running operations like Dagger builds, try using the async mode by setting "async": true in your request.\n\nOriginal error: ${error.message}` 
          }],
          isError: true
        };
      }
      
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

// Check operation status
server.registerTool(
  "check-operation-status",
  {
    title: "Check Operation Status",
    description: "Check the status of a background operation",
    inputSchema: {
      operationId: z.string().describe("The operation ID to check")
    }
  },
  async ({ operationId }) => {
    try {
      const operation = runningOperations.get(operationId);
      
      if (!operation) {
        return {
          content: [{ 
            type: "text", 
            text: `❌ Operation not found: ${operationId}\n\nThe operation may have been completed and cleaned up, or the ID is incorrect.` 
          }],
          isError: true
        };
      }
      
      const duration = Math.round((Date.now() - operation.startTime.getTime()) / 1000);
      
      switch (operation.status) {
        case 'running':
          return {
            content: [{ 
              type: "text", 
              text: `⏳ Operation Status: RUNNING\n\nOperation ID: ${operationId}\nTool: ${operation.name}\nStarted: ${operation.startTime.toISOString()}\nDuration: ${duration} seconds\n\nThe operation is still running. Please check again in a moment.` 
            }]
          };
          
        case 'completed':
          // Mark that result has been fetched and schedule cleanup
          if (!operation.resultFetched) {
            operation.resultFetched = true;
            // Schedule cleanup after a reasonable delay to allow multiple fetches
            setTimeout(() => {
              console.log(`[INFO] Cleaning up completed operation: ${operationId}`);
              runningOperations.delete(operationId);
            }, 60000); // 1 minute delay
          }
          return {
            content: [{ 
              type: "text", 
              text: `✅ Operation Status: COMPLETED\n\nOperation ID: ${operationId}\nTool: ${operation.name}\nStarted: ${operation.startTime.toISOString()}\nDuration: ${duration} seconds\n\nResult:\n${safeJsonStringify(operation.result)}` 
            }]
          };
          
        case 'failed':
          // Mark that error has been fetched and schedule cleanup
          if (!operation.errorFetched) {
            operation.errorFetched = true;
            // Schedule cleanup after a reasonable delay to allow multiple fetches
            setTimeout(() => {
              console.log(`[INFO] Cleaning up failed operation: ${operationId}`);
              runningOperations.delete(operationId);
            }, 60000); // 1 minute delay
          }
          return {
            content: [{ 
              type: "text", 
              text: `❌ Operation Status: FAILED\n\nOperation ID: ${operationId}\nTool: ${operation.name}\nStarted: ${operation.startTime.toISOString()}\nDuration: ${duration} seconds\n\nError: ${operation.error instanceof Error ? operation.error.message : String(operation.error)}` 
            }],
            isError: true
          };
          
        default:
          return {
            content: [{ 
              type: "text", 
              text: `❓ Unknown operation status: ${operation.status}` 
            }],
            isError: true
          };
      }
    } catch (error) {
      logger.error(`Error checking operation status:`, error);
      return {
        content: [{ 
          type: "text", 
          text: `Error checking operation status: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// List all operations
server.registerTool(
  "list-operations",
  {
    title: "List Operations",
    description: "List all background operations",
    inputSchema: {}
  },
  async () => {
    try {
      const operations = Array.from(runningOperations.values());
      
      if (operations.length === 0) {
        return {
          content: [{ 
            type: "text", 
            text: `📋 No background operations currently running or recently completed.` 
          }]
        };
      }
      
      let summary = `📋 Background Operations (${operations.length} total)\n\n`;
      
      operations.forEach(op => {
        const duration = Math.round((Date.now() - op.startTime.getTime()) / 1000);
        const statusEmoji = op.status === 'running' ? '⏳' : op.status === 'completed' ? '✅' : '❌';
        summary += `${statusEmoji} ${op.id}\n`;
        summary += `   Tool: ${op.name}\n`;
        summary += `   Status: ${op.status.toUpperCase()}\n`;
        summary += `   Duration: ${duration}s\n`;
        summary += `   Started: ${op.startTime.toISOString()}\n\n`;
      });
      
      return {
        content: [{ 
          type: "text", 
          text: summary
        }]
      };
    } catch (error) {
      logger.error(`Error listing operations:`, error);
      return {
        content: [{ 
          type: "text", 
          text: `Error listing operations: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// Execute tool by name - modern API (keeping original for compatibility)
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
      
      // For potentially long-running operations, provide immediate feedback
      const isLongRunningTool = name.includes('dagger') || name.includes('docker') || name.includes('build');
      if (isLongRunningTool) {
        logger.info(`⏳ Starting long-running operation: ${name} (this may take 1-2 minutes)`);
      }
      
      const result = await enactCore.executeToolByName(name, inputs, {
        timeout: timeout || '120s', // Use longer timeout for MCP operations
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
      
      // Check if this is a timeout error and provide better messaging
      if (error instanceof Error && error.message.includes('timed out')) {
        return {
          content: [{ 
            type: "text", 
            text: `⏰ Tool execution timed out: ${name}\n\nThis may happen with long-running operations like Dagger builds. The operation may still be running in the background. Consider:\n\n1. Running the tool directly from CLI for long operations\n2. Using smaller, more focused operations\n3. Checking if the operation completed successfully outside of MCP\n\nOriginal error: ${error.message}` 
          }],
          isError: true
        };
      }
      
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

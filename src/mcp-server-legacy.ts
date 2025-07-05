import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { EnactCore } from "./core/EnactCore";
import logger from './exec/logger';
import { silentMcpTool, validateSilentEnvironment } from './utils/silent-monitor';
import { startEnvManagerServer } from './web/env-manager-server';
import { resolveToolEnvironmentVariables, validateRequiredEnvironmentVariables, generateConfigLink } from './utils/env-loader';
import { verifyTool, VERIFICATION_POLICIES, type VerificationPolicy } from './security/sign';
import { enforceSignatureVerification } from './security/verification-enforcer';

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

// Store web server port for MCP tools
let webServerPort: number | null = null;
let webServerInstance: any = null; // Store the server instance for closing

// Helper function for safe JSON stringification
function safeJsonStringify(obj: any, fallback: string = "Unable to stringify object"): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (error) {
    logger.error(`JSON stringify failed: ${error instanceof Error ? error.message : String(error)}`);
    return fallback;
  }
}

// Helper function to validate environment variables for MCP tools
async function validateMcpToolEnvironmentVariables(toolName: string, toolEnv?: Record<string, any>): Promise<{
  valid: boolean;
  errorMessage?: string;
}> {
  if (!toolEnv || Object.keys(toolEnv).length === 0) {
    return { valid: true }; // No env vars required
  }

  try {
    // Resolve environment variables from Enact configuration
    const { resolved: envVars } = await resolveToolEnvironmentVariables(toolName, toolEnv);
    
    // Validate required environment variables
    const validation = validateRequiredEnvironmentVariables(toolEnv, envVars);
    
    if (!validation.valid) {
      let errorMessage = '❌ Missing required environment variables:\n\n';
      
      validation.missing.forEach(varName => {
        const config = toolEnv[varName];
        const description = config?.description ? ` - ${config.description}` : '';
        const source = config?.source ? ` (source: ${config.source})` : '';
        const required = config?.required ? ' [REQUIRED]' : '';
        errorMessage += `  • ${varName}${required}${description}${source}\n`;
      });
      
      errorMessage += '\n💡 You can set environment variables using:\n';
      errorMessage += '  • enact env set <package> <VAR_NAME> <value>  # Package-managed (shared)\n';
      errorMessage += '  • enact env set <package> <VAR_NAME> --encrypt # For sensitive values\n';
      errorMessage += '  • enact env set <VAR_NAME> <value> --project   # Project-specific (.env file)\n';
      
      // Generate a configuration link for the web interface
      const configLink = generateConfigLink(validation.missing, toolName);
      if (configLink) {
        errorMessage += '\n🌐 Or use the web interface to configure all missing variables:\n';
        errorMessage += `  ${configLink}\n`;
      }
      
      errorMessage += '\n⚠️ Execution aborted due to missing environment variables.';
      
      return {
        valid: false,
        errorMessage
      };
    }
    
    return { valid: true };
  } catch (error) {
    logger.error('Failed to validate environment variables:', error);
    return {
      valid: false,
      errorMessage: `❌ Failed to validate environment variables: ${error instanceof Error ? error.message : String(error)}`
    };
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
      
      // Get tool definition first to validate environment variables
      let tool;
      try {
        tool = await enactCore.getToolByName(name);
        if (!tool) {
          return {
            content: [{ 
              type: "text", 
              text: `❌ Tool not found: ${name}` 
            }],
            isError: true
          };
        }
      } catch (error) {
        return {
          content: [{ 
            type: "text", 
            text: `❌ Tool not found: ${name}\n\nError: ${error instanceof Error ? error.message : String(error)}` 
          }],
          isError: true
        };
      }
      
      // Validate environment variables before execution
      const envValidation = await validateMcpToolEnvironmentVariables(name, tool.env);
      if (!envValidation.valid) {
        return {
          content: [{ 
            type: "text", 
            text: envValidation.errorMessage || 'Environment validation failed' 
          }],
          isError: true
        };
      }
      
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
      
      // Get tool definition first to validate environment variables
      let tool;
      try {
        tool = await enactCore.getToolByName(name);
        if (!tool) {
          return {
            content: [{ 
              type: "text", 
              text: `❌ Tool not found: ${name}` 
            }],
            isError: true
          };
        }
      } catch (error) {
        return {
          content: [{ 
            type: "text", 
            text: `❌ Tool not found: ${name}\n\nError: ${error instanceof Error ? error.message : String(error)}` 
          }],
          isError: true
        };
      }
      
      // Validate environment variables before execution
      const envValidation = await validateMcpToolEnvironmentVariables(name, tool.env);
      if (!envValidation.valid) {
        return {
          content: [{ 
            type: "text", 
            text: envValidation.errorMessage || 'Environment validation failed' 
          }],
          isError: true
        };
      }
      
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

// // Execute raw tool from YAML definition using core library directly
// server.registerTool(
//   "execute-raw-tool",
//   {
//     title: "Execute Raw Tool",
//     description: "Execute an Enact tool from raw YAML definition using direct core integration",
//     inputSchema: {
//       yaml: z.string().describe("YAML definition of the tool"),
//       inputs: z.record(z.any()).optional().describe("Input parameters for the tool"),
//       options: z.record(z.any()).optional().describe("Execution options")
//     }
//   },
//   async ({ yaml: toolYaml, inputs = {}, options = {} }) => {
//     try {
//       logger.info("Executing raw tool via direct core library");
      
//       const result = await enactCore.executeRawTool(toolYaml, inputs, options);
      
//       if (!result.success) {
//         return {
//           content: [{ 
//             type: "text", 
//             text: `Error executing raw tool: ${result.error?.message}` 
//           }],
//           isError: true
//         };
//       }
      
//       return {
//         content: [{ 
//           type: "text", 
//           text: `Successfully executed raw tool\nOutput: ${safeJsonStringify(result)}` 
//         }]
//       };
//     } catch (error) {
//       logger.error(`Error executing raw tool:`, error);
//       return {
//         content: [{ 
//           type: "text", 
//           text: `Internal error executing raw tool: ${error instanceof Error ? error.message : String(error)}` 
//         }],
//         isError: true
//       };
//     }
//   }
// );

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
    description: "Search tools and register the first result as a tool using direct core integration with signature verification",
    inputSchema: {
      query: z.string().describe("Search query for tools"),
      limit: z.number().optional().describe("Maximum number of results"),
      tags: z.array(z.string()).optional().describe("Filter by tags"),
      author: z.string().optional().describe("Filter by author"),
      verifyPolicy: z.enum(['permissive', 'enterprise', 'paranoid']).optional().describe("Verification policy for signature checking")
    }
  },
  async ({ query, limit, tags, author, verifyPolicy = 'permissive' }) => {
    try {
      logger.info(`Searching and registering tools via direct core library: "${query}" with policy: ${verifyPolicy}`);
      
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
            // Verify the tool's signature before registration
            logger.info(`Verifying tool signatures for: ${firstTool.name} with policy: ${verifyPolicy}`);
            
            // Determine verification policy
            const policyKey = verifyPolicy.toUpperCase() as keyof typeof VERIFICATION_POLICIES;
            const policy: VerificationPolicy = VERIFICATION_POLICIES[policyKey] || VERIFICATION_POLICIES.PERMISSIVE;
            
            // Verify the tool
            const verificationResult = await verifyTool(firstTool, policy);
            
            if (!verificationResult.isValid) {
              logger.error(`Tool "${firstTool.name}" signature verification failed: ${verificationResult.message}`);
              return {
                content: [{ 
                  type: "text", 
                  text: `❌ Tool "${firstTool.name}" signature verification failed.\n\nPolicy: ${verifyPolicy}\nValid signatures: ${verificationResult.validSignatures}/${verificationResult.totalSignatures}\n\nErrors:\n${verificationResult.errors.map(e => `  • ${e}`).join('\n')}\n\n💡 Use 'enact-register-tool' with a different verification policy or ensure the tool has valid signatures.` 
                }],
                isError: true
              };
            }
            
            logger.info(`✅ Tool "${firstTool.name}" signature verification passed: ${verificationResult.message}`);
            
            // Add the tool as a dynamic MCP tool with verification info
            await registerDynamicTool(firstTool, {
              isValid: verificationResult.isValid,
              message: verificationResult.message,
              policy: verifyPolicy
            });
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
      statusText += `• ✅ Output schema validation\n`;
      statusText += `• 🌐 Web-based environment manager\n\n`;
      
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

// Launch web server async
server.registerTool(
  "launch-env-manager-server",
  {
    title: "Launch Environment Manager Server",
    description: "Start the web-based environment variable manager server asynchronously",
    inputSchema: {
      port: z.number().optional().describe("Port to run the server on (default: 5555)"),
      async: z.boolean().optional().describe("Run in background (default: true)")
    }
  },
  async ({ port = 5555, async = true }) => {
    try {
      if (webServerInstance) {
        return {
          content: [{ 
            type: "text", 
            text: `🌐 Environment Manager Server is already running on port ${webServerPort}\n\nURL: http://localhost:${webServerPort}` 
          }]
        };
      }

      if (async) {
        // Generate operation ID for async launch
        const operationId = `web-server-launch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Start server launch in background
        const launchPromise = startEnvManagerServer(port).then(({ server: webServer, port: actualPort }) => {
          webServerInstance = webServer;
          webServerPort = actualPort;
          logger.info(`🌐 Environment Manager available at http://localhost:${actualPort}`);
          return { server: webServer, port: actualPort };
        });
        
        // Store the operation
        const operation = {
          id: operationId,
          name: 'launch-env-manager-server',
          startTime: new Date(),
          promise: launchPromise,
          status: 'running' as 'running' | 'completed' | 'failed',
          result: undefined as any,
          error: undefined as any,
        };
        
        runningOperations.set(operationId, operation);
        
        // Handle completion in background
        launchPromise
          .then(result => {
            operation.status = 'completed';
            operation.result = result;
            logger.info(`Environment Manager Server started successfully on port ${result.port}`);
          })
          .catch(error => {
            operation.status = 'failed';
            operation.error = error;
            logger.error(`Failed to start Environment Manager Server:`, error);
          });
        
        return {
          content: [{ 
            type: "text", 
            text: `🚀 Starting Environment Manager Server asynchronously on port ${port}\n\nOperation ID: ${operationId}\nStarted: ${operation.startTime.toISOString()}\n\n⏳ Use "check-operation-status" with operation ID "${operationId}" to check when the server is ready.\n\nOnce running, the server will be available at: http://localhost:${port}` 
          }]
        };
      } else {
        // Synchronous launch
        const { server: webServer, port: actualPort } = await startEnvManagerServer(port);
        webServerInstance = webServer;
        webServerPort = actualPort;
        
        return {
          content: [{ 
            type: "text", 
            text: `✅ Environment Manager Server started successfully!\n\nURL: http://localhost:${actualPort}\n\nThe environment manager allows you to:\n• View all package namespaces and their environment variables\n• Add, edit, and delete environment variables\n• Create new package namespaces\n• Manage variables following the Enact package structure\n\nEnvironment variables are stored in ~/.enact/env/ organized by package namespace.` 
          }]
        };
      }
    } catch (error) {
      logger.error(`Error launching Environment Manager Server:`, error);
      return {
        content: [{ 
          type: "text", 
          text: `❌ Error launching Environment Manager Server: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// Close web server
server.registerTool(
  "close-env-manager-server",
  {
    title: "Close Environment Manager Server",
    description: "Stop the web-based environment variable manager server",
    inputSchema: {
      force: z.boolean().optional().describe("Force close the server (default: false)")
    }
  },
  async ({ force = false }) => {
    try {
      if (!webServerInstance) {
        return {
          content: [{ 
            type: "text", 
            text: `ℹ️ Environment Manager Server is not currently running` 
          }]
        };
      }

      const currentPort = webServerPort;
      
      return new Promise((resolve) => {
        const timeout = force ? 1000 : 5000; // 1s for force, 5s for graceful
        
        const cleanup = () => {
          webServerInstance = null;
          webServerPort = null;
          resolve({
            content: [{ 
              type: "text", 
              text: `✅ Environment Manager Server stopped successfully\n\nServer was running on port ${currentPort}` 
            }]
          });
        };

        if (force) {
          // Force close
          webServerInstance.close(cleanup);
          // Fallback timeout for force close
          setTimeout(cleanup, timeout);
        } else {
          // Graceful close
          webServerInstance.close((err: any) => {
            if (err) {
              logger.error('Error during graceful shutdown:', err);
              resolve({
                content: [{ 
                  type: "text", 
                  text: `⚠️ Server closed with warnings: ${err.message}\n\nServer was running on port ${currentPort}` 
                }]
              });
            } else {
              cleanup();
            }
          });
          
          // Fallback timeout
          setTimeout(() => {
            logger.warn('Graceful shutdown timeout, forcing close');
            cleanup();
          }, timeout);
        }
      });
    } catch (error) {
      logger.error(`Error closing Environment Manager Server:`, error);
      return {
        content: [{ 
          type: "text", 
          text: `❌ Error closing Environment Manager Server: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// Get environment manager status
server.registerTool(
  "get-env-manager-status",
  {
    title: "Get Environment Manager Status",
    description: "Check if the environment manager server is running and get its status",
    inputSchema: {}
  },
  async () => {
    try {
      if (!webServerInstance || !webServerPort) {
        return {
          content: [{ 
            type: "text", 
            text: `📊 Environment Manager Server Status: STOPPED\n\nThe server is not currently running.\n\n💡 Use "launch-env-manager-server" to start the server.` 
          }]
        };
      }

      // Check if server is actually listening
      const isListening = webServerInstance.listening;
      
      return {
        content: [{ 
          type: "text", 
          text: `📊 Environment Manager Server Status: ${isListening ? 'RUNNING' : 'STOPPED'}\n\n${isListening ? `🌐 URL: http://localhost:${webServerPort}\n\nThe environment manager allows you to:\n• View all package namespaces and their environment variables\n• Add, edit, and delete environment variables\n• Create new package namespaces\n• Manage variables following the Enact package structure` : 'Server instance exists but is not listening'}\n\nEnvironment variables are stored in ~/.enact/env/ organized by package namespace.` 
        }]
      };
    } catch (error) {
      logger.error(`Error getting Environment Manager Server status:`, error);
      return {
        content: [{ 
          type: "text", 
          text: `❌ Error getting Environment Manager Server status: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// Get environment manager URL
server.registerTool(
  "get-env-manager-url",
  {
    title: "Get Environment Manager URL",
    description: "Get the URL for the web-based environment variable manager",
    inputSchema: {}
  },
  async () => {
    try {
      // Use the actual web server port if available
      const port = webServerPort || 5555;
      
      return {
        content: [{ 
          type: "text", 
          text: `🌐 Environment Manager Web Interface\n\nURL: http://localhost:${port}\n\nThe environment manager allows you to:\n• View all package namespaces and their environment variables\n• Add, edit, and delete environment variables\n• Create new package namespaces\n• Manage variables following the Enact package structure\n\nEnvironment variables are stored in ~/.enact/env/ organized by package namespace.` 
        }]
      };
    } catch (error) {
      logger.error(`Error getting env manager URL:`, error);
      return {
        content: [{ 
          type: "text", 
          text: `Error getting environment manager URL: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// List package environment variables
server.registerTool(
  "list-package-env-vars",
  {
    title: "List Package Environment Variables",
    description: "List environment variables for a specific package namespace",
    inputSchema: {
      namespace: z.string().describe("Package namespace (e.g., 'org/package')")
    }
  },
  async ({ namespace }) => {
    try {
      const { getPackageEnvironmentVariables } = await import('./utils/env-loader');
      const { package: packageVars } = await getPackageEnvironmentVariables(namespace);
      
      if (Object.keys(packageVars).length === 0) {
        return {
          content: [{ 
            type: "text", 
            text: `📦 No environment variables found for package namespace: ${namespace}\n\nUse the web interface at http://localhost:5555 to add variables.` 
          }]
        };
      }
      
      let result = `📦 Environment Variables for ${namespace}\n`;
      result += `${'='.repeat(50)}\n\n`;
      
      for (const [key, info] of Object.entries(packageVars)) {
        result += `🔑 ${key}\n`;
        result += `   Value: ${info.encrypted ? '[encrypted]' : '[hidden]'}\n`;
        if (info.description) {
          result += `   Description: ${info.description}\n`;
        }
        result += `\n`;
      }
      
      result += `\n💡 Use the web interface at http://localhost:5555 to view and edit these variables.`;
      
      return {
        content: [{ 
          type: "text", 
          text: result
        }]
      };
    } catch (error) {
      logger.error(`Error listing package env vars:`, error);
      return {
        content: [{ 
          type: "text", 
          text: `Error listing environment variables: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// List all package namespaces
server.registerTool(
  "list-all-package-namespaces",
  {
    title: "List All Package Namespaces",
    description: "List all available package namespaces with environment variables",
    inputSchema: {}
  },
  async () => {
    try {
      const { getAllPackageNamespaces } = await import('./web/env-manager-server');
      const packages = await getAllPackageNamespaces();
      
      if (packages.length === 0) {
        return {
          content: [{ 
            type: "text", 
            text: `📦 No package namespaces found\n\nUse the web interface at http://localhost:5555 to create and manage packages.` 
          }]
        };
      }
      
      let result = `📦 Available Package Namespaces\n`;
      result += `${'='.repeat(40)}\n\n`;
      
      for (const pkg of packages) {
        const varCount = Object.keys(pkg.variables).length;
        result += `🏷️ ${pkg.namespace}\n`;
        result += `   Variables: ${varCount}\n`;
        result += `   Path: ${pkg.path}\n\n`;
      }
      
      result += `\n💡 Use the web interface at http://localhost:5555 to manage these packages.`;
      
      return {
        content: [{ 
          type: "text", 
          text: result
        }]
      };
    } catch (error) {
      logger.error(`Error listing package namespaces:`, error);
      return {
        content: [{ 
          type: "text", 
          text: `Error listing package namespaces: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// Execute local Enact YAML tool file
server.registerTool(
  "execute-local-enact-tool",
  {
    title: "Execute Local Enact Tool",
    description: "Load and execute an Enact tool from a local YAML file",
    inputSchema: {
      filePath: z.string().describe("Path to the local YAML tool file"),
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
    const { filePath, inputs = {}, timeout, verifyPolicy, skipVerification, force, dryRun, verbose, async = false } = params;
    
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const yaml = await import('yaml');
      
      logger.info(`Loading and executing local Enact tool: ${filePath}`);
      
      // Resolve file path (handle relative paths)
      const resolvedPath = path.resolve(filePath);
      
      // Check if file exists
      try {
        await fs.access(resolvedPath);
      } catch (error) {
        return {
          content: [{ 
            type: "text", 
            text: `❌ Tool file not found: ${resolvedPath}` 
          }],
          isError: true
        };
      }
      
      // Read and parse YAML file
      let toolDefinition;
      let yamlContent;
      try {
        yamlContent = await fs.readFile(resolvedPath, 'utf-8');
        toolDefinition = yaml.parse(yamlContent);
      } catch (error) {
        return {
          content: [{ 
            type: "text", 
            text: `❌ Failed to parse YAML file: ${error instanceof Error ? error.message : String(error)}` 
          }],
          isError: true
        };
      }
      
      // Validate tool definition has required fields
      if (!toolDefinition.name) {
        return {
          content: [{ 
            type: "text", 
            text: `❌ Invalid tool definition: missing 'name' field in ${filePath}` 
          }],
          isError: true
        };
      }
      
      if (!toolDefinition.command) {
        return {
          content: [{ 
            type: "text", 
            text: `❌ Invalid tool definition: missing 'command' field in ${filePath}` 
          }],
          isError: true
        };
      }
      
      // Validate environment variables if any
      if (toolDefinition.env) {
        const envValidation = await validateMcpToolEnvironmentVariables(toolDefinition.name, toolDefinition.env);
        if (!envValidation.valid) {
          return {
            content: [{ 
              type: "text", 
              text: envValidation.errorMessage || 'Environment validation failed' 
            }],
            isError: true
          };
        }
      }
      
      // Check if this is a long-running tool or if async is explicitly requested
      const isLongRunningTool = toolDefinition.name.includes('dagger') || 
                               toolDefinition.name.includes('docker') || 
                               toolDefinition.name.includes('build') || 
                               toolDefinition.command.includes('dagger') ||
                               toolDefinition.command.includes('docker') ||
                               async;
      
      if (isLongRunningTool) {
        // Generate operation ID for async execution
        const operationId = `local-enact-tool-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Start execution in background
        const executionPromise = enactCore.executeRawTool(yamlContent, inputs, {
          timeout: timeout || '300s',
          verifyPolicy,
          skipVerification,
          force,
          dryRun,
          verbose
        });
        
        // Store the operation
        const operation = {
          id: operationId,
          name: `local-enact-tool: ${toolDefinition.name}`,
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
            logger.info(`Background local Enact tool execution completed: ${operationId}`);
          })
          .catch(error => {
            operation.status = 'failed';
            operation.error = error;
            logger.error(`Background local Enact tool execution failed: ${operationId}`, error);
          });
        
        return {
          content: [{ 
            type: "text", 
            text: `🚀 Started background execution of local Enact tool: ${toolDefinition.name}\n\nOperation ID: ${operationId}\nStarted: ${operation.startTime.toISOString()}\nTool File: ${resolvedPath}\n\n⏳ This operation is running in the background. Use the "check-operation-status" tool with operation ID "${operationId}" to check progress.` 
          }]
        };
      }
      
      // Synchronous execution
      const result = await enactCore.executeRawTool(yamlContent, inputs, {
        timeout: timeout || '120s',
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
            text: `❌ Error executing local Enact tool ${toolDefinition.name}: ${result.error?.message}` 
          }],
          isError: true
        };
      }
      
      return {
        content: [{ 
          type: "text", 
          text: `✅ Successfully executed local Enact tool: ${toolDefinition.name}\nFile: ${resolvedPath}\nOutput: ${safeJsonStringify(result)}` 
        }]
      };
      
    } catch (error) {
      logger.error(`Error executing local Enact tool:`, error);
      
      if (error instanceof Error && error.message.includes('timed out')) {
        return {
          content: [{ 
            type: "text", 
            text: `⏰ Local Enact tool execution timed out: ${filePath}\n\nFor long-running operations, try using the async mode by setting "async": true in your request.\n\nOriginal error: ${error.message}` 
          }],
          isError: true
        };
      }
      
      return {
        content: [{ 
          type: "text", 
          text: `❌ Internal error executing local Enact tool: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// List local Enact YAML tool files
server.registerTool(
  "list-local-enact-tools",
  {
    title: "List Local Enact Tools",
    description: "List Enact YAML tool files in a directory",
    inputSchema: {
      directory: z.string().optional().describe("Directory to search for YAML tool files (default: current directory)"),
      recursive: z.boolean().default(false).describe("Search recursively in subdirectories"),
      pattern: z.string().optional().describe("File pattern to match (default: *.yaml, *.yml)")
    }
  },
  async ({ directory = ".", recursive = false, pattern }) => {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const { glob } = await import('glob');
      
      logger.info(`Listing local Enact tools in: ${directory}`);
      
      // Resolve directory path
      const resolvedDir = path.resolve(directory);
      
      // Check if directory exists
      try {
        const stat = await fs.stat(resolvedDir);
        if (!stat.isDirectory()) {
          return {
            content: [{ 
              type: "text", 
              text: `❌ Not a directory: ${resolvedDir}` 
            }],
            isError: true
          };
        }
      } catch (error) {
        return {
          content: [{ 
            type: "text", 
            text: `❌ Directory not found: ${resolvedDir}` 
          }],
          isError: true
        };
      }
      
      // Build glob pattern
      const filePattern = pattern || "*.{yaml,yml}";
      const searchPattern = recursive 
        ? path.join(resolvedDir, "**", filePattern)
        : path.join(resolvedDir, filePattern);
      
      // Find YAML files
      const yamlFiles = await glob(searchPattern);
      
      if (yamlFiles.length === 0) {
        return {
          content: [{ 
            type: "text", 
            text: `📁 No YAML files found in ${resolvedDir}\n\nPattern: ${filePattern}\nRecursive: ${recursive}` 
          }]
        };
      }
      
      // Analyze each file to see if it's an Enact tool
      const enactTools = [];
      const yaml = await import('yaml');
      
      for (const filePath of yamlFiles) {
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const parsed = yaml.parse(content);
          
          // Check if it looks like an Enact tool
          if (parsed && (parsed.name || parsed.command || parsed.enact)) {
            const relativePath = path.relative(process.cwd(), filePath);
            enactTools.push({
              path: relativePath,
              fullPath: filePath,
              name: parsed.name || path.basename(filePath, path.extname(filePath)),
              description: parsed.description || 'No description',
              version: parsed.version || 'No version',
              enactVersion: parsed.enact || 'Unknown',
              command: parsed.command ? parsed.command.substring(0, 50) + (parsed.command.length > 50 ? '...' : '') : 'No command',
              tags: parsed.tags || []
            });
          }
        } catch (error) {
          // Skip files that can't be parsed
          logger.debug(`Skipping unparseable file: ${filePath}`);
        }
      }
      
      if (enactTools.length === 0) {
        return {
          content: [{ 
            type: "text", 
            text: `📁 Found ${yamlFiles.length} YAML files but none appear to be Enact tools\n\nDirectory: ${resolvedDir}\nFiles checked: ${yamlFiles.map(f => path.basename(f)).join(', ')}` 
          }]
        };
      }
      
      // Format output
      let output = `🔧 Found ${enactTools.length} Local Enact Tools\n`;
      output += `${'='.repeat(50)}\n\n`;
      output += `Directory: ${resolvedDir}\n`;
      output += `Recursive: ${recursive}\n\n`;
      
      enactTools.forEach((tool, index) => {
        output += `${index + 1}. 📄 ${tool.name}\n`;
        output += `   Path: ${tool.path}\n`;
        output += `   Description: ${tool.description}\n`;
        output += `   Version: ${tool.version} (Enact: ${tool.enactVersion})\n`;
        output += `   Command: ${tool.command}\n`;
        if (tool.tags.length > 0) {
          output += `   Tags: ${tool.tags.join(', ')}\n`;
        }
        output += `\n`;
      });
      
      output += `💡 Use "execute-local-enact-tool" with the file path to execute any of these tools.`;
      
      return {
        content: [{ 
          type: "text", 
          text: output
        }]
      };
      
    } catch (error) {
      logger.error(`Error listing local Enact tools:`, error);
      return {
        content: [{ 
          type: "text", 
          text: `❌ Error listing local Enact tools: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// Validate local Enact YAML tool file
server.registerTool(
  "validate-local-enact-tool",
  {
    title: "Validate Local Enact Tool",
    description: "Validate the structure and syntax of a local Enact YAML tool file",
    inputSchema: {
      filePath: z.string().describe("Path to the local YAML tool file to validate")
    }
  },
  async ({ filePath }) => {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const yaml = await import('yaml');
      
      logger.info(`Validating local Enact tool: ${filePath}`);
      
      // Resolve file path
      const resolvedPath = path.resolve(filePath);
      
      // Check if file exists
      try {
        await fs.access(resolvedPath);
      } catch (error) {
        return {
          content: [{ 
            type: "text", 
            text: `❌ Tool file not found: ${resolvedPath}` 
          }],
          isError: true
        };
      }
      
      // Read and parse YAML
      let toolDefinition;
      try {
        const yamlContent = await fs.readFile(resolvedPath, 'utf-8');
        toolDefinition = yaml.parse(yamlContent);
      } catch (error) {
        return {
          content: [{ 
            type: "text", 
            text: `❌ Failed to parse YAML file: ${error instanceof Error ? error.message : String(error)}` 
          }],
          isError: true
        };
      }
      
      // Validation results
      const validation = {
        valid: true,
        errors: [] as string[],
        warnings: [] as string[],
        info: [] as string[]
      };
      
      // Required fields
      const requiredFields = ['name', 'command'];
      requiredFields.forEach(field => {
        if (!toolDefinition[field]) {
          validation.errors.push(`Missing required field: ${field}`);
          validation.valid = false;
        }
      });
      
      // Recommended fields
      const recommendedFields = ['description', 'version', 'enact'];
      recommendedFields.forEach(field => {
        if (!toolDefinition[field]) {
          validation.warnings.push(`Missing recommended field: ${field}`);
        }
      });
      
      // Field validations
      if (toolDefinition.name && typeof toolDefinition.name !== 'string') {
        validation.errors.push('Field "name" must be a string');
        validation.valid = false;
      }
      
      if (toolDefinition.command && typeof toolDefinition.command !== 'string') {
        validation.errors.push('Field "command" must be a string');
        validation.valid = false;
      }
      
      if (toolDefinition.inputSchema && typeof toolDefinition.inputSchema !== 'object') {
        validation.errors.push('Field "inputSchema" must be an object');
        validation.valid = false;
      }
      
      if (toolDefinition.outputSchema && typeof toolDefinition.outputSchema !== 'object') {
        validation.errors.push('Field "outputSchema" must be an object');
        validation.valid = false;
      }
      
      if (toolDefinition.tags && !Array.isArray(toolDefinition.tags)) {
        validation.errors.push('Field "tags" must be an array');
        validation.valid = false;
      }
      
      // Info about the tool
      validation.info.push(`Tool name: ${toolDefinition.name || 'Unknown'}`);
      validation.info.push(`Description: ${toolDefinition.description || 'No description'}`);
      validation.info.push(`Version: ${toolDefinition.version || 'No version'}`);
      validation.info.push(`Enact version: ${toolDefinition.enact || 'Not specified'}`);
      validation.info.push(`Command: ${toolDefinition.command || 'No command'}`);
      
      if (toolDefinition.tags && Array.isArray(toolDefinition.tags)) {
        validation.info.push(`Tags: ${toolDefinition.tags.join(', ')}`);
      }
      
      if (toolDefinition.timeout) {
        validation.info.push(`Timeout: ${toolDefinition.timeout}`);
      }
      
      if (toolDefinition.env) {
        const envVarCount = Object.keys(toolDefinition.env).length;
        validation.info.push(`Environment variables: ${envVarCount}`);
      }
      
      // Format output
      let output = `🔍 Validation Results for: ${path.basename(filePath)}\n`;
      output += `${'='.repeat(50)}\n\n`;
      output += `File: ${resolvedPath}\n`;
      output += `Status: ${validation.valid ? '✅ VALID' : '❌ INVALID'}\n\n`;
      
      if (validation.errors.length > 0) {
        output += `❌ Errors (${validation.errors.length}):\n`;
        validation.errors.forEach(error => {
          output += `  • ${error}\n`;
        });
        output += `\n`;
      }
      
      if (validation.warnings.length > 0) {
        output += `⚠️ Warnings (${validation.warnings.length}):\n`;
        validation.warnings.forEach(warning => {
          output += `  • ${warning}\n`;
        });
        output += `\n`;
      }
      
      if (validation.info.length > 0) {
        output += `ℹ️ Tool Information:\n`;
        validation.info.forEach(info => {
          output += `  • ${info}\n`;
        });
        output += `\n`;
      }
      
      if (validation.valid) {
        output += `💡 This tool is ready to execute with "execute-local-enact-tool".`;
      } else {
        output += `💡 Fix the errors above before executing this tool.`;
      }
      
      return {
        content: [{ 
          type: "text", 
          text: output
        }],
        isError: !validation.valid
      };
    } catch (error) {
      logger.error(`Error validating local Enact tool:`, error);
      return {
        content: [{ 
          type: "text", 
          text: `❌ Error validating local Enact tool: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// Helper function to register a tool dynamically
async function registerDynamicTool(tool: any, verificationInfo: { isValid: boolean; message: string; policy: string }): Promise<void> {
  const toolName = `enact-${tool.name.replace(/[^a-zA-Z0-9-_]/g, '-')}`;
  
  // Build description with signature verification info
  let description = tool.description || `Execute ${tool.name} tool`;
  const status = verificationInfo.isValid ? '✅' : '❌';
  description += `\n\n🔐 Signature Status: ${status} ${verificationInfo.message}`;
  description += `\n📋 Policy: ${verificationInfo.policy}`;
  
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
    description: "Register a tool as an MCP tool using direct core integration with mandatory signature verification",
    inputSchema: {
      name: z.string().describe("Name of the tool to register"),
      verifyPolicy: z.enum(['permissive', 'enterprise', 'paranoid']).optional().describe("Verification policy for signature checking")
    }
  },
  async ({ name, verifyPolicy = 'permissive' }) => {
    try {
      logger.info(`Registering tool via direct core library: ${name} with policy: ${verifyPolicy}`);
      
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
      
      // Verify the tool's signature (MANDATORY - no execution without verification)
      logger.info(`Performing mandatory signature verification for: ${name} with policy: ${verifyPolicy}`);
      
      // Determine verification policy
      const policyKey = verifyPolicy.toUpperCase() as keyof typeof VERIFICATION_POLICIES;
      const policy: VerificationPolicy = VERIFICATION_POLICIES[policyKey] || VERIFICATION_POLICIES.PERMISSIVE;
      
      // Verify the tool
      const verificationResult = await verifyTool(tool, policy);
      
      if (!verificationResult.isValid) {
        let errorMessage = `❌ Tool "${name}" signature verification failed.\n\n`;
        errorMessage += `Policy: ${verifyPolicy}\n`;
        errorMessage += `Valid signatures: ${verificationResult.validSignatures}/${verificationResult.totalSignatures}\n`;
        
        if (verificationResult.errors.length > 0) {
          errorMessage += `\nErrors:\n`;
          verificationResult.errors.forEach(error => {
            errorMessage += `  • ${error}\n`;
          });
        }
        
        errorMessage += `\n💡 You can:\n`;
        errorMessage += `  • Use a different verification policy (permissive/enterprise/paranoid)\n`;
        errorMessage += `  • Verify the tool's signatures manually using 'enact sign verify'\n`;
        errorMessage += `  • Ensure the tool has valid cryptographic signatures before registration\n`;
        
        return {
          content: [{ 
            type: "text", 
            text: errorMessage
          }],
          isError: true
        };
      }
      
      logger.info(`✅ Tool "${name}" signature verification passed: ${verificationResult.message}`);
      
      // Register it as a dynamic tool with verification info
      await registerDynamicTool(tool, {
        isValid: verificationResult.isValid,
        message: verificationResult.message,
        policy: verifyPolicy
      });
      
      return {
        content: [{ 
          type: "text", 
          text: `✅ Successfully registered tool: ${name} (signature verified with ${verifyPolicy} policy)` 
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

// List available local tools/executables in PATH
server.registerTool(
  "list-local-tools",
  {
    title: "List Local Tools",
    description: "List available tools/executables in the system PATH",
    inputSchema: {
      filter: z.string().optional().describe("Filter tools by name pattern"),
      limit: z.number().default(50).describe("Maximum number of tools to return")
    }
  },
  async ({ filter, limit = 50 }) => {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      logger.info(`Listing local tools with filter: ${filter || 'none'}`);
      
      // Get PATH directories
      const pathDirs = process.env.PATH?.split(':') || [];
      const tools = new Set<string>();
      
      // Use 'which' command to find executables (works on macOS/Linux)
      try {
        const { stdout } = await execAsync('ls /usr/bin /usr/local/bin ~/.local/bin 2>/dev/null | head -100');
        const binaries = stdout.split('\n').filter(Boolean);
        
        binaries.forEach(binary => {
          if (!filter || binary.toLowerCase().includes(filter.toLowerCase())) {
            tools.add(binary);
          }
        });
      } catch (error) {
        // Fallback: just list some common tools
        const commonTools = [
          'ls', 'cat', 'grep', 'sed', 'awk', 'sort', 'uniq', 'head', 'tail',
          'find', 'xargs', 'curl', 'wget', 'git', 'npm', 'node', 'python3',
          'python', 'pip', 'pip3', 'docker', 'kubectl', 'terraform', 'aws',
          'gcloud', 'az', 'jq', 'yq', 'make', 'cmake', 'gcc', 'clang',
          'java', 'javac', 'mvn', 'gradle', 'go', 'cargo', 'rustc'
        ];
        
        commonTools.forEach(tool => {
          if (!filter || tool.toLowerCase().includes(filter.toLowerCase())) {
            tools.add(tool);
          }
        });
      }
      
      const toolsList = Array.from(tools).slice(0, limit).sort();
      
      let output = `🔧 Available Local Tools (${toolsList.length}${toolsList.length >= limit ? '+' : ''})\n`;
      output += `${'='.repeat(50)}\n\n`;
      
      if (toolsList.length === 0) {
        output += `No tools found`;
        if (filter) {
          output += ` matching filter: ${filter}`;
        }
        output += `\n\n💡 Try without a filter or use a different pattern.`;
      } else {
        // Group tools by type/category
        const categories: Record<string, string[]> = {
          'System': [],
          'Development': [],
          'Network': [],
          'Cloud': [],
          'Other': []
        };
        
        toolsList.forEach(tool => {
          if (['ls', 'cat', 'grep', 'sed', 'awk', 'sort', 'uniq', 'head', 'tail', 'find', 'xargs'].includes(tool)) {
            categories['System'].push(tool);
          } else if (['git', 'npm', 'node', 'python3', 'python', 'pip', 'pip3', 'make', 'cmake', 'gcc', 'clang', 'java', 'javac', 'mvn', 'gradle', 'go', 'cargo', 'rustc'].includes(tool)) {
            categories['Development'].push(tool);
          } else if (['curl', 'wget', 'ssh', 'scp', 'rsync', 'nc', 'nmap'].includes(tool)) {
            categories['Network'].push(tool);
          } else if (['docker', 'kubectl', 'terraform', 'aws', 'gcloud', 'az'].includes(tool)) {
            categories['Cloud'].push(tool);
          } else {
            categories['Other'].push(tool);
          }
        });
        
        Object.entries(categories).forEach(([category, tools]) => {
          if (tools.length > 0) {
            output += `📁 ${category}:\n`;
            tools.forEach(tool => {
              output += `  • ${tool}\n`;
            });
            output += `\n`;
          }
        });
        
        if (filter) {
          output += `\n🔍 Filtered by: ${filter}`;
        }
        
        output += `\n\n💡 Use "execute-local-tool" to run any of these tools with custom arguments.`;
      }
      
      return {
        content: [{ 
          type: "text", 
          text: output
        }]
      };
      
    } catch (error) {
      logger.error(`Error listing local tools:`, error);
      return {
        content: [{ 
          type: "text", 
          text: `❌ Error listing local tools: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// Check if a local tool exists
server.registerTool(
  "check-local-tool",
  {
    title: "Check Local Tool",
    description: "Check if a local tool/executable exists and get its information",
    inputSchema: {
      tool: z.string().describe("Name of the tool to check")
    }
  },
  async ({ tool }) => {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      logger.info(`Checking local tool: ${tool}`);
      
      // Use 'which' command to find the tool
      try {
        const { stdout: whichOutput } = await execAsync(`which ${tool}`);
        const toolPath = whichOutput.trim();
        
        // Get version if possible
        let version = 'Unknown';
        try {
          const { stdout: versionOutput } = await execAsync(`${tool} --version 2>/dev/null || ${tool} -v 2>/dev/null || echo "Version not available"`);
          version = versionOutput.trim().split('\n')[0];
        } catch (error) {
          // Version command failed, that's okay
        }
        
        // Get file info
        let fileInfo = '';
        try {
          const { stdout: lsOutput } = await execAsync(`ls -la "${toolPath}"`);
          fileInfo = lsOutput.trim();
        } catch (error) {
          // File info failed, that's okay
        }
        
        let output = `✅ Tool Found: ${tool}\n\n`;
        output += `📍 Path: ${toolPath}\n`;
        output += `📋 Version: ${version}\n`;
        if (fileInfo) {
          output += `📁 File Info: ${fileInfo}\n`;
        }
        output += `\n💡 Use "execute-local-tool" to run this tool with custom arguments.`;
        
        return {
          content: [{ 
            type: "text", 
            text: output
          }]
        };
        
      } catch (error) {
        return {
          content: [{ 
            type: "text", 
            text: `❌ Tool not found: ${tool}\n\nThe tool "${tool}" was not found in your PATH.\n\n💡 Make sure it's installed and available in your system PATH, or use the full path to the executable.` 
          }],
          isError: true
        };
      }
      
    } catch (error) {
      logger.error(`Error checking local tool:`, error);
      return {
        content: [{ 
          type: "text", 
          text: `❌ Error checking local tool: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// Start the server
async function main() {
  try {
    // Set up signal handlers for graceful shutdown
    process.on('SIGINT', () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      if (webServerInstance) {
        logger.info('Shutting down web server...');
        webServerInstance.close();
      }
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      if (webServerInstance) {
        logger.info('Shutting down web server...');
        webServerInstance.close();
      }
      process.exit(0);
    });
    
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logger.info("🚀 Enact MCP Server with Direct Core Integration started successfully");
    logger.info("💡 Use 'launch-env-manager-server' tool to start the web interface for environment management");
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

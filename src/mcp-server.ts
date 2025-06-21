#!/usr/bin/env node

// src/mcp-server.ts - Direct MCP server entry point using core library
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

// Set logger to use server logging

// Helper function for safe JSON stringification
function safeJsonStringify(obj: any, fallback: string = "Unable to stringify object"): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (error) {
    logger.error(`JSON stringify failed: ${error instanceof Error ? error.message : String(error)}`);
    return fallback;
  }
}

// Execute tool by name using core library directly
server.tool(
  "execute-tool-by-name", 
  "Execute an Enact tool by its name using direct core integration",
  { 
    name: z.string(), 
    inputs: z.record(z.any()).optional(),
    timeout: z.string().optional(),
    verifyPolicy: z.enum(['permissive', 'enterprise', 'paranoid']).optional(),
    skipVerification: z.boolean().optional(),
    force: z.boolean().optional(),
    dryRun: z.boolean().optional(),
    verbose: z.boolean().optional()
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

// Search tools using core library directly
server.tool(
  "enact-search-tools",
  "Search tools in the Enact ecosystem using direct core integration",
  { 
    query: z.string(),
    limit: z.number().optional(),
    tags: z.array(z.string()).optional(),
    author: z.string().optional(),
    format: z.enum(['json', 'table', 'list']).optional()
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

// Get tool information using core library directly
server.tool(
  "enact-get-tool-info",
  "Get detailed information about a specific tool using direct core integration",
  { 
    name: z.string(), 
    version: z.string().optional(),
    includeSignatureInfo: z.boolean().optional()
  },
  async (params) => {
    const { name, version, includeSignatureInfo } = params;
    
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
          text: `Tool information for ${name}:\n${safeJsonStringify(tool)}` 
        }]
      };
    } catch (error) {
      logger.error(`Error getting tool info:`, error);
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
server.tool(
  "enact-verify-tool",
  "Verify cryptographic signatures of a tool using direct core integration",
  { 
    name: z.string(),
    policy: z.enum(['permissive', 'enterprise', 'paranoid']).optional()
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
server.tool(
  "execute-raw-tool",
  "Execute an Enact tool from raw YAML definition using direct core integration",
  { 
    yaml: z.string(),
    inputs: z.record(z.any()).optional(),
    options: z.record(z.any()).optional()
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
server.tool(
  "enact-get-tools",
  "Get all tools with optional filters using direct core integration",
  { 
    limit: z.number().optional(),
    offset: z.number().optional(),
    tags: z.array(z.string()).optional(),
    author: z.string().optional()
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
server.tool(
  "enact-tool-exists",
  "Check if a tool exists in the registry using direct core integration",
  { name: z.string() },
  async ({ name }) => {
    try {
      logger.info(`Checking tool existence via direct core library: ${name}`);
      
      const exists = await enactCore.toolExists(name);
      
      return {
        content: [{ 
          type: "text", 
          text: `Tool "${name}" ${exists ? 'exists' : 'does not exist'} in the registry.` 
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
server.tool(
  "enact-search-and-register-tools",
  "Search tools and register the first result as a tool using direct core integration",
  { 
    query: z.string(),
    limit: z.number().optional(),
    tags: z.array(z.string()).optional(),
    author: z.string().optional()
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
server.tool(
  "enact-core-status",
  "Get status and capabilities of the direct core integration",
  {},
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
  server.tool(
    toolName,
    description,
    inputSchema,
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
    logger.info("Enact MCP Server with Direct Core Integration started successfully");
  } catch (error) {
    console.error("Server connection error:", error);
    if (error instanceof Error) {
      console.error("Stack trace:", error.stack);
    }
    process.exit(1);
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  main().catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
  });
}

export { server, enactCore };

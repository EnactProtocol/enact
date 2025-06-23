// src/core/EnactCore.ts - Core library for both CLI and MCP usage
import type { EnactTool, ExecutionResult, ExecutionEnvironment } from "../types.js";
import { EnactApiClient } from "../api/enact-api.js";
import { verifyToolSignature, verifyCommandSafety, sanitizeEnvironmentVariables } from "../security/security.js";
import { validateToolStructure, validateInputs, validateOutput } from "../exec/validate.js";
import { DirectExecutionProvider } from "./DirectExecutionProvider.js";
import { resolveToolEnvironmentVariables } from "../utils/env-loader.js";
import logger from "../exec/logger.js";
import yaml from 'yaml';

export interface EnactCoreOptions {
  apiUrl?: string;
  supabaseUrl?: string;
  executionProvider?: 'direct' | 'docker' | 'cloud';
  authToken?: string;
  verbose?: boolean;
  defaultTimeout?: string;
  verificationPolicy?: 'permissive' | 'enterprise' | 'paranoid';
}

export interface ToolSearchOptions {
  query: string;
  limit?: number;
  tags?: string[];
  author?: string;
  format?: 'json' | 'table' | 'list';
}

export interface ToolExecuteOptions {
  timeout?: string;
  verifyPolicy?: 'permissive' | 'enterprise' | 'paranoid';
  skipVerification?: boolean;
  force?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
}

export class EnactCore {
  private apiClient: EnactApiClient;
  private executionProvider: DirectExecutionProvider;
  private options: EnactCoreOptions;

  constructor(options: EnactCoreOptions = {}) {
    this.options = {
      apiUrl: 'https://enact.tools',
      supabaseUrl: 'https://xjnhhxwxovjifdxdwzih.supabase.co',
      executionProvider: 'direct',
      defaultTimeout: '30s',
      verificationPolicy: 'permissive',
      ...options
    };

    this.apiClient = new EnactApiClient(
      this.options.apiUrl,
      this.options.supabaseUrl
    );

    this.executionProvider = new DirectExecutionProvider();
  }

  /**
   * Set authentication token for API operations
   */
  setAuthToken(token: string): void {
    this.options.authToken = token;
  }

  /**
   * Search for tools
   */
  async searchTools(options: ToolSearchOptions): Promise<EnactTool[]> {
    try {
      logger.info(`Searching for tools with query: "${options.query}"`);
      
      const searchParams = {
        query: options.query,
        limit: options.limit,
        tags: options.tags
      };

      const results = await this.apiClient.searchTools(searchParams);
      
      // Parse and validate results
      const tools: EnactTool[] = [];
      for (const result of results) {
        if (result.name) {
          try {
            const tool = await this.getToolByName(result.name);
            if (tool) {
              tools.push(tool);
            }
          } catch (error) {
            logger.warn(`Failed to fetch tool ${result.name}:`, error);
          }
        }
      }

      logger.info(`Found ${tools.length} tools`);
      return tools;
    } catch (error) {
      logger.error('Error searching tools:', error);
      throw new Error(`Search failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get a specific tool by name
   */
  async getToolByName(name: string, version?: string): Promise<EnactTool | null> {
    try {
      logger.info(`Fetching tool: ${name}${version ? `@${version}` : ''}`);
      
      const response = await this.apiClient.getTool(name);
      
      if (!response) {
        logger.info(`Tool not found: ${name}`);
        return null;
      }

      // Parse tool from response
      let tool: EnactTool;
      
      if (response.content && typeof response.content === 'string') {
        tool = yaml.parse(response.content);
      } else if (response.raw_content && typeof response.raw_content === 'string') {
        try {
          tool = JSON.parse(response.raw_content);
        } catch {
          tool = yaml.parse(response.raw_content);
        }
        
        // Merge signature information
        if (response.signature || response.signatures) {
          tool.signature = response.signature;
          tool.signatures = response.signatures;
        }
      } else {
        // Map database fields to tool format
        tool = {
          name: response.name,
          description: response.description,
          command: response.command,
          timeout: response.timeout || '30s',
          tags: response.tags || [],
          license: response.license || response.spdx_license,
          outputSchema: response.output_schema || response.outputSchema,
          enact: response.protocol_version || response.enact || '1.0.0',
          version: response.version,
          inputSchema: response.input_schema || response.inputSchema,
          examples: response.examples,
          annotations: response.annotations,
          env: response.env_vars || response.env,
          resources: response.resources,
          signature: response.signature,
          signatures: response.signatures,
          namespace: response.namespace
        };
      }

      logger.info(`Successfully fetched tool: ${tool.name}`);
      return tool;
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        logger.info(`Tool not found: ${name}`);
        return null;
      }
      
      logger.error(`Error fetching tool: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Execute a tool by name
   */
  async executeToolByName(
    name: string, 
    inputs: Record<string, any> = {},
    options: ToolExecuteOptions = {}
  ): Promise<ExecutionResult> {
    const executionId = this.generateExecutionId();
    
    try {
      // Fetch the tool
      const tool = await this.getToolByName(name);
      
      if (!tool) {
        return {
          success: false,
          error: {
            message: `Tool not found: ${name}`,
            code: 'NOT_FOUND'
          },
          metadata: {
            executionId,
            toolName: name,
            executedAt: new Date().toISOString(),
            environment: 'direct'
          }
        };
      }

      // Execute the tool
      return await this.executeTool(tool, inputs, options);
    } catch (error) {
      return {
        success: false,
        error: {
          message: (error as Error).message,
          code: 'EXECUTION_ERROR'
        },
        metadata: {
          executionId,
          toolName: name,
          executedAt: new Date().toISOString(),
          environment: 'direct'
        }
      };
    }
  }

  /**
   * Execute a tool directly
   */
  async executeTool(
    tool: EnactTool, 
    inputs: Record<string, any> = {},
    options: ToolExecuteOptions = {}
  ): Promise<ExecutionResult> {
    const executionId = this.generateExecutionId();
    
    try {
      logger.info(`Executing tool: ${tool.name}`);

      // Validate tool structure
      validateToolStructure(tool);

      // Verify signature if present and not skipped
      if (!options.skipVerification && tool.signature) {
        const isValid = verifyToolSignature(tool);
        if (!isValid && this.options.verificationPolicy !== 'permissive') {
          return {
            success: false,
            error: {
              message: `Tool signature verification failed: ${tool.name}`,
              code: 'SIGNATURE_INVALID'
            },
            metadata: {
              executionId,
              toolName: tool.name,
              version: tool.version,
              executedAt: new Date().toISOString(),
              environment: 'direct',
              command: tool.command
            }
          };
        }
      }

      // Validate inputs
      const validatedInputs = validateInputs(tool, inputs);

      // Check command safety
      const safetyCheck = verifyCommandSafety(tool.command, tool);
      if (!safetyCheck.isSafe && !options.force) {
        return {
          success: false,
          error: {
            message: `Unsafe command blocked: ${safetyCheck.blocked?.join(', ')}`,
            code: 'COMMAND_UNSAFE',
            details: safetyCheck
          },
          metadata: {
            executionId,
            toolName: tool.name,
            version: tool.version,
            executedAt: new Date().toISOString(),
            environment: 'direct',
            command: tool.command
          }
        };
      }

      // Log warnings
      if (safetyCheck.warnings.length > 0) {
        safetyCheck.warnings.forEach((warning: string) => logger.warn(warning));
      }

      // Dry run - just validate and return
      if (options.dryRun) {
        return {
          success: true,
          output: {
            dryRun: true,
            tool: tool.name,
            command: tool.command,
            inputs: validatedInputs,
            safetyCheck
          },
          metadata: {
            executionId,
            toolName: tool.name,
            version: tool.version,
            executedAt: new Date().toISOString(),
            environment: 'direct',
            command: tool.command
          }
        };
      }

      // Setup execution environment
      // Load package environment variables from .env files
      const envResult = await resolveToolEnvironmentVariables(tool.name, tool.env);
      
      // Log any missing required environment variables
      if (envResult.missing.length > 0) {
        logger.warn(`Missing required environment variables: ${envResult.missing.join(', ')}`);
      }
      
      const environment: ExecutionEnvironment = {
        vars: {
          ...envResult.resolved,
          ...sanitizeEnvironmentVariables(validatedInputs)
        },
        resources: tool.resources,
        namespace: tool.namespace
      };

      // Setup execution provider
      await this.executionProvider.setup(tool);

      // Execute the tool
      const result = await this.executionProvider.execute(tool, validatedInputs, environment);

      // Validate output if schema is provided
      if (result.success && result.output && tool.outputSchema) {
        try {
          result.output = validateOutput(tool, result.output);
        } catch (error) {
          logger.warn(`Output validation failed: ${(error as Error).message}`);
        }
      }

      logger.info(`Tool execution completed: ${tool.name} (success: ${result.success})`);
      return result;

    } catch (error) {
      logger.error(`Error executing tool: ${(error as Error).message}`);
      
      return {
        success: false,
        error: {
          message: (error as Error).message,
          code: 'EXECUTION_ERROR',
          details: error
        },
        metadata: {
          executionId,
          toolName: tool.name,
          version: tool.version,
          executedAt: new Date().toISOString(),
          environment: 'direct',
          command: tool.command
        }
      };
    } finally {
      // Cleanup
      try {
        await this.executionProvider.cleanup();
      } catch (cleanupError) {
        logger.error('Error during cleanup:', cleanupError);
      }
    }
  }

  /**
   * Execute a tool from raw YAML definition
   */
  async executeRawTool(
    toolYaml: string,
    inputs: Record<string, any> = {},
    options: ToolExecuteOptions = {}
  ): Promise<ExecutionResult> {
    try {
      // Parse the YAML
      const tool = yaml.parse(toolYaml) as EnactTool;
      
      // Validate that it's a proper tool definition
      if (!tool || typeof tool !== 'object') {
        throw new Error('Invalid tool definition: YAML must contain a tool object');
      }
      
      // Check for required fields
      if (!tool.name || !tool.description || !tool.command) {
        throw new Error('Invalid tool definition: missing required fields (name, description, command)');
      }
      
      // Execute the tool
      return await this.executeTool(tool, inputs, options);
    } catch (error) {
      const executionId = this.generateExecutionId();
      
      return {
        success: false,
        error: {
          message: (error as Error).message,
          code: 'PARSE_ERROR'
        },
        metadata: {
          executionId,
          toolName: 'unknown',
          executedAt: new Date().toISOString(),
          environment: 'direct'
        }
      };
    }
  }

  /**
   * Verify a tool's signature
   */
  async verifyTool(name: string, policy?: string): Promise<{
    verified: boolean;
    signatures: any[];
    policy: string;
    errors?: string[];
  }> {
    try {
      const tool = await this.getToolByName(name);
      
      if (!tool) {
        return {
          verified: false,
          signatures: [],
          policy: policy || 'permissive',
          errors: [`Tool not found: ${name}`]
        };
      }

      const verified = verifyToolSignature(tool);
      const signatures: any[] = [];
      
      if (tool.signature) {
        signatures.push(tool.signature);
      }
      
      if (tool.signatures) {
        signatures.push(...Object.values(tool.signatures));
      }

      return {
        verified,
        signatures,
        policy: policy || 'permissive'
      };
    } catch (error) {
      return {
        verified: false,
        signatures: [],
        policy: policy || 'permissive',
        errors: [`Verification error: ${(error as Error).message}`]
      };
    }
  }

  /**
   * Check if a tool exists
   */
  async toolExists(name: string): Promise<boolean> {
    try {
      const tool = await this.getToolByName(name);
      return tool !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get tools by tags
   */
  async getToolsByTags(tags: string[], limit: number = 20): Promise<EnactTool[]> {
    return this.searchTools({
      query: tags.join(' '),
      tags,
      limit
    });
  }

  /**
   * Get tools by author
   */
  async getToolsByAuthor(author: string, limit: number = 20): Promise<EnactTool[]> {
    return this.searchTools({
      query: `author:${author}`,
      author,
      limit
    });
  }

  /**
   * Get all tools with filters
   */
  async getTools(options: {
    limit?: number;
    offset?: number;
    tags?: string[];
    author?: string;
  } = {}): Promise<EnactTool[]> {
    try {
      const apiResults = await this.apiClient.getTools(options);
      
      // Parse and validate results
      const tools: EnactTool[] = [];
      for (const result of apiResults) {
        if (result.name) {
          try {
            const tool = await this.getToolByName(result.name);
            if (tool) {
              tools.push(tool);
            }
          } catch (error) {
            logger.warn(`Failed to fetch tool ${result.name}:`, error);
          }
        }
      }

      return tools;
    } catch (error) {
      logger.error('Error getting tools:', error);
      throw new Error(`Failed to get tools: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get authentication status (placeholder - would need actual auth implementation)
   */
  async getAuthStatus(): Promise<{
    authenticated: boolean;
    user?: string;
    server?: string;
  }> {
    // This would need to check actual auth state
    // For now, return based on whether we have a token
    return {
      authenticated: !!this.options.authToken,
      server: this.options.apiUrl
    };
  }

  /**
   * Publish a tool (requires authentication)
   */
  async publishTool(tool: EnactTool): Promise<{ success: boolean; message: string }> {
    if (!this.options.authToken) {
      return {
        success: false,
        message: 'Authentication required to publish tools'
      };
    }

    try {
      validateToolStructure(tool);
      
      await this.apiClient.publishTool(tool, this.options.authToken);
      
      return {
        success: true,
        message: `Successfully published tool: ${tool.name}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to publish tool: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Get tool information (alias for getToolByName for consistency)
   */
  async getToolInfo(name: string, version?: string): Promise<EnactTool | null> {
    return this.getToolByName(name, version);
  }

  /**
   * Get core library status
   */
  async getStatus(): Promise<{
    executionProvider: string;
    apiUrl: string;
    verificationPolicy: string;
    defaultTimeout: string;
    authenticated: boolean;
  }> {
    const authStatus = await this.getAuthStatus();
    
    return {
      executionProvider: this.options.executionProvider || 'direct',
      apiUrl: this.options.apiUrl || 'https://enact.tools',
      verificationPolicy: this.options.verificationPolicy || 'permissive',
      defaultTimeout: this.options.defaultTimeout || '30s',
      authenticated: authStatus.authenticated
    };
  }

  /**
   * Generate execution ID
   */
  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

// Export a default instance
export const enactCore = new EnactCore();

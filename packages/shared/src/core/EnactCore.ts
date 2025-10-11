// src/core/EnactCore.ts - Core library for both CLI and MCP usage
import type {
	EnactTool,
	ExecutionResult,
	ExecutionEnvironment,
} from "../types.js";
import { EnactApiClient } from "../api/enact-api.js";
import {
	validateToolStructure,
	validateInputs,
	validateOutput,
} from "../exec/validate.js";
import { DirectExecutionProvider } from "./DirectExecutionProvider.js";
import { DaggerExecutionProvider } from "./DaggerExecutionProvider.js";
import { resolveToolEnvironmentVariables } from "../utils/env-loader.js";
import logger from "../exec/logger.js";
import yaml from "yaml";
import fs from "fs";
import path from "path";
import { CryptoUtils, KeyManager, SecurityConfigManager, SigningService } from "@enactprotocol/security";
import { getFrontendUrl, getApiUrl } from "../utils/config";
import { EnactToolDefinition } from "../api/types.js";

export interface EnactCoreOptions {
	apiUrl?: string;
	supabaseUrl?: string;
	executionProvider?: "direct" | "docker" | "dagger" | "cloud";
	authToken?: string;
	verbose?: boolean;
	defaultTimeout?: string;
	// Dagger-specific options
	daggerOptions?: {
		baseImage?: string;
		enableNetwork?: boolean;
		enableHostFS?: boolean;
		maxMemory?: string;
		maxCPU?: string;
	};
}

export interface ToolSearchOptions {
	query: string;
	limit?: number;
	tags?: string[];
	author?: string;
	format?: "json" | "table" | "list";
}

export interface ToolExecuteOptions {
	timeout?: string;
	force?: boolean;
	dryRun?: boolean;
	verbose?: boolean;
	isLocalFile?: boolean;
	dangerouslySkipVerification?: boolean;
	mount?: string; // Mount local directory to container (format: "localPath" or "localPath:containerPath")
}

export class EnactCore {
	private apiClient: EnactApiClient;
	private executionProvider: DirectExecutionProvider | DaggerExecutionProvider;
	private options: EnactCoreOptions;

	constructor(options: EnactCoreOptions = {}) {
		this.options = {
			apiUrl: "https://enact.tools", // Default, will be overridden by factory
			supabaseUrl: "https://xjnhhxwxovjifdxdwzih.supabase.co", // Default, will be overridden by factory
			executionProvider: "dagger",
			defaultTimeout: "30s",
			...options,
		};

		this.apiClient = new EnactApiClient(
			this.options.apiUrl!,
			this.options.supabaseUrl!,
		);

		// Initialize the appropriate execution provider
		this.executionProvider = this.createExecutionProvider();
	}

	/**
	 * Create EnactCore with config-based URLs
	 */
	static async create(options: EnactCoreOptions = {}): Promise<EnactCore> {
		const frontendUrl = options.apiUrl || await getFrontendUrl();
		const apiUrl = options.supabaseUrl || await getApiUrl();
		
		return new EnactCore({
			...options,
			apiUrl: frontendUrl,
			supabaseUrl: apiUrl,
		});
	}
	/**
	 * Set authentication token for API operations
	 */
	setAuthToken(token: string): void {
		this.options.authToken = token;
	}

	/**
	 * Static method to search for tools (no execution provider needed)
	 */
	static async searchTools(
		options: ToolSearchOptions,
		coreOptions: Pick<EnactCoreOptions, 'apiUrl' | 'supabaseUrl'> = {}
	): Promise<EnactTool[]> {
		const apiClient = new EnactApiClient(
			coreOptions.apiUrl || "https://enact.tools",
			coreOptions.supabaseUrl || "https://xjnhhxwxovjifdxdwzih.supabase.co"
		);

		try {
			logger.info(`Searching for tools with query: "${options.query}"`);

			const searchParams = {
				query: options.query,
				limit: options.limit,
				tags: options.tags,
			};

			const results = await apiClient.searchTools(searchParams);

			// Parse and validate results
			const tools: EnactTool[] = [];
			for (const result of results) {
				if (result.name) {
					try {
						const tool = await EnactCore.getToolByName(result.name, undefined, coreOptions);
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
			logger.error("Error searching tools:", error);

			// If it's a 502 error (API server issue), try fallback to local filtering
			if (error instanceof Error && error.message.includes("502")) {
				logger.info(
					"Search API unavailable, trying fallback to local filtering...",
				);
				return EnactCore.searchToolsFallback(options, coreOptions);
			}

			throw new Error(
				`Search failed: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Instance method wrapper for backward compatibility
	 */
	async searchTools(options: ToolSearchOptions): Promise<EnactTool[]> {
		return EnactCore.searchTools(options, this.options);
	}

	/**
	 * Static fallback search method that gets all tools and filters locally
	 */
	private static async searchToolsFallback(
		options: ToolSearchOptions,
		coreOptions: Pick<EnactCoreOptions, 'apiUrl' | 'supabaseUrl'> = {}
	): Promise<EnactTool[]> {
		const apiClient = new EnactApiClient(
			coreOptions.apiUrl || "https://enact.tools",
			coreOptions.supabaseUrl || "https://xjnhhxwxovjifdxdwzih.supabase.co"
		);

		try {
			logger.info("Using fallback search method...");

			// Get all tools (limited to avoid overwhelming the API)
			const allTools = await apiClient.getTools({
				limit: options.limit || 100,
			});

			// Filter tools locally based on search criteria
			const filteredTools: EnactTool[] = [];
			const query = options.query.toLowerCase();

			for (const result of allTools) {
				if (result.name) {
					try {
						const tool = await EnactCore.getToolByName(result.name, undefined, coreOptions);
						if (tool) {
							// Check if tool matches search criteria
							const matchesQuery =
								tool.name.toLowerCase().includes(query) ||
								(tool.description &&
									tool.description.toLowerCase().includes(query)) ||
								(tool.tags &&
									tool.tags.some((tag) => tag.toLowerCase().includes(query)));

							const matchesTags =
								!options.tags ||
								!options.tags.length ||
								(tool.tags &&
									options.tags.some((searchTag) =>
										tool.tags!.some((toolTag) =>
											toolTag.toLowerCase().includes(searchTag.toLowerCase()),
										),
									));

							const matchesAuthor =
								!options.author ||
								(tool.authors &&
									tool.authors.some(
										(author) =>
											author.name &&
											author.name
												.toLowerCase()
												.includes(options.author!.toLowerCase()),
									));

							if (matchesQuery && matchesTags && matchesAuthor) {
								filteredTools.push(tool);

								// Apply limit if specified
								if (options.limit && filteredTools.length >= options.limit) {
									break;
								}
							}
						}
					} catch (error) {
						logger.warn(
							`Failed to fetch tool ${result.name} in fallback search:`,
							error,
						);
					}
				}
			}

			logger.info(`Fallback search found ${filteredTools.length} tools`);
			return filteredTools;
		} catch (fallbackError) {
			logger.error("Fallback search also failed:", fallbackError);
			throw new Error(
				`Search failed (including fallback): ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`,
			);
		}
	}

	/**
	 * Static method to get a specific tool by name
	 */
	static async getToolByName(
		name: string,
		version?: string,
		coreOptions: Pick<EnactCoreOptions, 'apiUrl' | 'supabaseUrl'> = {}
	): Promise<EnactTool | null> {
		const apiClient = new EnactApiClient(
			coreOptions.apiUrl || "https://enact.tools",
			coreOptions.supabaseUrl || "https://xjnhhxwxovjifdxdwzih.supabase.co"
		);

		try {
			logger.info(`Fetching tool: ${name}${version ? `@${version}` : ""}`);

			const response = await apiClient.getTool(name);

			if (!response) {
				logger.info(`Tool not found: ${name}`);
				return null;
			}

			// Parse tool from response - prefer raw_content for signature compatibility
			let tool: EnactTool;

			// Try raw_content first (contains original tool definition with correct field names for signatures)
			if (response.raw_content && typeof response.raw_content === "string") {
				try {
					tool = JSON.parse(response.raw_content);
				} catch {
					tool = yaml.parse(response.raw_content);
				}

				// Merge signature information from response if not already in raw content
				if (!tool.signature && response.signature) {
					tool.signature = response.signature;
				}
				if (!tool.signatures && response.signatures) {
					// Convert object format to array format
					if (Array.isArray(response.signatures)) {
						tool.signatures = response.signatures;
					} else {
						// Convert object format {keyId: signatureData} to array format
						tool.signatures = Object.values(response.signatures);
					}
				}
			} else if (response.content && typeof response.content === "string") {
				tool = yaml.parse(response.content);
				
				// Merge signature information
				if (!tool.signature && response.signature) {
					tool.signature = response.signature;
				}
				if (!tool.signatures && response.signatures) {
					// Convert object format to array format
					if (Array.isArray(response.signatures)) {
						tool.signatures = response.signatures;
					} else {
						// Convert object format {keyId: signatureData} to array format
						tool.signatures = Object.values(response.signatures);
					}
				}
			} else {
				// Fallback: map database fields to tool format (may cause signature verification issues)
				tool = {
					id: response.id,
					name: response.name,
					description: response.description,
					command: response.command,
					timeout: response.timeout || "30s",
					tags: response.tags || [],
					license: response.license || response.spdx_license,
					outputSchema: response.output_schema || response.outputSchema,
					enact: response.protocol_version || response.enact || "1.0.0",
					version: response.version,
					inputSchema: response.input_schema || response.inputSchema,
					examples: response.examples,
					annotations: response.annotations,
					env: response.env_vars || response.env,
					resources: response.resources,
					signature: response.signature,
					signatures: response.signatures ? (Array.isArray(response.signatures) ? response.signatures : Object.values(response.signatures)) : undefined,
					namespace: response.namespace,
				};
			}

			logger.info(`Successfully fetched tool: ${tool.name}`);
			return tool;
		} catch (error) {
			if (error instanceof Error && error.message.includes("404")) {
				logger.info(`Tool not found: ${name}`);
				return null;
			}

			logger.error(
				`Error fetching tool: ${error instanceof Error ? error.message : String(error)}`,
			);
			throw error;
		}
	}

	/**
	 * Instance method wrapper for backward compatibility
	 */
	async getToolByName(
		name: string,
		version?: string,
	): Promise<EnactTool | null> {
		return EnactCore.getToolByName(name, version, this.options);
	}

	/**
	 * Execute a tool by name
	 */
	async executeToolByName(
		name: string,
		inputs: Record<string, any> = {},
		options: ToolExecuteOptions = {},
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
						code: "NOT_FOUND",
					},
					metadata: {
						executionId,
						toolName: name,
						executedAt: new Date().toISOString(),
						environment: "direct",
					},
				};
			}

			// Execute the tool
			return await this.executeTool(tool, inputs, options);
		} catch (error) {
			return {
				success: false,
				error: {
					message: (error as Error).message,
					code: "EXECUTION_ERROR",
				},
				metadata: {
					executionId,
					toolName: name,
					executedAt: new Date().toISOString(),
					environment: "direct",
				},
			};
		}
	}

public static async checkToolVerificationStatus(tool: EnactToolDefinition): Promise<boolean> {
	const documentForVerification = {
		command: tool.command,
		description: tool.description,
		from: tool.from,
		name: tool.name,
		signatures: tool.signatures?.map(sig => ({
			signature: sig.value,
			publicKey: "", // TODO: Look up the correct public key
			algorithm: sig.algorithm,
			timestamp: new Date(sig.created).getTime(),
		})),
	};
	
	let isValid = false;

	if (tool.signatures && tool.signatures.length > 0) {
		isValid = tool.signatures.some(sig => {
			const referenceSignature = {
				signature: sig.value,
				publicKey: "", // TODO: Lookup correct public key based on signature UUID
				algorithm: sig.algorithm,
				timestamp: new Date(sig.created).getTime()
			};

			return SigningService.verifyDocument(
				documentForVerification,
				referenceSignature,
				{ includeFields: ['command', 'description', 'from', 'name'] }
			);
		});
	}

	return isValid;
}
		

private async verifyTool(tool: EnactTool, dangerouslySkipVerification: boolean = false): Promise<void> {
    if (dangerouslySkipVerification) {
        logger.warn(`Skipping signature verification for tool: ${tool.name}`);
        return;
    }

    try {
		if (!tool.signatures || tool.signatures.length === 0) {
			throw new Error(`Tool ${tool.name} does not have any signatures`);
		}
	
		// const documentForVerification = {
		// 	command: tool.command,
		// 	description: tool.description,
		// 	from: tool.from,
		// 	name: tool.name,
		// };

       	// const referenceSignature = {
		// 		signature: tool.signatures[0].value,
		// 		publicKey: "", // Correct public key for UUID 71e02e2c-148c-4534-9900-bd9646e99333
		// 		algorithm: tool.signatures[0].algorithm,
		// 		timestamp: new Date(tool.signatures[0].created).getTime()
		// 	};

        
//         // Check what canonical document looks like
//         const canonicalDoc = SigningService.getCanonicalDocument(documentForVerification,     { includeFields:  ['command', 'description', 'from', 'name'] } 
// );
        
//         const docString = JSON.stringify(canonicalDoc);
//         const messageHash = CryptoUtils.hash(docString);
    
        
//         // Test direct crypto verification
//         const directVerify = CryptoUtils.verify(
//             referenceSignature.publicKey,
//             messageHash,
//             referenceSignature.signature
//         );
        
        // Check trusted keys
        // const trustedKeys = KeyManager.getAllTrustedPublicKeys();

        const isValid = await EnactCore.checkToolVerificationStatus(tool);
        
        console.log("Final verification result:", isValid);

        if (!isValid) {
            throw new Error(`Tool ${tool.name} has invalid signatures`);
        }

        logger.info(`Tool ${tool.name} signature verification passed`);
    } catch (error) {
        logger.error(`Signature verification failed for tool ${tool.name}:`, error);
        throw new Error(`Signature verification failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}

	/**
	 * Execute a tool directly
	 */
	async executeTool(
		tool: EnactTool,
		inputs: Record<string, any> = {},
		options: ToolExecuteOptions = {},
	): Promise<ExecutionResult> {
		const executionId = this.generateExecutionId();

		try {
			logger.info(`Executing tool: ${tool.name}`);

			// Validate tool structure
			validateToolStructure(tool);

			// Validate inputs
			const validatedInputs = validateInputs(tool, inputs);
			const config = SecurityConfigManager.loadConfig(); 
		
			if( options.isLocalFile && config.allowLocalUnsigned){
				logger.warn(`Executing local file without signature verification: ${tool.name} (you can disallow in your security config)`);
			}
			if( options.dangerouslySkipVerification) {
				logger.warn(`Skipping signature verification for tool: ${tool.name} because of dangerouslySkipVerification option`);
			}
			const skipVerification = (options.isLocalFile && config.allowLocalUnsigned) || Boolean(options.dangerouslySkipVerification);
			// Verify tool signatures (unless explicitly skipped)
			await this.verifyTool(tool, skipVerification);

			// Resolve environment variables
			const { resolved: envVars } =
				await resolveToolEnvironmentVariables(tool.name, tool.env || {});


			// Execute the tool via the execution provider
			return await this.executionProvider.execute(
				tool,
				{ ...validatedInputs, ...envVars },
				{
					vars: { ...envVars, ...validatedInputs },
					resources: {
						timeout: options.timeout || tool.timeout || this.options.defaultTimeout,
					},
					mount: options.mount,
				},
			);
		} catch (error) {
			return {
				success: false,
				error: {
					message: (error as Error).message,
					code: "EXECUTION_ERROR",
				},
				metadata: {
					executionId,
					toolName: tool.name,
					executedAt: new Date().toISOString(),
					environment: "direct",
				},
			};
		}
	}

	/**
	 * Execute a tool from raw YAML definition
	 */
	async executeRawTool(
		toolYaml: string,
		inputs: Record<string, any> = {},
		options: ToolExecuteOptions = {},
	): Promise<ExecutionResult> {
		try {
			// Parse the YAML
			const tool = yaml.parse(toolYaml) as EnactTool;

			// Validate that it's a proper tool definition
			if (!tool || typeof tool !== "object") {
				throw new Error(
					"Invalid tool definition: YAML must contain a tool object",
				);
			}

			// Check for required fields
			if (!tool.name || !tool.description || !tool.command) {
				throw new Error(
					"Invalid tool definition: missing required fields (name, description, command)",
				);
			}

			// Execute the tool
			return await this.executeTool(tool, inputs, options);
		} catch (error) {
			const executionId = this.generateExecutionId();

			return {
				success: false,
				error: {
					message: (error as Error).message,
					code: "PARSE_ERROR",
				},
				metadata: {
					executionId,
					toolName: "unknown",
					executedAt: new Date().toISOString(),
					environment: "direct",
				},
			};
		}
	}


	/**
	 * Static method to check if a tool exists
	 */
	static async toolExists(
		name: string,
		coreOptions: Pick<EnactCoreOptions, 'apiUrl' | 'supabaseUrl'> = {}
	): Promise<boolean> {
		try {
			const tool = await EnactCore.getToolByName(name, undefined, coreOptions);
			return tool !== null;
		} catch (error) {
			return false;
		}
	}

	/**
	 * Instance method wrapper for backward compatibility
	 */
	async toolExists(name: string): Promise<boolean> {
		return EnactCore.toolExists(name, this.options);
	}

	/**
	 * Get tools by tags
	 */
	async getToolsByTags(
		tags: string[],
		limit: number = 20,
	): Promise<EnactTool[]> {
		return EnactCore.searchTools({
			query: tags.join(" "),
			tags,
			limit,
		}, this.options);
	}

	/**
	 * Get tools by author
	 */
	async getToolsByAuthor(
		author: string,
		limit: number = 20,
	): Promise<EnactTool[]> {
		return EnactCore.searchTools({
			query: `author:${author}`,
			author,
			limit,
		}, this.options);
	}

	/**
	 * Static method to get all tools with filters
	 */
	static async getTools(
		options: {
			limit?: number;
			offset?: number;
			tags?: string[];
			author?: string;
		} = {},
		coreOptions: Pick<EnactCoreOptions, 'apiUrl' | 'supabaseUrl'> = {}
	): Promise<EnactTool[]> {
		const apiClient = new EnactApiClient(
			coreOptions.apiUrl || "https://enact.tools",
			coreOptions.supabaseUrl || "https://xjnhhxwxovjifdxdwzih.supabase.co"
		);

		try {
			const apiResults = await apiClient.getTools(options);

			// Parse and validate results
			const tools: EnactTool[] = [];
			for (const result of apiResults) {
				if (result.name) {
					try {
						const tool = await EnactCore.getToolByName(result.name, undefined, coreOptions);
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
			logger.error("Error getting tools:", error);
			throw new Error(
				`Failed to get tools: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Instance method wrapper for backward compatibility
	 */
	async getTools(
		options: {
			limit?: number;
			offset?: number;
			tags?: string[];
			author?: string;
		} = {},
	): Promise<EnactTool[]> {
		return EnactCore.getTools(options, this.options);
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
			server: this.options.apiUrl,
		};
	}

	/**
	 * Static method to publish a tool
	 */
	static async publishTool(
		tool: EnactTool,
		authToken: string,
		coreOptions: Pick<EnactCoreOptions, 'apiUrl' | 'supabaseUrl'> = {}
	): Promise<{ success: boolean; message: string }> {
		const apiClient = new EnactApiClient(
			coreOptions.apiUrl || "https://enact.tools",
			coreOptions.supabaseUrl || "https://xjnhhxwxovjifdxdwzih.supabase.co"
		);

		try {
			validateToolStructure(tool);

			await apiClient.publishTool(tool, authToken);

			return {
				success: true,
				message: `Successfully published tool: ${tool.name}`,
			};
		} catch (error) {
			return {
				success: false,
				message: `Failed to publish tool: ${error instanceof Error ? error.message : String(error)}`,
			};
		}
	}

	/**
	 * Instance method wrapper for backward compatibility
	 */
	async publishTool(
		tool: EnactTool,
	): Promise<{ success: boolean; message: string }> {
		if (!this.options.authToken) {
			return {
				success: false,
				message: "Authentication required to publish tools",
			};
		}

		return EnactCore.publishTool(tool, this.options.authToken, this.options);
	}

	/**
	 * Get tool information (alias for getToolByName for consistency)
	 */
	async getToolInfo(name: string, version?: string): Promise<EnactTool | null> {
		return EnactCore.getToolByName(name, version, this.options);
	}

	/**
	 * Get core library status
	 */
	async getStatus(): Promise<{
		executionProvider: string;
		apiUrl: string;
		defaultTimeout: string;
		authenticated: boolean;
	}> {
		const authStatus = await this.getAuthStatus();

		return {
			executionProvider: this.options.executionProvider || "direct",
			apiUrl: this.options.apiUrl || "https://enact.tools",
			defaultTimeout: this.options.defaultTimeout || "30s",
			authenticated: authStatus.authenticated,
		};
	}

	/**
	 * Create the appropriate execution provider based on options
	 */
	private createExecutionProvider():
		| DirectExecutionProvider
		| DaggerExecutionProvider {
		switch (this.options.executionProvider) {
			case "direct":
				return new DirectExecutionProvider();
			case "dagger":
			default:
				return new DaggerExecutionProvider(this.options.daggerOptions);
		}
	}

	/**
	 * Switch execution provider at runtime
	 */
	switchExecutionProvider(provider: "direct" | "dagger", options?: any): void {
		this.options.executionProvider = provider;
		this.executionProvider = this.createExecutionProvider();
	}

	/**
	 * Generate execution ID
	 */
	private generateExecutionId(): string {
		return `exec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
	}
}

// No default instance to avoid eager initialization of Dagger

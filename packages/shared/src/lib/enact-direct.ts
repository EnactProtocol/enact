// src/lib/enact-direct.ts - Library interface for direct usage by MCP servers
import {
	EnactCore,
	type ToolSearchOptions,
	type ToolExecuteOptions,
} from "../core/EnactCore";
import type { EnactTool, ExecutionResult } from "../types";

/**
 * Direct Enact Library Interface
 *
 * This provides a simple, direct interface for MCP servers to use Enact
 * without any CLI process spawning. All operations happen in-process.
 */
export class EnactDirect {
	private core: EnactCore;

	constructor(
		options: {
			apiUrl?: string;
			supabaseUrl?: string;
			authToken?: string;
			defaultTimeout?: string;
		} = {},
	) {
		this.core = new EnactCore({
			apiUrl:
				options.apiUrl || process.env.ENACT_API_URL || "https://enact.tools",
			supabaseUrl:
				options.supabaseUrl ||
				process.env.ENACT_SUPABASE_URL ||
				"https://xjnhhxwxovjifdxdwzih.supabase.co",
			executionProvider: "direct",
			authToken: options.authToken || process.env.ENACT_AUTH_TOKEN,
			defaultTimeout: options.defaultTimeout || "30s",
		});
	}

	/**
	 * Execute a tool by name with inputs
	 *
	 * @param name - Tool name (e.g., "my-org/data-processor")
	 * @param inputs - Input parameters for the tool
	 * @param options - Execution options
	 * @returns Execution result
	 */
	async executeToolByName(
		name: string,
		inputs: Record<string, any> = {},
		options: ToolExecuteOptions = {},
	): Promise<ExecutionResult> {
		return this.core.executeToolByName(name, inputs, options);
	}

	/**
	 * Search for tools matching a query
	 *
	 * @param options - Search options
	 * @returns Array of matching tools
	 */
	async searchTools(options: ToolSearchOptions): Promise<EnactTool[]> {
		return this.core.searchTools(options);
	}

	/**
	 * Get detailed information about a specific tool
	 *
	 * @param name - Tool name
	 * @param version - Optional specific version
	 * @returns Tool information or null if not found
	 */
	async getToolInfo(name: string, version?: string): Promise<EnactTool | null> {
		return this.core.getToolInfo(name, version);
	}


	/**
	 * Execute a tool from raw YAML definition
	 *
	 * @param toolYaml - YAML tool definition
	 * @param inputs - Input parameters
	 * @param options - Execution options
	 * @returns Execution result
	 */
	async executeRawTool(
		toolYaml: string,
		inputs: Record<string, any> = {},
		options: ToolExecuteOptions = {},
	): Promise<ExecutionResult> {
		return this.core.executeRawTool(toolYaml, inputs, options);
	}

	/**
	 * Check if a tool exists in the registry
	 *
	 * @param name - Tool name
	 * @returns True if tool exists
	 */
	async toolExists(name: string): Promise<boolean> {
		return this.core.toolExists(name);
	}

	/**
	 * Get all tools with optional filtering
	 *
	 * @param options - Filter options
	 * @returns Array of tools
	 */
	async getTools(
		options: {
			limit?: number;
			offset?: number;
			tags?: string[];
			author?: string;
		} = {},
	): Promise<EnactTool[]> {
		return this.core.getTools(options);
	}

	/**
	 * Get tools by specific tags
	 *
	 * @param tags - Array of tags to filter by
	 * @param limit - Maximum number of results
	 * @returns Array of tools
	 */
	async getToolsByTags(
		tags: string[],
		limit: number = 20,
	): Promise<EnactTool[]> {
		return this.core.getToolsByTags(tags, limit);
	}

	/**
	 * Get tools by a specific author
	 *
	 * @param author - Author name
	 * @param limit - Maximum number of results
	 * @returns Array of tools
	 */
	async getToolsByAuthor(
		author: string,
		limit: number = 20,
	): Promise<EnactTool[]> {
		return this.core.getToolsByAuthor(author, limit);
	}

	/**
	 * Get the current status of the Enact core
	 *
	 * @returns Status information
	 */
	async getStatus(): Promise<{
		executionProvider: string;
		apiUrl: string;
		defaultTimeout: string;
		authenticated: boolean;
	}> {
		return this.core.getStatus();
	}

	/**
	 * Set authentication token
	 *
	 * @param token - Authentication token
	 */
	setAuthToken(token: string): void {
		this.core.setAuthToken(token);
	}

	/**
	 * Get authentication status
	 *
	 * @returns Authentication status
	 */
	async getAuthStatus(): Promise<{
		authenticated: boolean;
		user?: string;
		server?: string;
	}> {
		return this.core.getAuthStatus();
	}

	/**
	 * Publish a tool (requires authentication)
	 *
	 * @param tool - Tool definition to publish
	 * @returns Publication result
	 */
	async publishTool(
		tool: EnactTool,
	): Promise<{ success: boolean; message: string }> {
		return this.core.publishTool(tool);
	}
}

// Create and export a default instance
export const enactDirect = new EnactDirect();

// Export convenience functions using the default instance
export const executeToolByName = (
	name: string,
	inputs: Record<string, any> = {},
	options: ToolExecuteOptions = {},
) => enactDirect.executeToolByName(name, inputs, options);

export const searchTools = (options: ToolSearchOptions) =>
	enactDirect.searchTools(options);

export const getToolInfo = (name: string, version?: string) =>
	enactDirect.getToolInfo(name, version);

export const executeRawTool = (
	toolYaml: string,
	inputs: Record<string, any> = {},
	options: ToolExecuteOptions = {},
) => enactDirect.executeRawTool(toolYaml, inputs, options);

export const getToolsByTags = (tags: string[], limit: number = 20) =>
	enactDirect.getToolsByTags(tags, limit);

export const getToolsByAuthor = (author: string, limit: number = 20) =>
	enactDirect.getToolsByAuthor(author, limit);

export const toolExists = (name: string) => enactDirect.toolExists(name);

export const getAuthStatus = () => enactDirect.getAuthStatus();

export const publishTool = (tool: EnactTool) => enactDirect.publishTool(tool);

// Also export the core for advanced usage
export {
	EnactCore,
	type ToolSearchOptions,
	type ToolExecuteOptions,
} from "../core/EnactCore";
export type { EnactTool, ExecutionResult } from "../types";

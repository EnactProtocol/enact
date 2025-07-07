// src/services/McpCoreService.ts - Direct core integration for MCP server
import { EnactCore } from "../core/EnactCore";
import type { EnactTool, ExecutionResult } from "../types";
import type { ToolSearchOptions, ToolExecuteOptions } from "../core/EnactCore";

export class McpCoreService {
	private core: EnactCore;

	constructor(options?: {
		apiUrl?: string;
		supabaseUrl?: string;
		authToken?: string;
	}) {
		this.core = new EnactCore({
			apiUrl: options?.apiUrl || "https://enact.tools",
			supabaseUrl:
				options?.supabaseUrl || "https://xjnhhxwxovjifdxdwzih.supabase.co",
			authToken: options?.authToken,
		});
	}

	/**
	 * Set authentication token
	 */
	setAuthToken(token: string): void {
		this.core.setAuthToken(token);
	}

	/**
	 * Search for tools
	 */
	async searchTools(
		query: string,
		options?: {
			limit?: number;
			tags?: string[];
			author?: string;
		},
	): Promise<EnactTool[]> {
		const searchOptions: ToolSearchOptions = {
			query,
			limit: options?.limit,
			tags: options?.tags,
			author: options?.author,
		};

		return await this.core.searchTools(searchOptions);
	}

	/**
	 * Get a specific tool by name
	 */
	async getToolInfo(name: string): Promise<EnactTool | null> {
		return await this.core.getToolByName(name);
	}

	/**
	 * Execute a tool by name
	 */
	async executeToolByName(
		name: string,
		inputs: Record<string, any> = {},
		options?: {
			timeout?: string;
			verifyPolicy?: "permissive" | "enterprise" | "paranoid";
			skipVerification?: boolean;
			force?: boolean;
			dryRun?: boolean;
		},
	): Promise<ExecutionResult> {
		const executeOptions: ToolExecuteOptions = {
			timeout: options?.timeout,
			verifyPolicy: options?.verifyPolicy,
			skipVerification: options?.skipVerification,
			force: options?.force,
			dryRun: options?.dryRun,
		};

		return await this.core.executeToolByName(name, inputs, executeOptions);
	}

	/**
	 * Execute a tool from raw YAML definition
	 */
	async executeRawTool(
		toolYaml: string,
		inputs: Record<string, any> = {},
		options?: {
			timeout?: string;
			skipVerification?: boolean;
			force?: boolean;
			dryRun?: boolean;
		},
	): Promise<ExecutionResult> {
		const executeOptions: ToolExecuteOptions = {
			timeout: options?.timeout,
			skipVerification: options?.skipVerification,
			force: options?.force,
			dryRun: options?.dryRun,
		};

		return await this.core.executeRawTool(toolYaml, inputs, executeOptions);
	}

	/**
	 * Verify a tool's signature
	 */
	async verifyTool(
		name: string,
		policy?: string,
	): Promise<{
		verified: boolean;
		signatures: any[];
		policy: string;
		errors?: string[];
	}> {
		return await this.core.verifyTool(name, policy);
	}

	/**
	 * Check if a tool exists
	 */
	async toolExists(name: string): Promise<boolean> {
		return await this.core.toolExists(name);
	}

	/**
	 * Get tools by tags
	 */
	async getToolsByTags(
		tags: string[],
		limit: number = 20,
	): Promise<EnactTool[]> {
		return await this.core.getToolsByTags(tags, limit);
	}

	/**
	 * Get tools by author
	 */
	async getToolsByAuthor(
		author: string,
		limit: number = 20,
	): Promise<EnactTool[]> {
		return await this.core.getToolsByAuthor(author, limit);
	}

	/**
	 * Get all tools with filters
	 */
	async getTools(options?: {
		limit?: number;
		offset?: number;
		tags?: string[];
		author?: string;
	}): Promise<EnactTool[]> {
		return await this.core.getTools(options);
	}

	/**
	 * Get authentication status
	 */
	async getAuthStatus(): Promise<{
		authenticated: boolean;
		user?: string;
		server?: string;
	}> {
		return await this.core.getAuthStatus();
	}

	/**
	 * Check if service is available (always true for core service)
	 */
	async isAvailable(): Promise<boolean> {
		return true;
	}

	/**
	 * Get service path info (not applicable for core service)
	 */
	async getPathInfo(): Promise<{
		detectedPath: string | null;
		isAvailable: boolean;
		version?: string;
	}> {
		return {
			detectedPath: "core-library",
			isAvailable: true,
			version: "2.0.0-core",
		};
	}

	/**
	 * Publish a tool (requires authentication)
	 */
	async publishTool(
		tool: EnactTool,
	): Promise<{ success: boolean; message: string }> {
		return await this.core.publishTool(tool);
	}
}

// Create and export singleton instance
export const mcpCoreService = new McpCoreService();

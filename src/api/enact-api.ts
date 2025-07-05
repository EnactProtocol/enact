import {
	EnactToolDefinition,
	ToolUsage,
	ToolSearchQuery,
	CLITokenCreate,
	OAuthTokenExchange,
} from "./types";

export class EnactApiClient {
	baseUrl: string;
	supabaseUrl: string;

	constructor(
		baseUrl: string = "https://enact.tools",
		supabaseUrl: string = "https://xjnhhxwxovjifdxdwzih.supabase.co",
	) {
		this.baseUrl = baseUrl.replace(/\/$/, ""); // Remove trailing slash
		this.supabaseUrl = supabaseUrl.replace(/\/$/, "");
	}

	// Helper method to make authenticated requests
	private async makeRequest<T>(
		endpoint: string,
		options: RequestInit = {},
		token?: string,
		tokenType: "jwt" | "cli" = "jwt",
	): Promise<T> {
		const url = endpoint.startsWith("http")
			? endpoint
			: `${this.supabaseUrl}${endpoint}`;

		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			...(options.headers as Record<string, string>),
		};

		// Add authentication headers if token provided
		if (token) {
			if (tokenType === "jwt") {
				headers.Authorization = `Bearer ${token}`;
			} else {
				headers["X-API-Key"] = token;
			}
		}

		const response = await fetch(url, {
			...options,
			headers,
		});

		if (!response.ok) {
			const errorData = await response
				.json()
				.catch(() => ({ error: "Unknown error" }));
			throw new EnactApiError(
				`${(errorData as { error?: string }).error || response.statusText}`,
				response.status,
				endpoint,
			);
		}

		const responseData = await response.json();

		// Debug logging to help identify response structure issues
		if (process.env.NODE_ENV === "development" || process.env.DEBUG) {
			console.error(`API Response for ${endpoint}:`, responseData);
		}

		return responseData as T;
	}

	// =================
	// PUBLIC ENDPOINTS
	// =================

	/**
	 * Get all tools (public, no auth required)
	 */
	async getTools(params?: {
		limit?: number;
		offset?: number;
		tags?: string[];
		author?: string;
	}): Promise<EnactToolDefinition[]> {
		const searchParams = new URLSearchParams();
		if (params?.limit) searchParams.set("limit", params.limit.toString());
		if (params?.offset) searchParams.set("offset", params.offset.toString());
		if (params?.tags) searchParams.set("tags", params.tags.join(","));
		if (params?.author) searchParams.set("author", params.author);

		const query = searchParams.toString();
		const endpoint = `/functions/v1/tools${query ? `?${query}` : ""}`;

		const response = await this.makeRequest<any>(endpoint);

		// Handle different response structures
		if (Array.isArray(response)) {
			return response;
		} else if (response.data && Array.isArray(response.data)) {
			return response.data;
		} else if (response.tools && Array.isArray(response.tools)) {
			return response.tools;
		} else {
			console.warn("Unexpected response structure for getTools:", response);
			return [];
		}
	}

	/**
	 * Get specific tool details (public, no auth required)
	 */
	async getTool(name: string): Promise<EnactToolDefinition> {
		const endpoint = `/functions/v1/tools/${encodeURIComponent(name)}`;
		return this.makeRequest<EnactToolDefinition>(endpoint);
	}

	/**
	 * Get tool usage statistics (public, no auth required)
	 */
	async getToolUsage(name: string): Promise<any> {
		const endpoint = `/functions/v1/tools/${encodeURIComponent(name)}/usage`;
		return this.makeRequest(endpoint);
	}

	/**
	 * Log tool usage (public, no auth required)
	 */
	async logToolUsage(name: string, usage: ToolUsage): Promise<any> {
		const endpoint = `/functions/v1/tools/${encodeURIComponent(name)}/usage`;
		return this.makeRequest(endpoint, {
			method: "POST",
			body: JSON.stringify(usage),
		});
	}

	/**
	 * Search tools with semantic/text search (public, no auth required)
	 */
	async searchTools(query: ToolSearchQuery): Promise<EnactToolDefinition[]> {
		const endpoint = "/functions/v1/tools-search";

		try {
			// Log the request for debugging
			if (process.env.NODE_ENV === "development" || process.env.DEBUG) {
				console.error(
					`Search request to ${endpoint}:`,
					JSON.stringify(query, null, 2),
				);
			}

			const response = await this.makeRequest<any>(endpoint, {
				method: "POST",
				body: JSON.stringify(query),
			});

			// Handle different response structures
			if (Array.isArray(response)) {
				return response;
			} else if (response.data && Array.isArray(response.data)) {
				return response.data;
			} else if (response.results && Array.isArray(response.results)) {
				return response.results;
			} else if (response.tools && Array.isArray(response.tools)) {
				return response.tools;
			} else {
				console.warn(
					"Unexpected response structure for searchTools:",
					response,
				);
				return [];
			}
		} catch (error) {
			// Enhanced error logging
			if (error instanceof EnactApiError) {
				console.error(
					`Search API error (${error.statusCode}): ${error.message}`,
				);
				console.error(`Endpoint: ${error.endpoint}`);

				// If it's a 502 error, provide more specific guidance
				if (error.statusCode === 502) {
					console.error("502 Bad Gateway error - this usually indicates:");
					console.error("• The API server is temporarily unavailable");
					console.error("• The search service is overloaded");
					console.error("• Network connectivity issues");
					console.error("• Try again in a few moments");
				}
			} else {
				console.error("Unexpected search error:", error);
			}

			// Re-throw the error
			throw error;
		}
	}

	// ===================
	// AUTHENTICATED ENDPOINTS
	// ===================

	/**
	 * Publish/create new tool (requires authentication)
	 */
	async publishTool(
		tool: EnactToolDefinition,
		token: string,
		tokenType: "jwt" | "cli" = "cli",
	): Promise<any> {
		const endpoint = "/functions/v1/tools";
		return this.makeRequest(
			endpoint,
			{
				method: "POST",
				body: JSON.stringify(tool),
			},
			token,
			tokenType,
		);
	}

	/**
	 * Update existing tool (requires authentication, must be owner)
	 */
	async updateTool(
		name: string,
		tool: EnactToolDefinition,
		token: string,
		tokenType: "jwt" | "cli" = "cli",
	): Promise<any> {
		const endpoint = `/functions/v1/tools/${encodeURIComponent(name)}`;
		return this.makeRequest(
			endpoint,
			{
				method: "PUT",
				body: JSON.stringify(tool),
			},
			token,
			tokenType,
		);
	}

	/**
	 * Delete tool (requires authentication, must be owner)
	 */
	async deleteTool(
		name: string,
		token: string,
		tokenType: "jwt" | "cli" = "cli",
	): Promise<any> {
		const endpoint = `/functions/v1/tools/${encodeURIComponent(name)}`;
		return this.makeRequest(
			endpoint,
			{
				method: "DELETE",
			},
			token,
			tokenType,
		);
	}

	/**
	 * Create new CLI token (requires JWT authentication)
	 */
	async createCLIToken(
		tokenData: CLITokenCreate,
		jwtToken: string,
	): Promise<{ token: string; id: string; name?: string }> {
		const endpoint = "/functions/v1/cli-token";
		return this.makeRequest(
			endpoint,
			{
				method: "POST",
				body: JSON.stringify(tokenData),
			},
			jwtToken,
			"jwt",
		);
	}

	/**
	 * List user's CLI tokens (requires JWT authentication)
	 */
	async getCLITokens(jwtToken: string): Promise<any[]> {
		const endpoint = "/functions/v1/cli-token";
		return this.makeRequest(
			endpoint,
			{
				method: "GET",
			},
			jwtToken,
			"jwt",
		);
	}

	/**
	 * Delete CLI token (requires JWT authentication, must be owner)
	 */
	async deleteCLIToken(tokenId: string, jwtToken: string): Promise<any> {
		const endpoint = `/functions/v1/cli-token/${tokenId}`;
		return this.makeRequest(
			endpoint,
			{
				method: "DELETE",
			},
			jwtToken,
			"jwt",
		);
	}

	/**
	 * Exchange OAuth authorization code for access token
	 */
	async exchangeOAuthCode(oauthData: OAuthTokenExchange): Promise<{
		access_token: string;
		token_type: string;
		expires_in: number;
		scope?: string;
	}> {
		const endpoint = "/functions/v1/cli-oauth";
		return this.makeRequest(endpoint, {
			method: "POST",
			body: JSON.stringify(oauthData),
		});
	}

	/**
	 * Generate embeddings for tools (requires authentication)
	 */
	async generateEmbeddings(
		data: { toolId: string; text: string },
		token: string,
		tokenType: "jwt" | "cli" = "cli",
	): Promise<any> {
		const endpoint = "/functions/v1/generate-embeddings";
		return this.makeRequest(
			endpoint,
			{
				method: "POST",
				body: JSON.stringify(data),
			},
			token,
			tokenType,
		);
	}

	// ===================
	// CONVENIENCE METHODS
	// ===================

	/**
	 * Check if a tool exists
	 */
	async toolExists(name: string): Promise<boolean> {
		try {
			await this.getTool(name);
			return true;
		} catch (error) {
			if (error instanceof Error && error.message.includes("404")) {
				return false;
			}
			throw error;
		}
	}

	/**
	 * Publish or update tool based on existence
	 */
	async publishOrUpdateTool(
		tool: EnactToolDefinition,
		token: string,
		tokenType: "jwt" | "cli" = "cli",
	): Promise<{ isUpdate: boolean; result: any }> {
		let exists: boolean;
		try {
			exists = await this.toolExists(tool.name);
		} catch (error) {
			exists = false;
		}
		if (exists) {
			const result = await this.updateTool(tool.name, tool, token, tokenType);
			return { isUpdate: true, result };
		} else {
			const result = await this.publishTool(tool, token, tokenType);
			return { isUpdate: false, result };
		}
	}

	/**
	 * Search tools by tags
	 */
	async getToolsByTags(
		tags: string[],
		limit: number = 20,
	): Promise<EnactToolDefinition[]> {
		return this.searchTools({
			query: tags.join(" "),
			tags,
			limit,
		});
	}

	/**
	 * Get tools by author
	 */
	async getToolsByAuthor(
		author: string,
		limit: number = 20,
	): Promise<EnactToolDefinition[]> {
		return this.getTools({
			author,
			limit,
		});
	}

	/**
	 * Get a user's public key
	 */
	async getUserPublicKey(userId: string): Promise<any> {
		const url = `${this.supabaseUrl}/functions/v1/tools/user/public-key/${userId}`;

		const headers = {
			Accept: "application/json",
			"Content-Type": "application/json",
		};

		try {
			const response = await fetch(url, {
				method: "GET",
				headers,
			});
			if (!response.ok) {
				const errorText = await response.text();
				let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

				try {
					const errorJson = JSON.parse(errorText);
					if (errorJson.message) {
						errorMessage = errorJson.message;
					} else if (errorJson.error) {
						errorMessage = errorJson.error;
					}
				} catch {
					// If we can't parse JSON, stick with the original error message
				}

				throw new EnactApiError(errorMessage, response.status);
			}

			const data = await response.json();
			return data as any;
		} catch (error) {
			if (error instanceof EnactApiError) {
				throw error;
			}

			// Handle network errors
			if (error instanceof Error) {
				if (error.message.includes("fetch")) {
					throw new EnactApiError(
						"Network error: Could not connect to Enact API",
						0,
					);
				}
				throw new EnactApiError(error.message, 0);
			}

			throw new EnactApiError("Unknown error occurred", 0);
		}
	}

	// ===================
	// OAUTH FLOW HELPERS
	// ===================

	/**
	 * Generate OAuth authorization URL
	 */
	generateOAuthUrl(options: {
		clientId: string;
		redirectUri: string;
		scope: string;
		state: string;
		codeChallenge: string;
		codeChallengeMethod: string;
	}): string {
		const params = new URLSearchParams({
			response_type: "code",
			client_id: options.clientId,
			redirect_uri: options.redirectUri,
			scope: options.scope,
			state: options.state,
			code_challenge: options.codeChallenge,
			code_challenge_method: options.codeChallengeMethod,
		});

		return `${this.baseUrl}/auth/cli/oauth?${params.toString()}`;
	}

	/**
	 * Validate tool definition before publishing
	 */
	validateTool(tool: any): { valid: boolean; errors: string[] } {
		const errors: string[] = [];

		if (!tool.name || typeof tool.name !== "string") {
			errors.push("Tool name is required and must be a string");
		} else if (!/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_\/-]+$/.test(tool.name)) {
			errors.push(
				"Tool name must follow hierarchical format: org/package/tool-name",
			);
		}

		if (!tool.description || typeof tool.description !== "string") {
			errors.push("Tool description is required and must be a string");
		}

		if (!tool.command || typeof tool.command !== "string") {
			errors.push("Tool command is required and must be a string");
		}

		if (tool.timeout && typeof tool.timeout === "string") {
			if (!/^\d+[smh]$/.test(tool.timeout)) {
				errors.push(
					'Timeout must be in Go duration format (e.g., "30s", "5m", "1h")',
				);
			}
		}

		if (tool.tags && !Array.isArray(tool.tags)) {
			errors.push("Tags must be an array of strings");
		}

		if (tool.inputSchema && typeof tool.inputSchema !== "object") {
			errors.push("inputSchema must be a valid JSON Schema object");
		}

		if (tool.outputSchema && typeof tool.outputSchema !== "object") {
			errors.push("outputSchema must be a valid JSON Schema object");
		}

		return {
			valid: errors.length === 0,
			errors,
		};
	}
}

// Export a default instance
export const enactApi = new EnactApiClient();

// Export error types for better error handling
export class EnactApiError extends Error {
	constructor(
		message: string,
		public statusCode?: number,
		public endpoint?: string,
	) {
		super(message);
		this.name = "EnactApiError";
	}
}

// Helper function to create API client with custom configuration
export function createEnactApiClient(
	baseUrl?: string,
	supabaseUrl?: string,
): EnactApiClient {
	return new EnactApiClient(baseUrl, supabaseUrl);
}

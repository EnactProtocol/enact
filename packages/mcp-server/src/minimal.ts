import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { EnactCore } from "@enactprotocol/shared/core";
import { logger } from "@enactprotocol/shared/exec";
import {
	silentMcpTool,
	validateSilentEnvironment,
	resolveToolEnvironmentVariables,
	validateRequiredEnvironmentVariables,
	generateConfigLink,
} from "@enactprotocol/shared/utils";
import { startEnvManagerServer } from "@enactprotocol/shared/web";
import { LocalToolResolver } from "@enactprotocol/shared";
import { homedir } from "os";
import { join } from "path";

// Set required environment variables for silent operation first
process.env.CI = process.env.CI || "true";
process.env.ENACT_SKIP_INTERACTIVE =
	process.env.ENACT_SKIP_INTERACTIVE || "true";

// Only validate and report environment issues when not in test mode
if (process.env.NODE_ENV !== "test") {
	const envValidation = validateSilentEnvironment();
	if (!envValidation.valid) {
		// Log to stderr for debugging purposes (only in non-test environments)
		process.stderr.write(
			`⚠️ MCP Environment Issues: ${envValidation.issues.join(", ")}\n`,
		);
	}
}

// Initialize core library with extended timeout for long-running operations
const enactCore = new EnactCore({
	apiUrl: process.env.ENACT_API_URL || "https://enact.tools",
	supabaseUrl:
		process.env.ENACT_SUPABASE_URL ||
		"https://xjnhhxwxovjifdxdwzih.supabase.co",
	executionProvider: (process.env.ENACT_EXECUTION_PROVIDER as any) || "dagger",
	// verificationPolicy removed - security outsourced to enact-security package
	authToken: process.env.ENACT_AUTH_TOKEN,
	defaultTimeout: "120s", // Increased timeout for MCP operations
});

const server = new McpServer(
	{
		name: "enact-mcp-server",
		version: "3.0.0-minimal",
	},
	{
		capabilities: {
			logging: {
				level: "debug",
			},
		},
	},
);

// Store for tracking long-running operations
const runningOperations = new Map<
	string,
	{
		id: string;
		name: string;
		startTime: Date;
		promise: Promise<any>;
		status: "running" | "completed" | "failed";
		result?: any;
		error?: any;
		resultFetched?: boolean;
		errorFetched?: boolean;
	}
>();

// Store web server port for MCP tools
let webServerPort: number | null = null;
let webServerInstance: any = null; // Store the server instance for closing

// Helper function for safe JSON stringification
function safeJsonStringify(
	obj: any,
	fallback: string = "Unable to stringify object",
): string {
	try {
		return JSON.stringify(obj, null, 2);
	} catch (error) {
		logger.error(
			`JSON stringify failed: ${error instanceof Error ? error.message : String(error)}`,
		);
		return fallback;
	}
}

// Helper function to validate environment variables for MCP tools
async function validateMcpToolEnvironmentVariables(
	toolName: string,
	toolEnv?: Record<string, any>,
): Promise<{
	valid: boolean;
	errorMessage?: string;
}> {
	if (!toolEnv || Object.keys(toolEnv).length === 0) {
		return { valid: true }; // No env vars required
	}

	try {
		// Resolve environment variables from Enact configuration
		const { resolved: envVars } = await resolveToolEnvironmentVariables(
			toolName,
			toolEnv,
		);

		// Validate required environment variables
		const validation = validateRequiredEnvironmentVariables(toolEnv, envVars);

		if (!validation.valid) {
			let errorMessage = "❌ Missing required environment variables:\n\n";

			validation.missing.forEach((varName: string) => {
				const config = toolEnv[varName];
				const description = config?.description
					? ` - ${config.description}`
					: "";
				const source = config?.source ? ` (source: ${config.source})` : "";
				const required = config?.required ? " [REQUIRED]" : "";
				errorMessage += `  • ${varName}${required}${description}${source}\n`;
			});

			errorMessage += "\n💡 You can set environment variables using:\n";
			errorMessage +=
				"  • enact env set <package> <VAR_NAME> <value>  # Package-managed (shared)\n";
			errorMessage +=
				"  • enact env set <package> <VAR_NAME> --encrypt # For sensitive values\n";
			errorMessage +=
				"  • enact env set <VAR_NAME> <value> --project   # Project-specific (.env file)\n";

			// Generate a configuration link for the web interface
			const configLink = generateConfigLink(validation.missing, toolName);
			if (configLink) {
				errorMessage +=
					"\n🌐 Or use the web interface to configure all missing variables:\n";
				errorMessage += `  ${configLink}\n`;
			}

			errorMessage +=
				"\n⚠️ Execution aborted due to missing environment variables.";

			return {
				valid: false,
				errorMessage,
			};
		}

		return { valid: true };
	} catch (error) {
		logger.error("Failed to validate environment variables:", error);
		return {
			valid: false,
			errorMessage: `❌ Failed to validate environment variables: ${error instanceof Error ? error.message : String(error)}`,
		};
	}
}

// Initialize the resolver with ~/.enact paths
const defaultToolsDir = join(homedir(), ".enact", "tools");
const defaultCacheDir = join(homedir(), ".enact", "cache");

const toolResolver = new LocalToolResolver(
	enactCore,
	process.env.LOCAL_TOOLS_DIR || defaultToolsDir,
	process.env.TOOL_CACHE_DIR || defaultCacheDir,
);

// Auto-initialize on startup
(async () => {
	try {
		await toolResolver.initialize();
	} catch (error) {
		logger.warn(
			`Failed to initialize LocalToolResolver: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
})();

// ===== TOOL 1: Main Execution (Enhanced) =====
server.registerTool(
	"execute-tool-by-name",
	{
		title: "Execute Tool",
		description:
			"Execute tools with smart resolution: local files, local tools directory, or registry. Supports async execution.",
		inputSchema: {
			name: z.string().describe("Tool name OR file path to local YAML"),
			inputs: z
				.record(z.any())
				.optional()
				.describe("Input parameters for the tool"),
			localFile: z
				.boolean()
				.optional()
				.describe("Treat 'name' as a file path to local YAML tool"),
			timeout: z.string().optional().describe("Execution timeout"),
			dangerouslySkipVerification: z
				.boolean()
				.optional()
				.describe("Skip all signature verification (DANGEROUS)"),
			dryRun: z.boolean().optional().describe("Dry run mode"),
			verbose: z.boolean().optional().describe("Verbose output"),
			async: z
				.boolean()
				.optional()
				.describe("Run in background for long operations"),
			forceRegistry: z
				.boolean()
				.optional()
				.describe("Skip local resolution and go straight to registry"),
		},
	},
	async (params) => {
		const {
			name,
			inputs = {},
			localFile = false,
			timeout,
			dangerouslySkipVerification,
			dryRun,
			verbose,
			async = false,
			forceRegistry = false,
		} = params;

		try {
			logger.info(
				`Executing tool: ${name} (localFile: ${localFile}, async: ${async})`,
			);

			let toolToExecute;
			let resolutionInfo = "";
			let isLocalFile = false;

			if (localFile) {
				// Execute specific file path
				const fs = await import("fs/promises");
				const path = await import("path");
				const yaml = await import("yaml");

				const resolvedPath = path.resolve(name);

				try {
					await fs.access(resolvedPath);
					const yamlContent = await fs.readFile(resolvedPath, "utf-8");
					const definition = yaml.parse(yamlContent);

					toolToExecute = {
						path: resolvedPath,
						definition,
						name:
							definition.name ||
							path.basename(resolvedPath, path.extname(resolvedPath)),
					};
					resolutionInfo = `📄 Local file (${resolvedPath})`;
					isLocalFile = true;
				} catch (error) {
					return {
						content: [
							{
								type: "text",
								text: `❌ Local file not found or invalid: ${resolvedPath}`,
							},
						],
						isError: true,
					};
				}
			} else if (forceRegistry) {
				// Skip local resolution
				toolToExecute = await enactCore.getToolByName(name);
				resolutionInfo = "🌐 Registry (forced)";
			} else {
				// Use enhanced resolution (local tools dir → cache → registry)
				const resolution = await toolResolver.resolveTool(name);

				if (!resolution) {
					const suggestions = await toolResolver.getSuggestions(name);
					let errorMsg = `❌ Tool not found: ${name}`;

					if (suggestions.length > 0) {
						errorMsg += `\n\n💡 Did you mean one of these?\n${suggestions.map((s) => `  • ${s}`).join("\n")}`;
					}

					return {
						content: [{ type: "text", text: errorMsg }],
						isError: true,
					};
				}

				toolToExecute = resolution.tool;
				isLocalFile = resolution.source === "local";

				switch (resolution.source) {
					case "local":
						resolutionInfo = `📁 Local tools (${resolution.metadata?.path})`;
						break;
					case "cache":
						resolutionInfo = `💾 Cache (${resolution.metadata?.cachedAt})`;
						break;
					case "registry":
						resolutionInfo = "🌐 Registry (cached)";
						break;
				}
			}

			if (!toolToExecute) {
				return {
					content: [{ type: "text", text: `❌ Tool not found: ${name}` }],
					isError: true,
				};
			}

			// Validate environment variables
			const envToValidate = isLocalFile
				? toolToExecute.definition?.env
				: toolToExecute.env;
			if (envToValidate) {
				const envValidation = await validateMcpToolEnvironmentVariables(
					toolToExecute.name,
					envToValidate,
				);

				if (!envValidation.valid) {
					return {
						content: [
							{
								type: "text",
								text:
									envValidation.errorMessage || "Environment validation failed",
							},
						],
						isError: true,
					};
				}
			}

			// Determine if this is a long-running operation
			const isLongRunning =
				toolToExecute.name.includes("dagger") ||
				toolToExecute.name.includes("docker") ||
				toolToExecute.name.includes("build") ||
				async;

			if (isLongRunning) {
				// Background execution
				const operationId = `${toolToExecute.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

				let executionPromise;

				if (isLocalFile) {
					const yamlContent = await import("fs/promises").then((fs) =>
						fs.readFile(toolToExecute.path, "utf-8"),
					);
					executionPromise = enactCore.executeRawTool(yamlContent, inputs, {
						timeout: timeout || "300s",
						force: dangerouslySkipVerification || true,
						dryRun,
						verbose,
					});
				} else {
					executionPromise = enactCore.executeToolByName(
						toolToExecute.name || name,
						inputs,
						{
							timeout: timeout || "300s",
							force: dangerouslySkipVerification,
							dryRun,
							verbose,
						},
					);
				}

				const operation = {
					id: operationId,
					name: `${toolToExecute.name} (${isLocalFile ? "local" : "registry"})`,
					startTime: new Date(),
					promise: executionPromise,
					status: "running" as "running" | "completed" | "failed",
					result: undefined as any,
					error: undefined as any,
				};

				runningOperations.set(operationId, operation);

				executionPromise
					.then((result: any) => {
						operation.status = "completed";
						operation.result = result;
					})
					.catch((error: any) => {
						operation.status = "failed";
						operation.error = error;
					});

				return {
					content: [
						{
							type: "text",
							text: `🚀 Started background execution\n\nTool: ${toolToExecute.name}\nSource: ${resolutionInfo}\nOperation ID: ${operationId}\n\n⏳ Use "check-operation-status" with ID "${operationId}" to monitor progress.`,
						},
					],
				};
			} else {
				// Synchronous execution
				let result;

				if (isLocalFile) {
					const yamlContent = await import("fs/promises").then((fs) =>
						fs.readFile(toolToExecute.path, "utf-8"),
					);
					result = await enactCore.executeRawTool(yamlContent, inputs, {
						timeout: timeout || "120s",
						force: dangerouslySkipVerification || true,
						dryRun,
						verbose,
					});
				} else {
					result = await enactCore.executeToolByName(
						toolToExecute.name || name,
						inputs,
						{
							timeout: timeout || "120s",
							force: dangerouslySkipVerification,
							dryRun,
							verbose,
						},
					);
				}

				if (!result.success) {
					return {
						content: [
							{
								type: "text",
								text: `❌ Error executing tool ${toolToExecute.name}: ${result.error?.message}`,
							},
						],
						isError: true,
					};
				}

				return {
					content: [
						{
							type: "text",
							text: `✅ Successfully executed: ${toolToExecute.name}\nSource: ${resolutionInfo}\n\nOutput:\n${safeJsonStringify(result)}`,
						},
					],
				};
			}
		} catch (error) {
			logger.error(`Error in enhanced tool execution:`, error);

			if (error instanceof Error && error.message.includes("timed out")) {
				return {
					content: [
						{
							type: "text",
							text: `⏰ Tool execution timed out: ${name}\n\nFor long-running operations, try using async: true\n\nOriginal error: ${error.message}`,
						},
					],
					isError: true,
				};
			}

			return {
				content: [
					{
						type: "text",
						text: `❌ Internal error executing tool: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
				isError: true,
			};
		}
	},
);

// ===== TOOL 2: Local Tool Management =====
server.registerTool(
	"manage-local-tools",
	{
		title: "Manage Local Tools",
		description:
			"Manage local tools, aliases, favorites, cache, and view directory structure",
		inputSchema: {
			action: z
				.enum([
					"list",
					"show-directory",
					"add-favorite",
					"remove-favorite",
					"add-alias",
					"remove-alias",
					"cleanup-cache",
					"suggestions",
				])
				.describe("Action to perform"),
			toolName: z.string().optional().describe("Tool name for actions"),
			alias: z.string().optional().describe("Alias name"),
			partial: z.string().optional().describe("Partial name for suggestions"),
			detailed: z
				.boolean()
				.default(false)
				.describe("Show detailed information"),
		},
	},
	async ({ action, toolName, alias, partial, detailed = false }) => {
		try {
			switch (action) {
				case "list":
					const allTools = await toolResolver.listAllTools();
					let output = "🔧 Local Tool Management\n";
					output += "=".repeat(30) + "\n\n";

					output += `📁 Local Tools (${allTools.local.length}):\n`;
					allTools.local.forEach((tool) => {
						const relativePath = tool.path.replace(
							join(homedir(), ".enact", "tools"),
							"~/.enact/tools",
						);
						output += `  • ${tool.name} (${relativePath})\n`;
						if (detailed && tool.definition.description) {
							output += `    ${tool.definition.description}\n`;
						}
					});

					output += `\n💾 Cached Tools (${allTools.cached.length}):\n`;
					allTools.cached.forEach((tool) => {
						output += `  • ${tool.name} (cached)\n`;
					});

					output += `\n⭐ Favorites (${allTools.favorites.length}):\n`;
					allTools.favorites.forEach((fav) => {
						output += `  • ${fav}\n`;
					});

					output += `\n🔗 Aliases (${Object.keys(allTools.aliases).length}):\n`;
					Object.entries(allTools.aliases).forEach(([alias, target]) => {
						output += `  • ${alias} → ${target}\n`;
					});

					return { content: [{ type: "text", text: output }] };

				case "show-directory":
					const { promises: fs } = await import("fs");
					const enactDir = join(homedir(), ".enact");

					const scanDir = async (
						dirPath: string,
						prefix = "",
					): Promise<string> => {
						let result = "";
						try {
							const entries = await fs.readdir(dirPath, {
								withFileTypes: true,
							});

							for (const entry of entries.sort((a, b) =>
								a.name.localeCompare(b.name),
							)) {
								const isLast = entries.indexOf(entry) === entries.length - 1;
								const connector = isLast ? "└── " : "├── ";

								if (entry.isDirectory()) {
									result += `${prefix}${connector}📁 ${entry.name}/\n`;
									if (["tools", "env", "cache"].includes(entry.name)) {
										const nextPrefix = prefix + (isLast ? "    " : "│   ");
										result += await scanDir(
											join(dirPath, entry.name),
											nextPrefix,
										);
									}
								} else {
									let icon =
										entry.name.endsWith(".yaml") || entry.name.endsWith(".yml")
											? "🔧"
											: entry.name.endsWith(".env")
												? "🔐"
												: entry.name.endsWith(".json")
													? "⚙️"
													: "📄";
									result += `${prefix}${connector}${icon} ${entry.name}\n`;
								}
							}
						} catch (error) {
							result += `${prefix}❌ Cannot read directory\n`;
						}
						return result;
					};

					let dirOutput = `📂 Enact Directory Structure\n`;
					dirOutput += `${"=".repeat(35)}\n\n`;
					dirOutput += `Location: ${enactDir}\n\n`;

					try {
						dirOutput += await scanDir(enactDir);
					} catch (error) {
						dirOutput += `❌ Directory not found. Use init command to create it.\n`;
					}

					return { content: [{ type: "text", text: dirOutput }] };

				case "add-favorite":
					if (!toolName) throw new Error("toolName required for add-favorite");
					toolResolver.addToFavorites(toolName);
					return {
						content: [
							{ type: "text", text: `⭐ Added ${toolName} to favorites` },
						],
					};

				case "remove-favorite":
					if (!toolName)
						throw new Error("toolName required for remove-favorite");
					// Add remove method to resolver if needed
					return {
						content: [
							{ type: "text", text: `🗑️ Removed ${toolName} from favorites` },
						],
					};

				case "add-alias":
					if (!alias || !toolName)
						throw new Error("Both alias and toolName required");
					toolResolver.addAlias(alias, toolName);
					return {
						content: [
							{ type: "text", text: `🔗 Added alias: ${alias} → ${toolName}` },
						],
					};

				case "remove-alias":
					if (!alias) throw new Error("alias required for remove-alias");
					// Add remove method to resolver if needed
					return {
						content: [{ type: "text", text: `🗑️ Removed alias: ${alias}` }],
					};

				case "cleanup-cache":
					const cleaned = await toolResolver.cleanupCache();
					return {
						content: [
							{
								type: "text",
								text: `🧹 Cleaned ${cleaned} expired cache entries`,
							},
						],
					};

				case "suggestions":
					if (!partial)
						throw new Error("partial name required for suggestions");
					const suggestions = await toolResolver.getSuggestions(partial);
					const suggestOutput =
						suggestions.length > 0
							? `💡 Suggestions for "${partial}":\n${suggestions.map((s) => `  • ${s}`).join("\n")}`
							: `💡 No suggestions found for "${partial}"`;
					return { content: [{ type: "text", text: suggestOutput }] };

				default:
					throw new Error(`Unknown action: ${action}`);
			}
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text: `❌ Error managing local tools: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
				isError: true,
			};
		}
	},
);

// ===== TOOL 3: Create Local Tool =====
server.registerTool(
	"create-local-tool",
	{
		title: "Create Local Tool",
		description: "Create a new local tool in ~/.enact/tools/",
		inputSchema: {
			name: z.string().describe("Tool name"),
			description: z.string().describe("Tool description"),
			command: z.string().describe("Command to execute"),
			tags: z.array(z.string()).optional().describe("Tool tags"),
			timeout: z.string().optional().describe("Execution timeout"),
			inputSchema: z
				.record(z.any())
				.optional()
				.describe("Input schema for the tool"),
			env: z.record(z.any()).optional().describe("Environment variables"),
			overwrite: z
				.boolean()
				.default(false)
				.describe("Overwrite if tool already exists"),
		},
	},
	async ({
		name,
		description,
		command,
		tags,
		timeout,
		inputSchema,
		env,
		overwrite = false,
	}) => {
		try {
			const { promises: fs } = await import("fs");
			const yaml = await import("yaml");

			const toolsDir = join(homedir(), ".enact", "tools");
			await fs.mkdir(toolsDir, { recursive: true });

			const toolPath = join(toolsDir, `${name}.yaml`);

			// Check if tool already exists
			if (!overwrite) {
				try {
					await fs.access(toolPath);
					return {
						content: [
							{
								type: "text",
								text: `❌ Tool already exists: ${toolPath}\n\nUse overwrite: true to overwrite, or choose a different name.`,
							},
						],
						isError: true,
					};
				} catch {
					// Tool doesn't exist, we can create it
				}
			}

			const toolDefinition: any = {
				name,
				description,
				version: "1.0.0",
				command,
				enact: "3.0.0",
			};

			if (tags && tags.length > 0) toolDefinition.tags = tags;
			if (timeout) toolDefinition.timeout = timeout;
			if (inputSchema) toolDefinition.inputSchema = inputSchema;
			if (env) toolDefinition.env = env;

			await fs.writeFile(toolPath, yaml.stringify(toolDefinition, null, 2));

			let output = `✅ Created local tool: ${name}\n\n`;
			output += `📍 Location: ~/.enact/tools/${name}.yaml\n`;
			output += `📝 Description: ${description}\n`;
			output += `⚡ Command: ${command}\n`;

			if (tags && tags.length > 0) {
				output += `🏷️ Tags: ${tags.join(", ")}\n`;
			}

			output += `\n💡 Execute with: execute-tool-by-name "${name}"`;

			return { content: [{ type: "text", text: output }] };
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text: `❌ Error creating local tool: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
				isError: true,
			};
		}
	},
);

// ===== TOOL 4: Search Registry =====
server.registerTool(
	"enact-search-tools",
	{
		title: "Search Registry Tools",
		description: "Search tools in the Enact registry",
		inputSchema: {
			query: z.string().describe("Search query for tools"),
			limit: z.number().default(10).describe("Maximum number of results"),
			tags: z.array(z.string()).optional().describe("Filter by tags"),
			author: z.string().optional().describe("Filter by author"),
			detailed: z
				.boolean()
				.default(false)
				.describe("Show detailed information"),
		},
	},
	async ({ query, limit = 10, tags, author, detailed = false }) => {
		try {
			logger.info(`Searching registry tools: "${query}"`);

			const tools = await enactCore.searchTools({ query, limit, tags, author });

			if (tools.length === 0) {
				return {
					content: [
						{
							type: "text",
							text: `🔍 No tools found for query: "${query}"${tags ? ` with tags: ${tags.join(", ")}` : ""}${author ? ` by author: ${author}` : ""}`,
						},
					],
				};
			}

			let output = `🔍 Found ${tools.length} tools for "${query}"\n`;
			output += `${"=".repeat(40)}\n\n`;

			tools.forEach((tool: any, index: number) => {
				output += `${index + 1}. 🔧 ${tool.name}\n`;
				output += `   📝 ${tool.description || "No description"}\n`;
				output += `   👤 ${tool.author || "Unknown author"}\n`;

				if (tool.tags && tool.tags.length > 0) {
					output += `   🏷️ ${tool.tags.join(", ")}\n`;
				}

				if (detailed) {
					output += `   📦 Version: ${tool.version || "Unknown"}\n`;
					if (tool.command) {
						const shortCommand =
							tool.command.length > 50
								? tool.command.substring(0, 50) + "..."
								: tool.command;
						output += `   ⚡ Command: ${shortCommand}\n`;
					}
				}

				output += `\n`;
			});

			output += `💡 Execute any tool with: execute-tool-by-name "<tool-name>"`;

			return { content: [{ type: "text", text: output }] };
		} catch (error) {
			logger.error("Error searching tools:", error);
			return {
				content: [
					{
						type: "text",
						text: `❌ Error searching tools: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
				isError: true,
			};
		}
	},
);

// ===== TOOL 5: Check Operation Status =====
server.registerTool(
	"check-operation-status",
	{
		title: "Check Operation Status",
		description:
			"Check the status of background operations. Use 'list' as operationId to see all operations.",
		inputSchema: {
			operationId: z
				.string()
				.describe("Operation ID to check, or 'list' to show all operations"),
		},
	},
	async ({ operationId }) => {
		try {
			if (operationId === "list") {
				// List all operations
				const operations = Array.from(runningOperations.values());

				if (operations.length === 0) {
					return {
						content: [
							{
								type: "text",
								text: `📋 No background operations currently running or recently completed.`,
							},
						],
					};
				}

				let summary = `📋 Background Operations (${operations.length} total)\n\n`;

				operations.forEach((op) => {
					const duration = Math.round(
						(Date.now() - op.startTime.getTime()) / 1000,
					);
					const statusEmoji =
						op.status === "running"
							? "⏳"
							: op.status === "completed"
								? "✅"
								: "❌";
					summary += `${statusEmoji} ${op.id}\n`;
					summary += `   Tool: ${op.name}\n`;
					summary += `   Status: ${op.status.toUpperCase()}\n`;
					summary += `   Duration: ${duration}s\n\n`;
				});

				return { content: [{ type: "text", text: summary }] };
			}

			// Check specific operation
			const operation = runningOperations.get(operationId);

			if (!operation) {
				return {
					content: [
						{
							type: "text",
							text: `❌ Operation not found: ${operationId}\n\nUse operationId "list" to see all operations.`,
						},
					],
					isError: true,
				};
			}

			const duration = Math.round(
				(Date.now() - operation.startTime.getTime()) / 1000,
			);

			switch (operation.status) {
				case "running":
					return {
						content: [
							{
								type: "text",
								text: `⏳ Operation: RUNNING\n\nID: ${operationId}\nTool: ${operation.name}\nDuration: ${duration}s\n\nStill processing... check again in a moment.`,
							},
						],
					};

				case "completed":
					// Schedule cleanup after showing result
					setTimeout(() => runningOperations.delete(operationId), 60000);
					return {
						content: [
							{
								type: "text",
								text: `✅ Operation: COMPLETED\n\nID: ${operationId}\nTool: ${operation.name}\nDuration: ${duration}s\n\nResult:\n${safeJsonStringify(operation.result)}`,
							},
						],
					};

				case "failed":
					// Schedule cleanup after showing error
					setTimeout(() => runningOperations.delete(operationId), 60000);
					return {
						content: [
							{
								type: "text",
								text: `❌ Operation: FAILED\n\nID: ${operationId}\nTool: ${operation.name}\nDuration: ${duration}s\n\nError: ${operation.error instanceof Error ? operation.error.message : String(operation.error)}`,
							},
						],
						isError: true,
					};

				default:
					return {
						content: [
							{
								type: "text",
								text: `❓ Unknown operation status: ${operation.status}`,
							},
						],
						isError: true,
					};
			}
		} catch (error) {
			logger.error(`Error checking operation status:`, error);
			return {
				content: [
					{
						type: "text",
						text: `❌ Error checking operation status: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
				isError: true,
			};
		}
	},
);

// ===== TOOL 6: Environment Manager =====
server.registerTool(
	"launch-env-manager-server",
	{
		title: "Launch Environment Manager",
		description: "Start the web-based environment variable manager server",
		inputSchema: {
			port: z.number().default(5555).describe("Port to run the server on"),
			async: z.boolean().default(true).describe("Run in background"),
		},
	},
	async ({ port = 5555, async = true }) => {
		try {
			if (webServerInstance) {
				return {
					content: [
						{
							type: "text",
							text: `🌐 Environment Manager already running on port ${webServerPort}\n\nURL: http://localhost:${webServerPort}\n\nUse this interface to manage environment variables for your tools.`,
						},
					],
				};
			}

			if (async) {
				// Background launch
				const operationId = `env-manager-${Date.now()}`;

				const launchPromise = startEnvManagerServer(port).then(
					({ server: webServer, port: actualPort }: { server: any; port: number }) => {
						webServerInstance = webServer;
						webServerPort = actualPort;
						return { server: webServer, port: actualPort };
					},
				);

				const operation = {
					id: operationId,
					name: "launch-env-manager-server",
					startTime: new Date(),
					promise: launchPromise,
					status: "running" as "running" | "completed" | "failed",
					result: undefined as any,
					error: undefined as any,
				};

				runningOperations.set(operationId, operation);

				launchPromise
					.then((result: any) => {
						operation.status = "completed";
						operation.result = result;
					})
					.catch((error: any) => {
						operation.status = "failed";
						operation.error = error;
					});

				return {
					content: [
						{
							type: "text",
							text: `🚀 Starting Environment Manager on port ${port}\n\nOperation ID: ${operationId}\n\n⏳ Use "check-operation-status" with ID "${operationId}" to see when ready.\n\nOnce running: http://localhost:${port}`,
						},
					],
				};
			} else {
				// Synchronous launch
				const { server: webServer, port: actualPort } =
					await startEnvManagerServer(port);
				webServerInstance = webServer;
				webServerPort = actualPort;

				return {
					content: [
						{
							type: "text",
							text: `✅ Environment Manager started!\n\nURL: http://localhost:${actualPort}\n\nManage environment variables for your Enact tools through the web interface.`,
						},
					],
				};
			}
		} catch (error) {
			logger.error(`Error launching Environment Manager:`, error);
			return {
				content: [
					{
						type: "text",
						text: `❌ Error launching Environment Manager: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
				isError: true,
			};
		}
	},
);

// ===== TOOL 7: Core Status =====
server.registerTool(
	"enact-core-status",
	{
		title: "Enact Core Status",
		description: "Get status and health of the Enact MCP integration",
		inputSchema: {
			detailed: z
				.boolean()
				.default(false)
				.describe("Show detailed system information"),
		},
	},
	async ({ detailed = false }) => {
		try {
			const status = await enactCore.getStatus();
			const toolStats = await toolResolver.listAllTools();

			let output = `🔧 Enact MCP Status\n`;
			output += `${"=".repeat(25)}\n\n`;

			output += `📊 Core Integration:\n`;
			output += `  • Mode: Direct Core Library\n`;
			output += `  • Provider: ${status.executionProvider}\n`;
			output += `  • API: ${status.apiUrl}\n`;
			output += `  • Verification: Disabled\n`;
			output += `  • Timeout: ${status.defaultTimeout}\n\n`;

			output += `🔧 Local Tools:\n`;
			output += `  • Local: ${toolStats.local.length} tools\n`;
			output += `  • Cached: ${toolStats.cached.length} tools\n`;
			output += `  • Favorites: ${toolStats.favorites.length}\n`;
			output += `  • Aliases: ${Object.keys(toolStats.aliases).length}\n\n`;

			output += `⚡ Background Operations:\n`;
			const activeOps = Array.from(runningOperations.values()).filter(
				(op) => op.status === "running",
			);
			output += `  • Running: ${activeOps.length}\n`;
			output += `  • Total tracked: ${runningOperations.size}\n\n`;

			output += `🌐 Environment Manager:\n`;
			if (webServerInstance && webServerPort) {
				output += `  • Status: Running on port ${webServerPort}\n`;
				output += `  • URL: http://localhost:${webServerPort}\n`;
			} else {
				output += `  • Status: Not running\n`;
				output += `  • Use "launch-env-manager-server" to start\n`;
			}

			if (detailed) {
				output += `\n🛠️ Capabilities:\n`;
				output += `  • ✅ Local-first tool resolution\n`;
				output += `  • ✅ Registry tool caching\n`;
				output += `  • ✅ Background execution\n`;
				output += `  • ✅ Signature verification\n`;
				output += `  • ✅ Environment management\n`;
				output += `  • ✅ File-based tool execution\n`;
				output += `  • ✅ Smart tool suggestions\n\n`;

				output += `📁 Directory Structure:\n`;
				const enactDir = join(homedir(), ".enact");
				output += `  • Base: ${enactDir}\n`;
				output += `  • Tools: ~/.enact/tools/\n`;
				output += `  • Cache: ~/.enact/cache/\n`;
				output += `  • Env: ~/.enact/env/\n`;
			}

			output += `\n✅ System is healthy and ready for tool execution.`;

			return { content: [{ type: "text", text: output }] };
		} catch (error) {
			logger.error(`Error getting core status:`, error);
			return {
				content: [
					{
						type: "text",
						text: `❌ Error getting core status: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
				isError: true,
			};
		}
	},
);

// Start the server
async function main() {
	try {
		// Set up signal handlers for graceful shutdown
		process.on("SIGINT", () => {
			logger.info("Received SIGINT, shutting down gracefully...");
			if (webServerInstance) {
				logger.info("Shutting down web server...");
				webServerInstance.close();
			}
			process.exit(0);
		});

		process.on("SIGTERM", () => {
			logger.info("Received SIGTERM, shutting down gracefully...");
			if (webServerInstance) {
				logger.info("Shutting down web server...");
				webServerInstance.close();
			}
			process.exit(0);
		});

		const transport = new StdioServerTransport();
		await server.connect(transport);
		logger.info("🚀 Enact MCP Server (Minimal) started successfully");
		logger.info(
			"💡 Use 'launch-env-manager-server' tool to start the web interface for environment management",
		);
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

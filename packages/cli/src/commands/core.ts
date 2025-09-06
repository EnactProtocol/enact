// src/commands/core.ts - Core-based command handlers
import { readFileSync, existsSync } from "fs";
import { readFile } from "fs/promises";
import { resolve, extname } from "path";
import { EnactCore } from "@enactprotocol/shared/core";
import type { ToolSearchOptions, ToolExecuteOptions } from "@enactprotocol/shared/core";
import type { EnactTool } from "@enactprotocol/shared";
import type { EnactToolDefinition } from "@enactprotocol/shared/api";
import pc from "picocolors";
import * as p from "@clack/prompts";
import yaml from "yaml";
import {
	resolveToolEnvironmentVariables,
	validateRequiredEnvironmentVariables,
	generateConfigLink,
} from "@enactprotocol/shared/utils";
import { EnactApiClient, EnactApiError } from "@enactprotocol/shared/api";
import { getAuthHeaders } from "./auth";
import { addToHistory, getFrontendUrl, getApiUrl } from "@enactprotocol/shared/utils";
import { getCurrentConfig } from "./config";
import stripAnsi from "strip-ansi";
import { CryptoUtils, KeyManager, SecurityConfigManager, SigningService } from "@enactprotocol/security";

// Create core instance with configuration
let core: EnactCore;

export async function getConfiguredCore(): Promise<EnactCore> {
	if (!core) {
		try {
			const config = await getCurrentConfig();

			const coreOptions = {
				executionProvider: config.executionProvider,
				defaultTimeout: config.defaultTimeout,
				daggerOptions: config.daggerOptions,
			};

			core = new EnactCore(coreOptions);
		} catch (error) {
			// Fallback to default configuration if config loading fails
			core = new EnactCore();
		}
	}
	return core;
}

/**
 * Clean output text by removing ANSI escape codes for better readability
 */
function cleanOutput(text: string): string {
	if (typeof text !== "string") {
		return text;
	}
	return stripAnsi(text);
}

interface CoreSearchOptions {
	help?: boolean;
	limit?: number;
	tags?: string[];
	format?: string;
	author?: string;
}

interface CoreSignOptions {
	help?: boolean;
	tool?: string;
}

interface CoreExecOptions {
	help?: boolean;
	input?: string;
	params?: string;
	timeout?: string;
	dry?: boolean;
	verbose?: boolean;
	dangerouslySkipVerification?: boolean;
	mount?: string;
}

// Core Publish Command Options
interface CorePublishOptions {
	help?: boolean;
	url?: string;
	token?: string;
	file?: string;
	verbose?: boolean;
}

/**
 * Handle search command using core library - Enhanced with all legacy features
 */
export async function handleCoreSearchCommand(
	args: string[],
	options: CoreSearchOptions,
) {
	// Enable silent mode for cleaner CLI output
	process.env.ENACT_SILENT = "true";
	
	if (options.help) {
		console.error(`
${pc.bold("enact search")} - Search for tools

${pc.bold("USAGE:")}
  enact search [query] [options]

${pc.bold("ARGUMENTS:")}
  query               Search query (keywords, tool names, descriptions)

${pc.bold("OPTIONS:")}
  -l, --limit <number>    Maximum number of results (default: 20)
  -t, --tags <tags>       Filter by tags (comma-separated)
  -a, --author <author>   Filter by author
  -f, --format <format>   Output format: table, json, list (default: table)
  -h, --help              Show help

${pc.bold("EXAMPLES:")}
  enact search "text processing"
  enact search formatter --tags cli,text
  enact search --author myorg
  enact search prettier --limit 5 --format json
    `);
		return;
	}

	// Start the interactive prompt if no query provided and no author filter
	const isInteractiveMode = args.length === 0 && !options.author;

	if (isInteractiveMode) {
		p.intro(pc.bgGreen(pc.white(" Search Enact Tools ")));
	}

	// Get search query
	let query = args.join(" ");

	if (!query && !options.author) {
		const queryResponse = await p.text({
			message: "What are you looking for?",
			placeholder: "Enter keywords, tool names, or descriptions...",
			validate: (value) => {
				if (!value.trim()) return "Please enter a search query";
				return undefined;
			},
		});

		if (p.isCancel(queryResponse)) {
			p.outro(pc.yellow("Search cancelled"));
			return;
		}

		query = queryResponse as string;
	}

	// Interactive options if not provided
	let limit = options.limit || 20;
	let tags = options.tags;
	let format = options.format || "table";
	let author = options.author;

	if (isInteractiveMode) {
		// Ask for additional filters
		const addFilters = await p.confirm({
			message: "Add additional filters?",
			initialValue: false,
		});

		if (addFilters) {
			const tagsInput = (await p.text({
				message: "Filter by tags (comma-separated, optional):",
				placeholder: "cli, text, formatter",
			})) as string;

			if (tagsInput) {
				tags = tagsInput
					.split(",")
					.map((t) => t.trim())
					.filter((t) => t);
			}

			const authorInput = (await p.text({
				message: "Filter by author (optional):",
				placeholder: "myorg, username",
			})) as string;

			if (authorInput) {
				author = authorInput;
			}

			const limitInput = await p.text({
				message: "Maximum results:",
				placeholder: "20",
				initialValue: "20",
				validate: (value) => {
					const num = parseInt(value);
					if (isNaN(num) || num < 1 || num > 100) {
						return "Please enter a number between 1 and 100";
					}
					return undefined;
				},
			});

			if (!p.isCancel(limitInput)) {
				limit = parseInt(limitInput as string);
			}

			const formatResponse = await p.select({
				message: "Output format:",
				options: [
					{ value: "table", label: "Table (default)" },
					{ value: "list", label: "Simple list" },
					{ value: "json", label: "JSON output" },
				],
			});

			if (!p.isCancel(formatResponse)) {
				format = formatResponse as string;
			}
		}
	}

	// Show a spinner during search
	const spinner = p.spinner();
	spinner.start("Searching for tools...");

	try {
		const searchOptions: ToolSearchOptions = {
			query,
			limit,
			tags,
			author,
			format: format as any,
		};

		// Use API client directly for search - no need for EnactCore
		const apiClient = await EnactApiClient.create();
		const searchResults = await apiClient.searchTools(searchOptions);
		
		// Convert API results to EnactTool format
		const results: EnactTool[] = [];
		for (const result of searchResults) {
			if (result.name) {
				try {
					const tool = await apiClient.getTool(result.name);
					if (tool) {
						const isValid = await EnactCore.checkToolVerificationStatus(tool);
						// console.log("🔍 TRACE: core.ts - Tool:", tool.name, "isValid:", isValid);
						// Convert to EnactTool format
						const enactTool: EnactTool = {
							name: tool.name,
							description: tool.description || "",
							verified: isValid,
							command: tool.command,
							from: tool.from,
							version: tool.version || "1.0.0",
							timeout: tool.timeout,
							tags: tool.tags || [],
							inputSchema: tool.inputSchema,
							outputSchema: tool.outputSchema,
							env: tool.env_vars
								? Object.fromEntries(
										Object.entries(tool.env_vars).map(([key, config]: [string, any]) => [
											key,
											{ ...config, source: config.source || "env" },
										]),
									)
								: undefined,
							signature: tool.signature,
							signatures: Array.isArray(tool.signatures) ? tool.signatures : 
								(tool.signatures ? Object.values(tool.signatures) : undefined),
							namespace: tool.namespace,
							resources: tool.resources,
							license: tool.license,
							authors: tool.authors,
							examples: tool.examples,
							annotations: tool.annotations,
						};
						results.push(enactTool);
					}
				} catch (error) {
					// Skip tools that can't be fetched
					continue;
				}
			}
		}

		spinner.stop(
			`Found ${results.length} tool${results.length === 1 ? "" : "s"}`,
		);

		if (results.length === 0) {
			p.note("No tools found matching your criteria.", "No Results");
			p.note(
				"Try:\n• Broader keywords\n• Removing filters\n• Different spelling",
				"Suggestions",
			);
			if (isInteractiveMode) {
				p.outro("");
			}
			return;
		}

		// Display results based on format
		if (format === "json") {
			console.error(JSON.stringify(results, null, 2));
		} else if (format === "list") {
			displayResultsList(results);
		} else {
			displayResultsTable(results);
		}

		// Exit immediately for non-interactive mode
		if (!isInteractiveMode) {
			process.exit(0);
		}

		// Interactive tool selection for detailed view
		if (isInteractiveMode && results.length > 1) {
			const viewDetail = await p.confirm({
				message: "View details for a specific tool?",
				initialValue: false,
			});

			if (viewDetail) {
				const selectedTool = await p.select({
					message: "Select a tool to view details:",
					options: results.map((tool) => ({
						value: tool.name,
						label: `${tool.name} - ${tool.description.substring(0, 60)}${tool.description.length > 60 ? "..." : ""}`,
					})),
				});

				if (!p.isCancel(selectedTool)) {
					await showToolDetailsFromCore(selectedTool as string);
				}
			}
		}

		if (isInteractiveMode) {
			p.outro(pc.green("Search completed"));
		}
		// Non-interactive mode - exit cleanly without prompts
		return;
	} catch (error: any) {
		spinner.stop("Search failed");

		if (
			error.message?.includes("ENOTFOUND") ||
			error.message?.includes("ECONNREFUSED")
		) {
			p.note(
				"Could not connect to the Enact registry. Check your internet connection.",
				"Connection Error",
			);
		} else {
			p.note(error instanceof Error ? error.message : String(error), "Error");
		}

		if (isInteractiveMode) {
			p.outro(pc.red("Search failed"));
		} else {
			console.error(
				pc.red(
					`Search failed: ${error instanceof Error ? error.message : String(error)}`,
				),
			);
		}
		process.exit(1);
	}
}

/**
 * Load a tool definition from a local YAML file
 */
async function loadLocalTool(filePath: string): Promise<EnactToolDefinition> {
	const resolvedPath = resolve(filePath);

	if (!existsSync(resolvedPath)) {
		throw new Error(`Tool file not found: ${resolvedPath}`);
	}

	try {
		const fileContent = readFileSync(resolvedPath, "utf8");
		const toolData = yaml.parse(fileContent);

		// Store the raw content for signature verification
		const toolDefinition: EnactToolDefinition = {
			...toolData,
			raw_content: fileContent,
		};

		// Validate required fields
		if (!toolDefinition.name) {
			throw new Error("Tool must have a name");
		}
		if (!toolDefinition.command) {
			throw new Error("Tool must have a command");
		}

		return toolDefinition;
	} catch (error) {
		if (error instanceof yaml.YAMLParseError) {
			throw new Error(`Invalid YAML in tool file: ${error.message}`);
		}
		throw error;
	}
}

/**
 * Check if a tool identifier is a local file path
 */
function isLocalToolPath(toolIdentifier: string): boolean {
	const resolvedPath = resolve(toolIdentifier);

	if (existsSync(resolvedPath)) {
		return true;
	}

	return (
		(toolIdentifier.includes("/") || toolIdentifier.includes("\\")) &&
		(toolIdentifier.endsWith(".yaml") || toolIdentifier.endsWith(".yml"))
	);
}

/**
 * Collect parameters interactively based on JSON schema
 */
async function collectParametersInteractively(
	inputSchema: any,
): Promise<Record<string, any>> {
	const params: Record<string, any> = {};

	if (inputSchema.properties) {
		for (const [key, schema] of Object.entries(inputSchema.properties)) {
			const prop = schema as any;
			const isRequired = inputSchema.required?.includes(key) || false;

			let value: any;

			if (prop.type === "string") {
				value = await p.text({
					message: `Enter ${key}:`,
					placeholder: prop.description || `Value for ${key}`,
					validate: isRequired
						? (val) => (val.trim() ? undefined : `${key} is required`)
						: undefined,
				});
			} else if (prop.type === "number" || prop.type === "integer") {
				value = await p.text({
					message: `Enter ${key} (number):`,
					placeholder: prop.description || `Number value for ${key}`,
					validate: (val) => {
						if (!val.trim() && isRequired) return `${key} is required`;
						if (val.trim() && isNaN(Number(val)))
							return "Must be a valid number";
						return undefined;
					},
				});
				if (value) value = Number(value);
			} else if (prop.type === "boolean") {
				value = await p.confirm({
					message: `${key}:`,
					initialValue: false,
				});
			} else {
				value = await p.text({
					message: `Enter ${key} (JSON):`,
					placeholder: prop.description || `JSON value for ${key}`,
					validate: (val) => {
						if (!val.trim() && isRequired) return `${key} is required`;
						if (val.trim()) {
							try {
								JSON.parse(val);
							} catch {
								return "Must be valid JSON";
							}
						}
						return undefined;
					},
				});
				if (value) {
					try {
						value = JSON.parse(value);
					} catch {
						// Keep as string if JSON parsing fails
					}
				}
			}

			if (value !== null && value !== undefined && value !== "") {
				params[key] = value;
			}
		}
	}

	return params;
}

/**
 * Parse timeout string to milliseconds
 */
function parseTimeout(timeout: string): number {
	const match = timeout.match(/^(\d+)([smh])$/);
	if (!match) return 30000; // Default 30 seconds

	const [, value, unit] = match;
	const num = parseInt(value);

	switch (unit) {
		case "s":
			return num * 1000;
		case "m":
			return num * 60 * 1000;
		case "h":
			return num * 60 * 60 * 1000;
		default:
			return 30000;
	}
}

/**
 * Sign a tool definition using local private key
 */
export async function handleSignToolCommand(
	args: string[],
	options: CoreSignOptions,
) {
	if (options.help) {
		console.error(`
Usage: enact sign [options]
Sign a tool definition using your private key
Options:
  --help, -h          Show this help message
  --tool query      Search for the tool to sign (name)
Examples:
  enact sign --tool myorg/mytool
  `);
		return;
	}

		// Show a spinner during search
	
	if (!options.tool){
		const inputSchema = {
		type: "object",
		properties: {
			toolName: {
			type: "string",
			description: "The name of the tool to run"
			}
		},
		required: ["tool"]
		};

		const params = await collectParametersInteractively(inputSchema);
		// console.log("Collected tool name:", params.toolName);
		options.tool = params.toolName

	}	
	const spinner = p.spinner();
	spinner.start("Searching for tools...");
	const results: EnactTool[] = [];
	try {
		const searchOptions: ToolSearchOptions = {
			query: options.tool ? options.tool : "",
			limit: 20,
			tags: undefined,
			author: undefined,
			format: "table" as any,
		};

		// Use API client directly for search - no need for EnactCore
		const apiClient = await EnactApiClient.create();
		const searchResults = await apiClient.searchTools(searchOptions);
		
		// Convert API results to EnactTool format
		for (const result of searchResults) {
			if (result.name) {
				try {
					const tool = await apiClient.getTool(result.name);
					if (tool) {
						const documentForVerification = {
							command: tool.command,
							description: tool.description,
							from: tool.from,
							name: tool.name,
						};
						const isValid = await EnactCore.checkToolVerificationStatus(tool);
						// console.log("🔍 TRACE: core.ts - Tool:", tool.name, "isValid:", isValid);
						// Convert to EnactTool format
						const enactTool: EnactTool = {
							name: tool.name,
							description: tool.description || "",
							verified: isValid,
							command: tool.command,
							from: tool.from,
							version: tool.version || "1.0.0",
							timeout: tool.timeout,
							tags: tool.tags || [],
							inputSchema: tool.inputSchema,
							outputSchema: tool.outputSchema,
							env: tool.env_vars
								? Object.fromEntries(
										Object.entries(tool.env_vars).map(([key, config]: [string, any]) => [
											key,
											{ ...config, source: config.source || "env" },
										]),
									)
								: undefined,
							signature: tool.signature,
							signatures: Array.isArray(tool.signatures) ? tool.signatures : 
								(tool.signatures ? Object.values(tool.signatures) : undefined),
							namespace: tool.namespace,
							resources: tool.resources,
							license: tool.license,
							authors: tool.authors,
							examples: tool.examples,
							annotations: tool.annotations,
						};
						results.push(enactTool);
					}
				} catch (error) {
					// Skip tools that can't be fetched
					continue;
				}
			}
		}

		spinner.stop(
			`Found ${results.length} tool${results.length === 1 ? "" : "s"}`,
		);

		if (results.length === 0) {
			p.note("No tools found matching your criteria.", "No Results");
			p.note(
				"Try:\n• Broader keywords\n• Removing filters\n• Different spelling",
				"Suggestions",
			);

			return;
		}
	}catch (error: any) {
		spinner.stop("Search failed");

		if (
			error.message?.includes("ENOTFOUND") ||
			error.message?.includes("ECONNREFUSED")
		) {
			p.note(
				"Could not connect to the Enact registry. Check your internet connection.",
				"Connection Error",
			);
		} else {
			p.note(error instanceof Error ? error.message : String(error), "Error");
		}


		console.error(
			pc.red(
				`Search failed: ${error instanceof Error ? error.message : String(error)}`,
			),
		);
		process.exit(1);
	}

	const selected_tool = await p.select({
		message: "Select a tool to sign:",
		options: results.map((tool) => ({
			value: tool,
			label: `${tool.name} - ${tool.description.substring(0, 60)}${tool.description.length > 60 ? "..." : ""} - Verified: ${tool.verified ? pc.green("Yes") : pc.red("No")}`,
		}))
	}) as EnactTool;

	const documentForVerification = {
		command: selected_tool.command,
		description: selected_tool.description,
		from: selected_tool.from,
		name: selected_tool.name,
	}

	const privateKeys = await KeyManager.getAllPrivateKeys();

	const privateKey = await p.select({
		message: "Select a private key to sign with:",
		options: privateKeys.map((key) => ({
			value: key,
			label: `${key.fileName}`,
		}))
	}) as CryptoUtils.PrivateKey;

	const TrustedKey = CryptoUtils.getPublicKeyFromPrivate(privateKey.key);


	if (selected_tool.signatures && selected_tool.signatures.length > 0) {
		const alreadySigned = selected_tool.signatures.some(sig => {
				const referenceSignature = {
					signature: sig.value,
					publicKey: "", // Correct public key for UUID 71e02e2c-148c-4534-9900-bd9646e99333
					algorithm: sig.algorithm,
					timestamp: new Date(sig.created).getTime()
				};

				return SigningService.verifyDocumentWithPublicKey(
					documentForVerification,
					referenceSignature,
					TrustedKey,
					{ includeFields: ['command', 'description', 'from', 'name'] }
				);
			});

		if (alreadySigned) {
			console.log(pc.green("✓ Tool has already been signed with the selected key."));
			return;
		}
	}
	const spinnerSign = p.spinner();
	console.error(spinnerSign.start("Signing tool..."));
	const signature = await SigningService.signDocument(documentForVerification, privateKey.key, { includeFields: ['command', 'description', 'from', 'name']});
	spinnerSign.stop(pc.green("✓ Tool signed successfully"));
	console.error(pc.cyan("\nSignature Details:"));
	console.error(pc.cyan(`\tSignature: ${signature.signature}`));
	console.error(pc.cyan(`\tAlgorithm: ${signature.algorithm}`));
	console.error(pc.cyan(`\tCreated: ${new Date(signature.timestamp).toISOString()}`));
	console.error(pc.cyan(`\tPublic Key: ${TrustedKey}`));
	console.error(pc.red("\nPushing the signature to the registry is not yet implemented."));
	return signature

};	

/**
 * Enhanced handle execute command using core library with full legacy feature parity
 */
export async function handleCoreExecCommand(
	args: string[],
	options: CoreExecOptions,
) {
	if (options.help) {
		console.error(`
Usage: enact exec <tool-name-or-path> [options]

Execute an Enact tool by fetching its definition from the registry or loading from a local file.

Arguments:
  tool-name-or-path   Name of the tool (e.g., "enact/text/slugify") or path to local YAML file

Options:
  --help, -h          Show this help message
  --input <data>      Input data as JSON string or stdin
  --params <params>   Parameters as JSON object
  --timeout <time>    Override tool timeout (Go duration format: 30s, 5m, 1h)
  --dry               Show command that would be executed without running it
  --verbose, -v       Show detailed execution information
  --mount <path>      Mount local directory to container (format: "local:container")
  --dangerously-skip-verification Skip all signature verification (DANGEROUS - not recommended for production)
  --verify-policy     Verification policy: permissive, enterprise, paranoid (default: permissive)

Security Options:
  permissive          Require 1+ valid signatures from trusted keys (default)
  enterprise          Require author + reviewer signatures  
  paranoid            Require author + reviewer + approver signatures

Examples:
  enact exec enact/text/slugify --input "Hello World"
  enact exec org/ai/review --params '{"file": "README.md"}' --verify-policy enterprise
  enact exec ./my-tool.yaml --input "test data"
  enact exec kgroves/tools/prettier --mount ./src:/workspace/src
  enact exec untrusted/tool --dangerously-skip-verification  # DANGEROUS, not recommended
    `);
		return;
	}

	// Get the tool name/path
	let toolIdentifier = args[0];

	if (!toolIdentifier) {
		p.intro(pc.bgMagenta(pc.white(" Execute Enact Tool ")));

		toolIdentifier = (await p.text({
			message: "Enter the tool name or path to execute:",
			placeholder: "e.g., enact/text/slugify, ./my-tool.yaml",
			validate: (value) => {
				if (!value.trim()) return "Please enter a tool name or file path";
				const trimmed = value.trim();

				if (isLocalToolPath(trimmed)) {
					return undefined;
				}

				if (!/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_\/-]+$/.test(trimmed)) {
					return "Tool name must follow hierarchical format: org/package/tool-name, or be a path to a YAML file";
				}
				return undefined;
			},
		})) as string;

		if (!toolIdentifier) {
			p.outro(pc.yellow("Execution cancelled"));
			return;
		}
	}

	// Determine if this is a local file or remote tool
	const isLocalFile = isLocalToolPath(toolIdentifier);

	// Show a spinner while fetching/loading tool definition
	const spinner = p.spinner();
	spinner.start(
		isLocalFile
			? "Loading local tool definition..."
			: "Fetching tool definition...",
	);

	let toolDefinition: EnactToolDefinition;
	try {
		if (isLocalFile) {
			toolDefinition = await loadLocalTool(toolIdentifier);
			spinner.stop("Local tool definition loaded");
		} else {
			// Use the API to get tool
			const apiClient = await EnactApiClient.create();
			toolDefinition = await apiClient.getTool(toolIdentifier);
			spinner.stop("Tool definition fetched");
		}
	} catch (error) {
		spinner.stop(
			isLocalFile
				? "Failed to load local tool"
				: "Failed to fetch tool definition",
		);

		if (
			!isLocalFile &&
			error instanceof EnactApiError &&
			error.statusCode === 404
		) {
			p.outro(pc.red(`✗ Tool "${toolIdentifier}" not found`));
		} else {
			p.outro(
				pc.red(
					`✗ Failed to ${isLocalFile ? "load" : "fetch"} tool: ${error instanceof Error ? error.message : "Unknown error"}`,
				),
			);
		}
		return;
	}


	// Show tool information
	if (options.verbose) {
		console.error(pc.cyan("\n📋 Tool Information:"));
		console.error(`Name: ${toolDefinition.name}`);
		console.error(`Description: ${toolDefinition.description}`);
		console.error(`Command: ${toolDefinition.command}`);
		if (toolDefinition.from)
			console.error(`Container: ${toolDefinition.from}`);
		if (toolDefinition.timeout)
			console.error(`Timeout: ${toolDefinition.timeout}`);
		if (toolDefinition.tags)
			console.error(`Tags: ${toolDefinition.tags.join(", ")}`);

		if (toolDefinition.signatures) {
			const sigCount = Object.keys(toolDefinition.signatures).length;
			console.error(`Signatures: ${sigCount} signature(s) found`);
		} else {
			console.error(`Signatures: No signatures found`);
		}
	}

	// Parse input parameters
	let params: Record<string, any> = {};

	if (options.params) {
		try {
			params = JSON.parse(options.params);
		} catch (error) {
			p.outro(
				pc.red(
					`✗ Invalid JSON in --params: ${error instanceof Error ? error.message : "Unknown error"}`,
				),
			);
			return;
		}
	}

	// Handle input data
	if (options.input) {
		try {
			const inputData = JSON.parse(options.input);
			params = { ...params, ...inputData };
		} catch {
			params.input = options.input;
		}
	}

	// Parse key=value parameters from remaining command line arguments
	const remainingArgs = args.slice(1);
	for (const arg of remainingArgs) {
		if (arg.includes("=")) {
			const [key, ...valueParts] = arg.split("=");
			const value = valueParts.join("=");

			const cleanValue = value.replace(/^["']|["']$/g, "");
			params[key] = cleanValue;
		}
	}

	// Interactive parameter collection if needed
	if (toolDefinition.inputSchema && Object.keys(params).length === 0) {
		const needsParams = await p.confirm({
			message:
				"This tool requires parameters. Would you like to provide them interactively?",
			initialValue: true,
		});

		if (needsParams) {
			params = await collectParametersInteractively(toolDefinition.inputSchema);
		}
	}

	// Resolve environment variables from Enact configuration
	const { resolved: envVars, missing: missingEnvVars } =
		await resolveToolEnvironmentVariables(
			toolDefinition.name,
			toolDefinition.env,
		);

	// Validate required environment variables
	const validation = validateRequiredEnvironmentVariables(
		toolDefinition.env,
		envVars,
	);

	if (!validation.valid) {
		console.error(pc.red("\n✗ Missing required environment variables:"));
		validation.missing.forEach((varName) => {
			const config = toolDefinition.env?.[varName];
			const description = config?.description ? ` - ${config.description}` : "";
			const source = config?.source ? ` (source: ${config.source})` : "";
			const required = config?.required ? " [REQUIRED]" : "";
			console.error(pc.red(`  ${varName}${required}${description}${source}`));
		});

		console.error(pc.yellow("\n💡 You can set environment variables using:"));
		console.error(
			pc.cyan(
				"  enact env set <package> <VAR_NAME> <value>  # Package-managed (shared)",
			),
		);
		console.error(
			pc.cyan(
				"  enact env set <package> <VAR_NAME> --encrypt # For sensitive values",
			),
		);
		console.error(
			pc.cyan(
				"  enact env set <VAR_NAME> <value> --project   # Project-specific (.env file)",
			),
		);

		// Generate a configuration link for the web interface
		const configLink = generateConfigLink(
			validation.missing,
			toolDefinition.name,
		);
		if (configLink) {
			console.error(
				pc.yellow(
					"\n🌐 Or use the web interface to configure all missing variables:",
				),
			);
			console.error(pc.blue(`  ${configLink}`));
		}

		p.outro(pc.red("✗ Execution aborted due to missing environment variables"));
		return;
	}

	if (options.dry) {
		// Perform parameter substitution for dry run display
		let substitutedCommand = toolDefinition.command;
		Object.entries(params).forEach(([key, value]) => {
			substitutedCommand = substitutedCommand.replace(
				new RegExp(`\\$\\{${key}\\}`, "g"),
				String(value),
			);
		});

		console.error(pc.cyan("\n🔍 Command that would be executed:"));
		console.error(pc.white(substitutedCommand));
		console.error(pc.cyan("\nParameters:"));
		console.error(JSON.stringify(params, null, 2));
		console.error(pc.cyan("\nEnvironment variables:"));
		if (Object.keys(envVars).length > 0) {
			// Determine sources for dry run output too
			const systemEnv = process.env;
			let packageEnv: Record<string, string> = {};

			// Load package .env to determine sources
			if (toolDefinition.name) {
				try {
					const { extractPackageNamespace } = await import(
						"@enactprotocol/shared/utils"
					);
					const packageNamespace = extractPackageNamespace(toolDefinition.name);
					const packageEnvPath = require("path").join(
						require("os").homedir(),
						".enact",
						"env",
						packageNamespace,
						".env",
					);

					const fs = require("fs");
					if (fs.existsSync(packageEnvPath)) {
						const dotenv = require("dotenv");
						const result = dotenv.config({ path: packageEnvPath });
						packageEnv = result.parsed || {};
					}
				} catch (error) {
					// Ignore errors
				}
			}

			Object.entries(envVars).forEach(([key, value]) => {
				// Determine source with correct priority
				let source = " (from system)";
				if (key in packageEnv) {
					source = " (from package .env)";
				}
				if (key in envVars && !(key in systemEnv) && !(key in packageEnv)) {
					source = " (from Enact package config)";
				}

				const displayValue =
					key.includes("KEY") || key.includes("TOKEN") || key.includes("SECRET")
						? "[hidden]"
						: value;
				console.error(`  ${key}=${displayValue}${source}`);
			});
		} else {
			console.error("  (none required)");
		}
		return;
	}

	if (
		options.verbose &&
		toolDefinition.env &&
		Object.keys(toolDefinition.env).length > 0
	) {
		console.error(pc.cyan("\n🌍 Tool-specific environment variables:"));
		Object.entries(toolDefinition.env).forEach(([key, config]) => {
			const value = envVars[key];
			const isSet = value !== undefined;
			const isFromEnact = key in envVars && !(key in process.env);
			const source = isFromEnact ? " (from Enact config)" : " (from system)";
			const description = config?.description ? ` - ${config.description}` : "";
			const required = config?.required ? " [REQUIRED]" : "";
			const displayValue = isSet
				? key.includes("KEY") || key.includes("TOKEN") || key.includes("SECRET")
					? "[hidden]"
					: value
				: "[not set]";
			const status = isSet ? "✓" : required ? "✗" : "○";
			console.error(
				`  ${status} ${key}=${displayValue}${required}${description}${source}`,
			);
		});
	}

	// Execute using core library
	const executeOptions: ToolExecuteOptions = {
		timeout: options.timeout,
		dryRun: options.dry,
		verbose: options.verbose,
		isLocalFile: isLocalFile,
		mount: options.mount,
	};

	try {
		// Show a more informative start message
		console.error(pc.cyan(`\n🚀 Executing ${toolIdentifier}...`));

		if (options.verbose) {
			console.error(pc.gray(`Command: ${toolDefinition.command}`));
			if (Object.keys(params).length > 0) {
				console.error(pc.gray(`Parameters: ${JSON.stringify(params)}`));
			}
			spinner.start("Running...");
		}

		// Convert tool definition to EnactTool format for core
		const enactTool: EnactTool = {
			name: toolDefinition.name,
			description: toolDefinition.description || "",
			verified: true, // Verification handled separately
			command: toolDefinition.command,
			from: toolDefinition.from,
			version: toolDefinition.version || "1.0.0",
			timeout: toolDefinition.timeout,
			tags: toolDefinition.tags || [],
			inputSchema: toolDefinition.inputSchema,
			outputSchema: toolDefinition.outputSchema,
			env: toolDefinition.env
				? Object.fromEntries(
						Object.entries(toolDefinition.env).map(([key, config]) => [
							key,
							{ ...config, source: config.source || "env" },
						]),
					)
				: undefined,
			signature: toolDefinition.signature,
			signatures: Array.isArray(toolDefinition.signatures) ? toolDefinition.signatures : 
				(toolDefinition.signatures ? Object.values(toolDefinition.signatures) : undefined),
			namespace: toolDefinition.namespace,
			resources: toolDefinition.resources,
		};

		const configuredCore = await getConfiguredCore();
		const result = await configuredCore.executeTool(
			enactTool,
			params,
			executeOptions,
		);

		if (options.verbose) {
			spinner.stop("Execution completed");
		}

		if (result.success) {
			console.error(pc.green("\n✅ Tool executed successfully!!"));

			if (result.output) {
				// Check if output contains both stdout and stderr
				if (
					typeof result.output === "object" &&
					result.output.stdout !== undefined
				) {
					if (result.output.stdout && result.output.stdout.trim()) {
						console.error(pc.cyan("\n📤 Output:"));
						console.error(cleanOutput(result.output.stdout));
					}
					if (result.output.stderr && result.output.stderr.trim()) {
						console.error(pc.yellow("\n⚠ Stderr:"));
						console.error(pc.gray(cleanOutput(result.output.stderr)));
					}
				} else if (result.output) {
					console.error(pc.cyan("\n📤 Output:"));
					if (typeof result.output === "object") {
						console.error(JSON.stringify(result.output, null, 2));
					} else {
						console.error(cleanOutput(result.output));
					}
				}
			} else {
				console.error(pc.gray("\n(No output returned)"));
			}

			if (options.verbose && result.metadata) {
				console.error(pc.cyan("\n📋 Metadata:"));
				console.error(JSON.stringify(result.metadata, null, 2));
			}

			// Log usage (include verification status) - only for remote tools
			if (!isLocalFile) {
				try {
					const apiClient = await EnactApiClient.create();
					await apiClient.logToolUsage(toolIdentifier, {
						action: "execute",
						metadata: {
							hasParams: Object.keys(params).length > 0,
							timeout: options.timeout || toolDefinition.timeout || "30s",
							timestamp: new Date().toISOString(),
						},
					});
				} catch (error) {
					if (options.verbose) {
						console.error(pc.yellow("⚠ Failed to log usage statistics"));
					}
				}
			}

			p.outro("Execution successful!");
		} else {
			console.error(pc.red("\n❌ Tool execution failed"));

			if (result.error) {
				console.error(pc.red(`\nError: ${result.error.message}`));

				if (result.error.details) {
					// Always show key details, not just in verbose mode
					if (
						result.error.details.stderr &&
						result.error.details.stderr.trim()
					) {
						console.error(pc.red("\nStderr output:"));
						console.error(
							pc.gray(cleanOutput(result.error.details.stderr.trim())),
						);
					}

					if (
						result.error.details.stdout &&
						result.error.details.stdout.trim()
					) {
						console.error(pc.yellow("\nStdout output:"));
						console.error(
							pc.gray(cleanOutput(result.error.details.stdout.trim())),
						);
					}

					if (result.error.details.exitCode !== undefined) {
						console.error(
							pc.red(`\nExit code: ${result.error.details.exitCode}`),
						);
					}

					if (result.error.details.command) {
						console.error(
							pc.cyan(`\nCommand executed: ${result.error.details.command}`),
						);
					}

					if (options.verbose) {
						console.error(pc.red("\nFull error details:"));
						console.error(JSON.stringify(result.error.details, null, 2));
					}
				}
			}

			if (options.verbose && result.metadata) {
				console.error(pc.cyan("\nMetadata:"));
				console.error(JSON.stringify(result.metadata, null, 2));
			}

			p.outro(pc.red("Execution failed"));
			process.exit(1);
		}
	} catch (error) {
		spinner.stop("Execution failed");
		console.error(
			pc.red(
				`\n❌ Error executing tool: ${error instanceof Error ? error.message : String(error)}`,
			),
		);

		if (options.verbose) {
			console.error("Full error:", error);
		}

		p.outro(pc.red("Execution failed"));
		process.exit(1);
	}

	process.exit(0);
}

/**
 * Handle get command using core library
 */
export async function handleCoreGetCommand(
	args: string[],
	options: { help?: boolean; format?: string },
) {
	// Enable silent mode for cleaner CLI output
	process.env.ENACT_SILENT = "true";
	
	if (options.help) {
		console.error(`
${pc.bold("enact get")} - Get tool information

${pc.bold("USAGE:")}
  enact get <tool-name>

${pc.bold("OPTIONS:")}
  -f, --format <format>   Output format (json, yaml)
  -h, --help              Show help

${pc.bold("EXAMPLES:")}
  enact get text/analyzer
  enact get file/converter --format json
    `);
		return;
	}

	try {
		let toolName = args[0];

		if (!toolName) {
			const response = await p.text({
				message: "Enter tool name:",
				placeholder: 'e.g., "text/analyzer"',
			});

			if (p.isCancel(response)) {
				p.outro("Operation cancelled");
				return;
			}

			toolName = response;
		}

		p.intro(pc.bgBlue(pc.black(" Getting Tool Info ")));

		const spinner = p.spinner();
		spinner.start(`Fetching ${toolName}...`);

		// Use API client directly - no need for EnactCore
		const apiClient = await EnactApiClient.create();
		const toolDefinition = await apiClient.getTool(toolName);
		
		if (!toolDefinition) {
			spinner.stop("Tool not found");
			p.outro(pc.red(`Tool not found: ${toolName}`));
			process.exit(1);
		}

		const isValid = EnactCore.checkToolVerificationStatus(toolDefinition);

		// Convert to EnactTool format
		const tool: EnactTool = {
			name: toolDefinition.name,
			description: toolDefinition.description || "",
			verified: isValid,
			command: toolDefinition.command,
			from: toolDefinition.from,
			version: toolDefinition.version || "1.0.0",
			timeout: toolDefinition.timeout,
			tags: toolDefinition.tags || [],
			inputSchema: toolDefinition.inputSchema,
			outputSchema: toolDefinition.outputSchema,
			env: toolDefinition.env_vars
				? Object.fromEntries(
						Object.entries(toolDefinition.env_vars).map(([key, config]: [string, any]) => [
							key,
							{ ...config, source: config.source || "env" },
						]),
					)
				: undefined,
			signature: toolDefinition.signature,
			signatures: Array.isArray(toolDefinition.signatures) ? toolDefinition.signatures : 
				(toolDefinition.signatures ? Object.values(toolDefinition.signatures) : undefined),
			namespace: toolDefinition.namespace,
			resources: toolDefinition.resources,
			license: toolDefinition.license,
			authors: toolDefinition.authors,
			examples: toolDefinition.examples,
			annotations: toolDefinition.annotations,
		};

		spinner.stop("Fetch completed");

		if (!tool) {
			p.outro(pc.red(`Tool not found: ${toolName}`));
			process.exit(1);
		}

		if (options.format === "json") {
			console.error(JSON.stringify(tool, null, 2));
		} else if (options.format === "yaml") {
			const yaml = await import("yaml");
			console.error(yaml.stringify(tool));
		} else {
			// Human-readable format
			console.error(`\n${pc.bold(pc.cyan(`📦 ${tool.name}`))}`);
			console.error(`${tool.description}\n`);

			if (tool.command) {
				console.error(`${pc.bold("Command:")} ${pc.gray(tool.command)}`);
			}
			
			if (tool.verified) {
				console.error(`${pc.bold("Verification:")} ${pc.green("Verified ✓")}`);
			} else {
				console.error(`${pc.bold("Verification:")} ${pc.red("Unverified ✗")}`);
			}

			if (tool.from) {
				console.error(`${pc.bold("Container:")} ${pc.gray(tool.from)}`);
			}

			if (tool.tags && tool.tags.length > 0) {
				console.error(
					`${pc.bold("Tags:")} ${tool.tags.map((tag) => pc.blue(`#${tag}`)).join(" ")}`,
				);
			}

			if (tool.authors && tool.authors.length > 0) {
				console.error(
					`${pc.bold("Authors:")} ${tool.authors.map((a) => a.name).join(", ")}`,
				);
			}

			if (tool.license) {
				console.error(`${pc.bold("License:")} ${tool.license}`);
			}

			if (tool.version) {
				console.error(`${pc.bold("Version:")} ${tool.version}`);
			}

			if (tool.timeout) {
				console.error(`${pc.bold("Timeout:")} ${tool.timeout}`);
			}

			if (tool.signature || tool.signatures) {
				console.error(`${pc.bold("Signed:")} ${pc.green("✓")}`);
			}

			if (tool.inputSchema && tool.inputSchema.properties) {
				console.error(`\n${pc.bold("Input Parameters:")}`);
				for (const [key, schema] of Object.entries(
					tool.inputSchema.properties,
				)) {
					const required = tool.inputSchema.required?.includes(key)
						? pc.red("*")
						: "";
					console.error(
						`  ${key}${required}: ${(schema as any).type || "any"} - ${(schema as any).description || "No description"}`,
					);
				}
			}

			if (tool.examples && tool.examples.length > 0) {
				console.error(`\n${pc.bold("Examples:")}`);
				tool.examples.forEach((example, i) => {
					console.error(`  ${i + 1}. ${example.description || "Example"}`);
					console.error(`     Input: ${JSON.stringify(example.input)}`);
					if (example.output) {
						console.error(`     Output: ${JSON.stringify(example.output)}`);
					}
				});
			}
		}

		p.outro("Tool information retrieved successfully!");
	} catch (error) {
		p.outro(
			pc.red(
				`Failed to get tool info: ${error instanceof Error ? error.message : String(error)}`,
			),
		);
		process.exit(1);
	}
}


/**
 * Display results in a formatted table
 */
function displayResultsTable(results: EnactTool[]): void {
	console.error("\n" + pc.bold("Search Results:"));

	const nameWidth = 40;
	const statusWidth = 15; // moved up
	const descWidth = 45;
	const tagsWidth = 20;

	// Dynamically calculate the total table width
	const totalWidth = nameWidth + statusWidth + descWidth + tagsWidth + 9; 
	// 9 = 3 separators ( " │ " ) × 3

	console.error("═".repeat(totalWidth));

	// Header row
	console.error(
		pc.bold(pc.cyan("NAME".padEnd(nameWidth))) +
			" │ " +
			pc.bold(pc.cyan("STATUS".padEnd(statusWidth))) +
			" │ " +
			pc.bold(pc.cyan("DESCRIPTION".padEnd(descWidth))) +
			" │ " +
			pc.bold(pc.cyan("TAGS".padEnd(tagsWidth))),
	);

	// Separator row
	console.error(
		"─".repeat(nameWidth) +
			"─┼─" +
			"─".repeat(statusWidth) +
			"─┼─" +
			"─".repeat(descWidth) +
			"─┼─" +
			"─".repeat(tagsWidth),
	);

	// Rows
	results.forEach((tool) => {
		// Format name
		const nameText =
			tool.name.length > nameWidth
				? tool.name.substring(0, nameWidth - 3) + "..."
				: tool.name.padEnd(nameWidth);		

		// Format status
		const statusText = tool.verified ? "Verified" : "Unverified";
		const statusColor = tool.verified ? pc.green : pc.red;
		const status = statusColor(statusText.padEnd(statusWidth));

		// const name = statusColor(nameText)

		// Format description
		const desc =
			tool.description.length > descWidth
				? tool.description.substring(0, descWidth - 3) + "..."
				: tool.description.padEnd(descWidth);

		// Format tags
		const tags = (tool.tags || []).join(", ");
		const tagsDisplay =
			tags.length > tagsWidth
				? tags.substring(0, tagsWidth - 3) + "..."
				: tags.padEnd(tagsWidth);

		// Print row
		console.error(
			pc.green(nameText) + " │ " + status + " │ " + pc.dim(desc) + " │ " + pc.yellow(tagsDisplay),
		);
	});

	console.error("═".repeat(totalWidth));
	console.error(
		pc.dim(`Total: ${results.length} tool${results.length === 1 ? "" : "s"}`),
	);
}




/**
 * Display results in a simple list format
 */
function displayResultsList(results: EnactTool[]): void {
	console.error("\n" + pc.bold("Search Results:"));
	console.error("");

	results.forEach((tool, index) => {
		console.error(
			`${pc.cyan(`${index + 1}.`)} ${pc.bold((tool.verified ? pc.green(tool.name) : pc.red(tool.name)) + (tool.verified ? pc.green(" (verified)") : pc.red(" (unverified)")))}`,
		);
		console.error(`   ${pc.dim(tool.description)}`);
		if (tool.tags && tool.tags.length > 0) {
			console.error(`   ${pc.yellow("Tags:")} ${tool.tags.join(", ")}`);
		}
		console.error("");
	});

	console.error(
		pc.dim(`Total: ${results.length} tool${results.length === 1 ? "" : "s"}`),
	);
}

/**
 * Show detailed information for a specific tool using the core library
 */
async function showToolDetailsFromCore(toolName: string): Promise<void> {
	const spinner = p.spinner();
	spinner.start(`Loading details for ${toolName}...`);

	try {
		const config = await getCurrentConfig();
		const tool = await EnactCore.getToolByName(toolName, undefined, {
			apiUrl: config.apiUrl,
			supabaseUrl: config.supabaseUrl,
		});

		if (!tool) {
			spinner.stop("Tool not found");
			p.note(`Tool not found: ${toolName}`, "Error");
			return;
		}

		spinner.stop("Tool details loaded");

		console.error("\n" + pc.bold(pc.bgBlue(pc.white(` ${tool.name} `))));
		console.error("");
		console.error(pc.bold("Description:"));
		console.error(tool.description);
		console.error("");

		if (tool.command) {
			console.error(pc.bold("Command:"));
			console.error(pc.cyan(tool.command));
			console.error("");
		}

		if (tool.from) {
			console.error(pc.bold("Container:"));
			console.error(pc.cyan(tool.from));
			console.error("");
		}

		if (tool.tags && tool.tags.length > 0) {
			console.error(pc.bold("Tags:"));
			console.error(tool.tags.map((tag: string) => pc.yellow(tag)).join(", "));
			console.error("");
		}

		if (tool.timeout) {
			console.error(pc.bold("Timeout:"));
			console.error(tool.timeout);
			console.error("");
		}

		if (tool.version) {
			console.error(pc.bold("Version:"));
			console.error(tool.version);
			console.error("");
		}

		if (tool.license) {
			console.error(pc.bold("License:"));
			console.error(tool.license);
			console.error("");
		}

		if (tool.authors && tool.authors.length > 0) {
			console.error(pc.bold("Authors:"));
			console.error(tool.authors.map((a) => a.name).join(", "));
			console.error("");
		}

		if (tool.inputSchema) {
			console.error(pc.bold("Input Schema:"));
			console.error(JSON.stringify(tool.inputSchema, null, 2));
			console.error("");
		}

		if (tool.examples && tool.examples.length > 0) {
			console.error(pc.bold("Examples:"));
			tool.examples.forEach((example: any, index: any) => {
				console.error(pc.cyan(`Example ${index + 1}:`));
				if (example.description) {
					console.error(`  Description: ${example.description}`);
				}
				console.error(`  Input: ${JSON.stringify(example.input)}`);
				if (example.output) {
					console.error(`  Output: ${example.output}`);
				}
				console.error("");
			});
		}

		if (tool.env && Object.keys(tool.env).length > 0) {
			console.error(pc.bold("Environment Variables:"));
			Object.entries(tool.env).forEach(([key, config]: any) => {
				console.error(
					`  ${pc.yellow(key)}: ${config.description || "No description"}`,
				);
				if (config.required) {
					console.error(`    Required: ${pc.red("Yes")}`);
				} else {
					console.error(`    Required: ${pc.green("No")}`);
					if (config.default) {
						console.error(`    Default: ${config.default}`);
					}
				}
			});
			console.error("");
		}

		if (tool.signature || tool.signatures) {
			console.error(pc.bold("Security:"));
			console.error(`  Signed: ${pc.green("✓ Yes")}`);
			if (tool.signatures) {
				const sigCount = Object.keys(tool.signatures).length;
				console.error(`  Signatures: ${sigCount}`);
			}
			console.error("");
		} else {
			console.error(pc.bold("Security:"));
			console.error(`  Signed: ${pc.red("✗ No")}`);
			console.error("");
		}
	} catch (error) {
		spinner.stop("Failed to load tool details");
		p.note(
			`Failed to load details: ${error instanceof Error ? error.message : String(error)}`,
			"Error",
		);
	}
}

/**
 * Handle publish command using core library - Enhanced with all legacy features
 */
export async function handleCorePublishCommand(
	args: string[],
	options: CorePublishOptions,
) {
	if (options.help) {
		console.error(`
Usage: enact publish [file] [options]

Publish an Enact tool to the registry

Arguments:
  file                   Path to the tool manifest (.yaml or .yml)

Options:
  --url <url>           Registry URL to publish to
  --token <token>       Authentication token
  --verbose             Show detailed output
  --help, -h            Show this help message

Examples:
  enact publish my-tool.yaml
  enact publish --url https://api.enact.dev
  enact publish my-tool.yaml --token your-api-token
`);
		return;
	}

	p.intro(pc.bgBlue(pc.white(" Publish Enact Tool ")));

	try {
		// Get file path from args or prompt
		let filePath: string;
		if (args.length > 0) {
			filePath = args[0];
		} else if (options.file) {
			filePath = options.file;
		} else {
			// Interactive file selection
			filePath = (await p.text({
				message: "Enter the path to the tool manifest (.yaml or .yml):",
				validate: (value) => {
					if (!value) return "File path is required";
					if (!existsSync(value)) return "File does not exist";
					const ext = extname(value).toLowerCase();
					if (ext !== ".yaml" && ext !== ".yml")
						return "File must be a YAML file (.yaml or .yml)";
					return undefined;
				},
			})) as string;
		}

		if (p.isCancel(filePath)) {
			p.cancel("Operation cancelled");
			return;
		}

		// Validate file exists
		if (!existsSync(filePath)) {
			p.cancel(`File not found: ${filePath}`);
			return;
		}

		// Get authentication token
		let authToken: string;
		if (options.token) {
			authToken = options.token;
		} else {
			// Try to get from auth headers
			try {
				const authHeaders = await getAuthHeaders();
				authToken = authHeaders["X-API-Key"];
			} catch {
				// Prompt for token
				authToken = (await p.password({
					message: "Enter your API token:",
					validate: (value) => (value ? undefined : "API token is required"),
				})) as string;

				if (p.isCancel(authToken)) {
					p.cancel("Operation cancelled");
					return;
				}
			}
		}

		// Load and parse the tool
		const s = p.spinner();
		s.start("Loading tool manifest...");

		let tool: EnactTool;
		try {
			const fileContent = await readFile(filePath, "utf8");
			tool = yaml.parse(fileContent) as EnactTool;
		} catch (error) {
			s.stop("Failed to parse tool manifest");
			p.cancel(
				`Error parsing ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
			);
			return;
		}

		s.stop("Tool manifest loaded");

		// Validate required fields
		if (!tool.name) {
			p.cancel('Tool manifest must have a "name" field');
			return;
		}

		if (!tool.version) {
			p.cancel('Tool manifest must have a "version" field');
			return;
		}

		// Display tool info for confirmation
		p.note(
			`
Name: ${tool.name}
Version: ${tool.version}
Description: ${tool.description || "No description"}
File: ${filePath}
`,
			"Tool Information",
		);

		const shouldContinue = await p.confirm({
			message: "Publish this tool to the registry?",
		});

		if (!shouldContinue || p.isCancel(shouldContinue)) {
			p.cancel("Publish cancelled");
			return;
		}

		// Publish the tool
		s.start("Publishing tool...");

		try {
			const config = await getCurrentConfig();
			const result = await EnactCore.publishTool(tool, authToken, {
				supabaseUrl: options.url || config.supabaseUrl,
				apiUrl: config.apiUrl,
			});

			if (result.success) {
				s.stop("Tool published successfully!");
				p.note(
					`Tool "${tool.name}@${tool.version}" has been published to the registry.`,
					"Success",
				);

				// Add to history for future use
				try {
					await addToHistory(filePath);
				} catch (error) {
					if (options.verbose) {
						console.warn(`Warning: Could not save to history: ${error}`);
					}
				}
			} else {
				s.stop("Publish failed");
				p.cancel(`Failed to publish: ${result.message}`);
			}
		} catch (error) {
			s.stop("Publish failed");

			if (error instanceof EnactApiError) {
				if (error.statusCode === 401) {
					p.cancel("Authentication failed. Please check your API token.");
				} else if (error.statusCode === 409) {
					p.cancel(
						`Tool "${tool.name}@${tool.version}" already exists. Consider updating the version.`,
					);
				} else {
					p.cancel(`Publish failed: ${error.message}`);
				}
			} else {
				p.cancel(
					`Publish failed: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		}
	} catch (error) {
		p.cancel(
			`Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
		);
	}

	p.outro("Thanks for using Enact!");
}

/**
 * Interactive file path selection (same logic as legacy)
 */
async function getFilePathInteractively(): Promise<string | null> {
	try {
		const { getHistory } = await import("@enactprotocol/shared/utils");
		const history = await getHistory();

		if (history.length > 0) {
			// User has publish history, offer to reuse
			const action = await p.select({
				message: "Select a tool manifest to publish:",
				options: [
					{ value: "select", label: "Choose from recent files" },
					{ value: "new", label: "Specify a new file" },
				],
			});

			if (p.isCancel(action)) return null;

			if (action === "select") {
				const fileOptions = history
					.filter((file: string) => existsSync(file) && isEnactFile(file))
					.map((file: string) => ({
						value: file,
						label: file,
					}));

				if (fileOptions.length > 0) {
					const selectedFile = await p.select({
						message: "Select a tool manifest:",
						options: fileOptions,
					});

					return p.isCancel(selectedFile) ? null : (selectedFile as string);
				} else {
					p.note("No recent Enact tool manifests found.", "History");
					const filePath = await p.text({
						message: "Enter the path to the tool manifest (.yaml or .yml):",
						validate: validateEnactFile,
					});

					return p.isCancel(filePath) ? null : (filePath as string);
				}
			} else {
				const filePath = await p.text({
					message: "Enter the path to the tool manifest (.yaml or .yml):",
					validate: validateEnactFile,
				});

				return p.isCancel(filePath) ? null : (filePath as string);
			}
		} else {
			// No history, just ask for a file
			const filePath = await p.text({
				message: "Enter the path to the tool manifest (.yaml or .yml):",
				validate: validateEnactFile,
			});

			return p.isCancel(filePath) ? null : (filePath as string);
		}
	} catch (error) {
		console.warn("Failed to load history:", error);

		// Fallback to simple prompt
		const filePath = await p.text({
			message: "Enter the path to the tool manifest (.yaml or .yml):",
			validate: validateEnactFile,
		});

		return p.isCancel(filePath) ? null : (filePath as string);
	}
}

/**
 * Check if a file is an Enact manifest based on extension
 */
function isEnactFile(filePath: string): boolean {
	const ext = filePath.toLowerCase().split(".").pop();
	return ext === "yaml" || ext === "yml";
}

/**
 * Validate that a file exists and is an Enact manifest
 */
function validateEnactFile(value: string): string | undefined {
	if (!value) return "File path is required";
	if (!existsSync(value)) return "File does not exist";
	if (!isEnactFile(value)) return "File must be a YAML file (.yaml or .yml)";
	return undefined;
}

export { core };

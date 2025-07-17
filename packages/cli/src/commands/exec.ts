// src/commands/exec.ts - Execute Enact tools with centralized verification
import { readFileSync, existsSync } from "fs";
import * as p from "@clack/prompts";
import pc from "picocolors";
import * as yaml from "yaml";
import { enactApi, EnactApiError } from "@enactprotocol/shared/api";
import {
	EnactExecOptions,
	EnactToolDefinition,
} from "@enactprotocol/shared/api";
import { getConfiguredCore } from "./core";

/**
 * Load a tool definition from a local YAML file
 */
function loadLocalTool(path: string): EnactToolDefinition {
	if (!existsSync(path)) {
		throw new Error(`Tool file not found: ${path}`);
	}

	const content = readFileSync(path, "utf-8");
	const toolDefinition = yaml.parse(content) as EnactToolDefinition;

	if (!toolDefinition.name) {
		throw new Error("Tool definition must have a name");
	}

	if (!toolDefinition.description) {
		throw new Error("Tool definition must have a description");
	}

	if (!toolDefinition.command) {
		throw new Error("Tool definition must have a command");
	}

	return toolDefinition;
}

/**
 * Check if a tool identifier is a local file path
 */
function isLocalToolPath(identifier: string): boolean {
	return (
		identifier.startsWith("./") ||
		identifier.startsWith("../") ||
		identifier.startsWith("/") ||
		identifier.endsWith(".yaml") ||
		identifier.endsWith(".yml")
	);
}

/**
 * Execute an Enact tool using centralized Core verification
 */
export async function execCommand(
	toolIdentifier: string,
	options: EnactExecOptions,
): Promise<void> {
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
  --skip-verification Skip signature verification (not recommended)
  --verify-policy     Verification policy: permissive, enterprise, paranoid (default: permissive)
  --dangerously-skip-verification Skip all signature verification (DANGEROUS - not recommended for production)

Security Options:
  permissive          Require 1+ valid signatures from trusted keys (default)
  enterprise          Require author + reviewer signatures  
  paranoid            Require author + reviewer + approver signatures

Examples:
  enact exec enact/text/slugify --input "Hello World"
  enact exec org/ai/review --params '{"file": "README.md"}' --verify-policy enterprise
  enact exec ./my-tool.yaml --input "test data"
  enact exec untrusted/tool --dangerously-skip-verification  # DANGEROUS - not recommended
  echo "Hello World" | enact exec enact/text/slugify --input -
`);
		return;
	}

	// Auto-detect stdin input
	if (!toolIdentifier && !process.stdin.isTTY) {
		const response = await p.text({
			message: "Enter tool name or path",
			placeholder: "enact/text/slugify",
			validate: (value) => {
				if (!value) return "Tool name or path is required";
				return;
			},
		});

		if (p.isCancel(response)) {
			p.outro(pc.yellow("Execution cancelled"));
			return;
		}

		toolIdentifier = response as string;
	}

	// Determine if this is a local file or remote tool
	const isLocalFile = isLocalToolPath(toolIdentifier);

	// Get configured core instance
	const core = await getConfiguredCore();

	// Parse input parameters
	let params: Record<string, any> = {};

	if (options.params) {
		try {
			params = JSON.parse(options.params);
		} catch (error) {
			p.outro(
				pc.red(`✗ Invalid JSON in --params: ${(error as Error).message}`),
			);
			return;
		}
	}

	// Handle stdin input
	if (options.input === "-") {
		let stdinData = "";
		process.stdin.setEncoding("utf8");
		process.stdin.on("data", (chunk) => {
			stdinData += chunk;
		});

		await new Promise<void>((resolve) => {
			process.stdin.on("end", () => {
				params.input = stdinData.trim();
				resolve();
			});
		});
	} else if (options.input) {
		try {
			params.input = JSON.parse(options.input);
		} catch {
			// If it's not valid JSON, treat it as a string
			params.input = options.input;
		}
	}

	// Execute via centralized Core with proper verification
	const spinner = p.spinner();
	spinner.start("Executing tool...");

	try {
		console.error("🔍 TRACE: exec.ts - isLocalFile:", isLocalFile);
		const result = isLocalFile
			? await core.executeRawTool(readFileSync(toolIdentifier, "utf-8"), params, {
					timeout: options.timeout,
					force: options.force || options.dangerouslySkipVerification,
					dryRun: options.dry,
					verbose: options.verbose,
					isLocalFile: true,
				})
			: await core.executeToolByName(toolIdentifier, params, {
					timeout: options.timeout,
					force: options.force || options.dangerouslySkipVerification,
					dryRun: options.dry,
					verbose: options.verbose,
					isLocalFile: false,
				});

		spinner.stop("Tool execution completed");

		if (result.success) {
			// Output the result
			if (result.output) {
				console.log(result.output);
			}
			p.outro(pc.green("✅ Tool execution completed successfully"));
		} else {
			// Handle verification failure or execution error
			if (result.error) {
				console.error(pc.red(`❌ ${result.error}`));
			}
			p.outro(pc.red("✗ Tool execution failed"));
			process.exit(1);
		}
	} catch (error) {
		spinner.stop("Tool execution failed");
		console.error(pc.red(`❌ Execution error: ${(error as Error).message}`));
		p.outro(pc.red("✗ Tool execution failed"));
		process.exit(1);
	}
}
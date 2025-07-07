// src/commands/env.ts - Environment variable management for Enact CLI with package namespace support
import {
	intro,
	outro,
	text,
	select,
	confirm,
	spinner,
	note,
	password,
} from "@clack/prompts";
import pc from "picocolors";
import { existsSync } from "fs";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { homedir } from "os";

interface EnvOptions {
	help?: boolean;
	package?: string;
	format?: string;
	show?: boolean;
}

// Configuration paths
const CONFIG_DIR = join(homedir(), ".enact");
const ENV_BASE_DIR = join(CONFIG_DIR, "env");

/**
 * Get the environment file path for a package namespace (excluding tool name)
 */
function getPackageEnvPath(packageName: string): string {
	// Parse package name like "kgroves88/dagger/social/bluesky-poster"
	const parts = packageName.split("/");
	if (parts.length < 2) {
		throw new Error(
			'Package name must be in format "org/package" or "org/package/tool"',
		);
	}

	// Use all parts except the last one (tool name) for the directory structure
	// e.g., "kgroves88/dagger/social/bluesky-poster" -> "kgroves88/dagger/social"
	const namespace = parts.slice(0, -1).join("/");
	return join(ENV_BASE_DIR, namespace, ".env");
}

/**
 * Ensure package environment directory exists
 */
async function ensurePackageEnvDir(packageName: string): Promise<void> {
	const envFile = getPackageEnvPath(packageName);
	const envDir = dirname(envFile);

	if (!existsSync(envDir)) {
		await mkdir(envDir, { recursive: true });
	}

	if (!existsSync(envFile)) {
		await writeFile(envFile, "");
	}
}

/**
 * Parse simple .env file format (KEY=value)
 */
function parseDotEnv(content: string): Record<string, string> {
	const vars: Record<string, string> = {};
	const lines = content.split("\n");

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) {
			continue; // Skip empty lines and comments
		}

		const equalIndex = trimmed.indexOf("=");
		if (equalIndex === -1) {
			continue; // Skip lines without '='
		}

		const key = trimmed.slice(0, equalIndex).trim();
		let value = trimmed.slice(equalIndex + 1).trim();

		// Remove quotes if present
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}

		if (key) {
			vars[key] = value;
		}
	}

	return vars;
}

/**
 * Read environment variables from .env file
 */
async function readEnvVars(
	packageName: string,
): Promise<Record<string, string>> {
	await ensurePackageEnvDir(packageName);
	const envFile = getPackageEnvPath(packageName);

	try {
		const content = await readFile(envFile, "utf8");
		return parseDotEnv(content);
	} catch (error) {
		console.error(
			`Failed to read env file for ${packageName}: ${(error as Error).message}`,
		);
		return {};
	}
}

/**
 * Write environment variables to .env file
 */
async function writeEnvVars(
	packageName: string,
	vars: Record<string, string>,
): Promise<void> {
	await ensurePackageEnvDir(packageName);
	const envFile = getPackageEnvPath(packageName);

	const envContent = Object.entries(vars)
		.sort(([a], [b]) => a.localeCompare(b)) // Sort keys alphabetically
		.map(([key, value]) => {
			// Quote values that contain spaces or special characters
			const needsQuotes = /[\s#"'\\]/.test(value);
			const quotedValue = needsQuotes
				? `"${value.replace(/"/g, '\\"')}"`
				: value;
			return `${key}=${quotedValue}`;
		})
		.join("\n");

	await writeFile(envFile, envContent + "\n");
}

/**
 * List all available package namespaces
 */
async function listPackageNamespaces(): Promise<string[]> {
	if (!existsSync(ENV_BASE_DIR)) {
		return [];
	}

	const packages: string[] = [];
	try {
		const fs = require("fs");

		function scanDirectory(dir: string, prefix: string = ""): void {
			const items = fs.readdirSync(dir);

			for (const item of items) {
				const itemPath = join(dir, item);
				const stat = fs.statSync(itemPath);

				if (stat.isDirectory()) {
					const currentPath = prefix ? `${prefix}/${item}` : item;
					scanDirectory(itemPath, currentPath);
				} else if (item === ".env" && prefix) {
					packages.push(prefix);
				}
			}
		}

		scanDirectory(ENV_BASE_DIR);
	} catch (error) {
		// Directory doesn't exist or can't be read
	}

	return packages.sort();
}

/**
 * Set an environment variable for a package
 */
async function setEnvVar(
	packageName: string,
	name: string,
	value: string,
): Promise<void> {
	const vars = await readEnvVars(packageName);
	vars[name] = value;
	await writeEnvVars(packageName, vars);

	console.error(
		pc.green(
			`✓ Set environment variable for ${pc.bold(packageName)}: ${pc.bold(name)}`,
		),
	);
}

/**
 * Get an environment variable for a package
 */
async function getEnvVar(
	packageName: string,
	name: string,
	showValue: boolean = false,
): Promise<void> {
	const vars = await readEnvVars(packageName);
	const value = vars[name];

	if (value === undefined) {
		console.error(
			pc.red(
				`✗ Environment variable ${pc.bold(name)} not found for package ${pc.bold(packageName)}`,
			),
		);
		return;
	}

	const displayValue = showValue ? value : "[hidden]";

	console.error(
		pc.cyan(`Environment variable: ${pc.bold(name)} (${packageName})`),
	);
	console.error(`  Value: ${displayValue}`);
}

/**
 * List all environment variables for a package
 */
async function listEnvVars(
	packageName: string,
	format: string = "table",
	showValues: boolean = false,
): Promise<void> {
	const vars = await readEnvVars(packageName);
	const entries = Object.entries(vars);

	if (entries.length === 0) {
		console.error(
			pc.yellow(
				`No environment variables found for package ${pc.bold(packageName)}`,
			),
		);
		return;
	}

	console.error(pc.cyan(`Environment variables for ${pc.bold(packageName)}:`));

	if (format === "json") {
		const output = entries.reduce(
			(acc, [name, value]) => {
				acc[name] = showValues ? value : "[hidden]";
				return acc;
			},
			{} as Record<string, string>,
		);

		console.error(JSON.stringify(output, null, 2));
	} else {
		entries.forEach(([name, value]) => {
			const displayValue = showValues ? value : "[hidden]";
			console.error(`\n  ${pc.bold(name)}`);
			console.error(`    Value: ${displayValue}`);
		});
	}
}

/**
 * Delete an environment variable for a package
 */
async function deleteEnvVar(packageName: string, name: string): Promise<void> {
	const vars = await readEnvVars(packageName);

	if (vars[name] === undefined) {
		console.error(
			pc.red(
				`✗ Environment variable ${pc.bold(name)} not found for package ${pc.bold(packageName)}`,
			),
		);
		return;
	}

	delete vars[name];
	await writeEnvVars(packageName, vars);

	console.error(
		pc.green(
			`✓ Deleted environment variable for ${pc.bold(packageName)}: ${pc.bold(name)}`,
		),
	);
}

/**
 * Export environment variables for a package
 */
async function exportEnvVars(
	packageName: string,
	format: "env" | "json" | "yaml" = "env",
): Promise<void> {
	const vars = await readEnvVars(packageName);
	const entries = Object.entries(vars);

	if (entries.length === 0) {
		console.error(
			pc.yellow(
				`No environment variables to export for package ${packageName}`,
			),
		);
		return;
	}

	switch (format) {
		case "env":
			entries.forEach(([name, value]) => {
				const needsQuotes = /[\s#"'\\]/.test(value);
				const quotedValue = needsQuotes
					? `"${value.replace(/"/g, '\\"')}"`
					: value;
				console.log(`${name}=${quotedValue}`);
			});
			break;

		case "json":
			console.log(JSON.stringify(vars, null, 2));
			break;

		case "yaml":
			entries.forEach(([name, value]) => {
				console.log(`${name}: "${value}"`);
			});
			break;
	}
}

/**
 * Main environment command handler
 */
export async function handleEnvCommand(
	args: string[],
	options: EnvOptions,
): Promise<void> {
	if (options.help || !args[0]) {
		console.error(`
${pc.bold("Usage:")} enact env <subcommand> [options]

${pc.bold("Environment variable management for Enact CLI with package namespaces.")}

${pc.bold("Subcommands:")}
  set <package> <name> [value]    Set an environment variable for a package
  get <package> <name>            Get an environment variable for a package
  list [package]                  List environment variables for a package
  delete <package> <name>         Delete an environment variable for a package
  packages                        List all available package namespaces
  export <package> [format]       Export variables (env|json|yaml)
  clear <package>                 Clear all environment variables for a package

${pc.bold("Options:")}
  --help, -h              Show this help message
  --package <name>        Package namespace (org/package format)
  --format <fmt>          Output format (table|json)
  --show                  Show actual values (default: hidden)

${pc.bold("Package Namespace Format:")}
  Package names follow the format: org/package/tool
  Environment variables are shared at the org/package level
  Examples: acme-corp/discord/bot-maker → stored under acme-corp/discord/

${pc.bold("Examples:")}
  enact env set acme-corp/discord API_KEY sk-123...
  enact env get acme-corp/discord API_KEY --show
  enact env list acme-corp/discord --format json
  enact env packages
  enact env export acme-corp/discord env > .env
`);
		return;
	}

	const subCommand = args[0];

	try {
		switch (subCommand) {
			case "set": {
				const packageName = args[1];
				const name = args[2];
				let value = args[3];

				if (!packageName) {
					console.error(
						pc.red("✗ Package name is required (format: org/package/tool)"),
					);
					return;
				}

				if (!name) {
					console.error(pc.red("✗ Variable name is required"));
					return;
				}

				if (!value) {
					// Prompt for value
					const promptValue = await text({
						message: `Enter value for ${name}:`,
					});

					if (!promptValue || typeof promptValue === "symbol") {
						console.error(pc.yellow("Operation cancelled"));
						return;
					}
					value = promptValue;
				}

				await setEnvVar(packageName, name, value);
				break;
			}

			case "get": {
				const packageName = args[1];
				const name = args[2];

				if (!packageName) {
					console.error(
						pc.red("✗ Package name is required (format: org/package)"),
					);
					return;
				}

				if (!name) {
					console.error(pc.red("✗ Variable name is required"));
					return;
				}

				await getEnvVar(packageName, name, options.show);
				break;
			}

			case "list": {
				const packageName = args[1];

				if (!packageName) {
					const packages = await listPackageNamespaces();
					if (packages.length === 0) {
						console.error(
							pc.yellow(
								'No package namespaces found. Use "enact env set <package> <name> <value>" to create variables.',
							),
						);
						return;
					}

					console.error(pc.cyan("Available package namespaces:"));
					packages.forEach((pkg) => console.error(`  ${pkg}`));
					console.error(
						pc.dim(
							'\nUse "enact env list <package>" to see variables for a specific package.',
						),
					);
					return;
				}

				await listEnvVars(packageName, options.format || "table", options.show);
				break;
			}

			case "delete": {
				const packageName = args[1];
				const name = args[2];

				if (!packageName) {
					console.error(
						pc.red("✗ Package name is required (format: org/package)"),
					);
					return;
				}

				if (!name) {
					console.error(pc.red("✗ Variable name is required"));
					return;
				}

				const confirmed = await confirm({
					message: `Delete environment variable ${pc.bold(name)} from ${pc.bold(packageName)}?`,
					initialValue: false,
				});

				if (typeof confirmed === "symbol" || !confirmed) {
					console.error(pc.yellow("Operation cancelled"));
					return;
				}

				await deleteEnvVar(packageName, name);
				break;
			}

			case "packages": {
				const packages = await listPackageNamespaces();
				if (packages.length === 0) {
					console.error(pc.yellow("No package namespaces found."));
					return;
				}

				console.error(pc.cyan("Available package namespaces:"));
				packages.forEach((pkg) => console.error(`  ${pkg}`));
				break;
			}

			case "export": {
				const packageName = args[1];
				const format = (args[2] as "env" | "json" | "yaml") || "env";

				if (!packageName) {
					console.error(
						pc.red("✗ Package name is required (format: org/package)"),
					);
					return;
				}

				if (!["env", "json", "yaml"].includes(format)) {
					console.error(pc.red("✗ Supported formats: env, json, yaml"));
					return;
				}

				await exportEnvVars(packageName, format);
				break;
			}

			case "clear": {
				const packageName = args[1];

				if (!packageName) {
					console.error(
						pc.red("✗ Package name is required (format: org/package)"),
					);
					return;
				}

				const confirmed = await confirm({
					message: `Clear all environment variables for ${pc.bold(packageName)}?`,
					initialValue: false,
				});

				if (typeof confirmed === "symbol" || !confirmed) {
					console.error(pc.yellow("Operation cancelled"));
					return;
				}

				await writeEnvVars(packageName, {});
				console.error(
					pc.green(
						`✓ Cleared all environment variables for ${pc.bold(packageName)}`,
					),
				);
				break;
			}

			default:
				console.error(pc.red(`✗ Unknown subcommand: ${subCommand}`));
				console.error('Run "enact env --help" for usage information');
		}
	} catch (error) {
		console.error(pc.red(`Error: ${(error as Error).message}`));
		process.exit(1);
	}
}

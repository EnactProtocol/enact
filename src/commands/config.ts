// src/commands/config.ts - Configuration management for Enact CLI
import * as p from "@clack/prompts";
import pc from "picocolors";
import fs from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import os from "os";

interface EnactConfig {
	executionProvider: "direct" | "dagger";
	daggerOptions?: {
		baseImage?: string;
		enableNetwork?: boolean;
		enableHostFS?: boolean;
		maxMemory?: string;
		maxCPU?: string;
	};
	apiUrl?: string;
	supabaseUrl?: string;
	defaultTimeout?: string;
	verificationPolicy?: "permissive" | "enterprise" | "paranoid";
}

interface ConfigOptions {
	help?: boolean;
	set?: string;
	get?: string;
	list?: boolean;
	reset?: boolean;
	global?: boolean;
}

const CONFIG_FILE_NAME = ".enact-config.json";

/**
 * Get the configuration file path
 */
function getConfigPath(global: boolean = false): string {
	if (global) {
		return path.join(os.homedir(), CONFIG_FILE_NAME);
	} else {
		return path.join(process.cwd(), CONFIG_FILE_NAME);
	}
}

/**
 * Load configuration from file
 */
async function loadConfig(global: boolean = false): Promise<EnactConfig> {
	const configPath = getConfigPath(global);

	if (!existsSync(configPath)) {
		return {
			executionProvider: "direct",
			defaultTimeout: "30s",
			verificationPolicy: "permissive",
		};
	}

	try {
		const content = await fs.readFile(configPath, "utf8");
		const config = JSON.parse(content);

		// Ensure defaults
		return {
			executionProvider: "direct",
			defaultTimeout: "30s",
			verificationPolicy: "permissive",
			...config,
		};
	} catch (error) {
		console.error(pc.red(`Error reading config file: ${error}`));
		return {
			executionProvider: "direct",
			defaultTimeout: "30s",
			verificationPolicy: "permissive",
		};
	}
}

/**
 * Save configuration to file
 */
async function saveConfig(
	config: EnactConfig,
	global: boolean = false,
): Promise<void> {
	const configPath = getConfigPath(global);

	try {
		await fs.writeFile(configPath, JSON.stringify(config, null, 2));
		console.log(pc.green(`✅ Configuration saved to ${configPath}`));
	} catch (error) {
		console.error(pc.red(`Error saving config file: ${error}`));
		process.exit(1);
	}
}

/**
 * Set a configuration value
 */
async function setConfigValue(
	key: string,
	value: string,
	global: boolean = false,
): Promise<void> {
	const config = await loadConfig(global);

	// Parse nested keys (e.g., "daggerOptions.baseImage")
	const keyParts = key.split(".");
	let current: any = config;

	// Navigate to the parent object
	for (let i = 0; i < keyParts.length - 1; i++) {
		const part = keyParts[i];
		if (!current[part]) {
			current[part] = {};
		}
		current = current[part];
	}

	// Set the final value
	const finalKey = keyParts[keyParts.length - 1];

	// Type conversion based on key
	if (finalKey === "enableNetwork" || finalKey === "enableHostFS") {
		current[finalKey] = value.toLowerCase() === "true";
	} else {
		current[finalKey] = value;
	}

	await saveConfig(config, global);
}

/**
 * Get a configuration value
 */
async function getConfigValue(
	key: string,
	global: boolean = false,
): Promise<void> {
	const config = await loadConfig(global);

	if (key) {
		// Get specific value
		const keyParts = key.split(".");
		let current: any = config;

		for (const part of keyParts) {
			if (current && typeof current === "object" && part in current) {
				current = current[part];
			} else {
				console.log(pc.yellow(`Configuration key '${key}' not found`));
				return;
			}
		}

		console.log(pc.cyan(`${key}: `), current);
	}
}

/**
 * List all configuration
 */
async function listConfig(global: boolean = false): Promise<void> {
	const config = await loadConfig(global);
	const configPath = getConfigPath(global);

	console.log(pc.cyan(`\n📋 Configuration from ${configPath}:\n`));
	console.log(JSON.stringify(config, null, 2));
}

/**
 * Reset configuration to defaults
 */
async function resetConfig(global: boolean = false): Promise<void> {
	const defaultConfig: EnactConfig = {
		executionProvider: "direct",
		defaultTimeout: "30s",
		verificationPolicy: "permissive",
	};

	await saveConfig(defaultConfig, global);
}

/**
 * Interactive configuration setup
 */
async function interactiveConfig(global: boolean = false): Promise<void> {
	const currentConfig = await loadConfig(global);

	console.log(pc.cyan("\n🔧 Interactive Configuration Setup\n"));

	const executionProvider = await p.select({
		message: "Select execution provider:",
		options: [
			{ value: "direct", label: "Direct (run commands directly on host)" },
			{ value: "dagger", label: "Dagger (containerized execution)" },
		],
		initialValue: currentConfig.executionProvider,
	});

	let daggerOptions = currentConfig.daggerOptions;

	if (executionProvider === "dagger") {
		console.log(pc.yellow("\n🐳 Dagger Configuration:"));

		const baseImage = await p.text({
			message: "Base container image:",
			placeholder: "node:20-slim",
			defaultValue: currentConfig.daggerOptions?.baseImage || "node:20-slim",
		});

		const enableNetwork = await p.confirm({
			message: "Enable network access in containers?",
			initialValue: currentConfig.daggerOptions?.enableNetwork ?? true,
		});

		const enableHostFS = await p.confirm({
			message: "Enable host filesystem access?",
			initialValue: currentConfig.daggerOptions?.enableHostFS ?? false,
		});

		const maxMemory = await p.text({
			message: "Maximum memory (e.g., 512Mi, 2Gi):",
			placeholder: "1Gi",
			defaultValue: currentConfig.daggerOptions?.maxMemory || "",
		});

		daggerOptions = {
			baseImage: baseImage as string,
			enableNetwork: enableNetwork as boolean,
			enableHostFS: enableHostFS as boolean,
			maxMemory: (maxMemory as string) || undefined,
		};
	}

	const verificationPolicy = await p.select({
		message: "Default verification policy:",
		options: [
			{
				value: "permissive",
				label: "Permissive (allow unsigned tools with warning)",
			},
			{ value: "enterprise", label: "Enterprise (require valid signatures)" },
			{ value: "paranoid", label: "Paranoid (require multiple signatures)" },
		],
		initialValue: currentConfig.verificationPolicy,
	});

	const defaultTimeout = await p.text({
		message: "Default execution timeout:",
		placeholder: "30s",
		defaultValue: currentConfig.defaultTimeout || "30s",
	});

	const newConfig: EnactConfig = {
		executionProvider: executionProvider as "direct" | "dagger",
		verificationPolicy: verificationPolicy as
			| "permissive"
			| "enterprise"
			| "paranoid",
		defaultTimeout: defaultTimeout as string,
	};

	if (daggerOptions) {
		newConfig.daggerOptions = daggerOptions;
	}

	await saveConfig(newConfig, global);

	if (executionProvider === "dagger") {
		console.log(
			pc.yellow("\n⚠️  Note: Make sure you have Dagger installed and running:"),
		);
		console.log(
			pc.gray("   curl -L https://dl.dagger.io/dagger/install.sh | sh"),
		);
		console.log(pc.gray("   Or visit: https://docs.dagger.io/install"));
	}
}

/**
 * Show configuration help
 */
function showConfigHelp(): void {
	console.log(pc.cyan("\n🔧 Enact Configuration\n"));
	console.log("Usage: enact config [options] [command]\n");
	console.log("Commands:");
	console.log("  setup               Interactive configuration setup");
	console.log("  list                Show all configuration");
	console.log("  get <key>           Get specific configuration value");
	console.log("  set <key> <value>   Set configuration value");
	console.log("  reset               Reset to default configuration");
	console.log("\nOptions:");
	console.log(
		"  --global            Use global configuration (~/.enact-config.json)",
	);
	console.log("  --help              Show this help\n");
	console.log("Configuration Keys:");
	console.log("  executionProvider              direct | dagger");
	console.log(
		"  verificationPolicy             permissive | enterprise | paranoid",
	);
	console.log("  defaultTimeout                 30s | 5m | 1h");
	console.log("  daggerOptions.baseImage        node:20-slim");
	console.log("  daggerOptions.enableNetwork    true | false");
	console.log("  daggerOptions.enableHostFS     true | false");
	console.log("  daggerOptions.maxMemory        1Gi | 2Gi | 512Mi");
	console.log("\nExamples:");
	console.log("  enact config setup");
	console.log("  enact config set executionProvider dagger");
	console.log("  enact config set daggerOptions.baseImage ubuntu:22.04");
	console.log("  enact config get executionProvider");
	console.log("  enact config list --global");
}

/**
 * Handle config command
 */
export async function handleConfigCommand(
	args: string[],
	options: ConfigOptions,
): Promise<void> {
	if (options.help) {
		showConfigHelp();
		return;
	}

	const subcommand = args[0];
	const global = options.global || false;

	switch (subcommand) {
		case "setup":
			await interactiveConfig(global);
			break;

		case "list":
			await listConfig(global);
			break;

		case "get":
			if (!args[1]) {
				console.error(pc.red("Error: Missing configuration key"));
				console.log("Usage: enact config get <key>");
				process.exit(1);
			}
			await getConfigValue(args[1], global);
			break;

		case "set":
			if (!args[1] || !args[2]) {
				console.error(pc.red("Error: Missing configuration key or value"));
				console.log("Usage: enact config set <key> <value>");
				process.exit(1);
			}
			await setConfigValue(args[1], args[2], global);
			break;

		case "reset":
			await resetConfig(global);
			break;

		default:
			if (!subcommand) {
				await interactiveConfig(global);
			} else {
				console.error(pc.red(`Unknown config command: ${subcommand}`));
				showConfigHelp();
				process.exit(1);
			}
	}
}

/**
 * Load and return current configuration
 */
export async function getCurrentConfig(
	global: boolean = false,
): Promise<EnactConfig> {
	return loadConfig(global);
}

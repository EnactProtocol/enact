// src/commands/config.ts - Configuration management for Enact CLI
import * as p from "@clack/prompts";
import pc from "picocolors";
import fs from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import os from "os";
import { 
	getFrontendUrl, 
	getApiUrl, 
	setFrontendUrl, 
	setApiUrl, 
	resetUrls, 
	getUrlConfig,
	getTrustedKeys,
	addTrustedKey,
	removeTrustedKey,
	getTrustedKey
} from "@enactprotocol/shared/utils";

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
			executionProvider: "dagger", // Default to Dagger for tool execution security
			defaultTimeout: "30s",
			verificationPolicy: "permissive",
		};
	}

	try {
		const content = await fs.readFile(configPath, "utf8");
		const config = JSON.parse(content);

		// Ensure defaults
		return {
			executionProvider: "dagger",
			defaultTimeout: "30s",
			verificationPolicy: "permissive",
			...config,
		};
	} catch (error) {
		console.error(pc.red(`Error reading config file: ${error}`));
		return {
			executionProvider: "dagger",
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
		executionProvider: "dagger",
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
			{ value: "dagger", label: "Dagger (containerized execution)" },
			{ value: "direct", label: "Direct (run commands directly on host)" },
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
	console.log("  urls                Show current URL configuration");
	console.log("  set-frontend-url    Set frontend URL (for OAuth, registry)");
	console.log("  set-api-url         Set API URL (for backend calls)");
	console.log("  reset-urls          Reset URLs to defaults");
	console.log("  keys                Show trusted public keys");
	console.log("  add-key             Add a trusted public key");
	console.log("  remove-key <id>     Remove a trusted public key");
	console.log("\nOptions:");
	console.log(
		"  --global            Use global configuration (~/.enact-config.json)",
	);
	console.log("  --help              Show this help\n");
	console.log("Configuration Keys:");
	console.log("  executionProvider              dagger | direct");
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
	console.log("  enact config urls");
	console.log("  enact config set-frontend-url https://my-instance.example.com");
	console.log("  enact config set-api-url https://api.example.com");
	console.log("  enact config keys");
	console.log("  enact config add-key");
	console.log("  enact config remove-key my-org-key");
}

/**
 * Show URL configuration
 */
async function showUrls(): Promise<void> {
	const urlConfig = await getUrlConfig();
	
	console.log(pc.cyan("\n🌐 URL Configuration:\n"));
	console.log(pc.white("Frontend URL:"));
	console.log(`  ${pc.green(urlConfig.frontend.value)} ${pc.gray(`(${urlConfig.frontend.source})`)}`);
	console.log(pc.white("API URL:"));
	console.log(`  ${pc.green(urlConfig.api.value)} ${pc.gray(`(${urlConfig.api.source})`)}`);
	
	console.log(pc.gray("\nSources: default < config < environment"));
}

/**
 * Set URL configuration
 */
async function setUrl(type: 'frontend' | 'api', url: string): Promise<void> {
	try {
		if (type === 'frontend') {
			await setFrontendUrl(url);
			console.log(pc.green(`✅ Frontend URL set to: ${url}`));
		} else {
			await setApiUrl(url);
			console.log(pc.green(`✅ API URL set to: ${url}`));
		}
		console.log(pc.gray("Use 'enact config urls' to view current configuration"));
	} catch (error) {
		console.error(pc.red(`Error setting ${type} URL: ${error}`));
		process.exit(1);
	}
}

/**
 * Reset URLs to defaults
 */
async function resetUrlsConfig(): Promise<void> {
	try {
		await resetUrls();
		console.log(pc.green("✅ URLs reset to defaults"));
		await showUrls();
	} catch (error) {
		console.error(pc.red(`Error resetting URLs: ${error}`));
		process.exit(1);
	}
}

/**
 * Show trusted keys
 */
async function showTrustedKeys(): Promise<void> {
	try {
		const keys = await getTrustedKeys();
		
		console.log(pc.cyan("\n🔐 Trusted Keys:\n"));
		
		if (keys.length === 0) {
			console.log(pc.gray("No trusted keys found"));
			return;
		}
		
		for (const key of keys) {
			const sourceColor = key.source === 'default' ? pc.blue : 
							   key.source === 'organization' ? pc.yellow : pc.green;
			
			console.log(pc.white(`${key.name} (${key.id})`));
			console.log(`  ${sourceColor(`[${key.source}]`)} ${pc.gray(`Added: ${new Date(key.addedAt).toLocaleDateString()}`)}`);
			if (key.description) {
				console.log(`  ${pc.gray(key.description)}`);
			}
			console.log(`  ${pc.gray(`Key: ${key.publicKey.substring(0, 50)}...`)}`);
			console.log();
		}
	} catch (error) {
		console.error(pc.red(`Error reading trusted keys: ${error}`));
		process.exit(1);
	}
}

/**
 * Add a trusted key
 */
async function addTrustedKeyInteractive(): Promise<void> {
	try {
		console.log(pc.cyan("\n🔐 Add Trusted Key\n"));
		
		const id = await p.text({
			message: "Key ID (unique identifier):",
			placeholder: "my-org-key",
			validate: (value) => {
				if (!value) return "ID is required";
				if (!/^[a-zA-Z0-9-_]+$/.test(value)) return "ID must contain only letters, numbers, hyphens, and underscores";
			}
		});
		
		const name = await p.text({
			message: "Key name (display name):",
			placeholder: "My Organization Key",
			validate: (value) => value ? undefined : "Name is required"
		});
		
		const description = await p.text({
			message: "Description (optional):",
			placeholder: "Key for verifying my organization's tools"
		});
		
		const publicKey = await p.text({
			message: "Public key (PEM format):",
			placeholder: "-----BEGIN PUBLIC KEY-----\\n...\\n-----END PUBLIC KEY-----",
			validate: (value) => {
				if (!value) return "Public key is required";
				if (!value.includes("BEGIN PUBLIC KEY")) return "Invalid PEM format";
			}
		});
		
		const source = await p.select({
			message: "Key source:",
			options: [
				{ value: "user", label: "Personal key" },
				{ value: "organization", label: "Organization key" }
			]
		}) as "user" | "organization";
		
		const keyData = {
			id: id as string,
			name: name as string,
			publicKey: (publicKey as string).replace(/\\n/g, '\n'),
			description: description as string || undefined,
			source,
		};
		
		await addTrustedKey(keyData);
		console.log(pc.green(`✅ Trusted key '${keyData.name}' added successfully`));
		
	} catch (error) {
		console.error(pc.red(`Error adding trusted key: ${error}`));
		process.exit(1);
	}
}

/**
 * Remove a trusted key
 */
async function removeTrustedKeyById(keyId: string): Promise<void> {
	try {
		const key = await getTrustedKey(keyId);
		if (!key) {
			console.error(pc.red(`Trusted key '${keyId}' not found`));
			process.exit(1);
		}
		
		// Show warning for default Enact key but allow removal
		let confirmMessage = `Remove trusted key '${key.name}' (${keyId})?`;
		if (keyId === "enact-protocol-official") {
			confirmMessage = `${pc.yellow("⚠️  Warning:")} You are about to remove the default Enact Protocol key. This may prevent verification of official tools.\n\nRemove trusted key '${key.name}' (${keyId})?`;
		}
		
		const confirm = await p.confirm({
			message: confirmMessage,
		});
		
		if (!confirm) {
			console.log(pc.yellow("Operation cancelled"));
			return;
		}
		
		await removeTrustedKey(keyId);
		console.log(pc.green(`✅ Trusted key '${key.name}' removed successfully`));
		
		if (keyId === "enact-protocol-official") {
			console.log(pc.yellow("💡 You can re-add the Enact Protocol key anytime with 'enact config add-key'"));
		}
		
	} catch (error) {
		console.error(pc.red(`Error removing trusted key: ${error}`));
		process.exit(1);
	}
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

		case "urls":
			await showUrls();
			break;

		case "set-frontend-url":
			if (!args[1]) {
				console.error(pc.red("Error: Missing URL"));
				console.log("Usage: enact config set-frontend-url <url>");
				process.exit(1);
			}
			await setUrl('frontend', args[1]);
			break;

		case "set-api-url":
			if (!args[1]) {
				console.error(pc.red("Error: Missing URL"));
				console.log("Usage: enact config set-api-url <url>");
				process.exit(1);
			}
			await setUrl('api', args[1]);
			break;

		case "reset-urls":
			await resetUrlsConfig();
			break;

		case "keys":
			await showTrustedKeys();
			break;

		case "add-key":
			await addTrustedKeyInteractive();
			break;

		case "remove-key":
			if (!args[1]) {
				console.error(pc.red("Error: Missing key ID"));
				console.log("Usage: enact config remove-key <key-id>");
				process.exit(1);
			}
			await removeTrustedKeyById(args[1]);
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

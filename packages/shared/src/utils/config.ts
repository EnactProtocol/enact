// src/utils/config.ts
import { homedir } from "os";
import { join } from "path";
import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";

// Define config paths
const CONFIG_DIR = join(homedir(), ".enact");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

// Define config interface
export interface EnactConfig {
	defaultUrl?: string;
	history?: string[];
}

/**
 * Ensure config directory and file exist
 */
export async function ensureConfig(): Promise<void> {
	if (!existsSync(CONFIG_DIR)) {
		await mkdir(CONFIG_DIR, { recursive: true });
	}

	if (!existsSync(CONFIG_FILE)) {
		await writeFile(CONFIG_FILE, JSON.stringify({ history: [] }, null, 2));
	}
}

/**
 * Read the config file
 */
export async function readConfig(): Promise<EnactConfig> {
	await ensureConfig();

	try {
		const data = await readFile(CONFIG_FILE, "utf8");
		return JSON.parse(data) as EnactConfig;
	} catch (error) {
		console.error("Failed to read config:", (error as Error).message);
		return { history: [] };
	}
}

/**
 * Write to the config file
 */
export async function writeConfig(config: EnactConfig): Promise<void> {
	await ensureConfig();
	await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
}

/**
 * Add a file to the publish history
 */
export async function addToHistory(filePath: string): Promise<void> {
	const config = await readConfig();

	if (!config.history) {
		config.history = [];
	}

	// Add to history if not already there
	if (!config.history.includes(filePath)) {
		config.history.unshift(filePath);

		// Keep history to a reasonable size
		config.history = config.history.slice(0, 10);

		await writeConfig(config);
	}
}

/**
 * Get the publish history
 */
export async function getHistory(): Promise<string[]> {
	const config = await readConfig();
	return config.history || [];
}

/**
 * Set the default publish URL
 */
export async function setDefaultUrl(url: string): Promise<void> {
	const config = await readConfig();
	config.defaultUrl = url;
	await writeConfig(config);
}

/**
 * Get the default publish URL
 */
export async function getDefaultUrl(): Promise<string | undefined> {
	const config = await readConfig();
	return config.defaultUrl;
}

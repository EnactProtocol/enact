// src/utils/config.ts
import { homedir } from "os";
import { join } from "path";
import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";

// Define config paths
const CONFIG_DIR = join(homedir(), ".enact");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");
const TRUSTED_KEYS_DIR = join(CONFIG_DIR, "trusted-keys");

// Define config interface
export interface EnactConfig {
	defaultUrl?: string;
	history?: string[];
	urls?: {
		frontend?: string;
		api?: string;
	};
}

/**
 * Ensure config directory and file exist
 */
export async function ensureConfig(): Promise<void> {
	if (!existsSync(CONFIG_DIR)) {
		await mkdir(CONFIG_DIR, { recursive: true });
	}

	if (!existsSync(CONFIG_FILE)) {
		const defaultConfig = {
			history: [],
			urls: {
				frontend: DEFAULT_FRONTEND_URL,
				api: DEFAULT_API_URL,
			},
		};
		await writeFile(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
	}
}

/**
 * Read the config file
 */
export async function readConfig(): Promise<EnactConfig> {
	await ensureConfig();

	try {
		const data = await readFile(CONFIG_FILE, "utf8");
		const config = JSON.parse(data) as EnactConfig;
		
		// Migrate old configs that don't have URLs section
		if (!config.urls) {
			config.urls = {
				frontend: DEFAULT_FRONTEND_URL,
				api: DEFAULT_API_URL,
			};
			await writeConfig(config);
		}
		
		return config;
	} catch (error) {
		console.error("Failed to read config:", (error as Error).message);
		return { 
			history: [],
			urls: {
				frontend: DEFAULT_FRONTEND_URL,
				api: DEFAULT_API_URL,
			},
		};
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

// Default URLs
const DEFAULT_FRONTEND_URL = "https://enact.tools";
const DEFAULT_API_URL = "https://xjnhhxwxovjifdxdwzih.supabase.co";

// Default trusted public key (Enact Protocol official key)
const DEFAULT_ENACT_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE8VyE3jGm5yT2mKnPx1dQF7q8Z2Kv
7mX9YnE2mK8vF3tY9pL6xH2dF8sK3mN7wQ5vT2gR8sL4xN6pM9uE3wF2Qw==
-----END PUBLIC KEY-----`;

// Trusted key metadata interface (for .meta files)
export interface TrustedKeyMeta {
	name: string;
	description?: string;
	addedAt: string;
	source: "default" | "user" | "organization";
	keyFile: string;
}

// Combined trusted key interface
export interface TrustedKey {
	id: string;
	name: string;
	publicKey: string;
	description?: string;
	addedAt: string;
	source: "default" | "user" | "organization";
	keyFile: string;
}

/**
 * Get the frontend URL with fallbacks
 */
export async function getFrontendUrl(): Promise<string> {
	// 1. Environment variable override
	if (process.env.ENACT_FRONTEND_URL) {
		return process.env.ENACT_FRONTEND_URL;
	}
	
	// 2. Config file setting
	const config = await readConfig();
	if (config.urls?.frontend) {
		return config.urls.frontend;
	}
	
	// 3. Default
	return DEFAULT_FRONTEND_URL;
}

/**
 * Get the API URL with fallbacks
 */
export async function getApiUrl(): Promise<string> {
	// 1. Environment variable override
	if (process.env.ENACT_API_URL) {
		return process.env.ENACT_API_URL;
	}
	
	// 2. Config file setting
	const config = await readConfig();
	if (config.urls?.api) {
		return config.urls.api;
	}
	
	// 3. Default
	return DEFAULT_API_URL;
}

/**
 * Set the frontend URL in config
 */
export async function setFrontendUrl(url: string): Promise<void> {
	const config = await readConfig();
	if (!config.urls) {
		config.urls = {};
	}
	config.urls.frontend = url;
	await writeConfig(config);
}

/**
 * Set the API URL in config
 */
export async function setApiUrl(url: string): Promise<void> {
	const config = await readConfig();
	if (!config.urls) {
		config.urls = {};
	}
	config.urls.api = url;
	await writeConfig(config);
}

/**
 * Reset URLs to defaults
 */
export async function resetUrls(): Promise<void> {
	const config = await readConfig();
	if (config.urls) {
		delete config.urls.frontend;
		delete config.urls.api;
	}
	await writeConfig(config);
}

/**
 * Get current URL configuration
 */
export async function getUrlConfig(): Promise<{
	frontend: { value: string; source: string };
	api: { value: string; source: string };
}> {
	const config = await readConfig();
	
	// Determine frontend URL source
	let frontendValue = DEFAULT_FRONTEND_URL;
	let frontendSource = "default";
	
	if (config.urls?.frontend) {
		frontendValue = config.urls.frontend;
		frontendSource = "config";
	}
	
	if (process.env.ENACT_FRONTEND_URL) {
		frontendValue = process.env.ENACT_FRONTEND_URL;
		frontendSource = "environment";
	}
	
	// Determine API URL source
	let apiValue = DEFAULT_API_URL;
	let apiSource = "default";
	
	if (config.urls?.api) {
		apiValue = config.urls.api;
		apiSource = "config";
	}
	
	if (process.env.ENACT_API_URL) {
		apiValue = process.env.ENACT_API_URL;
		apiSource = "environment";
	}
	
	return {
		frontend: { value: frontendValue, source: frontendSource },
		api: { value: apiValue, source: apiSource },
	};
}

/**
 * Ensure trusted keys directory exists with default key
 */
async function ensureTrustedKeysDir(): Promise<void> {
	if (!existsSync(CONFIG_DIR)) {
		await mkdir(CONFIG_DIR, { recursive: true });
	}

	if (!existsSync(TRUSTED_KEYS_DIR)) {
		await mkdir(TRUSTED_KEYS_DIR, { recursive: true });
	}

	// Create default Enact Protocol key if it doesn't exist
	const defaultKeyFile = join(TRUSTED_KEYS_DIR, "enact-protocol-official.pem");
	const defaultMetaFile = join(TRUSTED_KEYS_DIR, "enact-protocol-official.meta");
	
	if (!existsSync(defaultKeyFile)) {
		await writeFile(defaultKeyFile, DEFAULT_ENACT_PUBLIC_KEY);
	}
	
	if (!existsSync(defaultMetaFile)) {
		const defaultMeta: TrustedKeyMeta = {
			name: "Enact Protocol Official",
			description: "Official Enact Protocol signing key for verified tools",
			addedAt: new Date().toISOString(),
			source: "default",
			keyFile: "enact-protocol-official.pem"
		};
		await writeFile(defaultMetaFile, JSON.stringify(defaultMeta, null, 2));
	}
}

/**
 * Read all trusted keys from directory
 */
export async function getTrustedKeys(): Promise<TrustedKey[]> {
	await ensureTrustedKeysDir();
	
	const keys: TrustedKey[] = [];
	
	try {
		const { readdir } = await import('fs/promises');
		const files = await readdir(TRUSTED_KEYS_DIR);
		
		// Get all .pem files
		const pemFiles = files.filter(f => f.endsWith('.pem'));
		
		for (const pemFile of pemFiles) {
			try {
				const keyId = pemFile.replace('.pem', '');
				const keyPath = join(TRUSTED_KEYS_DIR, pemFile);
				const metaPath = join(TRUSTED_KEYS_DIR, `${keyId}.meta`);
				
				// Read the public key
				const publicKey = await readFile(keyPath, 'utf8');
				
				// Read metadata if it exists
				let meta: TrustedKeyMeta = {
					name: keyId,
					addedAt: new Date().toISOString(),
					source: "user",
					keyFile: pemFile
				};
				
				if (existsSync(metaPath)) {
					try {
						const metaData = await readFile(metaPath, 'utf8');
						meta = { ...meta, ...JSON.parse(metaData) };
					} catch {
						// Use defaults if meta file is corrupted
					}
				}
				
				keys.push({
					id: keyId,
					name: meta.name,
					publicKey: publicKey.trim(),
					description: meta.description,
					addedAt: meta.addedAt,
					source: meta.source,
					keyFile: pemFile
				});
			} catch (error) {
				console.warn(`Warning: Could not read key file ${pemFile}:`, error);
			}
		}
	} catch (error) {
		console.error("Failed to read trusted keys directory:", error);
	}
	
	return keys;
}

/**
 * Add a trusted key
 */
export async function addTrustedKey(keyData: {
	id: string;
	name: string;
	publicKey: string;
	description?: string;
	source?: "user" | "organization";
}): Promise<void> {
	await ensureTrustedKeysDir();
	
	const keyFile = `${keyData.id}.pem`;
	const metaFile = `${keyData.id}.meta`;
	const keyPath = join(TRUSTED_KEYS_DIR, keyFile);
	const metaPath = join(TRUSTED_KEYS_DIR, metaFile);
	
	// Check if key already exists
	if (existsSync(keyPath)) {
		throw new Error(`Key with ID '${keyData.id}' already exists`);
	}
	
	// Write the public key file
	await writeFile(keyPath, keyData.publicKey);
	
	// Write the metadata file
	const meta: TrustedKeyMeta = {
		name: keyData.name,
		description: keyData.description,
		addedAt: new Date().toISOString(),
		source: keyData.source || "user",
		keyFile
	};
	await writeFile(metaPath, JSON.stringify(meta, null, 2));
}

/**
 * Remove a trusted key
 */
export async function removeTrustedKey(keyId: string): Promise<void> {
	const keyPath = join(TRUSTED_KEYS_DIR, `${keyId}.pem`);
	const metaPath = join(TRUSTED_KEYS_DIR, `${keyId}.meta`);
	
	if (!existsSync(keyPath)) {
		throw new Error(`Trusted key '${keyId}' not found`);
	}
	
	// Remove both files
	const { unlink } = await import('fs/promises');
	await unlink(keyPath);
	
	if (existsSync(metaPath)) {
		await unlink(metaPath);
	}
}

/**
 * Get a specific trusted key
 */
export async function getTrustedKey(keyId: string): Promise<TrustedKey | null> {
	const keys = await getTrustedKeys();
	return keys.find(k => k.id === keyId) || null;
}

/**
 * Check if a public key is trusted
 */
export async function isKeyTrusted(publicKey: string): Promise<boolean> {
	const keys = await getTrustedKeys();
	return keys.some(k => k.publicKey.trim() === publicKey.trim());
}

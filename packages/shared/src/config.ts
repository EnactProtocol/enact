/**
 * Configuration manager for Enact CLI
 * Handles reading and writing ~/.enact/config.yaml
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import yaml from "js-yaml";
import { getConfigPath, getEnactHome } from "./paths";

/**
 * Trust configuration for attestation verification
 *
 * Uses a unified model: all trust is based on cryptographic attestations.
 * Publishers who want their tools trusted should self-sign them.
 * Third-party reviewers can add additional attestations.
 */
export interface TrustConfig {
  /**
   * List of trusted auditor identities (provider:identity format, e.g., github:alice)
   * Anyone who signs with these identities is trusted - whether they authored
   * the tool (self-attestation) or reviewed it (third-party audit).
   */
  auditors?: string[];
  /** Trust policy: 'require_attestation' blocks without trust, 'prompt' asks user, 'allow' installs anyway */
  policy?: "require_attestation" | "prompt" | "allow";
  /** Minimum number of trusted attestations required */
  minimum_attestations?: number;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  /** Maximum cache size in megabytes */
  maxSizeMb?: number;
  /** Cache TTL in seconds */
  ttlSeconds?: number;
}

/**
 * Execution configuration
 */
export interface ExecutionConfig {
  /** Default timeout for tool execution (e.g., "30s", "5m") */
  defaultTimeout?: string;
  /** Whether to run in verbose mode */
  verbose?: boolean;
}

/**
 * Registry configuration
 */
export interface RegistryConfig {
  /** Default registry URL */
  url?: string;
  /** Authentication token for registry (stored reference, not actual token) */
  authTokenRef?: string;
  /** Direct authentication token (for local development) */
  authToken?: string;
}

/**
 * Complete Enact configuration
 */
export interface EnactConfig {
  /** Configuration file version */
  version?: string;
  /** Trust settings for verification */
  trust?: TrustConfig;
  /** Cache settings */
  cache?: CacheConfig;
  /** Execution defaults */
  execution?: ExecutionConfig;
  /** Registry settings */
  registry?: RegistryConfig;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: EnactConfig = {
  version: "1.0.0",
  trust: {
    auditors: [
      // Platform default trusted signers - can be removed by users
      "github:keith.groves@jointheleague.org",
    ],
    policy: "prompt",
    minimum_attestations: 1,
  },
  cache: {
    maxSizeMb: 1024, // 1GB
    ttlSeconds: 86400 * 7, // 7 days
  },
  execution: {
    defaultTimeout: "30s",
    verbose: false,
  },
  registry: {
    url: "https://siikwkfgsmouioodghho.supabase.co/functions/v1",
  },
};

/**
 * Platform-level default trusted signers.
 * These are included in DEFAULT_CONFIG but can be removed by users.
 */
export const PLATFORM_TRUSTED_SIGNERS: string[] = ["github:keith.groves@jointheleague.org"];

/**
 * Deep merge two objects, with source values overwriting target values
 */
function deepMerge(target: EnactConfig, source: Partial<EnactConfig>): EnactConfig {
  const result: EnactConfig = { ...target };

  // Merge trust config
  if (source.trust !== undefined) {
    result.trust = { ...target.trust, ...source.trust };
  }

  // Merge cache config
  if (source.cache !== undefined) {
    result.cache = { ...target.cache, ...source.cache };
  }

  // Merge execution config
  if (source.execution !== undefined) {
    result.execution = { ...target.execution, ...source.execution };
  }

  // Merge registry config
  if (source.registry !== undefined) {
    result.registry = { ...target.registry, ...source.registry };
  }

  // Copy top-level primitives
  if (source.version !== undefined) {
    result.version = source.version;
  }

  return result;
}

/**
 * Load configuration from ~/.enact/config.yaml
 * Returns default config if file doesn't exist or is invalid
 * @returns The loaded configuration merged with defaults
 */
export function loadConfig(): EnactConfig {
  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    return { ...DEFAULT_CONFIG };
  }

  try {
    const content = readFileSync(configPath, "utf-8");
    const parsed = yaml.load(content) as Partial<EnactConfig> | null;

    if (!parsed || typeof parsed !== "object") {
      return { ...DEFAULT_CONFIG };
    }

    // Merge with defaults to ensure all fields exist
    return deepMerge(DEFAULT_CONFIG, parsed);
  } catch {
    // Return defaults on any error (parse error, read error, etc.)
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Save configuration to ~/.enact/config.yaml
 * Creates the ~/.enact/ directory if it doesn't exist
 * @param config - The configuration to save
 */
export function saveConfig(config: EnactConfig): void {
  const configPath = getConfigPath();
  const enactHome = getEnactHome();

  // Ensure ~/.enact/ directory exists
  if (!existsSync(enactHome)) {
    mkdirSync(enactHome, { recursive: true });
  }

  // Ensure parent directory exists (should be ~/.enact/ but be safe)
  const parentDir = dirname(configPath);
  if (!existsSync(parentDir)) {
    mkdirSync(parentDir, { recursive: true });
  }

  const yamlContent = yaml.dump(config, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
  });

  writeFileSync(configPath, yamlContent, "utf-8");
}

/**
 * Get a configuration value by dot-notation key path
 * @param key - Dot-notation path (e.g., "trust.policy", "cache.maxSizeMb")
 * @param defaultValue - Default value if key doesn't exist
 * @returns The configuration value or default
 */
export function getConfigValue<T>(key: string, defaultValue: T): T {
  const config = loadConfig();
  const keys = key.split(".");

  let current: unknown = config;
  for (const k of keys) {
    if (current === null || current === undefined || typeof current !== "object") {
      return defaultValue;
    }
    current = (current as Record<string, unknown>)[k];
  }

  return current === undefined ? defaultValue : (current as T);
}

/**
 * Set a configuration value by dot-notation key path and persist
 * @param key - Dot-notation path (e.g., "trust.policy", "cache.maxSizeMb")
 * @param value - The value to set
 */
export function setConfigValue<T>(key: string, value: T): void {
  const config = loadConfig();
  const keys = key.split(".");
  const lastKey = keys.pop();

  if (!lastKey) {
    throw new Error("Invalid configuration key");
  }

  // Navigate to parent object, creating intermediate objects as needed
  let current: Record<string, unknown> = config as Record<string, unknown>;
  for (const k of keys) {
    if (current[k] === undefined || current[k] === null || typeof current[k] !== "object") {
      current[k] = {};
    }
    current = current[k] as Record<string, unknown>;
  }

  // Set the value
  current[lastKey] = value;

  // Persist
  saveConfig(config);
}

/**
 * Reset configuration to defaults
 * This will overwrite the existing config file
 */
export function resetConfig(): void {
  saveConfig({ ...DEFAULT_CONFIG });
}

/**
 * Check if a configuration file exists
 * @returns true if ~/.enact/config.yaml exists
 */
export function configExists(): boolean {
  return existsSync(getConfigPath());
}

/**
 * Ensure global setup is complete
 * Creates ~/.enact/ directory structure and default config if they don't exist.
 * This is a non-interactive initialization that runs silently.
 * @returns true if setup was performed, false if already initialized
 */
export function ensureGlobalSetup(): boolean {
  const enactHome = getEnactHome();
  const configPath = getConfigPath();
  const cacheDir = join(enactHome, "cache");

  let performedSetup = false;

  // Ensure ~/.enact/ directory exists
  if (!existsSync(enactHome)) {
    mkdirSync(enactHome, { recursive: true });
    performedSetup = true;
  }

  // Ensure ~/.enact/cache/ directory exists
  if (!existsSync(cacheDir)) {
    mkdirSync(cacheDir, { recursive: true });
    performedSetup = true;
  }

  // Create default config if it doesn't exist
  if (!existsSync(configPath)) {
    saveConfig({ ...DEFAULT_CONFIG });
    performedSetup = true;
  }

  return performedSetup;
}

// =============================================================================
// Local Trust Management
// =============================================================================

/**
 * Get list of trusted identities from local config
 * @returns Array of identities in provider:identity format
 */
export function getTrustedIdentities(): string[] {
  const config = loadConfig();
  return config.trust?.auditors ?? [];
}

/**
 * Add an identity to the local trusted list
 * @param identity - Identity in provider:identity format (e.g., github:alice)
 * @returns true if added, false if already exists
 */
export function addTrustedIdentity(identity: string): boolean {
  const config = loadConfig();
  const auditors = config.trust?.auditors ?? [];

  // Check if already exists
  if (auditors.includes(identity)) {
    return false;
  }

  // Add to list
  auditors.push(identity);

  // Update config
  if (!config.trust) {
    config.trust = { ...DEFAULT_CONFIG.trust };
  }
  config.trust.auditors = auditors;

  saveConfig(config);
  return true;
}

/**
 * Remove an identity from the local trusted list
 * @param identity - Identity in provider:identity format
 * @returns true if removed, false if not found
 */
export function removeTrustedIdentity(identity: string): boolean {
  const config = loadConfig();
  const auditors = config.trust?.auditors ?? [];

  const index = auditors.indexOf(identity);
  if (index === -1) {
    return false;
  }

  // Remove from list
  auditors.splice(index, 1);

  // Update config
  if (!config.trust) {
    config.trust = { ...DEFAULT_CONFIG.trust };
  }
  config.trust.auditors = auditors;

  saveConfig(config);
  return true;
}

/**
 * Check if an identity is in the local trusted list
 * Supports wildcards like github:my-org/* and *@company.com
 * @param identity - Identity to check
 * @returns true if trusted
 */
export function isIdentityTrusted(identity: string): boolean {
  const trustedIdentities = getTrustedIdentities();

  // Check exact match first
  if (trustedIdentities.includes(identity)) {
    return true;
  }

  // Check wildcard matches (e.g., github:my-org/* matches github:my-org/alice)
  for (const trusted of trustedIdentities) {
    if (trusted.endsWith("/*")) {
      const prefix = trusted.slice(0, -2); // Remove /*
      if (identity.startsWith(`${prefix}/`)) {
        return true;
      }
    }

    // Check email wildcards (e.g., *@company.com)
    if (trusted.includes("*@")) {
      const domainPart = trusted.split("*@")[1];
      if (identity.endsWith(`@${domainPart}`)) {
        return true;
      }
    }
  }

  return false;
}

// Legacy aliases for backward compatibility
/** @deprecated Use getTrustedIdentities instead */
export const getTrustedAuditors = getTrustedIdentities;
/** @deprecated Use addTrustedIdentity instead */
export const addTrustedAuditor = addTrustedIdentity;
/** @deprecated Use removeTrustedIdentity instead */
export const removeTrustedAuditor = removeTrustedIdentity;
/** @deprecated Use isIdentityTrusted instead */
export const isAuditorTrusted = isIdentityTrusted;

/**
 * Convert OIDC identity to provider:identity format
 * @param email - Email from Sigstore certificate
 * @param issuer - OIDC issuer URL (optional, improves accuracy)
 * @param username - Provider username if known (optional)
 * @returns Identity in provider:identity format (e.g., github:keithagroves)
 */
export function emailToProviderIdentity(email: string, issuer?: string, username?: string): string {
  // If we have a username and can determine the provider, use that
  if (username && issuer) {
    const provider = issuerToProvider(issuer);
    if (provider) {
      return `${provider}:${username}`;
    }
  }

  // Determine provider from issuer URL if available
  if (issuer) {
    const provider = issuerToProvider(issuer);
    if (provider) {
      // Try to extract username from email for GitHub
      if (provider === "github" && email.endsWith("@users.noreply.github.com")) {
        // GitHub noreply format: "123456+username@users.noreply.github.com"
        // or just "username@users.noreply.github.com"
        const localPart = email.replace("@users.noreply.github.com", "");
        const plusIndex = localPart.indexOf("+");
        const extractedUsername = plusIndex >= 0 ? localPart.slice(plusIndex + 1) : localPart;
        return `github:${extractedUsername}`;
      }
      // Use email as the identity since we don't have username
      return `${provider}:${email}`;
    }
  }

  // Common OIDC providers and their email domains (fallback)
  const providerMap: Record<string, string> = {
    "@users.noreply.github.com": "github",
    "@github.com": "github",
    "@gmail.com": "google",
    "@googlemail.com": "google",
    "@outlook.com": "microsoft",
    "@hotmail.com": "microsoft",
    "@live.com": "microsoft",
  };

  // Try to match provider by email domain
  for (const [domain, provider] of Object.entries(providerMap)) {
    if (email.endsWith(domain)) {
      let extractedUsername = email.substring(0, email.length - domain.length);
      // Handle GitHub noreply format: "123456+username@users.noreply.github.com"
      if (provider === "github" && domain === "@users.noreply.github.com") {
        const plusIndex = extractedUsername.indexOf("+");
        if (plusIndex >= 0) {
          extractedUsername = extractedUsername.slice(plusIndex + 1);
        }
      }
      return `${provider}:${extractedUsername}`;
    }
  }

  // If no match, check for GitHub workflow identity
  // Format: https://github.com/{org}/{workflow}
  if (email.startsWith("https://github.com/")) {
    const path = email.replace("https://github.com/", "");
    return `github:${path}`;
  }

  // Fall back to email as-is
  return email;
}

/**
 * Convert OIDC issuer URL to provider name
 */
function issuerToProvider(issuer: string): string | undefined {
  if (issuer.includes("github.com")) return "github";
  if (issuer.includes("accounts.google.com")) return "google";
  if (issuer.includes("login.microsoftonline.com")) return "microsoft";
  if (issuer.includes("gitlab.com")) return "gitlab";
  return undefined;
}

/**
 * Get minimum required attestations from config
 * @returns Minimum number of trusted attestations required
 */
export function getMinimumAttestations(): number {
  const config = loadConfig();
  return config.trust?.minimum_attestations ?? 1;
}

/**
 * Get trust policy from config
 * @returns Trust policy: 'require_attestation', 'prompt', or 'allow'
 */
export function getTrustPolicy(): "require_attestation" | "prompt" | "allow" {
  const config = loadConfig();
  // Handle legacy 'require_audit' value (cast to string for comparison)
  const policy = config.trust?.policy as string | undefined;
  if (policy === "require_audit") {
    return "require_attestation";
  }
  // Default to require_attestation - trust must be explicit
  return (policy as "require_attestation" | "prompt" | "allow") ?? "require_attestation";
}

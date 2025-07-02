// src/utils/env-loader.ts - Environment variable loader for Enact tools with package namespace support
import { join } from 'path';
import { homedir } from 'os';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { config as loadDotenv } from 'dotenv';

interface EnvVariable {
  value: string;
  description?: string;
  source?: string;
  required?: boolean;
  encrypted?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PackageEnvConfig {
  variables: Record<string, EnvVariable>;
}

// Configuration paths
const CONFIG_DIR = join(homedir(), '.enact');

/**
 * Extract package namespace from tool name (excluding tool name)
 * e.g., "kgroves88/dagger/social/bluesky-poster" -> "kgroves88/dagger/social"
 */
function extractPackageNamespace(toolName: string): string {
  const parts = toolName.split('/');
  if (parts.length < 2) {
    throw new Error('Tool name must be in format "org/package" or "org/package/tool"');
  }
  
  // Use all path parts except the last one (tool name)
  // For tools like "kgroves88/dagger/social/bluesky-poster", 
  // we want the package path "kgroves88/dagger/social"
  if (parts.length >= 2) {
    return parts.slice(0, -1).join('/');
  }
  
  return parts[0]; // fallback for edge cases
}

/**
 * Get the environment file path for a package namespace
 */
function getPackageEnvPath(packageNamespace: string): string {
  return join(CONFIG_DIR, 'env', packageNamespace, '.env');
}

/**
 * Simple decryption for encrypted values
 */
function decryptValue(encryptedValue: string): string {
  try {
    return Buffer.from(encryptedValue, 'base64').toString('utf8');
  } catch {
    return encryptedValue; // Return as-is if decryption fails
  }
}

/**
 * Read environment configuration for a package namespace
 */
async function readPackageEnvConfig(packageNamespace: string): Promise<PackageEnvConfig> {
  const envFile = getPackageEnvPath(packageNamespace);
  
  if (!existsSync(envFile)) {
    return { variables: {} };
  }
  
  try {
    const data = await readFile(envFile, 'utf8');
    
    // Check if it's a simple .env file (KEY=value format) or JSON
    if (data.trim().startsWith('{')) {
      // It's JSON format (legacy package-managed variables)
      return JSON.parse(data) as PackageEnvConfig;
    } else {
      // It's simple .env format (project mode), return empty since these are handled separately
      return { variables: {} };
    }
  } catch (error) {
    // Only warn if it's not a simple .env file parsing issue
    if (!(error as Error).message.includes('Unexpected token')) {
      console.warn(`Failed to read env config from ${envFile}: ${(error as Error).message}`);
    }
    return { variables: {} };
  }
}

/**
 * Load environment variables from Enact configuration for a specific package namespace
 */
export async function loadPackageEnvironmentVariables(packageNamespace: string): Promise<Record<string, string>> {
  const config = await readPackageEnvConfig(packageNamespace);
  const envVars: Record<string, string> = {};
  
  // Load variables from the package namespace
  for (const [name, envVar] of Object.entries(config.variables)) {
    const value = envVar.encrypted ? decryptValue(envVar.value) : envVar.value;
    envVars[name] = value;
  }
  
  return envVars;
}

/**
 * Load environment variables from a package-based .env file
 */
function loadPackageEnvFile(toolName: string): Record<string, string> {
  if (!toolName) {
    return {};
  }
  
  try {
    const packageNamespace = extractPackageNamespace(toolName);
    const packageEnvPath = getPackageEnvPath(packageNamespace);
    
    if (!existsSync(packageEnvPath)) {
      return {};
    }
    
    // Load .env file and return the parsed variables
    const result = loadDotenv({ path: packageEnvPath });
    return result.parsed || {};
  } catch (error) {
    console.warn(`Warning: Failed to load package .env file: ${(error as Error).message}`);
    return {};
  }
}

/**
 * Resolve environment variables for a tool definition with package namespace support
 * Combines system environment, Enact package configuration, and tool-specific requirements
 * Following the Enact protocol format:
 * env:
 *   VARIABLE_NAME:
 *     description: string
 *     source: string
 *     required: boolean
 *     default: string (optional)
 */
export async function resolveToolEnvironmentVariables(
  toolName: string,
  toolEnvConfig?: Record<string, any>
): Promise<{ resolved: Record<string, string>; missing: string[]; configLink?: string }> {
  // Start with system environment variables
  const resolved: Record<string, string> = { ...process.env } as Record<string, string>;
  
  // Load package .env file (if it exists) - priority 2
  const packageEnvVars = loadPackageEnvFile(toolName);
  Object.assign(resolved, packageEnvVars);
  
  // Load package-specific environment variables if we have a tool name - priority 3 (highest)
  if (toolName) {
    try {
      const packageNamespace = extractPackageNamespace(toolName);
      const packageJsonEnvVars = await loadPackageEnvironmentVariables(packageNamespace);
      
      // Override with package-managed JSON variables (highest priority)
      Object.assign(resolved, packageJsonEnvVars);
    } catch (error) {
      // If we can't extract package namespace, continue without package env vars
      console.warn(`Warning: Could not load package environment variables: ${(error as Error).message}`);
    }
  }
  
  const missing: string[] = [];
  
  // Check tool-specific environment requirements following Enact protocol
  if (toolEnvConfig) {
    for (const [varName, config] of Object.entries(toolEnvConfig)) {
      if (typeof config === 'object' && config !== null) {
        // Enact protocol: each env var has description, source, required, and optional default
        const isRequired = config.required === true;
        const defaultValue = config.default;
        const source = config.source;
        
        // Check if variable is already resolved
        if (!(varName in resolved) || resolved[varName] === '') {
          if (defaultValue !== undefined) {
            resolved[varName] = String(defaultValue);
          } else if (isRequired) {
            missing.push(varName);
          }
        }
        
        // Handle different sources as specified in the Enact protocol
        if (source && resolved[varName]) {
          // The source field tells us where the value should come from
          // For now, we'll just ensure the variable is available
          // In the future, this could be extended to support different sources
          // like "user", "system", "config", etc.
        }
      }
    }
  }
  
  // Generate and show configuration link if there are missing variables
  let configLink: string | undefined;
  if (missing.length > 0) {
    configLink = generateConfigLink(missing, toolName) || undefined;
    if (configLink) {
      console.log(`\n🔧 Missing environment variables: ${missing.join(', ')}`);
      console.log(`📋 Configure them here: ${configLink}\n`);
    } else {
      console.log(`\n⚠️  Missing required environment variables: ${missing.join(', ')}`);
      console.log(`💡 Set them using the 'enact env set' command or your system environment\n`);
    }
  }
  
  return { resolved, missing, configLink };
}

/**
 * Get available environment variables for a package namespace
 */
export async function getPackageEnvironmentVariables(packageNamespace: string): Promise<{
  package: Record<string, { value: string; encrypted: boolean; description?: string }>;
  system: Record<string, string>;
}> {
  const packageConfig = await readPackageEnvConfig(packageNamespace);
  
  const packageVars: Record<string, { value: string; encrypted: boolean; description?: string }> = {};
  
  // Process package variables
  for (const [name, envVar] of Object.entries(packageConfig.variables)) {
    packageVars[name] = {
      value: envVar.encrypted ? '[encrypted]' : envVar.value,
      encrypted: envVar.encrypted || false,
      description: envVar.description
    };
  }
  
  // System environment variables (filtered to avoid exposing sensitive data)
  const system = Object.fromEntries(
    Object.entries(process.env)
      .filter(([key]) => 
        // Only include environment variables that look like they might be relevant for tools
        key.includes('API') || 
        key.includes('TOKEN') || 
        key.includes('KEY') || 
        key.includes('URL') || 
        key.includes('HOST') || 
        key.includes('PORT') ||
        key.startsWith('ENACT_') ||
        key.startsWith('NODE_') ||
        key.startsWith('NPM_')
      )
      .map(([key, value]) => [key, value || ''])
  );
  
  return { package: packageVars, system };
}

/**
 * Validate that all required environment variables are available
 * Following the Enact protocol format for environment variables
 */
export function validateRequiredEnvironmentVariables(
  toolEnvConfig: Record<string, any> | undefined,
  availableVars: Record<string, string>
): { valid: boolean; missing: string[]; errors: string[] } {
  const missing: string[] = [];
  const errors: string[] = [];
  
  if (!toolEnvConfig) {
    return { valid: true, missing, errors };
  }
  
  for (const [varName, config] of Object.entries(toolEnvConfig)) {
    if (typeof config === 'object' && config !== null) {
      // Enact protocol: description, source, required are all required fields
      // default is optional
      const isRequired = config.required === true;
      const hasDefault = config.default !== undefined;
      const description = config.description || '';
      const source = config.source || '';
      
      if (isRequired && !hasDefault && (!(varName in availableVars) || availableVars[varName] === '')) {
        missing.push(varName);
        const errorMsg = `Required environment variable '${varName}' is not set`;
        const detailMsg = description ? ` - ${description}` : '';
        const sourceMsg = source ? ` (source: ${source})` : '';
        errors.push(`${errorMsg}${detailMsg}${sourceMsg}`);
      }
    }
  }
  
  return {
    valid: missing.length === 0,
    missing,
    errors
  };
}

// Export the package namespace extraction function for use in other modules
export { extractPackageNamespace };

// Load .env file if it exists
loadDotenv();

/**
 * Get the web server URL if it's running
 */
export function getWebServerUrl(): string | null {
  // For now, default to localhost:5555 as that's the standard port
  // When running via MCP (npx -p enact-cli enact-mcp), the web server is automatically started
  // TODO: In the future, we could check if the server is actually responding or get the port dynamically
  return 'http://localhost:5555';
}

/**
 * Generate a configuration link for missing environment variables
 */
export function generateConfigLink(missingVars: string[], toolName: string): string | null {
  const webUrl = getWebServerUrl();
  if (!webUrl) {
    return null;
  }
  
  // Extract package namespace from tool name (exclude tool name itself)
  const packageNamespace = extractPackageNamespace(toolName);
  
  const encodedVars = encodeURIComponent(JSON.stringify(missingVars));
  const encodedPackage = encodeURIComponent(packageNamespace);
  return `${webUrl}/?vars=${encodedVars}&package=${encodedPackage}`;
}

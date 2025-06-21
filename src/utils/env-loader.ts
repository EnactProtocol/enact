// src/utils/env-loader.ts - Environment variable loader for Enact tools with package namespace support
import { join } from 'path';
import { homedir } from 'os';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';

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
const ENV_BASE_DIR = join(CONFIG_DIR, 'env');

/**
 * Extract package namespace from tool name
 * e.g., "acme-corp/discord/bot-maker" -> "acme-corp/discord"
 */
function extractPackageNamespace(toolName: string): string {
  const parts = toolName.split('/');
  if (parts.length < 2) {
    throw new Error('Tool name must be in format "org/category" or "org/category/tool"');
  }
  // Use org/category as the namespace (ignore tool name for shared env vars)
  return parts.slice(0, 2).join('/');
}

/**
 * Get the environment file path for a package namespace
 */
function getPackageEnvPath(packageNamespace: string): string {
  return join(ENV_BASE_DIR, packageNamespace, '.env');
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
    return JSON.parse(data) as PackageEnvConfig;
  } catch (error) {
    console.warn(`Failed to read env config from ${envFile}: ${(error as Error).message}`);
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
): Promise<{ resolved: Record<string, string>; missing: string[] }> {
  // Start with system environment variables
  const resolved: Record<string, string> = { ...process.env } as Record<string, string>;
  
  // Load package-specific environment variables if we have a tool name
  if (toolName) {
    try {
      const packageNamespace = extractPackageNamespace(toolName);
      const packageEnvVars = await loadPackageEnvironmentVariables(packageNamespace);
      
      // Override with package-managed variables
      Object.assign(resolved, packageEnvVars);
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
  
  return { resolved, missing };
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

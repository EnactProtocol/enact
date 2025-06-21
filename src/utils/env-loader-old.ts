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
 * Read environment configuration
 */
async function readEnvConfig(isProject: boolean = false): Promise<EnvConfig> {
  const envFile = isProject ? PROJECT_ENV_FILE : GLOBAL_ENV_FILE;
  
  if (!existsSync(envFile)) {
    return { variables: {} };
  }
  
  try {
    const data = await readFile(envFile, 'utf8');
    return JSON.parse(data) as EnvConfig;
  } catch (error) {
    console.warn(`Failed to read env config from ${envFile}: ${(error as Error).message}`);
    return { variables: {} };
  }
}

/**
 * Load environment variables from Enact configuration
 * Merges global and project-level variables, with project taking precedence
 */
export async function loadEnactEnvironmentVariables(): Promise<Record<string, string>> {
  const globalConfig = await readEnvConfig(false);
  const projectConfig = await readEnvConfig(true);
  
  const envVars: Record<string, string> = {};
  
  // First, load global variables
  for (const [name, envVar] of Object.entries(globalConfig.variables)) {
    const value = envVar.encrypted ? decryptValue(envVar.value) : envVar.value;
    envVars[name] = value;
  }
  
  // Then, load project variables (these override global ones)
  for (const [name, envVar] of Object.entries(projectConfig.variables)) {
    const value = envVar.encrypted ? decryptValue(envVar.value) : envVar.value;
    envVars[name] = value;
  }
  
  return envVars;
}

/**
 * Resolve environment variables for a tool definition
 * Combines system environment, Enact configuration, and tool-specific requirements
 * Following the Enact protocol format:
 * env:
 *   VARIABLE_NAME:
 *     description: string
 *     source: string
 *     required: boolean
 *     default: string (optional)
 */
export async function resolveToolEnvironmentVariables(
  toolEnvConfig?: Record<string, any>
): Promise<{ resolved: Record<string, string>; missing: string[] }> {
  // Load Enact-managed environment variables
  const enactEnvVars = await loadEnactEnvironmentVariables();
  
  // Start with system environment variables
  const resolved: Record<string, string> = { ...process.env } as Record<string, string>;
  
  // Override with Enact-managed variables
  Object.assign(resolved, enactEnvVars);
  
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
 * Get available environment variables for debugging/listing
 */
export async function getAvailableEnvironmentVariables(): Promise<{
  global: Record<string, { value: string; encrypted: boolean; description?: string }>;
  project: Record<string, { value: string; encrypted: boolean; description?: string }>;
  system: Record<string, string>;
}> {
  const globalConfig = await readEnvConfig(false);
  const projectConfig = await readEnvConfig(true);
  
  const global: Record<string, { value: string; encrypted: boolean; description?: string }> = {};
  const project: Record<string, { value: string; encrypted: boolean; description?: string }> = {};
  
  // Process global variables
  for (const [name, envVar] of Object.entries(globalConfig.variables)) {
    global[name] = {
      value: envVar.encrypted ? '[encrypted]' : envVar.value,
      encrypted: envVar.encrypted || false,
      description: envVar.description
    };
  }
  
  // Process project variables
  for (const [name, envVar] of Object.entries(projectConfig.variables)) {
    project[name] = {
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
  
  return { global, project, system };
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

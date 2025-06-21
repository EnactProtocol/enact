// src/commands/env.ts - Environment variable management for Enact CLI with package namespace support
import { intro, outro, text, select, confirm, spinner, note, password } from '@clack/prompts';
import color from 'picocolors';
import { existsSync } from 'fs';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { homedir } from 'os';

interface EnvOptions {
  help?: boolean;
  package?: string;
  encrypt?: boolean;
  format?: string;
  show?: boolean;
  global?: boolean;
  project?: boolean;
}

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
 * Get the environment file path for a package namespace
 */
function getPackageEnvPath(packageName: string): string {
  // Parse package name like "acme-corp/discord/bot-maker" 
  const parts = packageName.split('/');
  if (parts.length < 2) {
    throw new Error('Package name must be in format "org/category" or "org/category/tool"');
  }
  
  // Use org/category as the namespace (ignore tool name for shared env vars)
  const namespace = parts.slice(0, 2).join('/');
  return join(ENV_BASE_DIR, namespace, '.env');
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
    await writeFile(envFile, JSON.stringify({ variables: {} }, null, 2));
  }
}

/**
 * Read package environment configuration
 */
async function readPackageEnvConfig(packageName: string): Promise<PackageEnvConfig> {
  await ensurePackageEnvDir(packageName);
  const envFile = getPackageEnvPath(packageName);
  
  try {
    const data = await readFile(envFile, 'utf8');
    return JSON.parse(data) as PackageEnvConfig;
  } catch (error) {
    console.error(`Failed to read env config for ${packageName}: ${(error as Error).message}`);
    return { variables: {} };
  }
}

/**
 * Write package environment configuration
 */
async function writePackageEnvConfig(packageName: string, config: PackageEnvConfig): Promise<void> {
  await ensurePackageEnvDir(packageName);
  const envFile = getPackageEnvPath(packageName);
  await writeFile(envFile, JSON.stringify(config, null, 2));
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
    const fs = require('fs');
    const orgs = fs.readdirSync(ENV_BASE_DIR);
    
    for (const org of orgs) {
      const orgPath = join(ENV_BASE_DIR, org);
      if (fs.statSync(orgPath).isDirectory()) {
        const categories = fs.readdirSync(orgPath);
        for (const category of categories) {
          const categoryPath = join(orgPath, category);
          if (fs.statSync(categoryPath).isDirectory()) {
            packages.push(`${org}/${category}`);
          }
        }
      }
    }
  } catch (error) {
    // Directory doesn't exist or can't be read
  }
  
  return packages;
}

/**
 * Simple encryption/decryption for sensitive values
 */
function encryptValue(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64');
}

function decryptValue(encryptedValue: string): string {
  try {
    return Buffer.from(encryptedValue, 'base64').toString('utf8');
  } catch {
    return encryptedValue;
  }
}

/**
 * Set an environment variable for a package
 */
async function setEnvVar(
  packageName: string,
  name: string, 
  value: string, 
  options: {
    description?: string;
    source?: string;
    required?: boolean;
    encrypt?: boolean;
  } = {}
): Promise<void> {
  const config = await readPackageEnvConfig(packageName);
  const now = new Date().toISOString();
  
  const envVar: EnvVariable = {
    value: options.encrypt ? encryptValue(value) : value,
    description: options.description,
    source: options.source,
    required: options.required,
    encrypted: options.encrypt,
    createdAt: config.variables[name]?.createdAt || now,
    updatedAt: now
  };
  
  config.variables[name] = envVar;
  await writePackageEnvConfig(packageName, config);
  
  const encrypted = options.encrypt ? ' (encrypted)' : '';
  console.log(color.green(`✓ Set environment variable for ${color.bold(packageName)}: ${color.bold(name)}${encrypted}`));
}

/**
 * Get an environment variable for a package
 */
async function getEnvVar(packageName: string, name: string, showValue: boolean = false): Promise<void> {
  const config = await readPackageEnvConfig(packageName);
  const envVar = config.variables[name];
  
  if (!envVar) {
    console.log(color.red(`✗ Environment variable ${color.bold(name)} not found for package ${color.bold(packageName)}`));
    return;
  }
  
  const value = envVar.encrypted ? decryptValue(envVar.value) : envVar.value;
  const displayValue = showValue ? value : (envVar.encrypted ? '[encrypted]' : '[hidden]');
  
  console.log(color.cyan(`Environment variable: ${color.bold(name)} (${packageName})`));
  console.log(`  Value: ${displayValue}`);
  if (envVar.description) console.log(`  Description: ${envVar.description}`);
  if (envVar.source) console.log(`  Source: ${envVar.source}`);
  if (envVar.required !== undefined) console.log(`  Required: ${envVar.required}`);
  console.log(`  Encrypted: ${envVar.encrypted || false}`);
  console.log(`  Created: ${envVar.createdAt}`);
  console.log(`  Updated: ${envVar.updatedAt}`);
}

/**
 * List all environment variables for a package
 */
async function listEnvVars(packageName: string, format: string = 'table', showValues: boolean = false): Promise<void> {
  const config = await readPackageEnvConfig(packageName);
  const vars = Object.entries(config.variables);
  
  if (vars.length === 0) {
    console.log(color.yellow(`No environment variables found for package ${color.bold(packageName)}`));
    return;
  }
  
  console.log(color.cyan(`Environment variables for ${color.bold(packageName)}:`));
  
  if (format === 'json') {
    const output = vars.reduce((acc, [name, envVar]) => {
      acc[name] = {
        value: showValues ? (envVar.encrypted ? decryptValue(envVar.value) : envVar.value) : '[hidden]',
        description: envVar.description,
        source: envVar.source,
        required: envVar.required,
        encrypted: envVar.encrypted || false,
        createdAt: envVar.createdAt,
        updatedAt: envVar.updatedAt
      };
      return acc;
    }, {} as Record<string, any>);
    
    console.log(JSON.stringify(output, null, 2));
  } else {
    vars.forEach(([name, envVar]) => {
      const value = showValues ? 
        (envVar.encrypted ? decryptValue(envVar.value) : envVar.value) : 
        (envVar.encrypted ? '[encrypted]' : '[hidden]');
      
      console.log(`\n  ${color.bold(name)}`);
      console.log(`    Value: ${value}`);
      if (envVar.description) console.log(`    Description: ${envVar.description}`);
      if (envVar.source) console.log(`    Source: ${envVar.source}`);
      if (envVar.required !== undefined) console.log(`    Required: ${envVar.required}`);
      console.log(`    Encrypted: ${envVar.encrypted || false}`);
      console.log(`    Updated: ${envVar.updatedAt}`);
    });
  }
}

/**
 * Delete an environment variable for a package
 */
async function deleteEnvVar(packageName: string, name: string): Promise<void> {
  const config = await readPackageEnvConfig(packageName);
  
  if (!config.variables[name]) {
    console.log(color.red(`✗ Environment variable ${color.bold(name)} not found for package ${color.bold(packageName)}`));
    return;
  }
  
  delete config.variables[name];
  await writePackageEnvConfig(packageName, config);
  
  console.log(color.green(`✓ Deleted environment variable for ${color.bold(packageName)}: ${color.bold(name)}`));
}

/**
 * Export environment variables for a package
 */
async function exportEnvVars(packageName: string, format: 'env' | 'json' | 'yaml' = 'env'): Promise<void> {
  const config = await readPackageEnvConfig(packageName);
  const vars = Object.entries(config.variables);
  
  if (vars.length === 0) {
    console.log(color.yellow(`No environment variables to export for package ${packageName}`));
    return;
  }
  
  switch (format) {
    case 'env':
      vars.forEach(([name, envVar]) => {
        const value = envVar.encrypted ? decryptValue(envVar.value) : envVar.value;
        console.log(`${name}="${value}"`);
      });
      break;
      
    case 'json':
      const jsonOutput = vars.reduce((acc, [name, envVar]) => {
        acc[name] = envVar.encrypted ? decryptValue(envVar.value) : envVar.value;
        return acc;
      }, {} as Record<string, string>);
      console.log(JSON.stringify(jsonOutput, null, 2));
      break;
      
    case 'yaml':
      vars.forEach(([name, envVar]) => {
        const value = envVar.encrypted ? decryptValue(envVar.value) : envVar.value;
        console.log(`${name}: "${value}"`);
      });
      break;
  }
}

/**
 * Main environment command handler
 */
export async function handleEnvCommand(args: string[], options: EnvOptions): Promise<void> {
  if (options.help || !args[0]) {
    console.log(`
${color.bold('Usage:')} enact env <subcommand> [options]

${color.bold('Environment variable management for Enact CLI with package namespaces.')}

${color.bold('Subcommands:')}
  set <package> <name> [value]    Set an environment variable for a package
  get <package> <name>            Get an environment variable for a package
  list [package]                  List environment variables for a package
  delete <package> <name>         Delete an environment variable for a package
  packages                        List all available package namespaces
  export <package> [format]       Export variables (env|json|yaml)
  clear <package>                 Clear all environment variables for a package

${color.bold('Options:')}
  --help, -h              Show this help message
  --package <name>        Package namespace (org/category format)
  --encrypt               Encrypt sensitive values
  --format <fmt>          Output format (table|json)
  --show                  Show actual values (default: hidden)

${color.bold('Package Namespace Format:')}
  Package names follow the format: org/category/tool
  Environment variables are shared at the org/category level
  Examples: acme-corp/discord/bot-maker → stored under acme-corp/discord/

${color.bold('Examples:')}
  enact env set acme-corp/discord API_KEY sk-123... --encrypt
  enact env set acme-corp/ai OPENAI_API_KEY --encrypt
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
      case 'set': {
        const packageName = args[1];
        const name = args[2];
        let value = args[3];
        
        if (!packageName) {
          console.log(color.red('✗ Package name is required (format: org/category)'));
          return;
        }
        
        if (!name) {
          console.log(color.red('✗ Variable name is required'));
          return;
        }
        
        if (!value) {
          // Prompt for value
          const promptValue = options.encrypt ? 
            await password({ message: `Enter value for ${name}:` }) :
            await text({ message: `Enter value for ${name}:` });
          
          if (!promptValue || typeof promptValue === 'symbol') {
            console.log(color.yellow('Operation cancelled'));
            return;
          }
          value = promptValue;
        }
        
        // Optional prompts for metadata (following Enact protocol format)
        const description = await text({ 
          message: 'Description (required for Enact protocol):', 
          placeholder: 'What this variable is for'
        });
        
        const source = await text({ 
          message: 'Source (required for Enact protocol):', 
          placeholder: 'Where to obtain this value'
        });
        
        const required = await confirm({ 
          message: 'Is this variable required?',
          initialValue: true
        });
        
        if (typeof description === 'symbol' || typeof source === 'symbol' || typeof required === 'symbol') {
          console.log(color.yellow('Operation cancelled'));
          return;
        }
        
        await setEnvVar(packageName, name, value, {
          description: description || undefined,
          source: source || undefined,
          required,
          encrypt: options.encrypt
        });
        break;
      }
      
      case 'get': {
        const packageName = args[1];
        const name = args[2];
        
        if (!packageName) {
          console.log(color.red('✗ Package name is required (format: org/category)'));
          return;
        }
        
        if (!name) {
          console.log(color.red('✗ Variable name is required'));
          return;
        }
        
        await getEnvVar(packageName, name, options.show);
        break;
      }
      
      case 'list': {
        const packageName = args[1];
        
        if (!packageName) {
          const packages = await listPackageNamespaces();
          if (packages.length === 0) {
            console.log(color.yellow('No package namespaces found. Use "enact env set <package> <name> <value>" to create variables.'));
            return;
          }
          
          console.log(color.cyan('Available package namespaces:'));
          packages.forEach(pkg => console.log(`  ${pkg}`));
          console.log(color.dim('\nUse "enact env list <package>" to see variables for a specific package.'));
          return;
        }
        
        await listEnvVars(packageName, options.format || 'table', options.show);
        break;
      }
      
      case 'delete': {
        const packageName = args[1];
        const name = args[2];
        
        if (!packageName) {
          console.log(color.red('✗ Package name is required (format: org/category)'));
          return;
        }
        
        if (!name) {
          console.log(color.red('✗ Variable name is required'));
          return;
        }
        
        const confirmed = await confirm({
          message: `Delete environment variable ${color.bold(name)} from ${color.bold(packageName)}?`,
          initialValue: false
        });
        
        if (typeof confirmed === 'symbol' || !confirmed) {
          console.log(color.yellow('Operation cancelled'));
          return;
        }
        
        await deleteEnvVar(packageName, name);
        break;
      }
      
      case 'packages': {
        const packages = await listPackageNamespaces();
        if (packages.length === 0) {
          console.log(color.yellow('No package namespaces found.'));
          return;
        }
        
        console.log(color.cyan('Available package namespaces:'));
        packages.forEach(pkg => console.log(`  ${pkg}`));
        break;
      }
      
      case 'export': {
        const packageName = args[1];
        const format = (args[2] as 'env' | 'json' | 'yaml') || 'env';
        
        if (!packageName) {
          console.log(color.red('✗ Package name is required (format: org/category)'));
          return;
        }
        
        if (!['env', 'json', 'yaml'].includes(format)) {
          console.log(color.red('✗ Supported formats: env, json, yaml'));
          return;
        }
        
        await exportEnvVars(packageName, format);
        break;
      }
      
      case 'clear': {
        const packageName = args[1];
        
        if (!packageName) {
          console.log(color.red('✗ Package name is required (format: org/category)'));
          return;
        }
        
        const confirmed = await confirm({
          message: `Clear all environment variables for ${color.bold(packageName)}?`,
          initialValue: false
        });
        
        if (typeof confirmed === 'symbol' || !confirmed) {
          console.log(color.yellow('Operation cancelled'));
          return;
        }
        
        await writePackageEnvConfig(packageName, { variables: {} });
        console.log(color.green(`✓ Cleared all environment variables for ${color.bold(packageName)}`));
        break;
      }
      
      default:
        console.log(color.red(`✗ Unknown subcommand: ${subCommand}`));
        console.log('Run "enact env --help" for usage information');
    }
  } catch (error) {
    console.error(color.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  }
}

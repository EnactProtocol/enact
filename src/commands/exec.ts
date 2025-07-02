// src/commands/exec.ts - Execute Enact tools with signature verification
import { spawn } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import * as yaml from 'yaml';
import { enactApi, EnactApiError } from '../api/enact-api';
import { EnactExecOptions, EnactToolDefinition, VerificationPolicy } from '../api/types';
import { verifyTool, shouldExecuteTool, VERIFICATION_POLICIES  } from '../security/sign';
import { resolveToolEnvironmentVariables, validateRequiredEnvironmentVariables, generateConfigLink } from '../utils/env-loader';
import { parseTimeout } from '../utils/timeout';
import { DirectExecutionProvider } from '../core/DirectExecutionProvider';


/**
 * Load a tool definition from a local YAML file
 */
async function loadLocalTool(filePath: string): Promise<EnactToolDefinition> {
  const resolvedPath = resolve(filePath);
  
  if (!existsSync(resolvedPath)) {
    throw new Error(`Tool file not found: ${resolvedPath}`);
  }
  
  try {
    const fileContent = readFileSync(resolvedPath, 'utf8');
    const toolData = yaml.parse(fileContent);
    
    // Store the raw content for signature verification
    const toolDefinition: EnactToolDefinition = {
      ...toolData,
      raw_content: fileContent
    };
    
    // Validate required fields
    if (!toolDefinition.name) {
      throw new Error('Tool must have a name');
    }
    if (!toolDefinition.command) {
      throw new Error('Tool must have a command');
    }
    
    return toolDefinition;
  } catch (error) {
    if (error instanceof yaml.YAMLParseError) {
      throw new Error(`Invalid YAML in tool file: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Check if a tool identifier is a local file path
 */
function isLocalToolPath(toolIdentifier: string): boolean {
  // Check if it's a file path - either exists as a file OR looks like a path ending in .yaml/.yml
  const resolvedPath = resolve(toolIdentifier);
  
  // If the file exists, it's definitely a local file
  if (existsSync(resolvedPath)) {
    return true;
  }
  
  // If it contains a path separator and ends with .yaml/.yml, treat as local file path
  return (toolIdentifier.includes('/') || toolIdentifier.includes('\\')) && 
         (toolIdentifier.endsWith('.yaml') || toolIdentifier.endsWith('.yml'));
}


/**
 * Handle the exec command for executing Enact tools with signature verification
 */
export async function handleExecCommand(
  args: string[], 
  options: EnactExecOptions
): Promise<void> {
  if (options.help) {
    console.error(`
Usage: enact exec <tool-name-or-path> [options]

Execute an Enact tool by fetching its definition from the registry or loading from a local file.

Arguments:
  tool-name-or-path   Name of the tool (e.g., "enact/text/slugify") or path to local YAML file

Options:
  --help, -h          Show this help message
  --input <data>      Input data as JSON string or stdin
  --params <params>   Parameters as JSON object
  --timeout <time>    Override tool timeout (Go duration format: 30s, 5m, 1h)
  --dry               Show command that would be executed without running it
  --verbose, -v       Show detailed execution information
  --skip-verification Skip signature verification (not recommended)
  --verify-policy     Verification policy: permissive, enterprise, paranoid (default: permissive)
  --force             Force execution even if signature verification fails

Security Options:
  permissive          Require 1+ valid signatures from trusted keys (default)
  enterprise          Require author + reviewer signatures  
  paranoid            Require author + reviewer + approver signatures

Examples:
  enact exec enact/text/slugify --input "Hello World"
  enact exec org/ai/review --params '{"file": "README.md"}' --verify-policy enterprise
  enact exec ./my-tool.yaml --input "test data"
  enact exec untrusted/tool --skip-verification  # Not recommended
`);
    return;
  }

  // Get the tool name/path
  let toolIdentifier = args[0];
  
  if (!toolIdentifier) {
    p.intro(pc.bgMagenta(pc.white(' Execute Enact Tool ')));
    
    toolIdentifier = await p.text({
      message: 'Enter the tool name or path to execute:',
      placeholder: 'e.g., enact/text/slugify, ./my-tool.yaml',
      validate: (value) => {
        if (!value.trim()) return 'Please enter a tool name or file path';
        const trimmed = value.trim();
        
        // Check if it's a local file path
        if (isLocalToolPath(trimmed)) {
          return undefined; // Local file paths are valid
        }
        
        // Check if it's a valid tool name format
        if (!/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_\/-]+$/.test(trimmed)) {
          return 'Tool name must follow hierarchical format: org/package/tool-name, or be a path to a YAML file';
        }
        return undefined;
      }
    }) as string;
    
    if (!toolIdentifier) {
      p.outro(pc.yellow('Execution cancelled'));
      return;
    }
  }

  // Determine if this is a local file or remote tool
  const isLocalFile = isLocalToolPath(toolIdentifier);
  
  // Show a spinner while fetching/loading tool definition
  const spinner = p.spinner();
  spinner.start(isLocalFile ? 'Loading local tool definition...' : 'Fetching tool definition...');

  let toolDefinition: EnactToolDefinition;
  try {
    if (isLocalFile) {
      toolDefinition = await loadLocalTool(toolIdentifier);
      spinner.stop('Local tool definition loaded');
    } else {
      toolDefinition = await enactApi.getTool(toolIdentifier);
      spinner.stop('Tool definition fetched');
    }
  } catch (error) {
    spinner.stop(isLocalFile ? 'Failed to load local tool' : 'Failed to fetch tool definition');
    
    if (!isLocalFile && error instanceof EnactApiError && error.statusCode === 404) {
      p.outro(pc.red(`✗ Tool "${toolIdentifier}" not found`));
    } else {
      p.outro(pc.red(`✗ Failed to ${isLocalFile ? 'load' : 'fetch'} tool: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
    return;
  }

  // Signature verification (unless skipped)
  if (!options.skipVerification) {
    spinner.start('Verifying tool signatures...');
    
    try {
      // Determine verification policy
      const policyName = (options.verifyPolicy || 'permissive').toUpperCase();
      const policy: VerificationPolicy = VERIFICATION_POLICIES[policyName as keyof typeof VERIFICATION_POLICIES] 
        || VERIFICATION_POLICIES.PERMISSIVE;
      
      if (options.verbose) {
        console.error(pc.cyan(`\n🔐 Using verification policy: ${policyName.toLowerCase()}`));
        if (policy.minimumSignatures) console.error(`  - Minimum signatures: ${policy.minimumSignatures}`);
      }
      
      // Create a tool object for verification
      let toolForVerification;
      if (isLocalFile) {
        // For local files, pass the raw YAML string directly to verifyTool
        toolForVerification = toolDefinition.raw_content;
      } else if (toolDefinition.raw_content && toolDefinition.signatures) {
        // For remote tools, parse the JSON raw content and add signatures back
        const originalTool = JSON.parse(toolDefinition.raw_content);
        
        // Add enact field if missing (frontend adds this during signing)
        if (!originalTool.enact) {
          originalTool.enact = "1.0.0";
        }
        
        toolForVerification = {
          ...originalTool,
          signatures: toolDefinition.signatures
        };
      } else {
        // Fallback to the transformed API response
        toolForVerification = toolDefinition;
        
        // Add enact field if missing
        if (!toolForVerification.enact) {
          toolForVerification.enact = "1.0.0";
        }
      }
      
      const verification = await verifyTool(toolForVerification, policy);
      spinner.stop('Signature verification completed');
      
      if (verification.isValid) {
        console.error(pc.green(`✅ ${verification.message}`));
        
        if (options.verbose && verification.verifiedSigners.length > 0) {
          console.error(pc.cyan('\n🔒 Verified signers:'));
          verification.verifiedSigners.forEach((signer: any) => {
            console.error(`  - ${signer.signer}${signer.role ? ` (${signer.role})` : ''} [${signer.keyId}]`);
          });
        }
      } else {
        console.error(pc.red(`❌ ${verification.message}`));
        
        if (verification.errors.length > 0) {
          console.error(pc.red('\nVerification errors:'));
          verification.errors.forEach((error: any) => {
            console.error(pc.red(`  - ${error}`));
          });
        }
        
        if (!options.force) {
          const shouldContinue = await p.confirm({
            message: 'Tool signature verification failed. Continue anyway?',
            initialValue: false
          });
          
          if (!shouldContinue) {
            p.outro(pc.yellow('Execution cancelled for security'));
            return;
          }
        } else {
          console.error(pc.yellow('⚠️  Proceeding due to --force flag'));
        }
      }
    } catch (error) {
      spinner.stop('Verification failed');
      console.error(pc.red(`❌ Signature verification error: ${(error as Error).message}`));
      
      if (!options.force) {
        const shouldContinue = await p.confirm({
          message: 'Signature verification failed with error. Continue anyway?',
          initialValue: false
        });
        
        if (!shouldContinue) {
          p.outro(pc.yellow('Execution cancelled for security'));
          return;
        }
      }
    }
  } else {
    console.error(pc.yellow('⚠️  Signature verification skipped - tool may be untrusted'));
  }

  // Show tool information
  if (options.verbose) {
    console.error(pc.cyan('\n📋 Tool Information:'));
    console.error(`Name: ${toolDefinition.name}`);
    console.error(`Description: ${toolDefinition.description}`);
    console.error(`Command: ${toolDefinition.command}`);
    if (toolDefinition.timeout) console.error(`Timeout: ${toolDefinition.timeout}`);
    if (toolDefinition.tags) console.error(`Tags: ${toolDefinition.tags.join(', ')}`);
    
    // Show signature count
    if (toolDefinition.signatures) {
      const sigCount = Object.keys(toolDefinition.signatures).length;
      console.error(`Signatures: ${sigCount} signature(s) found`);
    } else {
      console.error(`Signatures: No signatures found`);
    }
  }

  // Parse input parameters
  let params: Record<string, any> = {};
  
  if (options.params) {
    try {
      params = JSON.parse(options.params);
    } catch (error) {
      p.outro(pc.red(`✗ Invalid JSON in --params: ${error instanceof Error ? error.message : 'Unknown error'}`));
      return;
    }
  }

  // Handle input data
  if (options.input) {
    try {
      const inputData = JSON.parse(options.input);
      params = { ...params, ...inputData };
    } catch {
      params.input = options.input;
    }
  }

  // Parse key=value parameters from remaining command line arguments
  const remainingArgs = args.slice(1); // Skip the tool identifier
  for (const arg of remainingArgs) {
    if (arg.includes('=')) {
      const [key, ...valueParts] = arg.split('=');
      const value = valueParts.join('='); // Handle values that contain '='
      
      // Remove quotes if present
      const cleanValue = value.replace(/^["']|["']$/g, '');
      params[key] = cleanValue;
    }
  }

  // Interactive parameter collection if needed
  if (toolDefinition.inputSchema && Object.keys(params).length === 0) {
    const needsParams = await p.confirm({
      message: 'This tool requires parameters. Would you like to provide them interactively?',
      initialValue: true
    });

    if (needsParams) {
      params = await collectParametersInteractively(toolDefinition.inputSchema);
    }
  }

  // Build the command
  const command = await buildCommand(toolDefinition.command, params);
  
  // Resolve environment variables from Enact configuration
  const { resolved: envVars, missing: missingEnvVars } = await resolveToolEnvironmentVariables(toolDefinition.name, toolDefinition.env);
  
  // Validate required environment variables
  const validation = validateRequiredEnvironmentVariables(toolDefinition.env, envVars);
  
  if (!validation.valid) {
    console.error(pc.red('\n✗ Missing required environment variables:'));
    validation.missing.forEach(varName => {
      const config = toolDefinition.env?.[varName];
      const description = config?.description ? ` - ${config.description}` : '';
      const source = config?.source ? ` (source: ${config.source})` : '';
      const required = config?.required ? ' [REQUIRED]' : '';
      console.error(pc.red(`  ${varName}${required}${description}${source}`));
    });
    
    // Generate a configuration link for the web interface
    const configLink = generateConfigLink(validation.missing, toolDefinition.name);
    
    console.error(pc.yellow('\n💡 You can set environment variables using:'));
    console.error(pc.cyan('  enact env set <package> <VAR_NAME> <value>  # Package-managed (shared)'));
    console.error(pc.cyan('  enact env set <package> <VAR_NAME> --encrypt # For sensitive values'));
    console.error(pc.cyan('  enact env set <VAR_NAME> <value> --project   # Project-specific (.env file)'));
    
    if (configLink) {
      console.error(pc.yellow('\n🌐 Or use the web interface to configure all missing variables:'));
      console.error(pc.blue(`  ${configLink}`));
    }
    
    p.outro(pc.red('✗ Execution aborted due to missing environment variables'));
    return;
  }
  
  if (options.dry) {
    console.error(pc.cyan('\n🔍 Command that would be executed:'));
    console.error(pc.white(command));
    console.error(pc.cyan('\nEnvironment variables:'));
    if (Object.keys(envVars).length > 0) {
      Object.entries(envVars).forEach(([key, value]) => {
        const isFromEnact = key in envVars && !(key in process.env);
        const source = isFromEnact ? ' (from Enact config)' : ' (from system)';
        const displayValue = (key.includes('KEY') || key.includes('TOKEN') || key.includes('SECRET')) 
          ? '[hidden]' : value;
        console.error(`  ${key}=${displayValue}${source}`);
      });
    } else {
      console.error('  (none required)');
    }
    return;
  }

  if (options.verbose && toolDefinition.env && Object.keys(toolDefinition.env).length > 0) {
    console.error(pc.cyan('\n🌍 Tool-specific environment variables:'));
    Object.entries(toolDefinition.env).forEach(([key, config]) => {
      const value = envVars[key];
      const isSet = value !== undefined;
      const isFromEnact = key in envVars && !(key in process.env);
      const source = isFromEnact ? ' (from Enact config)' : ' (from system)';
      const description = config?.description ? ` - ${config.description}` : '';
      const required = config?.required ? ' [REQUIRED]' : '';
      const displayValue = isSet 
        ? ((key.includes('KEY') || key.includes('TOKEN') || key.includes('SECRET')) 
           ? '[hidden]' : value)
        : '[not set]';
      const status = isSet ? '✓' : (required ? '✗' : '○');
      console.error(`  ${status} ${key}=${displayValue}${required}${description}${source}`);
    });
  }

  // Execute the command
  const timeout = options.timeout || toolDefinition.timeout || '30s';
  await executeCommand(command, timeout, options.verbose, envVars);

  // Log usage (include verification status) - only for remote tools
  if (!isLocalFile) {
    try {
      await enactApi.logToolUsage(toolIdentifier, {
        action: 'execute',
        metadata: {
          hasParams: Object.keys(params).length > 0,
          timeout,
          verificationSkipped: options.skipVerification || false,
          verificationPolicy: options.verifyPolicy || 'permissive',
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      if (options.verbose) {
        console.error(pc.yellow('⚠ Failed to log usage statistics'));
      }
    }
  }
}

/**
 * Collect parameters interactively based on JSON schema
 */
async function collectParametersInteractively(inputSchema: any): Promise<Record<string, any>> {
  const params: Record<string, any> = {};
  
  if (inputSchema.properties) {
    for (const [key, schema] of Object.entries(inputSchema.properties)) {
      const prop = schema as any;
      const isRequired = inputSchema.required?.includes(key) || false;
      
      let value: any;
      
      if (prop.type === 'string') {
        value = await p.text({
          message: `Enter ${key}:`,
          placeholder: prop.description || `Value for ${key}`,
          validate: isRequired ? (val) => val.trim() ? undefined : `${key} is required` : undefined
        });
      } else if (prop.type === 'number' || prop.type === 'integer') {
        value = await p.text({
          message: `Enter ${key} (number):`,
          placeholder: prop.description || `Number value for ${key}`,
          validate: (val) => {
            if (!val.trim() && isRequired) return `${key} is required`;
            if (val.trim() && isNaN(Number(val))) return 'Must be a valid number';
            return undefined;
          }
        });
        if (value) value = Number(value);
      } else if (prop.type === 'boolean') {
        value = await p.confirm({
          message: `${key}:`,
          initialValue: false
        });
      } else {
        // For complex types, ask for JSON input
        value = await p.text({
          message: `Enter ${key} (JSON):`,
          placeholder: prop.description || `JSON value for ${key}`,
          validate: (val) => {
            if (!val.trim() && isRequired) return `${key} is required`;
            if (val.trim()) {
              try {
                JSON.parse(val);
              } catch {
                return 'Must be valid JSON';
              }
            }
            return undefined;
          }
        });
        if (value) {
          try {
            value = JSON.parse(value);
          } catch {
            // Keep as string if JSON parsing fails
          }
        }
      }
      
      if (value !== null && value !== undefined && value !== '') {
        params[key] = value;
      }
    }
  }
  
  return params;
}

/**
 * Build command by replacing template variables
 */
async function buildCommand(template: string, params: Record<string, any>): Promise<string> {
  let command = template;
  
  // Replace ${variable} patterns
  for (const [key, value] of Object.entries(params)) {
    const placeholder = `\${${key}}`;
    const escapedValue = typeof value === 'string' ? value.replace(/'/g, "'\"'\"'") : String(value);
    command = command.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), escapedValue);
  }
  
  return command;
}

/**
 * Execute the command with timeout and proper error handling
 * Now using the DirectExecutionProvider for consistency
 */
async function executeCommand(
  command: string, 
  timeout: string, 
  verbose: boolean = false, 
  envVars: Record<string, string> = {}
): Promise<void> {
  return executionProvider.executeCommandExecStyle(command, timeout, verbose, envVars);
}

// Add a factory function to create a DirectExecutionProvider instance
const executionProvider = new DirectExecutionProvider();
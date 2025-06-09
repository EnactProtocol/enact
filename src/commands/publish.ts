// src/commands/publish.ts
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { basename, extname } from 'path';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import * as yaml from 'yaml';
import { showPublishHelp } from '../utils/help';
import { 
  addToHistory, 
  getHistory, 
  getDefaultUrl, 
  setDefaultUrl 
} from '../utils/config';
import { getAuthHeaders } from './auth';

// Define the options interface
export interface PublishOptions {
  help?: boolean;
  url?: string;
  token?: string; // Support manual token override
}

// Enact tool definition interface based on the protocol
interface EnactToolDefinition {
  name: string;
  description: string;
  command: string;
  version?: string;
  timeout?: string;
  tags?: string[];
  inputSchema?: any;
  outputSchema?: any;
  examples?: any[];
  annotations?: {
    title?: string;
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
  env?: Record<string, {
    description: string;
    source?: string;
    required: boolean;
    default?: string;
  }>;
  resources?: {
    memory?: string;
    gpu?: string;
    disk?: string;
  };
  signature?: {
    algorithm: string;
    type: string;
    signer: string;
    created: string;
    value: string;
    role?: string;
  };
  enact?: string;
  // Allow custom extensions
  [key: string]: any;
}

/**
 * Handle the publish command for Enact tools
 */
export async function handlePublishCommand(
  args: string[], 
  options: PublishOptions
): Promise<void> {
  // Show help if requested
  if (options.help) {
    showPublishHelp();
    return;
  }

  // Start the interactive prompt
  p.intro(pc.bgBlue(pc.white(' Publish Enact Tool ')));

  // Check authentication first
  let authHeaders: Record<string, string>;
  try {
    if (options.token) {
      // Manual token provided via CLI option
      authHeaders = {
        // 'Authorization': `Bearer ${options.token}`,
        'Content-Type': 'application/json',
        'X-API-Key': options.token // Use X-Api-Token for manual token
      };
    } else {
      // Use OAuth token
      authHeaders = await getAuthHeaders();
    }
  } catch (error) {
    p.outro(pc.red(`✗ Authentication required. Run "enact auth login" to authenticate.`));
    return;
  }

  // Get the file to publish
  let filePath = args[0];
  
  if (!filePath) {
    // No file provided, show interactive prompt
    const history = await getHistory();
    
    if (history.length > 0) {
      // User has publish history, offer to reuse
      const action = await p.select({
        message: 'Select a tool manifest to publish:',
        options: [
          { value: 'select', label: 'Choose from recent files' },
          { value: 'new', label: 'Specify a new file' }
        ]
      });
      
      if (action === 'select') {
        const fileOptions = history
          .filter(file => existsSync(file) && isEnactFile(file))
          .map(file => ({
            value: file,
            label: file
          }));
        
        if (fileOptions.length > 0) {
          filePath = await p.select({
            message: 'Select a tool manifest:',
            options: fileOptions
          }) as string;
        } else {
          p.note('No recent Enact tool manifests found.', 'History');
          filePath = await p.text({
            message: 'Enter the path to the tool manifest (.yaml or .yml):',
            validate: validateEnactFile
          }) as string;
        }
      } else {
        filePath = await p.text({
          message: 'Enter the path to the tool manifest (.yaml or .yml):',
          validate: validateEnactFile
        }) as string;
      }
    } else {
      // No history, just ask for a file
      filePath = await p.text({
        message: 'Enter the path to the tool manifest (.yaml or .yml):',
        validate: validateEnactFile
      }) as string;
    }
    
    if (filePath === null) {
      p.outro(pc.yellow('Operation cancelled'));
      return;
    }
  } else {
    // Validate the provided file
    const validation = validateEnactFile(filePath);
    if (validation) {
      p.outro(pc.red(`Error: ${validation}`));
      return;
    }
  }

  // Parse and validate the Enact tool manifest
  let toolDefinition: EnactToolDefinition;
  try {
    const content = await readFile(filePath, 'utf8');
    toolDefinition = yaml.parse(content) as EnactToolDefinition;
    
    // Validate required fields
    const validation = validateToolDefinition(toolDefinition);
    if (validation) {
      p.outro(pc.red(`Invalid tool manifest: ${validation}`));
      return;
    }
  } catch (error) {
    p.outro(pc.red(`Failed to parse tool manifest: ${error instanceof Error ? error.message : 'Unknown error'}`));
    return;
  }

  // Get the API URL
  let apiUrl = options.url;
  
  if (!apiUrl) {
    const defaultUrl = await getDefaultUrl();
    
    if (defaultUrl) {
      const useDefault = await p.confirm({
        message: `Use default Enact registry (${defaultUrl})?`
      });
      
      if (useDefault === null) {
        p.outro(pc.yellow('Operation cancelled'));
        return;
      }
      
      if (useDefault) {
        apiUrl = defaultUrl;
      }
    }
    
    if (!apiUrl) {
      apiUrl = await p.text({
        message: 'Enter the Enact registry URL:',
        placeholder: 'https://api.enact.dev/functions/tools',
        validate: (value) => {
          if (!value) return 'URL is required';
          if (!value.startsWith('http')) return 'URL must start with http:// or https://';
          return undefined;
        }
      }) as string;
      
      if (apiUrl === null) {
        p.outro(pc.yellow('Operation cancelled'));
        return;
      }
      
      // Ask if this should be the default URL
      const saveAsDefault = await p.confirm({
        message: 'Save as default registry URL?'
      });
      
      if (saveAsDefault) {
        await setDefaultUrl(apiUrl);
        p.note('URL saved as default.', 'Config');
      }
    }
  }

  // Show tool information and confirm
  p.note(`Tool: ${pc.cyan(toolDefinition.name)}\nDescription: ${toolDefinition.description}\nCommand: ${pc.dim(toolDefinition.command)}`, 'Tool Details');
  
  const shouldPublish = await p.confirm({
    message: `Publish ${pc.cyan(toolDefinition.name)} to ${pc.green(apiUrl)}?`
  });
  
  if (!shouldPublish) {
    p.outro(pc.yellow('Publish cancelled'));
    return;
  }

  // Show a spinner during publish
  const spinner = p.spinner();
  spinner.start('Publishing tool to Enact registry');

  try {
    // Check if tool already exists (try to get it first)
    let isUpdate = false;
    try {
      const checkResponse = await fetch(`${apiUrl}/${encodeURIComponent(toolDefinition.name)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (checkResponse.ok) {
        isUpdate = true;
        spinner.message('Tool exists, updating...');
      }
    } catch (checkError) {
      // Tool doesn't exist, will create new
    }

    // Prepare the tool data according to Enact protocol
    const toolData = {
      ...toolDefinition,
      // Map Enact fields to API fields
      inputSchema: toolDefinition.inputSchema,
      outputSchema: toolDefinition.outputSchema,
      env: toolDefinition.env,
      // Add any missing protocol version
      enact: toolDefinition.enact || '1.0.0'
    };

    // Make the API call
    const method = isUpdate ? 'PUT' : 'POST';
    const url = isUpdate ? `${apiUrl}/${encodeURIComponent(toolDefinition.name)}` : apiUrl;
    
    spinner.message(`Publishing to URL: ${url} with method: ${method}`); 
    const publishResponse = await fetch(url, {
      method,
      headers: authHeaders,
      body: JSON.stringify(toolData)
    });

    if (!publishResponse.ok) {
      const errorData = await publishResponse.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
      
      if (publishResponse.status === 409) {
        throw new Error(`Tool '${toolDefinition.name}' already exists. Use a different name or update the existing tool.`);
      } else if (publishResponse.status === 400) {
        throw new Error(`Invalid tool definition: ${errorData.error || 'Bad request'}`);
      } else {
        throw new Error(`Publish failed (${publishResponse.status}): ${errorData.error || publishResponse.statusText}`);
      }
    }

    const result: any = await publishResponse.json();
    
    // Add to history
    await addToHistory(filePath);
    
    // Complete
    spinner.stop(`Tool ${isUpdate ? 'updated' : 'published'} successfully`);
    
    // Show success message
    let successMessage = `✓ ${pc.bold(toolDefinition.name)} ${isUpdate ? 'updated' : 'published'} to Enact registry`;
    if (result.tool?.id) {
      successMessage += `\n📄 Tool ID: ${pc.cyan(result.tool.id)}`;
    }
    if (result.tool?.name) {
      successMessage += `\n🔧 Tool Name: ${pc.blue(result.tool.name)}`;
    }
    successMessage += `\n🔍 Discoverable via: "enact search ${toolDefinition.tags?.join(' ') || toolDefinition.name}"`;
    
    p.outro(pc.green(successMessage));
    
  } catch (error) {
    spinner.stop('Failed to publish tool');
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('401') || error.message.includes('403')) {
        p.note('Authentication failed. Your token may have expired.', 'Error');
        p.note('Run "enact auth login" to re-authenticate.', 'Suggestion');
      } else if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
        p.note('Could not connect to the Enact registry. Check your internet connection and registry URL.', 'Error');
      } else {
        p.note(error.message, 'Error');
      }
    }
    
    p.outro(pc.red('Publish failed'));
  }
}

/**
 * Check if a file is an Enact manifest based on extension
 */
function isEnactFile(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase();
  return ext === '.yaml' || ext === '.yml';
}

/**
 * Validate that a file exists and is an Enact manifest
 */
function validateEnactFile(value: string): string | undefined {
  if (!value) return 'File path is required';
  if (!existsSync(value)) return 'File does not exist';
  if (!isEnactFile(value)) return 'File must be a YAML file (.yaml or .yml)';
  return undefined;
}

/**
 * Validate the Enact tool definition according to the protocol
 */
function validateToolDefinition(tool: any): string | undefined {
  if (!tool) return 'Tool definition is required';
  
  // Check required fields
  if (!tool.name || typeof tool.name !== 'string') {
    return 'Tool name is required and must be a string';
  }
  
  if (!tool.description || typeof tool.description !== 'string') {
    return 'Tool description is required and must be a string';
  }
  
  if (!tool.command || typeof tool.command !== 'string') {
    return 'Tool command is required and must be a string';
  }
  
  // Validate hierarchical name format
  if (!/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_\/-]+$/.test(tool.name)) {
    return 'Tool name must follow hierarchical format: org/category/tool-name';
  }
  
  // Validate timeout format if provided
  if (tool.timeout && typeof tool.timeout === 'string') {
    // Go duration format validation (basic)
    if (!/^\d+[smh]$/.test(tool.timeout)) {
      return 'Timeout must be in Go duration format (e.g., "30s", "5m", "1h")';
    }
  }
  
  // Validate tags if provided
  if (tool.tags && !Array.isArray(tool.tags)) {
    return 'Tags must be an array of strings';
  }
  
  // Validate schemas if provided
  if (tool.inputSchema && typeof tool.inputSchema !== 'object') {
    return 'inputSchema must be a valid JSON Schema object';
  }
  
  if (tool.outputSchema && typeof tool.outputSchema !== 'object') {
    return 'outputSchema must be a valid JSON Schema object';
  }
  
  return undefined;
}
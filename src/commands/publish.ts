// src/commands/publish.ts - Refactored to use the consolidated API client
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
import { enactApi, EnactApiError } from '../api/enact-api';
import { createEnactApiClient } from '../api/enact-api';
import { EnactToolDefinition } from '../api/types';

// Define the options interface
export interface PublishOptions {
  help?: boolean;
  url?: string;
  token?: string;
}

/**
 * Handle the publish command for Enact tools using the consolidated API client
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
  let token: string;
  try {
    if (options.token) {
      token = options.token;
    } else {
      const authHeaders = await getAuthHeaders();
      token = authHeaders['X-API-Key'];
    }
  } catch (error) {
    p.outro(pc.red(`✗ Authentication required. Run "enact auth login" to authenticate.`));
    return;
  }

  // Get the file to publish
  let filePath: string|null = args[0];
  
  if (!filePath) {
    filePath = await getFilePathInteractively();
    if (!filePath) {
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
    
    // Validate using the API client's validation
    const validation = enactApi.validateTool(toolDefinition);
    if (!validation.valid) {
      p.outro(pc.red(`Invalid tool manifest:\n${validation.errors.join('\n')}`));
      return;
    }
  } catch (error) {
    p.outro(pc.red(`Failed to parse tool manifest: ${error instanceof Error ? error.message : 'Unknown error'}`));
    return;
  }

  // Get the API URL (this is now handled by the API client, but we keep for compatibility)
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
    // Create API client with custom URL if provided
    const apiClient = apiUrl ? createEnactApiClient(apiUrl) : enactApi;
    p.note(`Using API URL: ${pc.cyan(apiClient.baseUrl)}`, 'API Client'); 
    // Use the consolidated API client to publish or update
    const result = await apiClient.publishOrUpdateTool(toolDefinition, token, 'cli');
    
    // Add to history
    await addToHistory(filePath);
    
    // Complete
    spinner.stop(`Tool ${result.isUpdate ? 'updated' : 'published'} successfully`);
    
    // Show success message
    let successMessage = `✓ ${pc.bold(toolDefinition.name)} ${result.isUpdate ? 'updated' : 'published'} to Enact registry`;
    if (result.result?.tool?.id) {
      successMessage += `\n📄 Tool ID: ${pc.cyan(result.result.tool.id)}`;
    }
    if (result.result?.tool?.name) {
      successMessage += `\n🔧 Tool Name: ${pc.blue(result.result.tool.name)}`;
    }
    successMessage += `\n🔍 Discoverable via: "enact search ${toolDefinition.tags?.join(' ') || toolDefinition.name}"`;
    
    p.outro(pc.green(successMessage));
    
  } catch (error: any) {
    spinner.stop('Failed to publish tool');
    
    // Handle specific error types using the API client's error handling
    if (error instanceof EnactApiError) {
      if (error.statusCode === 401 || error.statusCode === 403) {
        p.note('Authentication failed. Your token may have expired.', 'Error');
        p.note('Run "enact auth login" to re-authenticate.', 'Suggestion');
      } else if (error.statusCode === 409) {
        p.note(`Tool '${toolDefinition.name}' already exists and you don't have permission to update it.`, 'Error');
      } else if (error.statusCode === 400) {
        p.note(`Invalid tool definition: ${error.message}`, 'Error');
      } else {
        p.note(error.message, 'Error');
      }
    } else if (error instanceof Error) {
      if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
        p.note('Could not connect to the Enact registry. Check your internet connection and registry URL.', 'Error');
      } else {
        p.note(error.message, 'Error');
      }
    }
    
    p.outro(pc.red('Publish failed'));
  }
}

/**
 * Interactive file path selection
 */
async function getFilePathInteractively(): Promise<string | null> {
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
        return await p.select({
          message: 'Select a tool manifest:',
          options: fileOptions
        }) as string;
      } else {
        p.note('No recent Enact tool manifests found.', 'History');
        return await p.text({
          message: 'Enter the path to the tool manifest (.yaml or .yml):',
          validate: validateEnactFile
        }) as string;
      }
    } else {
      return await p.text({
        message: 'Enter the path to the tool manifest (.yaml or .yml):',
        validate: validateEnactFile
      }) as string;
    }
  } else {
    // No history, just ask for a file
    return await p.text({
      message: 'Enter the path to the tool manifest (.yaml or .yml):',
      validate: validateEnactFile
    }) as string;
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
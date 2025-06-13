// src/commands/user.ts - New command for user operations using consolidated API client
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { getAuthHeaders } from './auth';
import { enactApi, EnactApiError } from '../api/enact-api';
import { createEnactApiClient } from '../api/enact-api';
import { getDefaultUrl } from '../utils/config';

interface UserCommandOptions {
  help?: boolean;
  server?: string;
  token?: string;
  format?: string;
}

export async function handleUserCommand(args: string[], options: UserCommandOptions) {
  if (options.help) {
    showUserHelp();
    return;
  }

  const subcommand = args[0];

  switch (subcommand) {
    case 'public-key':
      await handlePublicKeyCommand(args.slice(1), options);
      break;
    default:
      if (!subcommand) {
        console.error(pc.red('Missing subcommand. Use --help for usage information.'));
      } else {
        console.error(pc.red(`Unknown subcommand: ${subcommand}`));
      }
      showUserHelp();
      process.exit(1);
  }
}

async function handlePublicKeyCommand(args: string[], options: UserCommandOptions) {
  // Start the interactive prompt
  p.intro(pc.bgBlue(pc.white(' Get User Public Key ')));

  // Check authentication first
  let token: string;
  try {
    if (options.token) {
      token = options.token;
    } else {
      const authHeaders = await getAuthHeaders();
      // token = authHeaders['X-API-Key'];
    }
  } catch (error) {
    p.outro(pc.red(`✗ Authentication required. Run "enact auth login" to authenticate.`));
    return;
  }

  let userId = args[0];
  
  // If no userId provided, prompt for it
  if (!userId) {
    userId = await p.text({
      message: 'Enter user ID:',
      placeholder: 'user-123',
      validate: (value) => {
        if (!value) return 'User ID is required';
        return;
      }
    }) as string;
    
    if (p.isCancel(userId)) {
      p.outro(pc.yellow('Operation cancelled'));
      return;
    }
  }

  // Get the API URL

  let apiUrl = options.server;
  if (!apiUrl) {
    const defaultUrl = await getDefaultUrl();
    console.log('defaultUrl', defaultUrl);
    if (defaultUrl) {
      // Use the default URL but adapt it for the user endpoint
    } else {
      apiUrl = 'https://api.enact.dev';
    }
  }

  const spinner = p.spinner();
  spinner.start('Fetching public key...');

  try {
    // Create API client with custom URL if provided
    const apiClient = apiUrl ? createEnactApiClient(apiUrl) : enactApi;
    
    // Use the API client to get user public key
    const data = await apiClient.getUserPublicKey(userId);
    
    spinner.stop('Public key retrieved successfully');

    // Format output based on format option
    if (options.format === 'json') {
      console.log(JSON.stringify(data, null, 2));
    } else if (options.format === 'raw' && data.publicKey) {
      console.log(data.publicKey);
    } else {
      // Default formatted output
      p.note(`User ID: ${pc.cyan(userId)}\nPublic Key: ${pc.yellow(data.publicKey || 'Not available')}\nKey Type: ${pc.blue(data.keyType || 'Unknown')}\nCreated: ${pc.gray(data.createdAt ? new Date(data.createdAt).toLocaleString() : 'Unknown')}`, 'Public Key Information');
    }

    p.outro(pc.green('✓ Public key retrieved successfully'));

  } catch (error: any) {
    spinner.stop('Failed to fetch public key'+error);
    
    // Handle specific error types using the API client's error handling
    if (error instanceof EnactApiError) {
      if (error.statusCode === 401 || error.statusCode === 403) {
        p.note('Authentication failed. Your token may have expired.', 'Error');
        p.note('Run "enact auth login" to re-authenticate.', 'Suggestion');
      } else if (error.statusCode === 404) {
        p.note(`User '${userId}' not found or no public key available.`, 'Error');
      } else if (error.statusCode === 400) {
        p.note(`Invalid user ID: ${error.message}`, 'Error');
      } else {
        p.note(error.message, 'Error');
      }
    } else if (error instanceof Error) {
      if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
        p.note('Could not connect to the Enact API. Check your internet connection and server URL.', 'Error');
      } else {
        p.note(error.message, 'Error');
      }
    }
    
    p.outro(pc.red('Failed to fetch public key'));
  }
}

function showUserHelp() {
  console.log(`
${pc.bold('USAGE')}
  enact user <subcommand> [options]

${pc.bold('SUBCOMMANDS')}
  public-key [userId]    Get a user's public key

${pc.bold('OPTIONS')}
  -h, --help            Show help information
  -s, --server <url>    API server URL (default: https://api.enact.dev)
  -t, --token <token>   Authentication token
  -f, --format <format> Output format (json|raw|default)

${pc.bold('EXAMPLES')}
  enact user public-key user-123
  enact user public-key --format json
  enact user public-key user-456 --token your-token
`);
}

// Equivalent curl command function for reference
export function generateCurlCommand(userId: string, options: UserCommandOptions): string {
  const baseUrl = options.server || 'https://api.enact.dev';
  const url = `${baseUrl}/tools/user/public-key/${userId}`;
  
  let curlCmd = `curl -X GET "${url}" \\\n  -H "Accept: application/json"`;
  
  if (options.token) {
    curlCmd += ` \\\n  -H "Authorization: Bearer ${options.token}"`;
  }
  
  return curlCmd;
}
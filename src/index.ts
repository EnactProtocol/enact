// src/index.ts - Updated with user command integration and core library support
import { parseArgs } from 'util';
import pc from 'picocolors';
import * as p from '@clack/prompts';
import { handlePublishCommand } from './commands/publish';
import { handleAuthCommand } from './commands/auth';
import { showHelp, showVersion } from './utils/help';
import { handleRemoteCommand } from './commands/remote';
import { handleInitCommand } from './commands/init';
import { handleSearchCommand } from './commands/search';
import { handleUserCommand } from './commands/user';
import { handleExecCommand } from './commands/exec';
import { handleSignCommand } from './commands/sign';
import { handleEnvCommand } from './commands/env';

// Import core-based handlers
import { 
  handleCoreSearchCommand, 
  handleCoreExecCommand, 
  handleCoreGetCommand,
  handleCoreVerifyCommand 
} from './commands/core';

// Parse arguments using process.argv (portable)
const { values, positionals } = parseArgs({
  args: process.argv,
  options: {
    help: {
      type: 'boolean',
      short: 'h',
    },
    version: {
      type: 'boolean',
      short: 'v',
    },
    url: {
      type: 'string',
    },
    server: {
      type: 'string',
      short: 's',
    },
    port: {
      type: 'string',
      short: 'p',
    },
    token: {
      type: 'string',
      short: 't',
    },
    minimal: {
      type: 'boolean',
      short: 'm',
    },
    limit: {
      type: 'string',
      short: 'l',
    },
    tags: {
      type: 'string',
    },
    format: {
      type: 'string',
      short: 'f',
    },
    json: {
      type: 'boolean',
    },
    author: {
      type: 'string',
      short: 'a',
    },
    input: {
      type: 'string',
      short: 'i',
    },
    params: {
      type: 'string',
    },
    dry: {
      type: 'boolean',
    },
    verbose: {
      type: 'boolean',
      short: 'v',
    },
    policy: {
      type: 'string',
    },
    'private-key': {
      type: 'string',
    },
    role: {
      type: 'string',
    },
    signer: {
      type: 'string',
    },
    // Core library options
    'use-core': {
      type: 'boolean',
    },
    'skip-verification': {
      type: 'boolean',
    },
    force: {
      type: 'boolean',
    },
    timeout: {
      type: 'string',
    },
    // Environment variable options
    global: {
      type: 'boolean',
    },
    project: {
      type: 'boolean',
    },
    encrypt: {
      type: 'boolean',
    },
    show: {
      type: 'boolean',
    }
  },
  allowPositionals: true,
  strict: false,
});

// Extract command and args
const command = positionals[2]; // First arg after 'node index.js' or binary name
const commandArgs = positionals.slice(3);

// Handle global flags
if (values.version) {
  showVersion();
  process.exit(0);
}

if (values.help && !command) {
  showHelp();
  process.exit(0);
}

// Main function
async function main() {
  try {
    // Route to the appropriate command
    switch (command) {
      case 'auth':
        await handleAuthCommand(commandArgs, {
          help: values.help as boolean | undefined,
          server: values.server as string | undefined,
          port: values.port ? parseInt(values.port as string) : undefined
        });
        break;
        
      case 'publish':
        await handlePublishCommand(commandArgs, {
          help: values.help as boolean | undefined,
          url: values.url as string | undefined,
          token: values.token as string | undefined
        });
        break;
        
      case 'search':
        // Use core library if --use-core flag is set or as default
        if (values['use-core'] !== false) {
          await handleCoreSearchCommand(commandArgs, {
            help: values.help as boolean | undefined,
            limit: values.limit ? parseInt(values.limit as string) : undefined,
            tags: values.tags ? (values.tags+"").split(',').map(t => t.trim()) : undefined,
            format: values.json ? 'json' : (values.format as string | undefined),
            author: values.author as string | undefined
          });
        } else {
          await handleSearchCommand(commandArgs, {
            help: values.help as boolean | undefined,
            limit: values.limit ? parseInt(values.limit as string) : undefined,
            tags: values.tags ? (values.tags+"").split(',').map(t => t.trim()) : undefined,
            format: values.json ? 'json' : (values.format as string | undefined),
            author: values.author as string | undefined
          });
        }
        break;
        
      case 'remote':
        await handleRemoteCommand(commandArgs, {
          help: values.help as boolean | undefined
        });
        break;
        
      case 'init':
        await handleInitCommand(commandArgs, {
          help: values.help as boolean | undefined,
          minimal: values.minimal as boolean | undefined
        });
        break;
        
      case 'user': // New case for user command
        await handleUserCommand(commandArgs, {
          help: values.help as boolean | undefined,
          server: values.server as string | undefined,
          token: values.token as string | undefined,
          format: values.format as string | undefined
        });
        break;
        
      case 'exec': // New case for exec command
        // Use core library if --use-core flag is set or as default
        if (values['use-core'] !== false) {
          await handleCoreExecCommand(commandArgs, {
            help: values.help as boolean | undefined,
            input: values.input as string | undefined,
            params: values.params as string | undefined,
            timeout: values.timeout as string | undefined,
            dry: values.dry as boolean | undefined,
            verbose: values.verbose as boolean | undefined,
            verifyPolicy: values.policy as ('permissive' | 'enterprise' | 'paranoid') | undefined,
            skipVerification: values['skip-verification'] as boolean | undefined,
            force: values.force as boolean | undefined
          });
        } else {
          await handleExecCommand(commandArgs, {
            help: values.help as boolean | undefined,
            input: values.input as string | undefined,
            params: values.params as string | undefined,
            timeout: values.timeout as string | undefined,
            dry: values.dry as boolean | undefined,
            verbose: values.verbose as boolean | undefined
          });
        }
        break;
        
      case 'sign': // New case for sign command
        await handleSignCommand(commandArgs, {
          help: values.help as boolean | undefined,
          policy: values.policy as string | undefined,
          privateKey: values['private-key'] as string | undefined,
          role: values.role as string | undefined,
          signer: values.signer as string | undefined,
          verbose: values.verbose as boolean | undefined
        });
        break;
        
      case 'get': // New case for get command (core library only)
        await handleCoreGetCommand(commandArgs, {
          help: values.help as boolean | undefined,
          format: values.format as string | undefined
        });
        break;
        
      case 'verify': // New case for verify command (core library only)
        await handleCoreVerifyCommand(commandArgs, {
          help: values.help as boolean | undefined,
          policy: values.policy as string | undefined,
          verbose: values.verbose as boolean | undefined
        });
        break;
        
      case 'env': // New case for env command
        await handleEnvCommand(commandArgs, {
          help: values.help as boolean | undefined,
          global: values.global as boolean | undefined,
          project: values.project as boolean | undefined,
          encrypt: values.encrypt as boolean | undefined,
          format: values.format as string | undefined,
          show: values.show as boolean | undefined
        });
        break;
        
      case undefined:
        // No command specified, show interactive mode
        if (values.help) {
          showHelp();
        } else {
          p.intro(pc.bgCyan(pc.black(' Enact CLI ')));
          
          const action = await p.select({
            message: 'What would you like to do?',
            options: [
              { value: 'search', label: '🔍 Search for tools' },
              { value: 'get', label: '📋 Get tool information' },
              { value: 'exec', label: '⚡ Execute a tool' },
              { value: 'verify', label: '🔒 Verify tool signatures' },
              { value: 'publish', label: '📤 Publish a tool' },
              { value: 'init', label: '📝 Create a new tool definition' },
              { value: 'sign', label: '✍️ Sign & verify tools' },
              { value: 'env', label: '🌍 Manage environment variables' },
              { value: 'auth', label: '🔐 Manage authentication' },
              { value: 'remote', label: '🌐 Manage remote servers' },
              { value: 'user', label: '👤 User operations' }, // New option
              { value: 'help', label: '❓ Show help' },
              { value: 'exit', label: '👋 Exit' }
            ]
          });
          
          if (action === null || action === 'exit') {
            p.outro('Goodbye!');
            return;
          }
          
          if (action === 'help') {
            showHelp();
            return;
          }
          
          if (action === 'search') {
            await handleCoreSearchCommand([], {});
            return;
          }
          
          if (action === 'get') {
            await handleCoreGetCommand([], {});
            return;
          }
          
          if (action === 'exec') {
            await handleCoreExecCommand([], {});
            return;
          }
          
          if (action === 'verify') {
            await handleCoreVerifyCommand([], {});
            return;
          }
          
          if (action === 'sign') {
            await handleSignCommand([], {});
            return;
          }
          
          if (action === 'env') {
            // Show env submenu
            const envAction = await p.select({
              message: 'Environment variables:',
              options: [
                { value: 'set', label: '➕ Set variable' },
                { value: 'get', label: '📋 Get variable' },
                { value: 'list', label: '📝 List all variables' },
                { value: 'delete', label: '🗑️ Delete variable' },
                { value: 'copy', label: '📋 Copy between scopes' },
                { value: 'export', label: '📤 Export variables' },
                { value: 'clear', label: '🧹 Clear all variables' }
              ]
            });
            
            if (envAction !== null) {
              await handleEnvCommand([envAction as string], {});
            }
            return;
          }
          
          if (action === 'auth') {
            // Show auth submenu
            const authAction = await p.select({
              message: 'Authentication:',
              options: [
                { value: 'login', label: '🔑 Login (OAuth)' },
                { value: 'status', label: '📊 Check auth status' },
                { value: 'logout', label: '🚪 Logout' },
                { value: 'token', label: '🔐 Show token' }
              ]
            });
            
            if (authAction !== null) {
              await handleAuthCommand([authAction as string], {});
            }
            return;
          }
          
          if (action === 'publish') {
            await handlePublishCommand([], {});
            return;
          }
          
          if (action === 'init') {
            await handleInitCommand([], {});
            return;
          }
          
          if (action === 'remote') {
            // Show remote submenu
            const remoteAction = await p.select({
              message: 'Remote management:',
              options: [
                { value: 'add', label: '➕ Add remote server' },
                { value: 'list', label: '📋 List remote servers' },
                { value: 'remove', label: '🗑️ Remove remote server' }
              ]
            });
            
            if (remoteAction !== null) {
              await handleRemoteCommand([remoteAction as string], {});
            }
            return;
          }
          
          if (action === 'user') {
            // Show user submenu
            const userAction = await p.select({
              message: 'User operations:',
              options: [
                { value: 'public-key', label: '🔑 Get user public key' }
              ]
            });
            
            if (userAction !== null) {
              await handleUserCommand([userAction as string], {});
            }
            return;
          }
        }
        break;
        
      default:
        console.error(pc.red(`Unknown command: ${command}`));
        showHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error(pc.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  }
}

// Run the CLI
main();
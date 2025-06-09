// src/index.ts
import { parseArgs } from 'util';
import pc from 'picocolors';
import * as p from '@clack/prompts';
import { handlePublishCommand } from './commands/publish';
import { handleAuthCommand } from './commands/auth';
import { showHelp, showVersion } from './utils/help';
import { handleRemoteCommand } from './commands/remote';
import { handleInitCommand } from './commands/init';

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
        
      case undefined:
        // No command specified, show interactive mode
        if (values.help) {
          showHelp();
        } else {
          p.intro(pc.bgCyan(pc.black(' Enact CLI ')));
          
          const action = await p.select({
            message: 'What would you like to do?',
            options: [
              { value: 'auth', label: 'Manage authentication' },
              { value: 'publish', label: 'Publish a document' },
              { value: 'init', label: 'Create a new tool definition' },
              { value: 'remote', label: 'Manage remote servers' },
              { value: 'help', label: 'Show help' },
              { value: 'exit', label: 'Exit' }
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
          
          if (action === 'auth') {
            // Show auth submenu
            const authAction = await p.select({
              message: 'Authentication:',
              options: [
                { value: 'login', label: 'Login (OAuth)' },
                { value: 'status', label: 'Check auth status' },
                { value: 'logout', label: 'Logout' },
                { value: 'token', label: 'Show token' }
              ]
            });
            
            if (authAction !== null) {
              await handleAuthCommand([authAction as string], {});
            }
            return;
          }
          
          if (action === 'publish') {
            await handlePublishCommand([], {});
          }
          
          if (action === 'init') {
            await handleInitCommand([], {});
          }
          
          if (action === 'remote') {
            // Show remote submenu
            const remoteAction = await p.select({
              message: 'Remote management:',
              options: [
                { value: 'add', label: 'Add remote server' },
                { value: 'list', label: 'List remote servers' },
                { value: 'remove', label: 'Remove remote server' }
              ]
            });
            
            if (remoteAction !== null) {
              await handleRemoteCommand([remoteAction as string], {});
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
#!/usr/bin/env bun
// src/index.ts
import { parseArgs } from 'util';
import pc from 'picocolors';
import * as p from '@clack/prompts';
import { handlePublishCommand } from './commands/publish';
import { showHelp, showVersion } from './utils/help';
import { handleRemoteCommand } from './commands/remote';

// Parse arguments
const { values, positionals } = parseArgs({
  args: Bun.argv,
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
    }
  },
  allowPositionals: true,
  strict: false,
});

// Extract command and args
const command = positionals[2]; // First arg after 'bun index.ts'
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
      case 'publish':
        await handlePublishCommand(commandArgs, {
          help: values.help as boolean | undefined,
          url: values.url as string | undefined
        });
        break;
      case 'remote':
        // Handle remote command (not implemented in this snippet)
        await handleRemoteCommand(commandArgs, {
          help: values.help as boolean | undefined
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
              { value: 'publish', label: 'Publish a document' },
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
          
          if (action === 'publish') {
            await handlePublishCommand([], {});
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
// src/commands/remote.ts
import { intro, outro, text, select, confirm, spinner, note } from '@clack/prompts';
import pc from 'picocolors';
import { existsSync } from 'fs';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

interface RemoteOptions {
  help?: boolean;
}

// Configuration file setup
const CONFIG_DIR = join(homedir(), '.enact');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

export async function handleRemoteCommand(args: string[], options: RemoteOptions): Promise<void> {
  if (options.help || !args[0]) {
    console.error(`
Usage: enact remote <subcommand> [options]

Manages remote server configurations for publishing enact documents.

Subcommands:
  add <name> <url>    Adds a new remote server.
  remove <name>       Removes an existing remote server.
  list                Lists all configured remote servers.
  ls                  Alias for list.

Options:
  --help, -h          Show this help message
`);
    return;
  }

  const subCommand = args[0];
  const subCommandArgs = args.slice(1);

  // Initialize config if it doesn't exist
  await ensureConfig();

  intro(pc.bgMagenta(pc.black(' Remote Server Management ')));

  switch (subCommand) {
    case 'add': {
      // Interactive mode if arguments are missing
      let name = subCommandArgs[0];
      let url = subCommandArgs[1];
      
      if (!name) {
        name = await text({
          message: 'Remote name:',
          placeholder: 'production',
          validate(value) {
            if (!value) return 'Name is required';
          }
        }) as string;
        
        if (name === null) {
          outro(pc.yellow('Operation cancelled'));
          return;
        }
      }
      
      if (!url) {
        url = await text({
          message: 'Remote URL:',
          placeholder: 'https://api.example.com/publish',
          validate(value) {
            if (!value) return 'URL is required';
            if (!value.startsWith('http')) return 'URL must start with http:// or https://';
          }
        }) as string;
        
        if (url === null) {
          outro(pc.yellow('Operation cancelled'));
          return;
        }
      }

      const config = await readConfig();
      
      // Check if remote already exists
      if (config.remotes[name]) {
        const overwrite = await confirm({
          message: `Remote "${name}" already exists. Overwrite?`
        });
        
        if (!overwrite) {
          outro(pc.yellow('Operation cancelled'));
          return;
        }
      }
      
      // Save the remote
      const s = spinner();
      s.start(`Adding remote "${name}"`);
      
      config.remotes[name] = { url };
      await writeConfig(config);
      
      s.stop(`Remote "${name}" added`);
      outro(pc.green(`✓ Remote ${pc.bold(name)} configured with URL ${pc.bold(url)}`));
      break;
    }
    
    case 'remove': {
      let name = subCommandArgs[0];
      const config = await readConfig();
      
      // Interactive mode if no name provided
      if (!name) {
        if (Object.keys(config.remotes).length === 0) {
          note('No remotes configured yet', 'Info');
          outro('');
          return;
        }
        
        name = await select({
          message: 'Select remote to remove:',
          options: Object.keys(config.remotes).map(remoteName => ({
            value: remoteName,
            label: `${remoteName} (${config.remotes[remoteName].url})`
          }))
        }) as string;
        
        if (name === null) {
          outro(pc.yellow('Operation cancelled'));
          return;
        }
      }
      
      // Check if remote exists
      if (!config.remotes[name]) {
        outro(pc.red(`✗ Remote "${name}" does not exist`));
        return;
      }
      
      // Confirm removal
      const shouldRemove = await confirm({
        message: `Are you sure you want to remove remote "${name}"?`
      });
      
      if (!shouldRemove) {
        outro(pc.yellow('Operation cancelled'));
        return;
      }
      
      // Remove the remote
      const s = spinner();
      s.start(`Removing remote "${name}"`);
      
      delete config.remotes[name];
      await writeConfig(config);
      
      s.stop(`Remote "${name}" removed`);
      outro(pc.green(`✓ Remote ${pc.bold(name)} has been removed`));
      break;
    }
    
    case 'list':
    case 'ls': {
      const config = await readConfig();
      const remotes = Object.entries(config.remotes);
      
      if (remotes.length === 0) {
        note('No remotes configured yet', 'Info');
        outro('');
        return;
      }
      
      note(
        remotes.map(([name, data]) => 
          `${pc.bold(name)}: ${(data as { url: string }).url}`
        ).join('\n'),
        'Configured Remotes'
      );
      
      outro('');
      break;
    }
    
    default:
      outro(pc.red(`✗ Unknown remote subcommand "${subCommand}"`));
      return;
  }
}

// Helper functions for config management (now using Node.js fs instead of Bun)
async function ensureConfig() {
  // Create config directory if it doesn't exist
  if (!existsSync(CONFIG_DIR)) {
    await mkdir(CONFIG_DIR, { recursive: true });
  }
  
  // Create default config if it doesn't exist
  if (!existsSync(CONFIG_FILE)) {
    await writeConfig({ remotes: {} });
  }
}

async function readConfig() {
  try {
    const text = await readFile(CONFIG_FILE, 'utf8');
    return JSON.parse(text);
  } catch (e) {
    return { remotes: {} };
  }
}

async function writeConfig(config: { remotes: Record<string, { url: string }> }): Promise<void> {
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
}
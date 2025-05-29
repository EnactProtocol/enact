// src/commands/publish.ts
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { basename } from 'path';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { showPublishHelp } from '../utils/help';
import { 
  addToHistory, 
  getHistory, 
  getDefaultUrl, 
  setDefaultUrl 
} from '../utils/config';

// Define the options interface
export interface PublishOptions {
  help?: boolean;
  url?: string;
}

/**
 * Handle the publish command
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
  p.intro(pc.bgBlue(pc.white(' Publish Document ')));

  // Get the file to publish
  let filePath = args[0];
  
  if (!filePath) {
    // No file provided, show interactive prompt
    const history = await getHistory();
    
    if (history.length > 0) {
      // User has publish history, offer to reuse
      const action = await p.select({
        message: 'Select a file to publish:',
        options: [
          { value: 'select', label: 'Choose from recent files' },
          { value: 'new', label: 'Specify a new file' }
        ]
      });
      
      if (action === 'select') {
        const fileOptions = history
          .filter(file => existsSync(file))
          .map(file => ({
            value: file,
            label: file
          }));
        
        if (fileOptions.length > 0) {
          filePath = await p.select({
            message: 'Select a file:',
            options: fileOptions
          }) as string;
        } else {
          p.note('No recent files found.', 'History');
          filePath = await p.text({
            message: 'Enter the path to the file:',
            validate: validateFile
          }) as string;
        }
      } else {
        filePath = await p.text({
          message: 'Enter the path to the file:',
          validate: validateFile
        }) as string;
      }
    } else {
      // No history, just ask for a file
      filePath = await p.text({
        message: 'Enter the path to the file:',
        validate: validateFile
      }) as string;
    }
    
    if (filePath === null) {
      p.outro(pc.yellow('Operation cancelled'));
      return;
    }
  } else {
    // Validate the provided file
    if (!existsSync(filePath)) {
      p.outro(pc.red(`Error: File not found: ${filePath}`));
      return;
    }
  }

  // Get the URL to publish to
  let url = options.url;
  
  if (!url) {
    const defaultUrl = await getDefaultUrl();
    
    if (defaultUrl) {
      const useDefault = await p.confirm({
        message: `Use default URL (${defaultUrl})?`
      });
      
      if (useDefault === null) {
        p.outro(pc.yellow('Operation cancelled'));
        return;
      }
      
      if (useDefault) {
        url = defaultUrl;
      }
    }
    
    if (!url) {
      url = await p.text({
        message: 'Enter the server URL:',
        placeholder: 'https://example.com/api',
        validate: (value) => {
          if (!value) return 'URL is required';
          if (!value.startsWith('http')) return 'URL must start with http:// or https://';
          return undefined;
        }
      }) as string;
      
      if (url === null) {
        p.outro(pc.yellow('Operation cancelled'));
        return;
      }
      
      // Ask if this should be the default URL
      const saveAsDefault = await p.confirm({
        message: 'Save as default URL?'
      });
      
      if (saveAsDefault) {
        await setDefaultUrl(url);
        p.note('URL saved as default.', 'Config');
      }
    }
  }

  // Confirm the publish action
  const shouldPublish = await p.confirm({
    message: `Publish ${pc.cyan(basename(filePath))} to ${pc.green(url)}?`
  });
  
  if (!shouldPublish) {
    p.outro(pc.yellow('Publish cancelled'));
    return;
  }

  // Show a spinner during publish
  const spinner = p.spinner();
  spinner.start('Publishing document');

  try {
    // Read the file content
    const content = await readFile(filePath, 'utf8');
    
    // Simulate publishing (in a real app, this would be an API call)
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Add to history
    await addToHistory(filePath);
    
    // Complete
    spinner.stop('Document published successfully');
    p.outro(pc.green(`✓ ${pc.bold(basename(filePath))} published to ${pc.bold(url)}`));
  } catch (error) {
    spinner.stop('Failed to publish document');
    p.note((error as Error).message, 'Error');
    p.outro(pc.red('Publish failed'));
  }
}

/**
 * Validate that a file exists
 */
function validateFile(value: string): string | undefined {
  if (!value) return 'File path is required';
  if (!existsSync(value)) return 'File does not exist';
  return undefined;
}

// Processed command: npx -y https://github.com/piuccio/cowsay/tree/eef317a302d025e3f31787566727c49eaee43648 ''hello there''
// Processed command: npx -y https://github.com/piuccio/cowsay/tree/eef317a302d025e3f31787566727c49eaee43648 ''hello there''
// Processed command: npx -y https://github.com/piuccio/cowsay/tree/eef317a302d025e3f31787566727c49eaee43648 ''hello there''


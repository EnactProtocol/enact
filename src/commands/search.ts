// src/commands/search.ts - New search command using the consolidated API client
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { enactApi, EnactApiError } from '../api/enact-api';
import { EnactToolDefinition } from '../api/types';

export interface SearchOptions {
  help?: boolean;
  limit?: number;
  tags?: string[];
  format?: string;
  author?: string;
}

/**
 * Handle the search command for finding Enact tools
 */
export async function handleSearchCommand(
  args: string[], 
  options: SearchOptions
): Promise<void> {
  if (options.help) {
    console.log(`
Usage: enact search [query] [options]

Search for Enact tools in the registry.

Arguments:
  query               Search query (keywords, tool names, descriptions)

Options:
  --help, -h          Show this help message
  --limit <number>    Maximum number of results (default: 20)
  --tags <tags>       Filter by tags (comma-separated)
  --format <format>   Output format: table, json, list (default: table)
  --author <author>   Filter by author

Examples:
  enact search "text processing"
  enact search formatter --tags cli,text
  enact search --author myorg
  enact search prettier --limit 5 --format json
`);
    return;
  }

  // Start the interactive prompt if no query provided
  if (args.length === 0 && !options.author) {
    p.intro(pc.bgGreen(pc.white(' Search Enact Tools ')));
  }

  // Get search query
  let query = args.join(' ');
  
  if (!query && !options.author) {
    const queryResponse = await p.text({
      message: 'What are you looking for?',
      placeholder: 'Enter keywords, tool names, or descriptions...',
      validate: (value) => {
        if (!value.trim()) return 'Please enter a search query';
        return undefined;
      }
    });
    
    if (queryResponse === null) {
      p.outro(pc.yellow('Search cancelled'));
      return;
    }
    
    query = queryResponse as string;
  }

  // Interactive options if not provided
  let limit = options.limit;
  let tags = options.tags;
  let format = options.format || 'table';
  let author = options.author;

  if (args.length === 0 && !options.author) {
    // Ask for additional filters
    const addFilters = await p.confirm({
      message: 'Add additional filters?',
      initialValue: false
    });

    if (addFilters) {
      const tagsInput = await p.text({
        message: 'Filter by tags (comma-separated, optional):',
        placeholder: 'cli, text, formatter'
      }) as string;

      if (tagsInput) {
        tags = tagsInput.split(',').map(t => t.trim()).filter(t => t);
      }

      const authorInput = await p.text({
        message: 'Filter by author (optional):',
        placeholder: 'myorg, username'
      }) as string;

      if (authorInput) {
        author = authorInput;
      }

      limit = await p.text({
        message: 'Maximum results:',
        placeholder: '20',
        initialValue: '20',
        validate: (value) => {
          const num = parseInt(value);
          if (isNaN(num) || num < 1 || num > 100) {
            return 'Please enter a number between 1 and 100';
          }
          return undefined;
        }
      }).then(val => parseInt(val as string));

      format = await p.select({
        message: 'Output format:',
        options: [
          { value: 'table', label: 'Table (default)' },
          { value: 'list', label: 'Simple list' },
          { value: 'json', label: 'JSON output' }
        ]
      }) as string;
    }
  }

  // Show a spinner during search
  const spinner = p.spinner();
  spinner.start('Searching tools...');

  try {
    let results: EnactToolDefinition[];

    if (author && !query) {
      // Author-only search
      results = await enactApi.getToolsByAuthor(author, limit || 20);
    } else if (query) {
      // Text/semantic search
      results = await enactApi.searchTools({
        query,
        limit: limit || 20,
        tags,
        format
      });
    } else {
      // Get all tools with filters
      results = await enactApi.getTools({
        limit: limit || 20,
        tags,
        author
      });
    }

    spinner.stop(`Found ${results.length} tool${results.length === 1 ? '' : 's'}`);

    if (results.length === 0) {
      p.note('No tools found matching your criteria.', 'No Results');
      p.note('Try:\n• Broader keywords\n• Removing filters\n• Different spelling', 'Suggestions');
      p.outro('');
      return;
    }

    // Display results based on format
    if (format === 'json') {
      console.log(JSON.stringify(results, null, 2));
    } else if (format === 'list') {
      displayResultsList(results);
    } else {
      displayResultsTable(results);
    }

    // Interactive tool selection for detailed view
    if (args.length === 0 && !options.author && results.length > 1) {
      const viewDetail = await p.confirm({
        message: 'View details for a specific tool?',
        initialValue: false
      });

      if (viewDetail) {
        const selectedTool = await p.select({
          message: 'Select a tool to view details:',
          options: results.map(tool => ({
            value: tool.name,
            label: `${tool.name} - ${tool.description.substring(0, 60)}${tool.description.length > 60 ? '...' : ''}`
          }))
        }) as string;

        if (selectedTool) {
          await showToolDetails(selectedTool);
        }
      }
    }

    if (args.length === 0 && !options.author) {
      p.outro(pc.green('Search completed'));
    }

  } catch (error: any) {
    spinner.stop('Search failed');
    
    if (error instanceof EnactApiError) {
      p.note(error.message, 'Error');
    } else if (error instanceof Error) {
      if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
        p.note('Could not connect to the Enact registry. Check your internet connection.', 'Error');
      } else {
        p.note(error.message, 'Error');
      }
    }
    
    if (args.length === 0 && !options.author) {
      p.outro(pc.red('Search failed'));
    } else {
      console.error(pc.red(`Search failed: ${(error as Error).message}`));
    }
  }
}

/**
 * Display results in a formatted table
 */
function displayResultsTable(results: EnactToolDefinition[]): void {
  console.log('\n' + pc.bold('Search Results:'));
  console.log('═'.repeat(100));
  
  // Header
  const nameWidth = 25;
  const descWidth = 50;
  const tagsWidth = 20;
  
  console.log(
    pc.bold(pc.cyan('NAME'.padEnd(nameWidth))) + ' │ ' +
    pc.bold(pc.cyan('DESCRIPTION'.padEnd(descWidth))) + ' │ ' +
    pc.bold(pc.cyan('TAGS'.padEnd(tagsWidth)))
  );
  console.log('─'.repeat(nameWidth) + '─┼─' + '─'.repeat(descWidth) + '─┼─' + '─'.repeat(tagsWidth));
  
  // Rows
  results.forEach(tool => {
    const name = tool.name.length > nameWidth ? tool.name.substring(0, nameWidth - 3) + '...' : tool.name.padEnd(nameWidth);
    const desc = tool.description.length > descWidth ? tool.description.substring(0, descWidth - 3) + '...' : tool.description.padEnd(descWidth);
    const tags = (tool.tags || []).join(', ');
    const tagsDisplay = tags.length > tagsWidth ? tags.substring(0, tagsWidth - 3) + '...' : tags.padEnd(tagsWidth);
    
    console.log(
      pc.green(name) + ' │ ' +
      pc.dim(desc) + ' │ ' +
      pc.yellow(tagsDisplay)
    );
  });
  
  console.log('═'.repeat(100));
  console.log(pc.dim(`Total: ${results.length} tool${results.length === 1 ? '' : 's'}`));
}

/**
 * Display results in a simple list format
 */
function displayResultsList(results: EnactToolDefinition[]): void {
  console.log('\n' + pc.bold('Search Results:'));
  console.log('');
  
  results.forEach((tool, index) => {
    console.log(`${pc.cyan(`${index + 1}.`)} ${pc.bold(pc.green(tool.name))}`);
    console.log(`   ${pc.dim(tool.description)}`);
    if (tool.tags && tool.tags.length > 0) {
      console.log(`   ${pc.yellow('Tags:')} ${tool.tags.join(', ')}`);
    }
    console.log('');
  });
  
  console.log(pc.dim(`Total: ${results.length} tool${results.length === 1 ? '' : 's'}`));
}

/**
 * Show detailed information for a specific tool
 */
async function showToolDetails(toolName: string): Promise<void> {
  const spinner = p.spinner();
  spinner.start(`Loading details for ${toolName}...`);

  try {
    const tool = await enactApi.getTool(toolName);
    const usage = await enactApi.getToolUsage(toolName);
    
    spinner.stop('Tool details loaded');

    console.log('\n' + pc.bold(pc.bgBlue(pc.white(` ${tool.name} `))));
    console.log('');
    console.log(pc.bold('Description:'));
    console.log(tool.description);
    console.log('');
    
    console.log(pc.bold('Command:'));
    console.log(pc.cyan(tool.command));
    console.log('');
    
    if (tool.tags && tool.tags.length > 0) {
      console.log(pc.bold('Tags:'));
      console.log(tool.tags.map((tag: string) => pc.yellow(tag)).join(', '));
      console.log('');
    }
    
    if (tool.timeout) {
      console.log(pc.bold('Timeout:'));
      console.log(tool.timeout);
      console.log('');
    }
    
    if (tool.inputSchema) {
      console.log(pc.bold('Input Schema:'));
      console.log(JSON.stringify(tool.inputSchema, null, 2));
      console.log('');
    }
    
    if (tool.examples && tool.examples.length > 0) {
      console.log(pc.bold('Examples:'));
      tool.examples.forEach((example: any, index: any) => {
        console.log(pc.cyan(`Example ${index + 1}:`));
        if (example.description) {
          console.log(`  Description: ${example.description}`);
        }
        console.log(`  Input: ${JSON.stringify(example.input)}`);
        if (example.output) {
          console.log(`  Output: ${example.output}`);
        }
        console.log('');
      });
    }
    
    if (tool.env && Object.keys(tool.env).length > 0) {
      console.log(pc.bold('Environment Variables:'));
      Object.entries(tool.env).forEach(([key, config]: any) => {
        console.log(`  ${pc.yellow(key)}: ${config.description}`);
        if (config.required) {
          console.log(`    Required: ${pc.red('Yes')}`);
        } else {
          console.log(`    Required: ${pc.green('No')}`);
          if (config.default) {
            console.log(`    Default: ${config.default}`);
          }
        }
      });
      console.log('');
    }
    
    if (usage) {
      console.log(pc.bold('Usage Statistics:'));
      console.log(`  Views: ${usage.views || 0}`);
      console.log(`  Downloads: ${usage.downloads || 0}`);
      console.log(`  Executions: ${usage.executions || 0}`);
      console.log('');
    }

  } catch (error) {
    spinner.stop('Failed to load tool details');
    p.note(`Failed to load details: ${(error as Error).message}`, 'Error');
  }
}

/**
 * Search for tools and register the first result (for enact-search-and-register-tools integration)
 */
export async function searchAndRegisterTool(query: string): Promise<EnactToolDefinition | null> {
  try {
    const results = await enactApi.searchTools({
      query,
      limit: 1
    });

    if (results.length > 0) {
      return results[0];
    }
    
    return null;
  } catch (error) {
    console.error(`Failed to search and register tool: ${(error as Error).message}`);
    return null;
  }
}
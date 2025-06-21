// src/commands/core.ts - Core-based command handlers
import { EnactCore } from '../core/EnactCore';
import type { ToolSearchOptions, ToolExecuteOptions } from '../core/EnactCore';
import pc from 'picocolors';
import * as p from '@clack/prompts';
import { resolveToolEnvironmentVariables, validateRequiredEnvironmentVariables } from '../utils/env-loader';

// Create core instance
const core = new EnactCore();

interface CoreSearchOptions {
  help?: boolean;
  limit?: number;
  tags?: string[];
  format?: string;
  author?: string;
}

interface CoreExecOptions {
  help?: boolean;
  input?: string;
  params?: string;
  timeout?: string;
  dry?: boolean;
  verbose?: boolean;
  verifyPolicy?: 'permissive' | 'enterprise' | 'paranoid';
  skipVerification?: boolean;
  force?: boolean;
}

/**
 * Handle search command using core library
 */
export async function handleCoreSearchCommand(args: string[], options: CoreSearchOptions) {
  if (options.help) {
    console.log(`
${pc.bold('enact search')} - Search for tools

${pc.bold('USAGE:')}
  enact search [query]

${pc.bold('OPTIONS:')}
  -l, --limit <number>    Limit number of results (default: 10)
  -t, --tags <tags>       Filter by tags (comma-separated)
  -a, --author <author>   Filter by author
  -f, --format <format>   Output format (json, table, list)
  -h, --help              Show help

${pc.bold('EXAMPLES:')}
  enact search "text processing"
  enact search --tags "nlp,ai" --limit 5
  enact search --author "openai" --format json
    `);
    return;
  }

  try {
    let query = args[0];
    
    // Interactive mode if no query provided
    if (!query) {
      const response = await p.text({
        message: 'Enter search query:',
        placeholder: 'e.g., "text processing", "file converter"'
      });
      
      if (p.isCancel(response)) {
        p.outro('Search cancelled');
        return;
      }
      
      query = response;
    }

    p.intro(pc.bgCyan(pc.black(' Searching Enact Tools ')));

    const spinner = p.spinner();
    spinner.start('Searching for tools...');

    const searchOptions: ToolSearchOptions = {
      query,
      limit: options.limit,
      tags: options.tags,
      author: options.author,
      format: options.format as any
    };

    const results = await core.searchTools(searchOptions);
    
    spinner.stop('Search completed');

    if (results.length === 0) {
      p.outro(`No tools found matching: ${pc.yellow(query)}`);
      return;
    }

    // Display results based on format
    if (options.format === 'json') {
      console.log(JSON.stringify(results, null, 2));
    } else {
      console.log(`\nFound ${pc.green(results.length.toString())} tool(s):\n`);
      
      for (const tool of results) {
        console.log(pc.bold(pc.cyan(`📦 ${tool.name}`)));
        console.log(`   ${tool.description}`);
        
        if (tool.tags && tool.tags.length > 0) {
          console.log(`   ${pc.gray('Tags:')} ${tool.tags.map(tag => pc.blue(`#${tag}`)).join(' ')}`);
        }
        
        if (tool.authors && tool.authors.length > 0) {
          console.log(`   ${pc.gray('Author:')} ${tool.authors[0].name}`);
        }
        
        if (tool.license) {
          console.log(`   ${pc.gray('License:')} ${tool.license}`);
        }
        
        console.log('');
      }
    }

    p.outro(`Search completed! Found ${results.length} tool(s).`);
  } catch (error) {
    p.outro(pc.red(`Search failed: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }
}

/**
 * Handle execute command using core library
 */
export async function handleCoreExecCommand(args: string[], options: CoreExecOptions) {
  if (options.help) {
    console.log(`
${pc.bold('enact exec')} - Execute a tool

${pc.bold('USAGE:')}
  enact exec <tool-name> [options]

${pc.bold('OPTIONS:')}
  -i, --input <file>      Input file (JSON or YAML)
  -p, --params <json>     Parameters as JSON string
  --timeout <duration>    Execution timeout (e.g., "30s", "5m")
  --dry                   Dry run - validate but don't execute
  --verify-policy <policy> Verification policy (permissive, enterprise, paranoid)
  --skip-verification     Skip signature verification
  --force                 Force execution even if unsafe
  -v, --verbose           Verbose output
  -h, --help              Show help

${pc.bold('EXAMPLES:')}
  enact exec text/analyzer --params '{"text": "Hello world"}'
  enact exec file/converter --input params.json --timeout 5m
  enact exec dangerous/tool --force --verify-policy enterprise
    `);
    return;
  }

  try {
    let toolName = args[0];
    
    // Interactive mode if no tool name provided
    if (!toolName) {
      const response = await p.text({
        message: 'Enter tool name:',
        placeholder: 'e.g., "text/analyzer", "file/converter"'
      });
      
      if (p.isCancel(response)) {
        p.outro('Execution cancelled');
        return;
      }
      
      toolName = response;
    }

    // Parse parameters
    let inputs: Record<string, any> = {};
    
    if (options.params) {
      try {
        inputs = JSON.parse(options.params);
      } catch (error) {
        p.outro(pc.red(`Invalid JSON in --params: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    }
    
    if (options.input) {
      try {
        const fs = await import('fs/promises');
        const inputContent = await fs.readFile(options.input, 'utf-8');
        
        // Try JSON first, then YAML
        try {
          inputs = { ...inputs, ...JSON.parse(inputContent) };
        } catch {
          const yaml = await import('yaml');
          inputs = { ...inputs, ...yaml.parse(inputContent) };
        }
      } catch (error) {
        p.outro(pc.red(`Failed to read input file: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    }

    // Interactive input if no parameters provided
    if (Object.keys(inputs).length === 0) {
      const shouldAddParams = await p.confirm({
        message: 'No parameters provided. Would you like to add some?'
      });
      
      if (shouldAddParams && !p.isCancel(shouldAddParams)) {
        const paramsJson = await p.text({
          message: 'Enter parameters as JSON:',
          placeholder: '{"key": "value"}'
        });
        
        if (!p.isCancel(paramsJson) && paramsJson) {
          try {
            inputs = JSON.parse(paramsJson);
          } catch (error) {
            p.outro(pc.red(`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`));
            process.exit(1);
          }
        }
      }
    }

    p.intro(pc.bgGreen(pc.black(' Executing Enact Tool ')));

    const spinner = p.spinner();
    spinner.start(`Executing ${toolName}...`);

    const executeOptions: ToolExecuteOptions = {
      timeout: options.timeout,
      verifyPolicy: options.verifyPolicy,
      skipVerification: options.skipVerification,
      force: options.force,
      dryRun: options.dry,
      verbose: options.verbose
    };

    const result = await core.executeToolByName(toolName, inputs, executeOptions);
    
    spinner.stop('Execution completed');

    if (result.success) {
      console.log(`\n${pc.green('✓')} Tool executed successfully`);
      
      if (result.output) {
        console.log('\n' + pc.bold('Output:'));
        if (typeof result.output === 'object') {
          console.log(JSON.stringify(result.output, null, 2));
        } else {
          console.log(result.output);
        }
      }
      
      if (options.verbose && result.metadata) {
        console.log('\n' + pc.bold('Metadata:'));
        console.log(JSON.stringify(result.metadata, null, 2));
      }
      
      p.outro('Execution successful!');
    } else {
      console.log(`\n${pc.red('✗')} Tool execution failed`);
      
      if (result.error) {
        console.log(`\n${pc.bold('Error:')} ${result.error.message}`);
        
        if (options.verbose && result.error.details) {
          console.log('\n' + pc.bold('Details:'));
          console.log(JSON.stringify(result.error.details, null, 2));
        }
      }
      
      p.outro(pc.red('Execution failed!'));
      process.exit(1);
    }
  } catch (error) {
    p.outro(pc.red(`Execution failed: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }
}

/**
 * Handle get command using core library
 */
export async function handleCoreGetCommand(args: string[], options: { help?: boolean; format?: string }) {
  if (options.help) {
    console.log(`
${pc.bold('enact get')} - Get tool information

${pc.bold('USAGE:')}
  enact get <tool-name>

${pc.bold('OPTIONS:')}
  -f, --format <format>   Output format (json, yaml)
  -h, --help              Show help

${pc.bold('EXAMPLES:')}
  enact get text/analyzer
  enact get file/converter --format json
    `);
    return;
  }

  try {
    let toolName = args[0];
    
    if (!toolName) {
      const response = await p.text({
        message: 'Enter tool name:',
        placeholder: 'e.g., "text/analyzer"'
      });
      
      if (p.isCancel(response)) {
        p.outro('Operation cancelled');
        return;
      }
      
      toolName = response;
    }

    p.intro(pc.bgBlue(pc.black(' Getting Tool Info ')));

    const spinner = p.spinner();
    spinner.start(`Fetching ${toolName}...`);

    const tool = await core.getToolByName(toolName);
    
    spinner.stop('Fetch completed');

    if (!tool) {
      p.outro(pc.red(`Tool not found: ${toolName}`));
      process.exit(1);
    }

    if (options.format === 'json') {
      console.log(JSON.stringify(tool, null, 2));
    } else if (options.format === 'yaml') {
      const yaml = await import('yaml');
      console.log(yaml.stringify(tool));
    } else {
      // Human-readable format
      console.log(`\n${pc.bold(pc.cyan(`📦 ${tool.name}`))}`);
      console.log(`${tool.description}\n`);
      
      if (tool.command) {
        console.log(`${pc.bold('Command:')} ${pc.gray(tool.command)}`);
      }
      
      if (tool.tags && tool.tags.length > 0) {
        console.log(`${pc.bold('Tags:')} ${tool.tags.map(tag => pc.blue(`#${tag}`)).join(' ')}`);
      }
      
      if (tool.authors && tool.authors.length > 0) {
        console.log(`${pc.bold('Authors:')} ${tool.authors.map(a => a.name).join(', ')}`);
      }
      
      if (tool.license) {
        console.log(`${pc.bold('License:')} ${tool.license}`);
      }
      
      if (tool.version) {
        console.log(`${pc.bold('Version:')} ${tool.version}`);
      }
      
      if (tool.timeout) {
        console.log(`${pc.bold('Timeout:')} ${tool.timeout}`);
      }
      
      if (tool.signature || tool.signatures) {
        console.log(`${pc.bold('Signed:')} ${pc.green('✓')}`);
      }
      
      if (tool.inputSchema && tool.inputSchema.properties) {
        console.log(`\n${pc.bold('Input Parameters:')}`);
        for (const [key, schema] of Object.entries(tool.inputSchema.properties)) {
          const required = tool.inputSchema.required?.includes(key) ? pc.red('*') : '';
          console.log(`  ${key}${required}: ${(schema as any).type || 'any'} - ${(schema as any).description || 'No description'}`);
        }
      }
      
      if (tool.examples && tool.examples.length > 0) {
        console.log(`\n${pc.bold('Examples:')}`);
        tool.examples.forEach((example, i) => {
          console.log(`  ${i + 1}. ${example.description || 'Example'}`);
          console.log(`     Input: ${JSON.stringify(example.input)}`);
          if (example.output) {
            console.log(`     Output: ${JSON.stringify(example.output)}`);
          }
        });
      }
    }

    p.outro('Tool information retrieved successfully!');
  } catch (error) {
    p.outro(pc.red(`Failed to get tool info: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }
}

/**
 * Handle verify command using core library
 */
export async function handleCoreVerifyCommand(args: string[], options: { 
  help?: boolean; 
  policy?: string;
  verbose?: boolean 
}) {
  if (options.help) {
    console.log(`
${pc.bold('enact verify')} - Verify tool signatures

${pc.bold('USAGE:')}
  enact verify <tool-name> [policy]

${pc.bold('POLICIES:')}
  permissive   Allow unsigned tools (default)
  enterprise   Require valid signatures
  paranoid     Require multiple signatures

${pc.bold('OPTIONS:')}
  --policy <policy>   Verification policy
  -v, --verbose       Verbose output
  -h, --help          Show help

${pc.bold('EXAMPLES:')}
  enact verify text/analyzer
  enact verify file/converter --policy enterprise
    `);
    return;
  }

  try {
    let toolName = args[0];
    let policy = args[1] || options.policy || 'permissive';
    
    if (!toolName) {
      const response = await p.text({
        message: 'Enter tool name to verify:',
        placeholder: 'e.g., "text/analyzer"'
      });
      
      if (p.isCancel(response)) {
        p.outro('Verification cancelled');
        return;
      }
      
      toolName = response;
    }

    p.intro(pc.bgYellow(pc.black(' Verifying Tool Signatures ')));

    const spinner = p.spinner();
    spinner.start(`Verifying ${toolName}...`);

    const result = await core.verifyTool(toolName, policy);
    
    spinner.stop('Verification completed');

    if (result.verified) {
      console.log(`\n${pc.green('✓')} Tool signature verification passed`);
    } else {
      console.log(`\n${pc.red('✗')} Tool signature verification failed`);
    }
    
    console.log(`${pc.bold('Policy:')} ${policy}`);
    console.log(`${pc.bold('Signatures found:')} ${result.signatures.length}`);
    
    if (options.verbose && result.signatures.length > 0) {
      console.log('\n' + pc.bold('Signature Details:'));
      result.signatures.forEach((sig, i) => {
        console.log(`  ${i + 1}. ${sig.type} by ${sig.signer}`);
        console.log(`     Algorithm: ${sig.algorithm}`);
        console.log(`     Created: ${sig.created}`);
        if (sig.role) {
          console.log(`     Role: ${sig.role}`);
        }
      });
    }
    
    if (result.errors && result.errors.length > 0) {
      console.log('\n' + pc.bold(pc.red('Errors:')));
      result.errors.forEach(error => console.log(`  • ${error}`));
    }

    if (result.verified) {
      p.outro('Verification successful!');
    } else {
      p.outro(pc.red('Verification failed!'));
      process.exit(1);
    }
  } catch (error) {
    p.outro(pc.red(`Verification failed: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }
}

export { core };

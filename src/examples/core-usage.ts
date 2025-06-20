// src/examples/core-usage.ts - Example of using Enact Core Library directly
import { EnactCore } from '../core/EnactCore';
import { mcpCoreService } from '../services/McpCoreService';

async function exampleCoreUsage() {
  console.log('=== Enact Core Library Usage Example ===\n');

  // Example 1: Search for tools
  console.log('1. Searching for tools...');
  try {
    const searchResults = await mcpCoreService.searchTools('text processing', {
      limit: 3
    });
    
    console.log(`Found ${searchResults.length} tools:`);
    searchResults.forEach((tool, i) => {
      console.log(`  ${i + 1}. ${tool.name}: ${tool.description}`);
    });
  } catch (error) {
    console.error('Search failed:', error);
  }
  
  console.log('');

  // Example 2: Get tool information
  console.log('2. Getting tool information...');
  try {
    const tool = await mcpCoreService.getToolInfo('echo');
    if (tool) {
      console.log(`Tool: ${tool.name}`);
      console.log(`Description: ${tool.description}`);
      console.log(`Command: ${tool.command}`);
    } else {
      console.log('Tool not found');
    }
  } catch (error) {
    console.error('Get tool info failed:', error);
  }
  
  console.log('');

  // Example 3: Execute a simple tool
  console.log('3. Executing a tool...');
  try {
    const result = await mcpCoreService.executeToolByName('echo', {
      message: 'Hello from Enact Core!'
    }, {
      dryRun: true // Safe dry run
    });
    
    if (result.success) {
      console.log('Execution successful:');
      console.log(JSON.stringify(result.output, null, 2));
    } else {
      console.log('Execution failed:', result.error?.message);
    }
  } catch (error) {
    console.error('Execution failed:', error);
  }
  
  console.log('');

  // Example 4: Execute raw YAML tool
  console.log('4. Executing raw YAML tool...');
  const rawToolYaml = `
name: test-echo
description: A test echo tool
command: echo "Test message"
timeout: 30s
tags:
  - test
  - example
annotations:
  readOnlyHint: true
`;

  try {
    const result = await mcpCoreService.executeRawTool(rawToolYaml, {}, {
      dryRun: true
    });
    
    if (result.success) {
      console.log('Raw tool execution successful:');
      console.log(JSON.stringify(result.output, null, 2));
    } else {
      console.log('Raw tool execution failed:', result.error?.message);
    }
  } catch (error) {
    console.error('Raw tool execution failed:', error);
  }
  
  console.log('');

  // Example 5: Verify tool signatures
  console.log('5. Verifying tool signatures...');
  try {
    const verification = await mcpCoreService.verifyTool('echo');
    console.log(`Verification result: ${verification.verified ? 'VERIFIED' : 'FAILED'}`);
    console.log(`Policy: ${verification.policy}`);
    console.log(`Signatures found: ${verification.signatures.length}`);
    
    if (verification.errors && verification.errors.length > 0) {
      console.log('Errors:', verification.errors);
    }
  } catch (error) {
    console.error('Verification failed:', error);
  }
  
  console.log('');

  // Example 6: Check service status
  console.log('6. Checking service status...');
  try {
    const isAvailable = await mcpCoreService.isAvailable();
    const pathInfo = await mcpCoreService.getPathInfo();
    const authStatus = await mcpCoreService.getAuthStatus();
    
    console.log(`Service available: ${isAvailable}`);
    console.log(`Integration type: ${pathInfo.detectedPath}`);
    console.log(`Version: ${pathInfo.version}`);
    console.log(`Authenticated: ${authStatus.authenticated}`);
  } catch (error) {
    console.error('Status check failed:', error);
  }

  console.log('\n=== Example Complete ===');
}

// Run the example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  exampleCoreUsage().catch(console.error);
}

export { exampleCoreUsage };

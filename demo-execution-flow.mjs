#!/usr/bin/env node

// Demo of tool execution entry point flow
import { EnactCore } from './src/core/EnactCore.js';
import { DaggerExecutionProvider } from './src/core/DaggerExecutionProvider.js';

async function demonstrateToolExecution() {
  console.log('=== Enact Tool Execution Flow Demo ===\n');
  
  // 1. Create Core with Dagger execution provider
  console.log('1. 📦 Creating EnactCore with Dagger execution provider...');
  const core = new EnactCore({
    executionProvider: 'dagger',
    daggerOptions: {
      baseImage: 'alpine:latest',
      enableNetwork: false
    }
  });
  console.log('   ✅ Core created\n');
  
  // 2. Define a simple tool (normally this would come from the registry or file)
  console.log('2. 🔧 Defining tool specification...');
  const sampleTool = {
    name: 'demo/simple-echo',
    description: 'Simple echo tool for demonstration',
    command: 'echo "Hello from ${name}! You are ${age} years old."',
    timeout: '10s',
    version: '1.0.0'
  };
  console.log('   ✅ Tool defined:', sampleTool.name);
  console.log('   📋 Command:', sampleTool.command);
  console.log('   ⏱️ Timeout:', sampleTool.timeout, '\n');
  
  // 3. Prepare inputs
  console.log('3. 📝 Preparing input parameters...');
  const inputs = {
    name: 'Docker Container',
    age: 42
  };
  console.log('   ✅ Inputs:', JSON.stringify(inputs), '\n');
  
  // 4. Execute the tool (this is the main entry point)
  console.log('4. 🚀 Executing tool via core.executeTool()...');
  console.log('   This flow will:');
  console.log('   - Setup Dagger execution provider');
  console.log('   - Create container from alpine:latest');
  console.log('   - Substitute template variables');
  console.log('   - Execute command in container');
  console.log('   - Return results\n');
  
  try {
    const result = await core.executeTool(sampleTool, inputs, { 
      skipVerification: true, // Skip signature verification for demo
      verbose: true 
    });
    
    console.log('5. 📊 Execution Results:');
    console.log('   Success:', result.success ? '✅' : '❌');
    if (result.success && result.output) {
      console.log('   Output:', result.output);
    }
    if (result.error) {
      console.log('   Error:', result.error.message);
    }
    console.log('   Environment:', result.metadata.environment);
    console.log('   Execution ID:', result.metadata.executionId);
    
  } catch (error) {
    console.error('❌ Execution failed:', error.message);
  }
  
  console.log('\n=== Demo Complete ===');
}

// Only run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateToolExecution().catch(console.error);
}

export { demonstrateToolExecution };

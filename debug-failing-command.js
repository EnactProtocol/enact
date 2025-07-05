#!/usr/bin/env node

// Test just the exact failing test case
import { DaggerExecutionProvider } from './src/core/DaggerExecutionProvider.js';

async function testFailingCommand() {
  console.log('🔍 Testing failing command scenario...');
  
  const daggerProvider = new DaggerExecutionProvider({
    baseImage: 'node:20-alpine',
    enableNetwork: true,
    enableHostFS: false
  });

  const mockTool = {
    name: 'test/failing-tool',
    description: 'Tool that should fail',
    command: 'exit 1',
    timeout: '10s'
  };

  const environment = {
    vars: {},
    resources: { timeout: '10s' }
  };

  try {
    console.log('🚀 Setting up provider...');
    await daggerProvider.setup(mockTool);
    
    console.log('⚡ Executing failing command...');
    const result = await daggerProvider.execute(mockTool, {}, environment);
    
    console.log('📊 Result:', {
      success: result.success,
      error: result.error,
      metadata: result.metadata
    });
    
    console.log('🧹 Cleaning up...');
    await daggerProvider.cleanup();
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testFailingCommand();

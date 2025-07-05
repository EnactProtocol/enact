#!/usr/bin/env node

// Simple debug script to test Dagger execution
import { DaggerExecutionProvider } from './src/core/DaggerExecutionProvider.js';

async function debugDagger() {
  console.log('🔍 Starting Dagger debug test...');
  
  const provider = new DaggerExecutionProvider({
    baseImage: 'node:20-alpine',
    enableNetwork: true,
    enableHostFS: false
  });

  const mockTool = {
    name: 'test/debug-echo',
    description: 'Debug echo tool',
    command: 'echo "Hello from Dagger container"',
    timeout: '10s'
  };

  const environment = {
    vars: {},
    resources: { timeout: '10s' }
  };

  try {
    console.log('🚀 Setting up provider...');
    await provider.setup(mockTool);
    
    console.log('⚡ Executing command...');
    const result = await provider.execute(mockTool, {}, environment);
    
    console.log('📊 Result:', {
      success: result.success,
      output: result.output,
      error: result.error,
      metadata: result.metadata
    });
    
    console.log('🧹 Cleaning up...');
    await provider.cleanup();
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugDagger().then(() => {
  console.log('✅ Debug complete');
}).catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});

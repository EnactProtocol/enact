#!/usr/bin/env node

// Simple test with minimal timeout
import { DaggerExecutionProvider } from './src/core/DaggerExecutionProvider.js';

async function simpleTest() {
  console.log('🔍 Minimal test with short timeout...');
  
  const daggerProvider = new DaggerExecutionProvider({
    baseImage: 'alpine:latest',
    enableNetwork: false,
    enableHostFS: false
  });

  const mockTool = {
    name: 'test/minimal',
    description: 'Minimal test',
    command: 'true',
    timeout: '3s'
  };

  const environment = {
    vars: {},
    resources: { timeout: '3s' }
  };

  try {
    console.log('🚀 Setting up...');
    await daggerProvider.setup(mockTool);
    
    console.log('⚡ Executing...');
    const result = await daggerProvider.execute(mockTool, {}, environment);
    
    console.log('📊 Result:', {
      success: result.success,
      error: result.error?.message
    });
    
    await daggerProvider.cleanup();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

simpleTest();

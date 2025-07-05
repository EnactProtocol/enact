#!/usr/bin/env node

// Simple test to debug Dagger execution
import { connect } from '@dagger.io/dagger';

async function testBasicExecution() {
  console.log('Testing basic Dagger execution...');
  
  try {
    await connect(async (client) => {
      console.log('✅ Connected to Dagger');
      
      // Test basic container
      const container = client.container()
        .from('node:20-alpine')
        .withWorkdir('/workspace');
      
      console.log('✅ Created container with node:20-alpine');
      
      // Test simple echo
      const result1 = await container
        .withExec(['echo', 'Hello World'])
        .stdout();
      console.log('✅ Echo test:', result1.trim());
      
      // Test with shell
      const result2 = await container
        .withExec(['sh', '-c', 'echo "Shell test works"'])
        .stdout();
      console.log('✅ Shell test:', result2.trim());
      
      // Test package manager detection
      try {
        const result3 = await container
          .withExec(['sh', '-c', 'apk --version'])
          .stdout();
        console.log('✅ Package manager (apk):', result3.trim());
      } catch (e) {
        console.log('❌ apk not available:', e.message);
      }
      
      // Test file creation
      const result4 = await container
        .withNewFile('/workspace/test.txt', { contents: 'Hello from file' })
        .withExec(['cat', '/workspace/test.txt'])
        .stdout();
      console.log('✅ File test:', result4.trim());
      
    });
    
    console.log('✅ All tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
  }
}

testBasicExecution();

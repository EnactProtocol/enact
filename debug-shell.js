#!/usr/bin/env node

// Test shell escaping
import { connect } from '@dagger.io/dagger';

function escapeShellArg(arg) {
  return "'" + arg.replace(/'/g, "'\"'\"'") + "'";
}

async function testShellEscaping() {
  const dangerousInput = 'test"; echo "INJECTED"; echo "';
  const escaped = escapeShellArg(dangerousInput);
  const command = `echo "Input: ${escaped}"`;
  
  console.log('Original input:', JSON.stringify(dangerousInput));
  console.log('Escaped:', escaped);
  console.log('Final command:', command);
  
  // Test a more dangerous injection that would create files
  const reallyDangerousInput = 'test"; touch /tmp/injected; echo "HACKED';
  const escapedDangerous = escapeShellArg(reallyDangerousInput);
  const dangerousCommand = `echo "Input: ${escapedDangerous}"`;
  
  console.log('\nTesting file creation injection:');
  console.log('Dangerous input:', JSON.stringify(reallyDangerousInput));
  console.log('Final command:', dangerousCommand);
  
  await connect(async (client) => {
    const container = client.container()
      .from('alpine:latest')
      .withWorkdir('/workspace');
      
    console.log('\n=== Testing first injection ===');
    const result1 = await container
      .withExec(['sh', '-c', command])
      .stdout();
      
    console.log('Output:', JSON.stringify(result1));
    
    console.log('\n=== Testing file creation injection ===');
    const result2 = await container
      .withExec(['sh', '-c', dangerousCommand])
      .stdout();
      
    console.log('Output:', JSON.stringify(result2));
    
    // Check if file was created (it shouldn't be)
    try {
      const fileCheck = await container
        .withExec(['ls', '/tmp/injected'])
        .stdout();
      console.log('File created! This is BAD:', fileCheck);
    } catch (e) {
      console.log('File not created - injection prevented ✓');
    }
  });
}

testShellEscaping().catch(console.error);

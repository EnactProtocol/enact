#!/usr/bin/env node

// Minimal Dagger test to isolate the hanging issue
import { connect } from "@dagger.io/dagger";

async function minimalDaggerTest() {
  console.log('🔍 Starting minimal Dagger test...');
  
  try {
    console.log('🔗 Connecting to Dagger...');
    
    await connect(async (client) => {
      console.log('✅ Connected to Dagger client');
      
      console.log('📦 Creating container...');
      const container = client.container().from('alpine:latest');
      
      console.log('📁 Setting workdir...');
      const containerWithWorkdir = container.withWorkdir('/workspace');
      
      console.log('⚡ Executing simple echo...');
      const execContainer = containerWithWorkdir.withExec(['echo', 'Hello']);
      
      console.log('📤 Getting stdout...');
      const stdout = await execContainer.stdout();
      
      console.log('📊 Result:', stdout);
    });
    
    console.log('✅ Dagger test complete');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

minimalDaggerTest();

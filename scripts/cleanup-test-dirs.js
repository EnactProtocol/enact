#!/usr/bin/env node
/**
 * Cleanup script for test directories
 * This script removes all test-* directories that may have been left behind by failed tests
 */

const fs = require('fs');
const path = require('path');

async function cleanupTestDirectories() {
  const cwd = process.cwd();
  
  try {
    console.log('🧹 Cleaning up test directories...');
    
    const entries = await fs.promises.readdir(cwd, { withFileTypes: true });
    const testDirs = entries
      .filter(entry => entry.isDirectory() && entry.name.startsWith('test-'))
      .map(entry => entry.name);
    
    if (testDirs.length === 0) {
      console.log('✅ No test directories found to clean up.');
      return;
    }
    
    console.log(`📁 Found ${testDirs.length} test directories to clean up:`);
    testDirs.forEach(dir => console.log(`   - ${dir}`));
    
    for (const dir of testDirs) {
      const fullPath = path.join(cwd, dir);
      if (fs.existsSync(fullPath)) {
        try {
          await fs.promises.rm(fullPath, { recursive: true, force: true });
          console.log(`   ✅ Removed: ${dir}`);
        } catch (error) {
          console.log(`   ❌ Failed to remove: ${dir} - ${error.message}`);
        }
      }
    }
    
    console.log('🎉 Test directory cleanup completed!');
  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  cleanupTestDirectories().catch(console.error);
}

module.exports = { cleanupTestDirectories };

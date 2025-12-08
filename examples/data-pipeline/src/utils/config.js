/**
 * Configuration Loader
 * 
 * Loads and merges configuration from files
 */

const fs = require('node:fs');
const path = require('node:path');

function loadConfig() {
  const configDir = path.join(__dirname, '../../config');
  
  // Load default config
  const defaultPath = path.join(configDir, 'default.json');
  let config = {};
  
  if (fs.existsSync(defaultPath)) {
    config = JSON.parse(fs.readFileSync(defaultPath, 'utf-8'));
  }
  
  // Override with environment-specific config
  const env = process.env.NODE_ENV || 'development';
  const envPath = path.join(configDir, `${env}.json`);
  
  if (fs.existsSync(envPath)) {
    const envConfig = JSON.parse(fs.readFileSync(envPath, 'utf-8'));
    config = { ...config, ...envConfig };
  }
  
  return config;
}

module.exports = { loadConfig };

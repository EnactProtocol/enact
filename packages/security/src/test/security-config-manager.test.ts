import { test, expect, beforeEach, afterEach } from 'bun:test';
import { SecurityConfigManager } from '../securityConfigManager';
import { DEFAULT_SECURITY_CONFIG } from '../types';
import type { SecurityConfig } from '../types';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Test directories - use temp directory to avoid affecting real config
const testHomeDir = path.join(os.tmpdir(), 'test-security-config-manager');
const testEnactDir = path.join(testHomeDir, '.enact');
const testSecurityDir = path.join(testEnactDir, 'security');
const testConfigFile = path.join(testSecurityDir, 'config.json');

// Override the static paths in SecurityConfigManager
const originalEnactDir = (SecurityConfigManager as any).ENACT_DIR;
const originalSecurityDir = (SecurityConfigManager as any).SECURITY_DIR;
const originalConfigFile = (SecurityConfigManager as any).CONFIG_FILE;

beforeEach(() => {
  // Override the static paths to use test directories
  (SecurityConfigManager as any).ENACT_DIR = testEnactDir;
  (SecurityConfigManager as any).SECURITY_DIR = testSecurityDir;
  (SecurityConfigManager as any).CONFIG_FILE = testConfigFile;
  
  // Clean up any existing test directories
  if (fs.existsSync(testHomeDir)) {
    fs.rmSync(testHomeDir, { recursive: true, force: true });
  }
  
  // Create test home directory
  fs.mkdirSync(testHomeDir, { recursive: true });
});

afterEach(() => {
  // Restore original paths
  (SecurityConfigManager as any).ENACT_DIR = originalEnactDir;
  (SecurityConfigManager as any).SECURITY_DIR = originalSecurityDir;
  (SecurityConfigManager as any).CONFIG_FILE = originalConfigFile;
  
  // Clean up test directories
  if (fs.existsSync(testHomeDir)) {
    fs.rmSync(testHomeDir, { recursive: true, force: true });
  }
});

test('initializeConfig creates directories and default config file', () => {
  expect(fs.existsSync(testEnactDir)).toBe(false);
  expect(fs.existsSync(testSecurityDir)).toBe(false);
  expect(fs.existsSync(testConfigFile)).toBe(false);
  
  const config = SecurityConfigManager.initializeConfig();
  
  expect(fs.existsSync(testEnactDir)).toBe(true);
  expect(fs.existsSync(testSecurityDir)).toBe(true);
  expect(fs.existsSync(testConfigFile)).toBe(true);
  
  expect(config).toEqual(DEFAULT_SECURITY_CONFIG);
  
  // Verify file contents
  const fileContent = fs.readFileSync(testConfigFile, 'utf8');
  const savedConfig = JSON.parse(fileContent);
  expect(savedConfig).toEqual(DEFAULT_SECURITY_CONFIG);
});

test('initializeConfig returns existing config if file already exists', () => {
  // Create initial config
  const initialConfig = SecurityConfigManager.initializeConfig();
  expect(initialConfig).toEqual(DEFAULT_SECURITY_CONFIG);
  
  // Modify the config file
  const customConfig: SecurityConfig = {
    allowLocalUnsigned: false,
    minimumSignatures: 3
  };
  fs.writeFileSync(testConfigFile, JSON.stringify(customConfig, null, 2));
  
  // Initialize again - should return existing config
  const config = SecurityConfigManager.initializeConfig();
  expect(config).toEqual(customConfig);
});

test('loadConfig returns default config when file does not exist', () => {
  expect(fs.existsSync(testConfigFile)).toBe(false);
  
  const config = SecurityConfigManager.loadConfig();
  
  expect(config).toEqual(DEFAULT_SECURITY_CONFIG);
  expect(fs.existsSync(testConfigFile)).toBe(true);
});

test('loadConfig merges with defaults for missing fields', () => {
  // Create partial config file
  const partialConfig = { minimumSignatures: 5 };
  fs.mkdirSync(testSecurityDir, { recursive: true });
  fs.writeFileSync(testConfigFile, JSON.stringify(partialConfig, null, 2));
  
  const config = SecurityConfigManager.loadConfig();
  
  expect(config).toEqual({
    allowLocalUnsigned: true, // from default
    minimumSignatures: 5 // from file
  });
});

test('loadConfig handles corrupted config file gracefully', () => {
  // Create corrupted config file
  fs.mkdirSync(testSecurityDir, { recursive: true });
  fs.writeFileSync(testConfigFile, 'invalid json content');
  
  const config = SecurityConfigManager.loadConfig();
  
  expect(config).toEqual(DEFAULT_SECURITY_CONFIG);
});

test('saveConfig creates directories and saves config', () => {
  const customConfig: SecurityConfig = {
    allowLocalUnsigned: false,
    minimumSignatures: 2
  };
  
  expect(fs.existsSync(testSecurityDir)).toBe(false);
  
  const success = SecurityConfigManager.saveConfig(customConfig);
  
  expect(success).toBe(true);
  expect(fs.existsSync(testSecurityDir)).toBe(true);
  expect(fs.existsSync(testConfigFile)).toBe(true);
  
  // Verify saved content
  const fileContent = fs.readFileSync(testConfigFile, 'utf8');
  const savedConfig = JSON.parse(fileContent);
  expect(savedConfig).toEqual(customConfig);
});

test('saveConfig merges with defaults before saving', () => {
  const partialConfig: SecurityConfig = {
    minimumSignatures: 3
    // allowLocalUnsigned not specified
  };
  
  const success = SecurityConfigManager.saveConfig(partialConfig);
  expect(success).toBe(true);
  
  const fileContent = fs.readFileSync(testConfigFile, 'utf8');
  const savedConfig = JSON.parse(fileContent);
  expect(savedConfig).toEqual({
    allowLocalUnsigned: true, // merged from default
    minimumSignatures: 3
  });
});

test('updateConfig loads, merges, and saves config', () => {
  // Initialize with default config
  SecurityConfigManager.initializeConfig();
  
  const updates: Partial<SecurityConfig> = {
    minimumSignatures: 4
  };
  
  const updatedConfig = SecurityConfigManager.updateConfig(updates);
  
  expect(updatedConfig).toEqual({
    allowLocalUnsigned: true, // preserved from original
    minimumSignatures: 4 // updated
  });
  
  // Verify file was updated
  const fileContent = fs.readFileSync(testConfigFile, 'utf8');
  const savedConfig = JSON.parse(fileContent);
  expect(savedConfig).toEqual(updatedConfig);
});

test('resetToDefaults overwrites config with defaults', () => {
  // Create custom config
  const customConfig: SecurityConfig = {
    allowLocalUnsigned: false,
    minimumSignatures: 5
  };
  SecurityConfigManager.saveConfig(customConfig);
  
  const resetConfig = SecurityConfigManager.resetToDefaults();
  
  expect(resetConfig).toEqual(DEFAULT_SECURITY_CONFIG);
  
  // Verify file was reset
  const fileContent = fs.readFileSync(testConfigFile, 'utf8');
  const savedConfig = JSON.parse(fileContent);
  expect(savedConfig).toEqual(DEFAULT_SECURITY_CONFIG);
});

test('getPaths returns correct paths', () => {
  const paths = SecurityConfigManager.getPaths();
  
  expect(paths.enactDir).toBe(testEnactDir);
  expect(paths.securityDir).toBe(testSecurityDir);
  expect(paths.configFile).toBe(testConfigFile);
});

test('configExists returns correct status', () => {
  expect(SecurityConfigManager.configExists()).toBe(false);
  
  SecurityConfigManager.initializeConfig();
  
  expect(SecurityConfigManager.configExists()).toBe(true);
});

test('getStatus returns accurate directory and file status', () => {
  let status = SecurityConfigManager.getStatus();
  
  expect(status.enactDirExists).toBe(false);
  expect(status.securityDirExists).toBe(false);
  expect(status.configFileExists).toBe(false);
  expect(status.paths.enactDir).toBe(testEnactDir);
  
  // Create .enact directory only
  fs.mkdirSync(testEnactDir, { recursive: true });
  
  status = SecurityConfigManager.getStatus();
  expect(status.enactDirExists).toBe(true);
  expect(status.securityDirExists).toBe(false);
  expect(status.configFileExists).toBe(false);
  
  // Initialize full config
  SecurityConfigManager.initializeConfig();
  
  status = SecurityConfigManager.getStatus();
  expect(status.enactDirExists).toBe(true);
  expect(status.securityDirExists).toBe(true);
  expect(status.configFileExists).toBe(true);
});

test('validateConfig validates correct config structure', () => {
  const validConfigs = [
    { allowLocalUnsigned: true, minimumSignatures: 1 },
    { allowLocalUnsigned: false, minimumSignatures: 0 },
    { allowLocalUnsigned: true }, // partial config
    { minimumSignatures: 5 }, // partial config
    {} // empty config
  ];
  
  validConfigs.forEach(config => {
    expect(SecurityConfigManager.validateConfig(config)).toBe(true);
  });
});

test('validateConfig rejects invalid config structure', () => {
  const invalidConfigs = [
    null,
    undefined,
    'string',
    123,
    { allowLocalUnsigned: 'true' }, // string instead of boolean
    { minimumSignatures: '1' }, // string instead of number
    { minimumSignatures: -1 }, // negative number
    { minimumSignatures: 1.5 }, // non-integer
    { allowLocalUnsigned: true, minimumSignatures: null }
  ];
  
  invalidConfigs.forEach(config => {
    expect(SecurityConfigManager.validateConfig(config)).toBe(false);
  });
});

test('importConfig imports valid config from file', () => {
  const configToImport: SecurityConfig = {
    allowLocalUnsigned: false,
    minimumSignatures: 3
  };
  
  const importFile = path.join(testHomeDir, 'import-config.json');
  fs.writeFileSync(importFile, JSON.stringify(configToImport, null, 2));
  
  const importedConfig = SecurityConfigManager.importConfig(importFile);
  
  expect(importedConfig).toEqual(configToImport);
  expect(fs.existsSync(testConfigFile)).toBe(true);
  
  // Verify imported config was saved
  const savedConfig = SecurityConfigManager.loadConfig();
  expect(savedConfig).toEqual(configToImport);
});

test('importConfig rejects invalid config file', () => {
  const invalidConfigFile = path.join(testHomeDir, 'invalid-config.json');
  fs.writeFileSync(invalidConfigFile, JSON.stringify({ minimumSignatures: 'invalid' }));
  
  const result = SecurityConfigManager.importConfig(invalidConfigFile);
  
  expect(result).toBeNull();
  expect(fs.existsSync(testConfigFile)).toBe(false);
});

test('importConfig handles non-existent file', () => {
  const nonExistentFile = path.join(testHomeDir, 'does-not-exist.json');
  
  const result = SecurityConfigManager.importConfig(nonExistentFile);
  
  expect(result).toBeNull();
});

test('importConfig handles corrupted JSON file', () => {
  const corruptedFile = path.join(testHomeDir, 'corrupted.json');
  fs.writeFileSync(corruptedFile, 'invalid json content');
  
  const result = SecurityConfigManager.importConfig(corruptedFile);
  
  expect(result).toBeNull();
});

test('exportConfig exports current config to file', () => {
  // Initialize config
  const config: SecurityConfig = {
    allowLocalUnsigned: false,
    minimumSignatures: 2
  };
  SecurityConfigManager.saveConfig(config);
  
  const exportFile = path.join(testHomeDir, 'exported-config.json');
  const success = SecurityConfigManager.exportConfig(exportFile);
  
  expect(success).toBe(true);
  expect(fs.existsSync(exportFile)).toBe(true);
  
  // Verify exported content
  const exportedContent = fs.readFileSync(exportFile, 'utf8');
  const exportedConfig = JSON.parse(exportedContent);
  expect(exportedConfig).toEqual(config);
});

test('exportConfig handles write errors gracefully', () => {
  // Try to export to a read-only directory
  const readOnlyDir = path.join(testHomeDir, 'readonly');
  fs.mkdirSync(readOnlyDir, { recursive: true });
  fs.chmodSync(readOnlyDir, 0o444); // read-only
  
  const exportFile = path.join(readOnlyDir, 'config.json');
  const success = SecurityConfigManager.exportConfig(exportFile);
  
  expect(success).toBe(false);
  
  // Restore permissions for cleanup
  fs.chmodSync(readOnlyDir, 0o755);
});

test('complete workflow: initialize, update, export, import', () => {
  // 1. Initialize default config
  const initialConfig = SecurityConfigManager.initializeConfig();
  expect(initialConfig).toEqual(DEFAULT_SECURITY_CONFIG);
  
  // 2. Update config
  const updates = { minimumSignatures: 3 };
  const updatedConfig = SecurityConfigManager.updateConfig(updates);
  expect(updatedConfig.minimumSignatures).toBe(3);
  
  // 3. Export config
  const exportFile = path.join(testHomeDir, 'backup-config.json');
  const exportSuccess = SecurityConfigManager.exportConfig(exportFile);
  expect(exportSuccess).toBe(true);
  
  // 4. Reset to defaults
  SecurityConfigManager.resetToDefaults();
  const resetConfig = SecurityConfigManager.loadConfig();
  expect(resetConfig).toEqual(DEFAULT_SECURITY_CONFIG);
  
  // 5. Import the backup
  const importedConfig = SecurityConfigManager.importConfig(exportFile);
  expect(importedConfig).toEqual(updatedConfig);
  expect(importedConfig).not.toBeNull();
  
  // 6. Verify current config matches imported
  const finalConfig = SecurityConfigManager.loadConfig();
  expect(finalConfig).toEqual(importedConfig!);
});

test('error handling when directories cannot be created', () => {
  // Mock fs.mkdirSync to throw an error
  const originalMkdirSync = fs.mkdirSync;
  (fs as any).mkdirSync = () => {
    throw new Error('Permission denied');
  };
  
  try {
    const config = SecurityConfigManager.initializeConfig();
    // Should still return default config even if directory creation fails
    expect(config).toEqual(DEFAULT_SECURITY_CONFIG);
  } finally {
    // Restore original function
    (fs as any).mkdirSync = originalMkdirSync;
  }
});

test('error handling when config file cannot be written', () => {
  // Create directories manually
  fs.mkdirSync(testSecurityDir, { recursive: true });
  
  // Mock fs.writeFileSync to throw an error
  const originalWriteFileSync = fs.writeFileSync;
  (fs as any).writeFileSync = () => {
    throw new Error('Disk full');
  };
  
  try {
    const success = SecurityConfigManager.saveConfig(DEFAULT_SECURITY_CONFIG);
    expect(success).toBe(false);
  } finally {
    // Restore original function
    (fs as any).writeFileSync = originalWriteFileSync;
  }
});
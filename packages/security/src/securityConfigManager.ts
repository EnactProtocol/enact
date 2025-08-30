import fs from 'fs';
import path from 'path';
import os from 'os';
import type { SecurityConfig } from './types';
import { DEFAULT_SECURITY_CONFIG } from './types';

export class SecurityConfigManager {
  private static readonly ENACT_DIR = path.join(os.homedir(), '.enact');
  private static readonly SECURITY_DIR = path.join(this.ENACT_DIR, 'security');
  private static readonly CONFIG_FILE = path.join(this.SECURITY_DIR, 'config.json');
  
  /**
   * Ensure the .enact/security directory structure exists
   */
  private static ensureDirectories(): void {
    try {
      // Create .enact directory if it doesn't exist
      if (!fs.existsSync(this.ENACT_DIR)) {
        fs.mkdirSync(this.ENACT_DIR, { recursive: true, mode: 0o755 });
        console.log(`Created .enact directory: ${this.ENACT_DIR}`);
      }
      
      // Create security subdirectory if it doesn't exist
      if (!fs.existsSync(this.SECURITY_DIR)) {
        fs.mkdirSync(this.SECURITY_DIR, { recursive: true, mode: 0o755 });
        console.log(`Created security directory: ${this.SECURITY_DIR}`);
      }
    } catch (error) {
      console.warn(`Failed to create directories: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Initialize security config with default values if it doesn't exist
   */
  static initializeConfig(): SecurityConfig {
    this.ensureDirectories();
    
    try {
      // Check if config file already exists
      if (fs.existsSync(this.CONFIG_FILE)) {
        console.log(`Security config already exists: ${this.CONFIG_FILE}`);
        return this.loadConfig();
      }
      
      // Create default config file
      const defaultConfig = { ...DEFAULT_SECURITY_CONFIG };
      const configContent = JSON.stringify(defaultConfig, null, 2);
      
      fs.writeFileSync(this.CONFIG_FILE, configContent, { mode: 0o644 });
      console.log(`Initialized security config: ${this.CONFIG_FILE}`);
      console.log('Default config:', defaultConfig);
      
      return defaultConfig;
      
    } catch (error) {
      console.warn(`Failed to initialize security config: ${error instanceof Error ? error.message : String(error)}`);
      console.log('Using in-memory default config');
      return { ...DEFAULT_SECURITY_CONFIG };
    }
  }

  /**
   * Load security config from file
   */
  static loadConfig(): SecurityConfig {
    try {
      if (!fs.existsSync(this.CONFIG_FILE)) {
        console.log('No security config file found, initializing...');
        return this.initializeConfig();
      }
      
      const configContent = fs.readFileSync(this.CONFIG_FILE, 'utf8');
      const config = JSON.parse(configContent) as SecurityConfig;
      
      // Merge with defaults to ensure all fields are present
      const mergedConfig = { ...DEFAULT_SECURITY_CONFIG, ...config };
      
      console.log(`Loaded security config from: ${this.CONFIG_FILE}`);
      return mergedConfig;
      
    } catch (error) {
      console.warn(`Failed to load security config: ${error instanceof Error ? error.message : String(error)}`);
      console.log('Using default config');
      return { ...DEFAULT_SECURITY_CONFIG };
    }
  }

  /**
   * Save security config to file
   */
  static saveConfig(config: SecurityConfig): boolean {
    this.ensureDirectories();
    
    try {
      // Merge with defaults to ensure consistency
      const configToSave = { ...DEFAULT_SECURITY_CONFIG, ...config };
      const configContent = JSON.stringify(configToSave, null, 2);
      
      fs.writeFileSync(this.CONFIG_FILE, configContent, { mode: 0o644 });
      console.log(`Saved security config to: ${this.CONFIG_FILE}`);
      
      return true;
      
    } catch (error) {
      console.error(`Failed to save security config: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Update specific config values
   */
  static updateConfig(updates: Partial<SecurityConfig>): SecurityConfig {
    const currentConfig = this.loadConfig();
    const updatedConfig = { ...currentConfig, ...updates };
    
    if (this.saveConfig(updatedConfig)) {
      console.log('Security config updated:', updates);
      return updatedConfig;
    } else {
      console.warn('Failed to save updated config, returning current config');
      return currentConfig;
    }
  }

  /**
   * Reset config to defaults
   */
  static resetToDefaults(): SecurityConfig {
    const defaultConfig = { ...DEFAULT_SECURITY_CONFIG };
    
    if (this.saveConfig(defaultConfig)) {
      console.log('Security config reset to defaults');
      return defaultConfig;
    } else {
      console.warn('Failed to reset config');
      return this.loadConfig();
    }
  }

  /**
   * Get the paths used by the security config manager
   */
  static getPaths() {
    return {
      enactDir: this.ENACT_DIR,
      securityDir: this.SECURITY_DIR,
      configFile: this.CONFIG_FILE
    };
  }

  /**
   * Check if security config exists
   */
  static configExists(): boolean {
    return fs.existsSync(this.CONFIG_FILE);
  }

  /**
   * Get current config status
   */
  static getStatus() {
    const paths = this.getPaths();
    return {
      enactDirExists: fs.existsSync(paths.enactDir),
      securityDirExists: fs.existsSync(paths.securityDir),
      configFileExists: fs.existsSync(paths.configFile),
      paths
    };
  }

  /**
   * Validate security config structure
   */
  static validateConfig(config: any): config is SecurityConfig {
    if (typeof config !== 'object' || config === null) {
      return false;
    }
    
    // Check allowLocalUnsigned field
    if ('allowLocalUnsigned' in config && typeof config.allowLocalUnsigned !== 'boolean') {
      return false;
    }
    
    // Check minimumSignatures field
    if ('minimumSignatures' in config) {
      if (typeof config.minimumSignatures !== 'number' || 
          config.minimumSignatures < 0 || 
          !Number.isInteger(config.minimumSignatures)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Import config from another file
   */
  static importConfig(filePath: string): SecurityConfig | null {
    try {
      if (!fs.existsSync(filePath)) {
        console.error(`Config file does not exist: ${filePath}`);
        return null;
      }
      
      const configContent = fs.readFileSync(filePath, 'utf8');
      const config = JSON.parse(configContent);
      
      if (!this.validateConfig(config)) {
        console.error('Invalid config format');
        return null;
      }
      
      if (this.saveConfig(config)) {
        console.log(`Imported config from: ${filePath}`);
        return config;
      } else {
        console.error('Failed to save imported config');
        return null;
      }
      
    } catch (error) {
      console.error(`Failed to import config: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Export current config to a file
   */
  static exportConfig(filePath: string): boolean {
    try {
      const config = this.loadConfig();
      const configContent = JSON.stringify(config, null, 2);
      
      fs.writeFileSync(filePath, configContent, { mode: 0o644 });
      console.log(`Exported config to: ${filePath}`);
      
      return true;
      
    } catch (error) {
      console.error(`Failed to export config: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
}
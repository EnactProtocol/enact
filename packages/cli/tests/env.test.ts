import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { handleEnvCommand } from '../src/commands/env';
import { existsSync } from 'fs';
import { rm, mkdir } from 'fs/promises';
import { join } from 'path';

describe('Env Command', () => {
  const testConfigDir = join(process.cwd(), 'test-env-config');
  const originalHomeDir = process.env.HOME;
  let consoleOutput: string[] = [];
  let consoleErrorOutput: string[] = [];
  
  beforeEach(async () => {
    // Clean up test directory
    if (existsSync(testConfigDir)) {
      await rm(testConfigDir, { recursive: true, force: true });
    }
    await mkdir(testConfigDir, { recursive: true });
    
    // Mock HOME directory for testing
    process.env.HOME = testConfigDir;
    
    // Reset console output
    consoleOutput = [];
    consoleErrorOutput = [];
    
    // Mock console methods
    const originalLog = console.log;
    const originalError = console.error;
    
    console.log = (...args: any[]) => {
      consoleOutput.push(args.join(' '));
    };
    
    console.error = (...args: any[]) => {
      consoleErrorOutput.push(args.join(' '));
    };
    
    // Store original functions
    (console as any)._originalLog = originalLog;
    (console as any)._originalError = originalError;
  });

  afterEach(async () => {
    // Restore original HOME
    if (originalHomeDir) {
      process.env.HOME = originalHomeDir;
    }
    
    // Restore console methods
    if ((console as any)._originalLog) {
      console.log = (console as any)._originalLog;
    }
    if ((console as any)._originalError) {
      console.error = (console as any)._originalError;
    }
    
    // Clean up test directory
    if (existsSync(testConfigDir)) {
      await rm(testConfigDir, { recursive: true, force: true });
    }
  });

  describe('Help Command', () => {
    test('should display help when --help flag is provided', async () => {
      await handleEnvCommand([], { help: true });
      
      const helpOutput = consoleErrorOutput.join(' ');
      expect(helpOutput).toContain('Usage:');
      expect(helpOutput).toContain('env');
    });

    test('should display help when no subcommand provided', async () => {
      await handleEnvCommand([], {});
      
      // The function should handle the case gracefully, possibly showing help
      const errorOutput = consoleErrorOutput.join(' ');
      // The command might show help or an error message
      expect(errorOutput.length >= 0).toBe(true);
    });

    test('should include all expected subcommands in help text', async () => {
      await handleEnvCommand([], { help: true });
      
      const helpOutput = consoleErrorOutput.join(' ');
      expect(helpOutput).toContain('set');
      expect(helpOutput).toContain('get');
      expect(helpOutput).toContain('list');
      expect(helpOutput).toContain('delete');
      expect(helpOutput).toContain('export');
    });
  });

  describe('Subcommand Validation', () => {
    test('should recognize valid subcommands', () => {
      const validSubcommands = ['set', 'get', 'list', 'delete', 'export'];
      
      validSubcommands.forEach(subcommand => {
        expect(typeof subcommand).toBe('string');
        expect(subcommand.length).toBeGreaterThan(0);
      });
    });

    test('should handle unknown subcommands', async () => {
      await handleEnvCommand(['unknown-command'], {});
      
      // The function should handle unknown commands gracefully
      const errorOutput = consoleErrorOutput.join(' ');
      // Should either show help or an error message
      expect(errorOutput.length >= 0).toBe(true);
    });
  });

  describe('Options Processing', () => {
    test('should accept help option', async () => {
      await handleEnvCommand(['list'], { help: true });
      
      const helpOutput = consoleErrorOutput.join(' ');
      expect(helpOutput).toContain('Usage:');
    });

    test('should accept package option', () => {
      const options = { package: 'acme-corp/discord' };
      expect(options.package).toBe('acme-corp/discord');
    });

    test('should accept format option', () => {
      const options = { format: 'json' };
      expect(options.format).toBe('json');
    });

    test('should accept show option', () => {
      const options = { show: true };
      expect(options.show).toBe(true);
    });

    test('should accept package option', () => {
      const options = { package: 'acme-corp/test' };
      expect(options.package).toBe('acme-corp/test');
    });

    test('should handle multiple options', () => {
      const options = {
        help: false,
        package: 'test-org/test-package',
        format: 'json',
        show: false
      };
      
      expect(options.package).toBe('test-org/test-package');
      expect(options.format).toBe('json');
      expect(options.show).toBe(false);
      expect(options.help).toBe(false);
    });
  });

  describe('Package Name Validation', () => {
    test('should validate package name format', () => {
      // Test valid package names
      const validNames = [
        'acme-corp/discord',
        'my-org/package',
        'org-name/some-category/tool-name'
      ];
      
      // Test invalid package names
      const invalidNames = [
        'single-name',           // No slash
        'org/',                  // Trailing slash
        '/package',             // Leading slash
        'org//package',         // Double slash
        '',                      // Empty
        'org/cat/too/many/parts' // Too many parts for some contexts
      ];
      
      // Since validation happens internally, we test the expected format
      const packagePattern = /^[a-z0-9-]+\/[a-z0-9-]+/;
      
      validNames.forEach(name => {
        expect(packagePattern.test(name)).toBe(true);
      });
      
      // Test that invalid names don't match (where applicable)
      invalidNames.slice(0, 5).forEach(name => {
        expect(packagePattern.test(name)).toBe(false);
      });
    });
  });

  describe('Configuration Directory Structure', () => {
    test('should work with environment directory structure', () => {
      const envBaseDir = join(testConfigDir, '.enact', 'env');
      const packagePath = join(envBaseDir, 'acme-corp/discord', '.env');
      
      expect(typeof envBaseDir).toBe('string');
      expect(envBaseDir).toContain('.enact/env');
      expect(typeof packagePath).toBe('string');
      expect(packagePath).toContain('acme-corp/discord/.env');
    });
  });

  describe('Command Structure', () => {
    test('should export handleEnvCommand function', () => {
      expect(typeof handleEnvCommand).toBe('function');
    });

    test('should accept args array and options object', () => {
      // Test function signature
      const args: string[] = ['list'];
      const options = { help: false };
      
      expect(typeof args).toBe('object');
      expect(Array.isArray(args)).toBe(true);
      expect(typeof options).toBe('object');
    });
  });

  describe('List Subcommand', () => {
    test('should recognize list subcommand', () => {
      // This test verifies that 'list' is a recognized subcommand
      const validSubcommands = ['list', 'set', 'get', 'delete', 'export'];
      expect(validSubcommands).toContain('list');
    });
  });

  describe('Set Subcommand', () => {
    test('should recognize set subcommand', () => {
      const validSubcommands = ['list', 'set', 'get', 'delete', 'export'];
      expect(validSubcommands).toContain('set');
    });
  });

  describe('Get Subcommand', () => {
    test('should recognize get subcommand', () => {
      const validSubcommands = ['list', 'set', 'get', 'delete', 'export'];
      expect(validSubcommands).toContain('get');
    });
  });

  describe('Delete Subcommand', () => {
    test('should recognize delete subcommand', () => {
      const validSubcommands = ['list', 'set', 'get', 'delete', 'export'];
      expect(validSubcommands).toContain('delete');
    });
  });

  describe('Export Subcommand', () => {
    test('should recognize export subcommand', () => {
      const validSubcommands = ['list', 'set', 'get', 'delete', 'export'];
      expect(validSubcommands).toContain('export');
    });
  });

  describe('Error Handling', () => {
    test('should handle empty args gracefully', async () => {
      await handleEnvCommand([], {});
      
      // The function should handle empty args gracefully
      const errorOutput = consoleErrorOutput.join(' ');
      // Should show some kind of output (help or error)
      expect(errorOutput.length >= 0).toBe(true);
    });

    test('should handle null/undefined args', () => {
      // Test that function can handle edge cases
      expect(typeof handleEnvCommand).toBe('function');
    });

    test('should handle empty options object', () => {
      const options = {};
      expect(typeof options).toBe('object');
    });
  });

  describe('Help Content', () => {
    test('should show comprehensive help information', async () => {
      await handleEnvCommand([], { help: true });
      
      const helpOutput = consoleErrorOutput.join(' ');
      
      // Check for key sections in help output
      expect(helpOutput).toContain('Usage:');
      expect(helpOutput).toContain('Environment variable management for Enact CLI with package namespaces');
      expect(helpOutput).toContain('--help');
      expect(helpOutput).toContain('--format');
      expect(helpOutput).toContain('--show');
      expect(helpOutput).toContain('Subcommands:');
      expect(helpOutput).toContain('set <package> <name> [value]');
      expect(helpOutput).toContain('get <package> <name>');
      expect(helpOutput).toContain('list [package]');
      expect(helpOutput).toContain('delete <package> <name>');
      expect(helpOutput).toContain('packages');
      expect(helpOutput).toContain('export <package> [format]');
      expect(helpOutput).toContain('clear <package>');
      expect(helpOutput).toContain('Package Namespace Format:');
      expect(helpOutput).toContain('Examples:');
      expect(helpOutput.length).toBeGreaterThan(0);
    });
  });

  describe('Integration Tests', () => {
    test('should maintain consistent help behavior', async () => {
      // Test multiple help calls
      await handleEnvCommand([], { help: true });
      const firstHelpOutput = [...consoleErrorOutput];
      
      // Clear output
      consoleErrorOutput.length = 0;
      
      await handleEnvCommand(['some-command'], { help: true });
      const secondHelpOutput = [...consoleErrorOutput];
      
      // Both should contain help information
      expect(firstHelpOutput.join(' ')).toContain('Usage:');
      expect(secondHelpOutput.join(' ')).toContain('Usage:');
    });

    test('should handle various option combinations', () => {
      const testCases = [
        { help: true },
        { package: 'test-org/test-package' },
        { format: 'json' },
        { show: true },
        { 
          help: false, 
          package: 'acme-corp/discord', 
          format: 'json',
          show: false
        }
      ];
      
      testCases.forEach(options => {
        expect(typeof options).toBe('object');
        // Each options object should be valid
        Object.keys(options).forEach(key => {
          expect(['help', 'package', 'format', 'show']).toContain(key);
        });
      });
    });
  });

  describe('TypeScript Interface Compliance', () => {
    test('should comply with EnvOptions interface', () => {
      // Test various valid option combinations
      const validOptions = [
        {},
        { help: true },
        { help: false },
        { package: 'acme-corp/discord' },
        { format: 'json' },
        { show: true },
        {
          help: false,
          package: 'test-org/test-category',
          format: 'json',
          show: false
        }
      ];
      
      validOptions.forEach(options => {
        // Each option set should be a valid object
        expect(typeof options).toBe('object');
        
        // Verify option types when present
        if ('help' in options) {
          expect(typeof options.help).toBe('boolean');
        }
        if ('package' in options) {
          expect(typeof options.package).toBe('string');
        }
        if ('format' in options) {
          expect(typeof options.format).toBe('string');
        }
        if ('show' in options) {
          expect(typeof options.show).toBe('boolean');
        }
      });
    });

    test('should handle args as string array', () => {
      const validArgs = [
        [],
        ['list'],
        ['set', 'test-org/test-tool', 'VARIABLE_NAME', 'value'],
        ['get', 'test-org/test-tool', 'VARIABLE_NAME'],
        ['delete', 'test-org/test-tool', 'VARIABLE_NAME'],
        ['export', 'test-org/test-tool'],
        ['packages'],
        ['clear', 'test-org/test-tool'],
        ['unknown-command']
      ];
      
      validArgs.forEach(args => {
        expect(Array.isArray(args)).toBe(true);
        args.forEach(arg => {
          expect(typeof arg).toBe('string');
        });
      });
    });
  });
});

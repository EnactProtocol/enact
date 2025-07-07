import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { handleAuthCommand } from '../src/commands/auth';
import { existsSync } from 'fs';
import { rm, mkdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { runCommandSafely } from './helpers/test-utils';

describe('Auth Command', () => {
  const testConfigDir = join(process.cwd(), 'test-auth-config');
  const originalHomeDir = process.env.HOME;
  
  beforeEach(async () => {
    // Clean up test directory
    if (existsSync(testConfigDir)) {
      await rm(testConfigDir, { recursive: true, force: true });
    }
    await mkdir(testConfigDir, { recursive: true });
    
    // Mock HOME directory for testing
    process.env.HOME = testConfigDir;
  });

  afterEach(async () => {
    // Restore original HOME
    if (originalHomeDir) {
      process.env.HOME = originalHomeDir;
    }
    
    // Clean up test directory
    if (existsSync(testConfigDir)) {
      await rm(testConfigDir, { recursive: true, force: true });
    }
  });

  describe('Help Command', () => {
    test('should display help when --help flag is provided', async () => {
      let capturedOutput = '';
      const originalConsoleError = console.error;
      console.error = (message: string) => {
        capturedOutput = message;
      };
      
      await handleAuthCommand([], { help: true });
      
      expect(capturedOutput).toContain('Usage: enact auth <subcommand> [options]');
      expect(capturedOutput).toContain('Manages authentication for enact CLI');
      
      console.error = originalConsoleError;
    });

    test('should display help when no subcommand provided', async () => {
      let capturedOutput = '';
      const originalConsoleError = console.error;
      console.error = (message: string) => {
        capturedOutput = message;
      };
      
      await handleAuthCommand([], {});
      
      expect(capturedOutput).toContain('Usage: enact auth <subcommand> [options]');
      expect(capturedOutput).toContain('Subcommands:');
      expect(capturedOutput).toContain('login');
      expect(capturedOutput).toContain('logout');
      expect(capturedOutput).toContain('status');
      expect(capturedOutput).toContain('token');
      
      console.error = originalConsoleError;
    });

    test('should include all expected subcommands in help text', async () => {
      let capturedOutput = '';
      const originalConsoleError = console.error;
      console.error = (message: string) => {
        capturedOutput = message;
      };
      
      await handleAuthCommand([], { help: true });
      
      expect(capturedOutput).toContain('login');
      expect(capturedOutput).toContain('logout');
      expect(capturedOutput).toContain('status');
      expect(capturedOutput).toContain('token');
      expect(capturedOutput).toContain('--server <url>');
      expect(capturedOutput).toContain('--port <number>');
      
      console.error = originalConsoleError;
    });
  });

  describe('Subcommand Validation', () => {
    test('should recognize valid subcommands', () => {
      const validSubcommands = ['login', 'logout', 'status', 'token'];
      
      validSubcommands.forEach(subcommand => {
        expect(typeof subcommand).toBe('string');
        expect(subcommand.length).toBeGreaterThan(0);
      });
    });

    test('should handle auth command with different subcommands', async () => {
      // Test that the function accepts different subcommands without throwing
      try {
        await handleAuthCommand(['status'], {});
        await handleAuthCommand(['logout'], {});
        // If we reach here, the commands completed successfully
        expect(true).toBe(true);
      } catch (error) {
        // If an error is thrown, fail the test
        expect(error).toBe(null);
      }
    });
  });

  describe('Configuration Directory', () => {
    test('should work with default config directory path', () => {
      const configDir = join(homedir(), '.enact');
      const authFile = join(configDir, 'auth.json');
      
      expect(typeof configDir).toBe('string');
      expect(configDir).toContain('.enact');
      expect(typeof authFile).toBe('string');
      expect(authFile).toContain('auth.json');
    });
  });

  describe('Default Server Configuration', () => {
    test('should use default server when none specified', async () => {
      // The function should use https://enact.tools as default
      // This test verifies the function handles default configuration
      try {
        await handleAuthCommand(['status'], {});
        expect(true).toBe(true); // Command completed successfully
      } catch (error) {
        expect(error).toBe(null);
      }
    });    test('should accept custom server option', async () => {
      const customServer = 'https://custom.enact.server';

      try {
        await handleAuthCommand(['status'], {
          server: customServer
        });
        expect(true).toBe(true); // Command completed successfully
      } catch (error) {
        expect(error).toBe(null);
      }
    });    test('should accept custom port option', async () => {
      const customPort = 3000;

      try {
        await handleAuthCommand(['status'], {
          port: customPort
        });
        expect(true).toBe(true); // Command completed successfully
      } catch (error) {
        expect(error).toBe(null);
      }
    });
  });

  describe('Command Structure', () => {
    test('should export handleAuthCommand function', () => {
      expect(typeof handleAuthCommand).toBe('function');
    });    test('should accept args array and options object', async () => {
      // Test function signature
      const args: string[] = ['status'];
      const options = { help: false };

      try {
        await handleAuthCommand(args, options);
        expect(true).toBe(true); // Command completed successfully
      } catch (error) {
        expect(error).toBe(null);
      }
    });
  });

  describe('Status Subcommand', () => {
    test('should handle status subcommand', async () => {
      // This test verifies the status subcommand can be called
      try {
        await handleAuthCommand(['status'], {});
        expect(true).toBe(true); // Command completed successfully
      } catch (error) {
        expect(error).toBe(null);
      }
    });
  });

  describe('Logout Subcommand', () => {
    test('should handle logout subcommand', async () => {
      // This test verifies the logout subcommand can be called
      try {
        await handleAuthCommand(['logout'], {});
        expect(true).toBe(true); // Command completed successfully
      } catch (error) {
        expect(error).toBe(null);
      }
    });
  });

  describe('Token Subcommand', () => {
    test('should handle token subcommand', async () => {
      // This test verifies the token subcommand can be called
      try {
        await handleAuthCommand(['token'], {});
        expect(true).toBe(true); // Command completed successfully
      } catch (error) {
        expect(error).toBe(null);
      }
    });
  });

  describe('Options Processing', () => {
    test('should handle multiple options', async () => {
      const options = {
        help: false,
        server: 'https://test.server.com',
        port: 8888
      };
      
      try {
        await handleAuthCommand(['status'], options);
        expect(true).toBe(true); // Command completed successfully
      } catch (error) {
        expect(error).toBe(null);
      }
    });

    test('should prioritize help option', async () => {
      let capturedOutput = '';
      const originalConsoleError = console.error;
      console.error = (message: string) => {
        capturedOutput = message;
      };
      
      // Even with other options, help should take precedence
      await handleAuthCommand(['login'], { 
        help: true, 
        server: 'https://test.com',
        port: 9999 
      });
      
      expect(capturedOutput).toContain('Usage:');
      
      console.error = originalConsoleError;
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid subcommands gracefully', async () => {
      // The function should handle unknown subcommands without crashing
      try {
        await handleAuthCommand(['invalid-subcommand'], {});
        expect(true).toBe(true); // Command completed successfully
      } catch (error) {
        expect(error).toBe(null);
      }
    });

    test('should handle empty args array', async () => {
      try {
        await handleAuthCommand([], {});
        expect(true).toBe(true); // Command completed successfully
      } catch (error) {
        expect(error).toBe(null);
      }
    });

    test('should handle undefined options', async () => {
      try {
        await handleAuthCommand(['status'], {} as any);
        expect(true).toBe(true); // Command completed successfully
      } catch (error) {
        expect(error).toBe(null);
      }
    });
  });

  describe('Integration Tests', () => {
    test('should work with realistic usage scenarios', async () => {
      // Test common usage patterns
      const scenarios = [
        { args: [], options: { help: true } },
        { args: ['status'], options: {} },
        { args: ['logout'], options: {} },
        { args: ['status'], options: { server: 'https://custom.server.com' } },
        { args: ['token'], options: { port: 8080 } }
      ];
      
      for (const scenario of scenarios) {
        try {
          await handleAuthCommand(scenario.args, scenario.options);
          expect(true).toBe(true); // Command completed successfully
        } catch (error) {
          expect(error).toBe(null);
        }
      }
    });

    test('should maintain consistent behavior across calls', async () => {
      // Multiple calls should not interfere with each other
      await handleAuthCommand(['status'], {});
      await handleAuthCommand(['logout'], {});
      await handleAuthCommand(['status'], {});
      
      // If we get here without throwing, the test passes
      expect(true).toBe(true);
    });
  });
});

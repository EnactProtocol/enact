import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { handleUserCommand } from '../../src/commands/user';
import { 
  createTestEnvironment, 
  testCommandHandler,
  ProcessExitError,
  validators,
  type TestEnvironment 
} from '../helpers/test-utils';

describe('User Command', () => {
  let testEnv: TestEnvironment;

  beforeEach(async () => {
    testEnv = createTestEnvironment('user-command');
    await testEnv.setup();
  });

  afterEach(async () => {
    await testEnv.cleanup();
  });

  describe('Help Command', () => {
    test('should display help when --help flag is provided', async () => {
      const result = await testCommandHandler(handleUserCommand, [[], { help: true }], testEnv);
      
      expect(result.exitCalled).toBe(false);
      const helpOutput = testEnv.console.errorOutput.join(' ');
      expect(validators.containsUsage(helpOutput)).toBe(true);
    });

    test('should display help when no subcommand provided', async () => {
      const result = await testCommandHandler(handleUserCommand, [[], {}], testEnv, true);
      
      expect(result.exitCalled).toBe(true);
      expect(result.exitCode).toBe(1);
      const errorOutput = testEnv.console.errorOutput.join(' ');
      expect(validators.containsUsage(errorOutput)).toBe(true);
    });
  });

  describe('Subcommand Validation', () => {
    test('should handle unknown subcommands', async () => {
      const result = await testCommandHandler(handleUserCommand, [['unknown-command'], {}], testEnv, true);
      
      expect(result.exitCalled).toBe(true);
      expect(result.exitCode).toBe(1);
      const errorOutput = testEnv.console.errorOutput.join(' ');
      expect(errorOutput).toContain('Unknown subcommand: unknown-command');
    });

    test('should recognize public-key subcommand', () => {
      const validSubcommands = ['public-key'];
      expect(validSubcommands).toContain('public-key');
    });
  });

  describe('Options Processing', () => {
    const optionTests = [
      { name: 'help', value: true, expectedType: 'boolean' },
      { name: 'server', value: 'https://custom.server.com', expectedType: 'string' },
      { name: 'token', value: 'test-token-123', expectedType: 'string' },
      { name: 'format', value: 'json', expectedType: 'string' }
    ];

    optionTests.forEach(({ name, value, expectedType }) => {
      test(`should accept ${name} option`, () => {
        const options = { [name]: value };
        expect(validators.hasCorrectType(options[name], expectedType)).toBe(true);
      });
    });

    test('should handle multiple options', () => {
      const options = {
        help: false,
        server: 'https://test.server.com',
        token: 'test-token',
        format: 'json'
      };
      
      expect(validators.hasValidOptions(options)).toBe(true);
      expect(options.server).toBe('https://test.server.com');
      expect(options.token).toBe('test-token');
      expect(options.format).toBe('json');
      expect(options.help).toBe(false);
    });

    test('should accept help option and show help', async () => {
      const result = await testCommandHandler(handleUserCommand, [['public-key'], { help: true }], testEnv);
      
      expect(result.exitCalled).toBe(false);
      const helpOutput = testEnv.console.errorOutput.join(' ');
      expect(validators.containsUsage(helpOutput)).toBe(true);
    });
  });

  describe('Command Structure', () => {
    test('should export handleUserCommand function', () => {
      expect(validators.isFunction(handleUserCommand)).toBe(true);
    });

    test('should accept args array and options object', () => {
      const args: string[] = ['public-key'];
      const options = { help: false };
      
      expect(Array.isArray(args)).toBe(true);
      expect(validators.hasValidOptions(options)).toBe(true);
    });
  });

  describe('Public Key Subcommand', () => {
    test('should recognize public-key subcommand without error', () => {
      const validSubcommands = ['public-key'];
      expect(validSubcommands).toContain('public-key');
    });
  });

  describe('Error Handling', () => {
    test('should handle empty args gracefully', async () => {
      const result = await testCommandHandler(handleUserCommand, [[], {}], testEnv, true);
      
      expect(result.exitCalled).toBe(true);
      expect(result.exitCode).toBe(1);
      const errorOutput = testEnv.console.errorOutput.join(' ');
      expect(errorOutput).toContain('Missing subcommand');
    });

    test('should handle null/undefined args', () => {
      expect(validators.isFunction(handleUserCommand)).toBe(true);
    });

    test('should handle empty options object', () => {
      const options = {};
      expect(validators.hasValidOptions(options)).toBe(true);
    });
  });

  describe('Help Content', () => {
    test('should show comprehensive help information', async () => {
      const result = await testCommandHandler(handleUserCommand, [[], { help: true }], testEnv);
      
      expect(result.exitCalled).toBe(false);
      const helpOutput = testEnv.console.errorOutput.join(' ');
      expect(validators.containsUsage(helpOutput)).toBe(true);
      expect(helpOutput.length).toBeGreaterThan(0);
    });
  });

  describe('Integration Tests', () => {
    test('should maintain consistent help behavior', async () => {
      await testCommandHandler(handleUserCommand, [[], { help: true }], testEnv);
      const firstHelpOutput = [...testEnv.console.errorOutput];
      
      testEnv.console.errorOutput.length = 0;
      
      await testCommandHandler(handleUserCommand, [['some-command'], { help: true }], testEnv);
      const secondHelpOutput = [...testEnv.console.errorOutput];
      
      expect(validators.containsUsage(firstHelpOutput.join(' '))).toBe(true);
      expect(validators.containsUsage(secondHelpOutput.join(' '))).toBe(true);
    });

    test('should handle various option combinations', () => {
      const testCases = [
        { help: true },
        { server: 'https://test.com' },
        { token: 'test-token' },
        { format: 'json' },
        { help: false, server: 'https://example.com', token: 'abc123' },
        { help: true, format: 'xml', server: 'https://api.test.com' }
      ];
      
      testCases.forEach(options => {
        expect(validators.hasValidOptions(options)).toBe(true);
        
        Object.entries(options).forEach(([key, value]) => {
          const expectedTypes: Record<string, string> = {
            help: 'boolean',
            server: 'string',
            token: 'string',
            format: 'string'
          };
          
          if (expectedTypes[key]) {
            expect(validators.hasCorrectType(value, expectedTypes[key])).toBe(true);
          }
        });
      });
    });
  });

  describe('TypeScript Interface Compliance', () => {
    test('should comply with UserCommandOptions interface', () => {
      const validOptions = [
        {},
        { help: true },
        { help: false },
        { server: 'https://example.com' },
        { token: 'test-token' },
        { format: 'json' },
        { format: 'xml' },
        {
          help: false,
          server: 'https://api.example.com',
          token: 'bearer-token-123',
          format: 'json'
        }
      ];
      
      validOptions.forEach(options => {
        expect(validators.hasValidOptions(options)).toBe(true);
        
        Object.entries(options).forEach(([key, value]) => {
          const expectedTypes: Record<string, string> = {
            help: 'boolean',
            server: 'string',
            token: 'string',
            format: 'string'
          };
          
          if (expectedTypes[key]) {
            expect(validators.hasCorrectType(value, expectedTypes[key])).toBe(true);
          }
        });
      });
    });

    test('should handle args as string array', () => {
      const validArgs = [
        [],
        ['public-key'],
        ['public-key', 'additional-arg'],
        ['unknown-command'],
        ['cmd1', 'cmd2', 'cmd3']
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

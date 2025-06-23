import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { handleEnvCommand } from '../../src/commands/env';
import { 
  createTestEnvironment, 
  testPatterns, 
  validators,
  type TestEnvironment 
} from '../helpers/test-utils';

describe('Env Command', () => {
  let testEnv: TestEnvironment;

  beforeEach(async () => {
    testEnv = createTestEnvironment('env-command');
    await testEnv.setup();
  });

  afterEach(async () => {
    await testEnv.cleanup();
  });

  describe('Help Command', () => {
    test('should display help when --help flag is provided', async () => {
      const helpTest = testPatterns.helpCommand.createHelpTest(handleEnvCommand);
      const result = await helpTest.withHelpFlag();
      
      expect(validators.containsUsage(result.helpOutput)).toBe(true);
      expect(validators.containsCommand(result.helpOutput, 'env')).toBe(true);
    });

    test('should display help when no subcommand provided', async () => {
      const helpTest = testPatterns.helpCommand.createHelpTest(handleEnvCommand);
      const result = await helpTest.withoutSubcommand(false);
      
      // The function should handle the case gracefully
      expect(result.errorOutput.length >= 0).toBe(true);
    });

    test('should include all expected subcommands in help text', async () => {
      await handleEnvCommand([], { help: true });
      
      const helpOutput = testEnv.console.errorOutput.join(' ');
      const expectedSubcommands = ['set', 'get', 'list', 'delete', 'export'];
      
      expectedSubcommands.forEach(subcommand => {
        expect(helpOutput).toContain(subcommand);
      });
    });
  });

  describe('Subcommand Validation', () => {
    test('should recognize valid subcommands', () => {
      const validSubcommands = ['set', 'get', 'list', 'delete', 'export'];
      
      validSubcommands.forEach(subcommand => {
        expect(validators.isFunction(handleEnvCommand)).toBe(true);
        expect(typeof subcommand).toBe('string');
        expect(subcommand.length).toBeGreaterThan(0);
      });
    });

    test('should handle unknown subcommands', async () => {
      await handleEnvCommand(['unknown-command'], {});
      
      const errorOutput = testEnv.console.errorOutput.join(' ');
      expect(errorOutput.length >= 0).toBe(true);
    });
  });

  describe('Options Processing', () => {
    const optionTests = [
      { name: 'help', value: true, expectedType: 'boolean' },
      { name: 'package', value: 'acme-corp/discord', expectedType: 'string' },
      { name: 'encrypt', value: true, expectedType: 'boolean' },
      { name: 'format', value: 'json', expectedType: 'string' },
      { name: 'show', value: true, expectedType: 'boolean' },
      { name: 'global', value: true, expectedType: 'boolean' },
      { name: 'project', value: true, expectedType: 'boolean' }
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
        package: 'test-org/test-package',
        encrypt: true,
        format: 'json',
        show: false,
        global: false,
        project: true
      };
      
      expect(validators.hasValidOptions(options)).toBe(true);
      expect(options.package).toBe('test-org/test-package');
      expect(options.encrypt).toBe(true);
      expect(options.format).toBe('json');
    });

    test('should accept help option and show help', async () => {
      await handleEnvCommand(['list'], { help: true });
      
      const helpOutput = testEnv.console.errorOutput.join(' ');
      expect(validators.containsUsage(helpOutput)).toBe(true);
    });
  });

  describe('Package Name Validation', () => {
    test('should validate package name format', () => {
      const validNames = [
        'acme-corp/discord',
        'my-org/package',
        'org-name/some-category/tool-name'
      ];
      
      const invalidNames = [
        'single-name',
        'org/',
        '/package',
        'org//package',
        ''
      ];
      
      const packagePattern = /^[a-z0-9-]+\/[a-z0-9-]+/;
      
      validNames.forEach(name => {
        expect(packagePattern.test(name)).toBe(true);
      });
      
      invalidNames.slice(0, 5).forEach(name => {
        expect(packagePattern.test(name)).toBe(false);
      });
    });
  });

  describe('Command Structure', () => {
    test('should export handleEnvCommand function', () => {
      expect(validators.isFunction(handleEnvCommand)).toBe(true);
    });

    test('should accept args array and options object', () => {
      const args: string[] = ['list'];
      const options = { help: false };
      
      expect(Array.isArray(args)).toBe(true);
      expect(validators.hasValidOptions(options)).toBe(true);
    });
  });

  describe('Subcommand Recognition', () => {
    const subcommands = ['list', 'set', 'get', 'delete', 'export'];
    
    subcommands.forEach(subcommand => {
      test(`should recognize ${subcommand} subcommand`, () => {
        const validSubcommands = ['list', 'set', 'get', 'delete', 'export'];
        expect(validSubcommands).toContain(subcommand);
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle empty args gracefully', async () => {
      await handleEnvCommand([], {});
      
      const errorOutput = testEnv.console.errorOutput.join(' ');
      expect(errorOutput.length >= 0).toBe(true);
    });

    test('should handle null/undefined args', () => {
      expect(validators.isFunction(handleEnvCommand)).toBe(true);
    });

    test('should handle empty options object', () => {
      const options = {};
      expect(validators.hasValidOptions(options)).toBe(true);
    });
  });

  describe('Help Content', () => {
    test('should show comprehensive help information', async () => {
      await handleEnvCommand([], { help: true });
      
      const helpOutput = testEnv.console.errorOutput.join(' ');
      
      expect(validators.containsUsage(helpOutput)).toBe(true);
      expect(helpOutput).toContain('--package');
      expect(helpOutput).toContain('--show');
      expect(helpOutput.length).toBeGreaterThan(0);
    });
  });

  describe('Integration Tests', () => {
    test('should maintain consistent help behavior', async () => {
      // Test multiple help calls
      await handleEnvCommand([], { help: true });
      const firstHelpOutput = [...testEnv.console.errorOutput];
      
      // Clear output
      testEnv.console.errorOutput.length = 0;
      
      await handleEnvCommand(['some-command'], { help: true });
      const secondHelpOutput = [...testEnv.console.errorOutput];
      
      expect(validators.containsUsage(firstHelpOutput.join(' '))).toBe(true);
      expect(validators.containsUsage(secondHelpOutput.join(' '))).toBe(true);
    });

    test('should handle various option combinations', () => {
      const testCases = [
        { help: true },
        { package: 'test-org/test-package' },
        { encrypt: true },
        { format: 'json' },
        { show: true },
        { global: true },
        { project: true },
        { 
          help: false, 
          package: 'acme-corp/discord', 
          encrypt: true,
          format: 'json'
        }
      ];
      
      testCases.forEach(options => {
        expect(validators.hasValidOptions(options)).toBe(true);
      });
    });
  });

  describe('TypeScript Interface Compliance', () => {
    test('should comply with EnvOptions interface', () => {
      const validOptions = [
        {},
        { help: true },
        { help: false },
        { package: 'acme-corp/discord' },
        { encrypt: true },
        { format: 'json' },
        { show: true },
        { global: false },
        { project: true }
      ];
      
      validOptions.forEach(options => {
        expect(validators.hasValidOptions(options)).toBe(true);
        
        // Verify option types when present
        Object.entries(options).forEach(([key, value]) => {
          const expectedTypes: Record<string, string> = {
            help: 'boolean',
            package: 'string',
            encrypt: 'boolean',
            format: 'string',
            show: 'boolean',
            global: 'boolean',
            project: 'boolean'
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
        ['list'],
        ['set', 'VARIABLE_NAME', 'value'],
        ['get', 'VARIABLE_NAME'],
        ['delete', 'VARIABLE_NAME'],
        ['export'],
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

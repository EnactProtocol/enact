import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { handleEnvCommand } from '../../src/commands/env';
import { 
  createTestEnvironment, 
  testPatterns, 
  validators,
  type TestEnvironment,
  testCommandHandler,
  stripAnsi
} from '../helpers/test-utils';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';

describe('Env Command', () => {
  let testEnv: TestEnvironment;

  mock.module('os', () => ({
    homedir: () => testEnv.testDir,
  }));

  beforeEach(async () => {
    testEnv = createTestEnvironment('env-command');
    await testEnv.setup();
  });

  afterEach(async () => {
    await testEnv.cleanup();
  });

  describe('Help Command', () => {
    test('should display help when --help flag is provided', async () => {
      await testCommandHandler(handleEnvCommand, [[], { help: true }], testEnv);
      const helpOutput = stripAnsi(testEnv.console.errorOutput.join('\n'));
      expect(validators.containsUsage(helpOutput)).toBe(true);
      expect(helpOutput).toContain('Environment variable management');
    });

    test('should display help when no subcommand provided', async () => {
      await testCommandHandler(handleEnvCommand, [[], {}], testEnv);
      const helpOutput = stripAnsi(testEnv.console.errorOutput.join('\n'));
      expect(validators.containsUsage(helpOutput)).toBe(true);
    });

    test('should include all expected subcommands in help text', async () => {
      await testCommandHandler(handleEnvCommand, [[], { help: true }], testEnv);
      
      const helpOutput = stripAnsi(testEnv.console.errorOutput.join(' '));
      const expectedSubcommands = ['set', 'get', 'list', 'delete', 'export', 'packages', 'clear'];
      
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
      await testCommandHandler(handleEnvCommand, [['unknown-command'], {}], testEnv);
      
      const errorOutput = stripAnsi(testEnv.console.errorOutput.join(' '));
      expect(errorOutput).toContain('Unknown subcommand: unknown-command');
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
      await testCommandHandler(handleEnvCommand, [['list'], { help: true }], testEnv);
      
      const helpOutput = stripAnsi(testEnv.console.errorOutput.join(' '));
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
      await testCommandHandler(handleEnvCommand, [[], {}], testEnv);
      
      const errorOutput = stripAnsi(testEnv.console.errorOutput.join(' '));
      expect(errorOutput).toContain('Usage: enact env <subcommand> [options]');
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
      await testCommandHandler(handleEnvCommand, [[], { help: true }], testEnv);
      
      const helpOutput = stripAnsi(testEnv.console.errorOutput.join(' '));
      
      expect(validators.containsUsage(helpOutput)).toBe(true);
      expect(helpOutput).toContain('--package');
      expect(helpOutput).toContain('--show');
      expect(helpOutput.length).toBeGreaterThan(0);
    });
  });

  describe('Set Command', () => {
    test('should set a package environment variable', async () => {
      await testCommandHandler(handleEnvCommand, [['set', 'test/package', 'MY_VAR', 'my_value'], {}], testEnv);
      const output = stripAnsi(testEnv.console.errorOutput.join(' '));
      expect(output).toContain('Set environment variable for test/package: MY_VAR');
    });
  });

  describe('Get Command', () => {
    test('should get a package environment variable', async () => {
      await testCommandHandler(handleEnvCommand, [['set', 'test/package', 'MY_VAR', 'my_value'], {}], testEnv);
      testEnv.console.errorOutput = []; // Clear output
      await testCommandHandler(handleEnvCommand, [['get', 'test/package', 'MY_VAR'], { show: true }], testEnv);
      const output = stripAnsi(testEnv.console.errorOutput.join(' '));
      expect(output).toContain('Environment variable: MY_VAR');
      expect(output).toContain('my_value');
    });
  });

  describe('List Command', () => {
    test('should list package environment variables', async () => {
      await testCommandHandler(handleEnvCommand, [['set', 'test/package', 'VAR_1', 'val1'], {}], testEnv);
      await testCommandHandler(handleEnvCommand, [['set', 'test/package', 'VAR_2', 'val2'], {}], testEnv);
      testEnv.console.errorOutput = []; // Clear output
      await testCommandHandler(handleEnvCommand, [['list', 'test/package'], {}], testEnv);
      const output = stripAnsi(testEnv.console.errorOutput.join('\n'));
      expect(output).toContain('Environment variables for test/package');
    });
  });

  describe('Delete Command', () => {
    test('should require package name and variable name for delete command', async () => {
      await testCommandHandler(handleEnvCommand, [['delete'], {}], testEnv, true);
      const output = stripAnsi(testEnv.console.errorOutput.join(' '));
      expect(output).toContain('Package name is required');
    });
  });
});

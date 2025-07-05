// tests/direct-execution-output-validation.test.ts - Output validation tests for DirectExecutionProvider
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { DirectExecutionProvider } from '../src/core/DirectExecutionProvider';
import { EnactTool, ExecutionEnvironment, ExecutionResult } from '../src/types';

describe('DirectExecutionProvider Output Validation', () => {
  let provider: DirectExecutionProvider;

  beforeEach(() => {
    provider = new DirectExecutionProvider();
  });

  afterEach(async () => {
    await provider.cleanup();
  });

  // Helper function to create basic execution environment
  const createEnvironment = (vars: Record<string, string> = {}): ExecutionEnvironment => ({
    vars,
    resources: { timeout: '10s' }
  });

  describe('JSON Output Parsing', () => {
    it('should parse valid JSON output correctly', async () => {
      const tool: EnactTool = {
        name: 'test/json-output',
        description: 'Tool that outputs JSON',
        command: 'echo \'{"name": "test", "value": 42, "success": true}\'',
        timeout: '5s'
      };

      const result = await provider.execute(tool, {}, createEnvironment());

      expect(result.success).toBe(true);
      expect(result.output).toEqual({
        name: 'test',
        value: 42,
        success: true
      });
      expect(result.metadata.environment).toBe('direct');
    });

    it('should handle complex nested JSON output', async () => {
      const complexJson = {
        users: [
          { id: 1, name: 'Alice', preferences: { theme: 'dark', notifications: true } },
          { id: 2, name: 'Bob', preferences: { theme: 'light', notifications: false } }
        ],
        metadata: {
          total: 2,
          page: 1,
          generated_at: '2025-07-04T10:00:00Z'
        }
      };

      const tool: EnactTool = {
        name: 'test/complex-json',
        description: 'Tool that outputs complex JSON',
        command: `echo '${JSON.stringify(complexJson)}'`,
        timeout: '5s'
      };

      const result = await provider.execute(tool, {}, createEnvironment());

      expect(result.success).toBe(true);
      expect(result.output).toEqual(complexJson);
      expect(result.output.users).toHaveLength(2);
      expect(result.output.users[0].name).toBe('Alice');
      expect(result.output.metadata.total).toBe(2);
    });

    it('should handle JSON with special characters and unicode', async () => {
      const specialJson = {
        message: 'Hello 🌍 World! This has "quotes" and \\backslashes\\',
        unicode: '你好 世界',
        symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
        multiline: 'Line 1\nLine 2\nLine 3'
      };

      const tool: EnactTool = {
        name: 'test/special-json',
        description: 'Tool that outputs JSON with special characters',
        command: `echo '${JSON.stringify(specialJson).replace(/'/g, "\\'")}'`,
        timeout: '5s'
      };

      const result = await provider.execute(tool, {}, createEnvironment());

      expect(result.success).toBe(true);
      expect(result.output.message).toContain('🌍');
      expect(result.output.unicode).toBe('你好 世界');
      expect(result.output.multiline).toContain('\n');
    });
  });

  describe('Non-JSON Output Handling', () => {
    it('should handle plain text output', async () => {
      const tool: EnactTool = {
        name: 'test/text-output',
        description: 'Tool that outputs plain text',
        command: 'echo "This is plain text output"',
        timeout: '5s'
      };

      const result = await provider.execute(tool, {}, createEnvironment());

      expect(result.success).toBe(true);
      expect(result.output).toEqual({
        stdout: 'This is plain text output',
        stderr: ''
      });
    });

    it('should handle multiline text output', async () => {
      const tool: EnactTool = {
        name: 'test/multiline-output',
        description: 'Tool that outputs multiple lines',
        command: 'node -e "console.log(\\"Line 1\\\\nLine 2\\\\nLine 3\\")"',
        timeout: '5s'
      };

      const result = await provider.execute(tool, {}, createEnvironment());

      expect(result.success).toBe(true);
      expect(result.output.stdout).toContain('Line 1');
      expect(result.output.stdout).toContain('Line 2');
      expect(result.output.stdout).toContain('Line 3');
    });

    it('should handle empty output', async () => {
      const tool: EnactTool = {
        name: 'test/empty-output',
        description: 'Tool that produces no output',
        command: 'true', // Command that succeeds but produces no output
        timeout: '5s'
      };

      const result = await provider.execute(tool, {}, createEnvironment());

      expect(result.success).toBe(true);
      expect(result.output).toEqual({
        stdout: '',
        stderr: ''
      });
    });

    it('should handle output with only whitespace', async () => {
      const tool: EnactTool = {
        name: 'test/whitespace-output',
        description: 'Tool that outputs only whitespace',
        command: 'echo "   " && echo "\t" && echo "   "',
        timeout: '5s'
      };

      const result = await provider.execute(tool, {}, createEnvironment());

      expect(result.success).toBe(true);
      expect(result.output.stdout.length).toBeGreaterThan(0);
      expect(result.output.stdout.replace(/\s/g, '')).toBe('');
    });
  });

  describe('Error Output Validation', () => {
    it('should handle stderr output correctly', async () => {
      const tool: EnactTool = {
        name: 'test/stderr-output',
        description: 'Tool that outputs to stderr',
        command: 'sh -c "echo \\"Error message\\" >&2; echo \\"Success message\\""',
        timeout: '5s'
      };

      const result = await provider.execute(tool, {}, createEnvironment());

      expect(result.success).toBe(true);
      expect(result.output.stdout).toContain('Success message');
      expect(result.output.stderr).toContain('Error message');
    });

    it('should handle command failure with error output', async () => {
      const tool: EnactTool = {
        name: 'test/command-failure',
        description: 'Tool that fails with error output',
        command: 'sh -c "echo \\"This failed\\" >&2; exit 1"',
        timeout: '5s'
      };

      const result = await provider.execute(tool, {}, createEnvironment());

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.message).toContain('exit code 1');
      expect(result.error!.code).toBe('COMMAND_FAILED');
      expect(result.error!.details.stderr).toContain('This failed');
      expect(result.error!.details.exitCode).toBe(1);
    });

    it('should handle malformed JSON gracefully', async () => {
      const tool: EnactTool = {
        name: 'test/malformed-json',
        description: 'Tool that outputs malformed JSON',
        command: 'echo \'{"name": "test", "value": 42, "incomplete"\'',
        timeout: '5s'
      };

      const result = await provider.execute(tool, {}, createEnvironment());

      expect(result.success).toBe(true);
      // Should fall back to structured output when JSON parsing fails
      expect(result.output).toEqual({
        stdout: '{"name": "test", "value": 42, "incomplete"',
        stderr: ''
      });
    });
  });

  describe('Template Variable Substitution in Output', () => {
    it('should substitute variables and validate output', async () => {
      const tool: EnactTool = {
        name: 'test/variable-substitution',
        description: 'Tool that uses input variables',
        command: 'echo \'{"input_name": "${name}", "input_value": "${value}", "computed": "processed"}\'',
        timeout: '5s'
      };

      const inputs = {
        name: 'test-item',
        value: '123'
      };

      const result = await provider.execute(tool, inputs, createEnvironment());

      expect(result.success).toBe(true);
      expect(result.output.input_name).toBe('test-item');
      expect(result.output.input_value).toBe('123');
      expect(result.output.computed).toBe('processed');
    });

    it('should handle object and array inputs in substitution', async () => {
      const tool: EnactTool = {
        name: 'test/complex-substitution',
        description: 'Tool that handles complex input types',
        command: 'echo \'{"config": ${config}, "list": ${items}, "simple": "${name}"}\'',
        timeout: '5s'
      };

      const inputs = {
        config: { enabled: true, timeout: 30 },
        items: ['item1', 'item2', 'item3'],
        name: 'test'
      };

      const result = await provider.execute(tool, inputs, createEnvironment());

      expect(result.success).toBe(true);
      expect(result.output.config.enabled).toBe(true);
      expect(result.output.config.timeout).toBe(30);
      expect(result.output.list).toEqual(['item1', 'item2', 'item3']);
      expect(result.output.simple).toBe('test');
    });
  });

  describe('Output Size and Performance', () => {
    it('should handle large output efficiently', async () => {
      const tool: EnactTool = {
        name: 'test/large-output',
        description: 'Tool that produces large output',
        command: 'node -e "for(let i=1; i<=1000; i++) console.log(`Line ${i}: This is a test line with some content`);"',
        timeout: '10s'
      };

      const startTime = Date.now();
      const result = await provider.execute(tool, {}, createEnvironment());
      const executionTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.output.stdout.split('\n').filter(line => line.trim()).length).toBeGreaterThan(900);
      expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle binary-like output gracefully', async () => {
      const tool: EnactTool = {
        name: 'test/binary-output',
        description: 'Tool that outputs binary-like data',
        command: 'node -e "process.stdout.write(Buffer.from([0x00, 0x01, 0x02, 0xFF, 0xFE, 0xFD]))"',
        timeout: '5s'
      };

      const result = await provider.execute(tool, {}, createEnvironment());

      expect(result.success).toBe(true);
      expect(result.output.stdout).toBeDefined();
      expect(typeof result.output.stdout).toBe('string');
    });
  });

  describe('Metadata Validation', () => {
    it('should include correct metadata in successful execution', async () => {
      const tool: EnactTool = {
        name: 'test/metadata-check',
        description: 'Tool for checking metadata',
        command: 'echo "test output"',
        version: '1.2.3',
        timeout: '5s'
      };

      const result = await provider.execute(tool, { input: 'test' }, createEnvironment());

      expect(result.success).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.toolName).toBe('test/metadata-check');
      expect(result.metadata.version).toBe('1.2.3');
      expect(result.metadata.environment).toBe('direct');
      expect(result.metadata.executedAt).toBeDefined();
      expect(result.metadata.executionId).toMatch(/^exec_\d+_[a-z0-9]+$/);
      expect(result.metadata.timeout).toBe('5s');
      expect(result.metadata.command).toContain('echo "test output"');
    });

    it('should include error metadata in failed execution', async () => {
      const tool: EnactTool = {
        name: 'test/error-metadata',
        description: 'Tool for checking error metadata',
        command: 'sh -c "exit 42"',
        version: '2.0.0'
      };

      const result = await provider.execute(tool, {}, createEnvironment());

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe('COMMAND_FAILED');
      expect(result.error!.details.exitCode).toBe(42);
      expect(result.metadata.toolName).toBe('test/error-metadata');
      expect(result.metadata.version).toBe('2.0.0');
    });
  });

  describe('Environment Variable Output Effects', () => {
    it('should reflect environment variables in tool output', async () => {
      const tool: EnactTool = {
        name: 'test/env-output',
        description: 'Tool that outputs environment variable',
        command: 'sh -c "echo \\"TEST_VAR is: $TEST_VAR\\""',
        timeout: '5s'
      };

      const result = await provider.execute(
        tool, 
        {}, 
        createEnvironment({ TEST_VAR: 'hello-world' })
      );

      expect(result.success).toBe(true);
      expect(result.output.stdout).toContain('TEST_VAR is: hello-world');
    });

    it('should handle multiple environment variables', async () => {
      const tool: EnactTool = {
        name: 'test/multi-env',
        description: 'Tool that uses multiple environment variables',
        command: 'sh -c "echo \\"{\\\"var1\\\": \\\"$VAR1\\\", \\\"var2\\\": \\\"$VAR2\\\", \\\"var3\\\": \\\"$VAR3\\\"}\\\""',
        timeout: '5s'
      };

      const result = await provider.execute(
        tool,
        {},
        createEnvironment({
          VAR1: 'value1',
          VAR2: 'value2',
          VAR3: 'value3'
        })
      );

      expect(result.success).toBe(true);
      expect(result.output.var1).toBe('value1');
      expect(result.output.var2).toBe('value2');
      expect(result.output.var3).toBe('value3');
    });
  });

  describe('Edge Cases and Error Conditions', () => {
    it('should handle output with control characters', async () => {
      const tool: EnactTool = {
        name: 'test/control-chars',
        description: 'Tool with control characters in output',
        command: 'node -e "process.stdout.write(\\"Before\\\\rCarriage\\\\nReturn\\\\tTab\\\\bBackspace\\\\fFormFeed\\\\vVerticalTab\\")"',
        timeout: '5s'
      };

      const result = await provider.execute(tool, {}, createEnvironment());

      expect(result.success).toBe(true);
      expect(result.output.stdout).toBeDefined();
      expect(typeof result.output.stdout).toBe('string');
    });

    it('should handle very long single line output', async () => {
      const tool: EnactTool = {
        name: 'test/long-line',
        description: 'Tool with very long single line',
        command: 'node -e "console.log(\\"🎉\\".repeat(10000))"',
        timeout: '10s'
      };

      const result = await provider.execute(tool, {}, createEnvironment());

      expect(result.success).toBe(true);
      expect(result.output.stdout.length).toBeGreaterThan(5000);
    });

    it('should handle mixed stdout and stderr output', async () => {
      const tool: EnactTool = {
        name: 'test/mixed-output',
        description: 'Tool with mixed stdout/stderr',
        command: 'sh -c "echo \\"stdout line 1\\"; echo \\"stderr line 1\\" >&2; echo \\"stdout line 2\\"; echo \\"stderr line 2\\" >&2"',
        timeout: '5s'
      };

      const result = await provider.execute(tool, {}, createEnvironment());

      expect(result.success).toBe(true);
      expect(result.output.stdout).toContain('stdout line 1');
      expect(result.output.stdout).toContain('stdout line 2');
      expect(result.output.stderr).toContain('stderr line 1');
      expect(result.output.stderr).toContain('stderr line 2');
    });
  });

  describe('Command Substitution Edge Cases', () => {
    it('should handle special characters in template substitution', async () => {
      const tool: EnactTool = {
        name: 'test/special-substitution',
        description: 'Tool with special characters in substitution',
        command: 'echo "Value: ${value}"',
        timeout: '5s'
      };

      const specialInput = 'Test with quotes, single quotes, variables, and backslashes';

      const result = await provider.execute(
        tool, 
        { value: specialInput }, 
        createEnvironment()
      );

      expect(result.success).toBe(true);
      expect(result.output.stdout).toContain('Test with quotes');
    });

    it('should handle multiple substitutions of same variable', async () => {
      const tool: EnactTool = {
        name: 'test/multiple-substitution',
        description: 'Tool with multiple same variable substitutions',
        command: 'echo "First: ${name}, Second: ${name}, Third: ${name}"',
        timeout: '5s'
      };

      const result = await provider.execute(
        tool,
        { name: 'repeated-value' },
        createEnvironment()
      );

      expect(result.success).toBe(true);
      expect(result.output.stdout).toBe('First: repeated-value, Second: repeated-value, Third: repeated-value');
    });
  });
});

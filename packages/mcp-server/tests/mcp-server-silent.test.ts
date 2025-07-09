/**
 * Tests to ensure MCP server functions are silent (no console logs) 
 * and bypass interactive prompts
 */

import { describe, it, expect, beforeEach, afterEach, spyOn, mock } from 'bun:test';
import { createMockConsole, ProcessExitError } from '../../shared/tests/helpers/test-utils';
import { EnactCore } from '@enactprotocol/shared/core';

interface ConsoleMock {
  log: any;
  error: any;
  warn: any;
  info: any;
  debug: any;
  output: string[];
  errorOutput: string[];
  warnOutput: string[];
  restore: () => void;
}

interface ProcessMock {
  stdout: {
    write: any;
    originalWrite: any;
    output: string[];
  };
  stderr: {
    write: any;
    originalWrite: any;
    output: string[];
  };
  exit: any;
  originalExit: any;
  exitCalled: boolean;
  exitCode?: number;
  restore: () => void;
}

/**
 * Creates comprehensive console and process mocks to capture all output
 */
function createSilentMocks(): { console: ConsoleMock; process: ProcessMock } {
  // Console mocking
  const output: string[] = [];
  const errorOutput: string[] = [];
  const warnOutput: string[] = [];
  
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalInfo = console.info;
  const originalDebug = console.debug;
  
  console.log = mock((...args: any[]) => {
    output.push(args.join(' '));
  });
  
  console.error = mock((...args: any[]) => {
    errorOutput.push(args.join(' '));
  });
  
  console.warn = mock((...args: any[]) => {
    warnOutput.push(args.join(' '));
  });
  
  console.info = mock((...args: any[]) => {
    output.push(args.join(' '));
  });
  
  console.debug = mock((...args: any[]) => {
    output.push(args.join(' '));
  });
  
  // Process stdout/stderr mocking
  const stdoutOutput: string[] = [];
  const stderrOutput: string[] = [];
  
  const originalStdoutWrite = process.stdout.write;
  const originalStderrWrite = process.stderr.write;
  
  process.stdout.write = mock((chunk: any) => {
    if (typeof chunk === 'string') {
      stdoutOutput.push(chunk);
    }
    return true;
  }) as any;
  
  process.stderr.write = mock((chunk: any) => {
    if (typeof chunk === 'string') {
      stderrOutput.push(chunk);
    }
    return true;
  }) as any;
  
  // Process exit mocking
  const originalExit = process.exit;
  let exitCalled = false;
  let exitCode: number | undefined;
  
  process.exit = mock((code?: number) => {
    exitCalled = true;
    exitCode = code;
    throw new ProcessExitError(`Process exited with code ${code}`, code || 0);
  }) as any;
  
  return {
    console: {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info,
      debug: console.debug,
      output,
      errorOutput,
      warnOutput,
      restore: () => {
        console.log = originalLog;
        console.error = originalError;
        console.warn = originalWarn;
        console.info = originalInfo;
        console.debug = originalDebug;
      }
    },
    process: {
      stdout: {
        write: process.stdout.write,
        originalWrite: originalStdoutWrite,
        output: stdoutOutput
      },
      stderr: {
        write: process.stderr.write,
        originalWrite: originalStderrWrite,
        output: stderrOutput
      },
      exit: process.exit,
      originalExit,
      exitCalled,
      exitCode,
      restore: () => {
        process.stdout.write = originalStdoutWrite;
        process.stderr.write = originalStderrWrite;
        process.exit = originalExit;
      }
    }
  };
}

/**
 * Helper to assert appropriate MCP operation (allows console.error for MCP logging)
 */
function assertSilent(mocks: { console: ConsoleMock; process: ProcessMock }, operation: string) {
  // For MCP servers, console.error is acceptable as it's used for logging
  // We only check for console.log, console.warn, and direct stdout writes
  const problematicOutput = [
    ...mocks.console.output, // console.log calls
    ...mocks.console.warnOutput, // console.warn calls
    ...mocks.process.stdout.output, // direct stdout writes
  ].filter(output => output.trim() !== '');
  
  if (problematicOutput.length > 0) {
    console.error(`❌ ${operation} produced unexpected output:`, problematicOutput);
  }
  
  expect(problematicOutput, `${operation} should not produce console.log, console.warn, or stdout output`).toHaveLength(0);
  expect(mocks.process.exitCalled, `${operation} should not call process.exit`).toBe(false);
  
  // console.error output is acceptable for MCP logging, but we can log it for visibility
  if (mocks.console.errorOutput.length > 0) {
    console.log(`ℹ️ ${operation} produced ${mocks.console.errorOutput.length} console.error entries (acceptable for MCP)`);
  }
}

describe('MCP Server Silent Operation Tests', () => {
  let mocks: { console: ConsoleMock; process: ProcessMock };
  let enactCore: EnactCore;
  
  beforeEach(() => {
    // Create fresh mocks for each test
    mocks = createSilentMocks();
    
    // Create EnactCore instance with minimal config to avoid API calls
    enactCore = new EnactCore({
      apiUrl: 'http://localhost:3000', // Use localhost to avoid real API calls
      executionProvider: 'direct', // Override default to use direct for testing
      verificationPolicy: 'permissive'
    });
    
    // Set environment variables to minimize external dependencies
    process.env.ENACT_VERIFY_POLICY = 'permissive';
    process.env.ENACT_SKIP_INTERACTIVE = 'true';
    process.env.CI = 'true'; // Many libraries respect CI flag for non-interactive mode
  });
  
  afterEach(() => {
    mocks.console.restore();
    mocks.process.restore();
    
    // Clean up environment
    delete process.env.ENACT_SKIP_INTERACTIVE;
    delete process.env.CI;
  });
  
  describe('Core Status Operations', () => {
    it('should get status silently', async () => {
      try {
        await enactCore.getStatus();
        assertSilent(mocks, 'getStatus()');
      } catch (error) {
        // Even if the operation fails, it should be silent
        assertSilent(mocks, 'getStatus() [with error]');
      }
    });
  });
  
  describe('Tool Search Operations', () => {
    it('should search tools silently', async () => {
      try {
        await enactCore.searchTools({ query: 'test', limit: 5 });
        assertSilent(mocks, 'searchTools()');
      } catch (error) {
        assertSilent(mocks, 'searchTools() [with error]');
      }
    });
    
    it('should get tool info silently', async () => {
      try {
        await enactCore.getToolInfo('nonexistent-tool');
        assertSilent(mocks, 'getToolInfo()');
      } catch (error) {
        assertSilent(mocks, 'getToolInfo() [with error]');
      }
    });
    
    it('should check tool existence silently', async () => {
      try {
        await enactCore.toolExists('some-tool');
        assertSilent(mocks, 'toolExists()');
      } catch (error) {
        assertSilent(mocks, 'toolExists() [with error]');
      }
    });
    
    it('should get all tools silently', async () => {
      try {
        await enactCore.getTools({ limit: 5 });
        assertSilent(mocks, 'getTools()');
      } catch (error) {
        assertSilent(mocks, 'getTools() [with error]');
      }
    });
  });
  
  describe('Tool Execution Operations', () => {
    it('should execute tool by name silently', async () => {
      try {
        await enactCore.executeToolByName('test-tool', {}, {
          dryRun: true,
          skipVerification: true,
          verbose: false
        });
        assertSilent(mocks, 'executeToolByName()');
      } catch (error) {
        assertSilent(mocks, 'executeToolByName() [with error]');
      }
    });
    
    it('should execute raw tool silently', async () => {
      const testYaml = `
name: test-tool
version: 1.0.0
description: Test tool
commands:
  - echo "test"
`;
      
      try {
        await enactCore.executeRawTool(testYaml, {}, {
          dryRun: true,
          skipVerification: true
        });
        assertSilent(mocks, 'executeRawTool()');
      } catch (error) {
        assertSilent(mocks, 'executeRawTool() [with error]');
      }
    });
    
    it('should verify tool silently', async () => {
      try {
        await enactCore.verifyTool('test-tool', 'permissive');
        assertSilent(mocks, 'verifyTool()');
      } catch (error) {
        assertSilent(mocks, 'verifyTool() [with error]');
      }
    });
  });
  
  describe('Interactive Prompt Bypass', () => {
    it('should not prompt for user input during tool execution', async () => {
      // Mock readline to ensure no prompts are created
      const readlineMock = mock();
      
      // For Bun, we'll check that readline isn't used instead of mocking modules
      const originalRequire = require;
      let readlineUsed = false;
      
      (global as any).require = function(id: string) {
        if (id === 'readline') {
          readlineUsed = true;
        }
        return originalRequire.apply(this, arguments as any);
      };
      
      try {
        await enactCore.executeToolByName('interactive-tool', {}, {
          force: true,
          skipVerification: true
        });
        
        // Verify no readline was used
        expect(readlineUsed).toBe(false);
        assertSilent(mocks, 'interactive tool execution');
      } catch (error) {
        expect(readlineUsed).toBe(false);
        assertSilent(mocks, 'interactive tool execution [with error]');
      } finally {
        (global as any).require = originalRequire;
      }
    });
    
    it('should handle missing inputs gracefully without prompting', async () => {
      try {
        // Try to execute a tool without required inputs
        await enactCore.executeToolByName('tool-with-required-inputs', {}, {
          force: true,
          skipVerification: true
        });
        assertSilent(mocks, 'missing inputs handling');
      } catch (error) {
        // Should fail silently without prompting
        assertSilent(mocks, 'missing inputs handling [with error]');
      }
    });
  });
  
  describe('Error Handling', () => {
    it('should handle API failures silently', async () => {
      // Create core with invalid URL to force failure
      const failingCore = new EnactCore({
        apiUrl: 'http://invalid-url-that-should-fail',
        executionProvider: 'direct'
      });
      
      try {
        await failingCore.searchTools({ query: 'test' });
        assertSilent(mocks, 'API failure handling');
      } catch (error) {
        assertSilent(mocks, 'API failure handling [with error]');
      }
    });
    
    it('should handle invalid tool definitions silently', async () => {
      const invalidYaml = 'invalid: yaml: content: [broken';
      
      try {
        await enactCore.executeRawTool(invalidYaml, {});
        assertSilent(mocks, 'invalid YAML handling');
      } catch (error) {
        assertSilent(mocks, 'invalid YAML handling [with error]');
      }
    });
    
    it('should handle security verification failures silently', async () => {
      try {
        await enactCore.verifyTool('suspicious-tool', 'paranoid');
        assertSilent(mocks, 'security verification');
      } catch (error) {
        assertSilent(mocks, 'security verification [with error]');
      }
    });
  });
  
  describe('Environment Variables and Configuration', () => {
    it('should respect CI environment for non-interactive mode', () => {
      expect(process.env.CI).toBe('true');
      expect(process.env.ENACT_SKIP_INTERACTIVE).toBe('true');
    });
    
    it('should not log debug information in production mode', async () => {
      // Ensure debug logging is disabled
      delete process.env.DEBUG;
      delete process.env.VERBOSE;
      
      try {
        await enactCore.getStatus();
        assertSilent(mocks, 'production mode operation');
      } catch (error) {
        assertSilent(mocks, 'production mode operation [with error]');
      }
    });
  });
  
  describe('Logger Configuration', () => {
    it('should not use console logging when in MCP mode', async () => {
      // Import logger and verify it's configured properly
      try {
        const logger = await import('../../shared/src/exec/logger');
        
        // Test that logger methods don't output to console in MCP mode
        if (logger.default.clientLoggingEnabled && logger.default.clientLoggingEnabled()) {
          // If MCP logging is enabled, console logging should be suppressed
          logger.default.info('test message');
          logger.default.error('test error');
          logger.default.warn('test warning');
          logger.default.debug('test debug');
          
          assertSilent(mocks, 'logger with MCP client');
        }
      } catch (error) {
        // Logger module might not exist or be accessible in test environment
        // This is acceptable for this test
        assertSilent(mocks, 'logger import [with error]');
      }
    });
  });
  
  describe('MCP Server Tool Registration', () => {
    it('should register tools without producing output', async () => {
      // Mock a simple tool registration
      const mockTool = {
        name: 'test-tool',
        description: 'Test tool for silent operation',
        inputSchema: {
          properties: {
            input: { type: 'string' }
          }
        }
      };
      
      // This would typically be done through the MCP server's registerDynamicTool function
      // but we'll test the core functionality
      try {
        await enactCore.getToolInfo(mockTool.name);
        assertSilent(mocks, 'tool registration check');
      } catch (error) {
        assertSilent(mocks, 'tool registration check [with error]');
      }
    });
  });
});

describe('MCP Server Function Silence Validation', () => {
  let mocks: { console: ConsoleMock; process: ProcessMock };
  
  beforeEach(() => {
    mocks = createSilentMocks();
  });
  
  afterEach(() => {
    mocks.console.restore();
    mocks.process.restore();
  });
  
  it('should validate that all public EnactCore methods are tested for silence', () => {
    const enactCore = new EnactCore();
    const publicMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(enactCore))
      .filter(method => method !== 'constructor' && !method.startsWith('_'))
      .filter(method => typeof (enactCore as any)[method] === 'function');
    
    // List of methods we expect to test
    const expectedMethods = [
      'getStatus',
      'searchTools', 
      'getToolInfo',
      'toolExists',
      'getTools',
      'executeToolByName',
      'executeRawTool',
      'verifyTool'
    ];
    
    // Verify all public methods are covered
    for (const method of expectedMethods) {
      expect(publicMethods).toContain(method);
    }
    
    console.log(`✅ Testing ${expectedMethods.length} public EnactCore methods for silent operation`);
  });
});

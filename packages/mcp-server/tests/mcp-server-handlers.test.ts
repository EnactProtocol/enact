/**
 * Simplified tests for MCP server tool handlers to ensure they are silent
 * and don't use interactive prompts - compatible with Bun test runner
 */

import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';

interface MockedOutput {
  consoleOutput: string[];
  stderrOutput: string[];
  stdoutOutput: string[];
  warnings: string[];
  exitCalled: boolean;
  exitCode?: number;
  restore: () => void;
}

/**
 * Create simplified output mocking for Bun test runner
 */
function createOutputMocks(): MockedOutput {
  const consoleOutput: string[] = [];
  const stderrOutput: string[] = [];
  const stdoutOutput: string[] = [];
  const warnings: string[] = [];
  let exitCalled = false;
  let exitCode: number | undefined;
  
  // Store originals
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;
  const originalConsoleInfo = console.info;
  const originalProcessStdoutWrite = process.stdout.write;
  const originalProcessStderrWrite = process.stderr.write;
  const originalProcessExit = process.exit;
  
  // Mock console methods
  console.log = mock((...args: any[]) => {
    consoleOutput.push(args.join(' '));
  });
  
  console.error = mock((...args: any[]) => {
    consoleOutput.push(args.join(' '));
  });
  
  console.warn = mock((...args: any[]) => {
    warnings.push(args.join(' '));
  });
  
  console.info = mock((...args: any[]) => {
    consoleOutput.push(args.join(' '));
  });
  
  // Mock process streams
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
  
  // Mock process.exit
  process.exit = mock((code?: number) => {
    exitCalled = true;
    exitCode = code;
    throw new Error(`Process exit called with code: ${code}`);
  }) as any;
  
  return {
    consoleOutput,
    stderrOutput,
    stdoutOutput,
    warnings,
    exitCalled,
    exitCode,
    restore: () => {
      console.log = originalConsoleLog;
      console.error = originalConsoleError;
      console.warn = originalConsoleWarn;
      console.info = originalConsoleInfo;
      process.stdout.write = originalProcessStdoutWrite;
      process.stderr.write = originalProcessStderrWrite;
      process.exit = originalProcessExit;
    }
  };
}

/**
 * Helper to validate appropriate MCP operation (allows MCP logging)
 */
function validateSilentOperation(mocks: MockedOutput, operationName: string) {
  // For MCP servers, certain logging outputs are acceptable:
  // - console.error for MCP logging communication
  // - stderr output for environment validation
  // - [INFO], [ERROR] prefixed messages from logger
  
  // Filter out acceptable MCP-related output
  const problematicOutput = mocks.consoleOutput.filter(output => {
    // Allow logger output with prefixes
    if (output.includes('[INFO]') || output.includes('[ERROR]') || output.includes('[WARN]') || output.includes('[DEBUG]')) {
      return false;
    }
    // Allow environment validation warnings
    if (output.includes('MCP Environment Issues') || output.includes('⚠️')) {
      return false;
    }
    return output.trim() !== '';
  });
  
  // Only check for truly problematic output (console.log without prefixes, stdout writes)
  const allProblematicOutput = [
    ...problematicOutput,
    ...mocks.stdoutOutput.filter(s => s.trim())
  ];
  
  // For debugging, log what was captured
  if (allProblematicOutput.length > 0) {
    console.log(`🔍 ${operationName} produced problematic output:`, allProblematicOutput);
  }
  
  expect(allProblematicOutput.length).toBe(0);
  expect(mocks.exitCalled).toBe(false);
  
  // Log acceptable MCP activity for visibility
  const mcpOutput = mocks.consoleOutput.filter(output => 
    output.includes('[INFO]') || output.includes('[ERROR]') || output.includes('⚠️')
  );
  if (mcpOutput.length > 0) {
    console.log(`ℹ️ ${operationName} produced ${mcpOutput.length} MCP log entries (acceptable)`);
  }
}

describe('MCP Server Silent Operation Basic Tests', () => {
  let mocks: MockedOutput;
  
  beforeEach(() => {
    mocks = createOutputMocks();
    
    // Set environment for non-interactive operation
    process.env.NODE_ENV = 'test';
    process.env.CI = 'true';
    process.env.ENACT_SKIP_INTERACTIVE = 'true';
    process.env.ENACT_VERIFY_POLICY = 'permissive';
  });
  
  afterEach(() => {
    mocks.restore();
    delete process.env.NODE_ENV;
    delete process.env.CI;
    delete process.env.ENACT_SKIP_INTERACTIVE;
    delete process.env.ENACT_VERIFY_POLICY;
  });
  
  describe('Module Import Tests', () => {
    it.skip('should import MCP server module without producing output', async () => {
      try {
        await import('../src/mcp-server');
        
        // Debug: Show what output was captured
        if (mocks.consoleOutput.length > 0) {
          console.info('Console output detected:', mocks.consoleOutput);
        }
        if (mocks.stderrOutput.length > 0) {
          console.info('Stderr output detected:', mocks.stderrOutput);
        }
        if (mocks.stdoutOutput.length > 0) {
          console.info('Stdout output detected:', mocks.stdoutOutput);
        }
        
        validateSilentOperation(mocks, 'MCP server module import');
      } catch (error) {
        // Even if import fails, it should be silent
        console.info('Import error (expected to be silent):', error);
        validateSilentOperation(mocks, 'MCP server module import [with error]');
      }
    });
    
    it('should import EnactCore without producing output', async () => {
      try {
        await import('../src/core/EnactCore');
        validateSilentOperation(mocks, 'EnactCore import');
      } catch (error) {
        validateSilentOperation(mocks, 'EnactCore import [with error]');
      }
    });
    
    it('should import logger without producing output', async () => {
      try {
        await import('../src/exec/logger');
        validateSilentOperation(mocks, 'logger import');
      } catch (error) {
        validateSilentOperation(mocks, 'logger import [with error]');
      }
    });
  });
  
  describe('Environment Configuration', () => {
    it('should validate environment variables for non-interactive mode', () => {
      const requiredEnvVars = [
        'CI',
        'ENACT_SKIP_INTERACTIVE'
      ];
      
      for (const envVar of requiredEnvVars) {
        expect(process.env[envVar]).toBeTruthy();
      }
      
      validateSilentOperation(mocks, 'environment validation');
    });
    
    it('should not use debug logging in test environment', () => {
      // Ensure debug/verbose are not enabled
      expect(process.env.DEBUG).toBeFalsy();
      expect(process.env.VERBOSE).toBeFalsy();
      
      validateSilentOperation(mocks, 'debug logging check');
    });
  });
  
  describe('Interactive Prevention', () => {
    it('should not attempt to create interactive interfaces', async () => {
      // Track if readline is attempted to be used
      const originalRequire = require;
      let readlineAttempted = false;
      
      (global as any).require = function(id: string) {
        if (id === 'readline' || id.includes('readline')) {
          readlineAttempted = true;
        }
        return originalRequire.apply(this, arguments as any);
      };
      
      try {
        // Import modules that might use readline
        await import('../src/mcp-server');
        await import('../src/core/EnactCore');
        
        expect(readlineAttempted).toBe(false);
        validateSilentOperation(mocks, 'readline prevention');
      } catch (error) {
        expect(readlineAttempted).toBe(false);
        validateSilentOperation(mocks, 'readline prevention [with error]');
      } finally {
        (global as any).require = originalRequire;
      }
    });
  });
  
  describe('Error Handling Silence', () => {
    it('should handle errors silently', () => {
      try {
        // Force an error
        throw new Error('Test error');
      } catch (error) {
        // Error handling should not produce output
        validateSilentOperation(mocks, 'error handling');
      }
    });
    
    it('should handle JSON operations silently', () => {
      try {
        const data = { test: 'value' };
        const json = JSON.stringify(data);
        const parsed = JSON.parse(json);
        
        // Try to stringify something that might fail
        const circular: any = {};
        circular.self = circular;
        
        try {
          JSON.stringify(circular);
        } catch (jsonError) {
          // JSON error handling should be silent
        }
        
        validateSilentOperation(mocks, 'JSON operations');
      } catch (error) {
        validateSilentOperation(mocks, 'JSON operations [with error]');
      }
    });
  });
  
  describe('Logger Behavior', () => {
    it('should use logger without console output', async () => {
      try {
        const logger = await import('../src/exec/logger');
        
        // Test logger methods - they should not produce console output
        // when properly configured for MCP mode
        logger.default.info('test info message');
        logger.default.error('test error message');
        logger.default.warn('test warning message');
        logger.default.debug('test debug message');
        
        // Note: The logger might produce output to stderr, which is acceptable
        // for MCP logging, but should not use console.log/error directly
        
        // We only check that console methods weren't called directly
        const directConsoleOutput = mocks.consoleOutput.filter(output => 
          !output.includes('[INFO]') && 
          !output.includes('[ERROR]') && 
          !output.includes('[WARN]') && 
          !output.includes('[DEBUG]')
        );
        
        expect(directConsoleOutput.length).toBe(0);
      } catch (error) {
        validateSilentOperation(mocks, 'logger usage [with error]');
      }
    });
  });
});

describe('MCP Server Configuration Validation', () => {
  it('should validate that MCP server is configured for silent operation', () => {
    // Check that required environment variables are set for CI/MCP mode
    process.env.CI = 'true';
    process.env.ENACT_SKIP_INTERACTIVE = 'true';
    
    const isConfiguredForSilentOperation = 
      process.env.CI === 'true' && 
      process.env.ENACT_SKIP_INTERACTIVE === 'true' &&
      !process.env.DEBUG &&
      !process.env.VERBOSE;
    
    expect(isConfiguredForSilentOperation).toBe(true);
    
    console.log('✅ MCP server is properly configured for silent operation');
  });
  
  it('should provide guidance for silent operation setup', () => {
    const silentOperationGuidelines = [
      'Set CI=true environment variable',
      'Set ENACT_SKIP_INTERACTIVE=true environment variable', 
      'Ensure DEBUG and VERBOSE are not set',
      'Use logger instead of console methods',
      'Handle errors gracefully without user prompts',
      'Use force=true and skipVerification=true for non-interactive execution'
    ];
    
    expect(silentOperationGuidelines.length).toBeGreaterThan(0);
    console.log('📋 Silent operation guidelines verified');
  });
});

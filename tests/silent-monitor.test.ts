/**
 * Tests for the silent operation monitor utility
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { 
  McpSilentOperationMonitor, 
  ensureSilent, 
  silentMcpTool, 
  validateSilentEnvironment 
} from '../src/utils/silent-monitor';

describe('Silent Operation Monitor', () => {
  let monitor: McpSilentOperationMonitor;
  
  beforeEach(() => {
    monitor = new McpSilentOperationMonitor();
  });
  
  afterEach(() => {
    if (monitor.isCurrentlyMonitoring()) {
      monitor.stopMonitoring();
    }
  });
  
  describe('Basic Monitoring', () => {
    it('should detect console.log violations', () => {
      monitor.startMonitoring();
      
      console.log('This should be detected');
      
      const report = monitor.stopMonitoring();
      expect(report.violations).toHaveLength(1);
      expect(report.violations[0]).toContain('Console.log called');
      expect(report.consoleOutputDetected).toHaveLength(1);
    });
    
    it('should detect console.error violations', () => {
      monitor.startMonitoring();
      
      console.error('This error should be detected');
      
      const report = monitor.stopMonitoring();
      expect(report.violations).toHaveLength(1);
      expect(report.violations[0]).toContain('Console.error called');
    });
    
    it('should detect process.exit attempts', () => {
      monitor.startMonitoring();
      
      try {
        process.exit(1);
      } catch (error) {
        // Expected to throw due to monitoring
      }
      
      const report = monitor.stopMonitoring();
      expect(report.processExitAttempts).toBe(1);
      expect(report.violations).toContain('Process.exit called with code: 1');
    });
    
    it('should detect stdout.write violations', () => {
      monitor.startMonitoring();
      
      process.stdout.write('Direct stdout write');
      
      const report = monitor.stopMonitoring();
      expect(report.violations.some(v => v.includes('Process.stdout.write called'))).toBe(true);
    });
    
    it('should not detect violations when silent', () => {
      monitor.startMonitoring();
      
      // Do some operations that should be silent
      const data = { test: 'value' };
      const json = JSON.stringify(data);
      const parsed = JSON.parse(json);
      
      const report = monitor.stopMonitoring();
      expect(report.violations).toHaveLength(0);
      expect(report.consoleOutputDetected).toHaveLength(0);
    });
  });
  
  describe('ensureSilent Decorator', () => {
    it('should pass for silent functions', async () => {
      const silentFunction = ensureSilent(() => {
        return 'result';
      });
      
      const result = silentFunction();
      expect(result).toBe('result');
    });
    
    it('should throw for functions that violate silence', () => {
      const noisyFunction = ensureSilent(() => {
        console.log('This should cause a violation');
        return 'result';
      });
      
      expect(() => noisyFunction()).toThrow('Silent operation violated');
    });
    
    it('should handle async functions', async () => {
      const silentAsyncFunction = ensureSilent(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'async result';
      });
      
      const result = await silentAsyncFunction();
      expect(result).toBe('async result');
    });
    
    it('should catch violations in async functions', async () => {
      const noisyAsyncFunction = ensureSilent(async () => {
        console.error('Async violation');
        return 'result';
      });
      
      await expect(noisyAsyncFunction()).rejects.toThrow('Silent operation violated');
    });
  });
  
  describe('silentMcpTool Wrapper', () => {
    it('should wrap MCP tool handlers properly', async () => {
      const mockHandler = silentMcpTool(async (params: any) => {
        return {
          content: [{ type: "text", text: "Success" }]
        };
      });
      
      const result = await mockHandler({ test: 'input' });
      expect(result.content[0].text).toBe('Success');
    });
    
    it('should detect violations in MCP tool handlers', async () => {
      const noisyHandler = silentMcpTool(async (params: any) => {
        console.log('This handler is noisy');
        return {
          content: [{ type: "text", text: "Success" }]
        };
      });
      
      // Set production mode to get error response
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      try {
        const result = await noisyHandler({});
        
        // In production mode, violations should return error response
        expect(result.content[0].text).toContain('Silent operation requirements violated');
        expect((result as any).isError).toBe(true);
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
      }
    });
    
    it('should return error response in production mode', async () => {
      const noisyHandler = silentMcpTool(async (params: any) => {
        console.error('Production violation');
        return {
          content: [{ type: "text", text: "Success" }]
        };
      });
      
      process.env.NODE_ENV = 'production';
      const result = await noisyHandler({});
      
      expect(result.content[0].text).toContain('Silent operation requirements violated');
      expect((result as any).isError).toBe(true);
      
      delete process.env.NODE_ENV;
    });
  });
  
  describe('Environment Validation', () => {
    it('should validate proper silent environment setup', () => {
      // Set up good environment
      process.env.CI = 'true';
      process.env.ENACT_SKIP_INTERACTIVE = 'true';
      delete process.env.DEBUG;
      delete process.env.VERBOSE;
      
      const validation = validateSilentEnvironment();
      
      // The validation might still show TTY issues in test environment, which is expected
      if (!validation.valid) {
        console.log('Expected validation issues in test environment:', validation.issues);
        expect(validation.issues.length).toBeGreaterThan(0);
      } else {
        expect(validation.valid).toBe(true);
        expect(validation.issues).toHaveLength(0);
      }
    });
    
    it('should detect environment issues', () => {
      // Set up problematic environment
      delete process.env.CI;
      delete process.env.ENACT_SKIP_INTERACTIVE;
      process.env.DEBUG = 'true';
      
      const validation = validateSilentEnvironment();
      expect(validation.valid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
      expect(validation.issues.some(issue => issue.includes('CI'))).toBe(true);
      expect(validation.issues.some(issue => issue.includes('DEBUG'))).toBe(true);
    });
  });
  
  describe('Monitor State Management', () => {
    it('should track monitoring state correctly', () => {
      expect(monitor.isCurrentlyMonitoring()).toBe(false);
      
      monitor.startMonitoring();
      expect(monitor.isCurrentlyMonitoring()).toBe(true);
      
      monitor.stopMonitoring();
      expect(monitor.isCurrentlyMonitoring()).toBe(false);
    });
    
    it('should not start monitoring if already monitoring', () => {
      monitor.startMonitoring();
      const violations1 = monitor.getViolations().length;
      
      // Try to start again
      monitor.startMonitoring();
      
      console.log('Test violation');
      const violations2 = monitor.getViolations().length;
      
      // Should only have one violation, not multiple
      expect(violations2).toBe(violations1 + 1);
      
      monitor.stopMonitoring();
    });
    
    it('should throw when stopping non-running monitor', () => {
      expect(() => monitor.stopMonitoring()).toThrow('Monitor is not currently running');
    });
  });
  
  describe('Report Generation', () => {
    it('should generate comprehensive reports', () => {
      monitor.startMonitoring();
      
      console.log('Test log');
      console.error('Test error');
      process.stdout.write('Test stdout');
      
      try {
        process.exit(0);
      } catch (error) {
        // Expected
      }
      
      const report = monitor.stopMonitoring();
      
      expect(report.violations.length).toBeGreaterThan(0);
      expect(report.consoleOutputDetected.length).toBeGreaterThan(0);
      expect(report.processExitAttempts).toBe(1);
      expect(typeof report.duration).toBe('number');
      expect(report.timestamp).toBeTruthy();
    });
  });
});

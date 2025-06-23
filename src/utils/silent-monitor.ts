/**
 * Runtime silent operation monitor for MCP server
 * This utility can be used to ensure the MCP server remains silent during operation
 */

interface SilentOperationMonitor {
  startMonitoring(): void;
  stopMonitoring(): SilentOperationReport;
  isCurrentlyMonitoring(): boolean;
  getViolations(): string[];
}

interface SilentOperationReport {
  violations: string[];
  consoleOutputDetected: string[];
  processExitAttempts: number;
  readlineUsageDetected: boolean;
  duration: number;
  timestamp: string;
}

class McpSilentOperationMonitor implements SilentOperationMonitor {
  private isMonitoring = false;
  private violations: string[] = [];
  private consoleOutput: string[] = [];
  private processExitAttempts = 0;
  private readlineUsageDetected = false;
  private startTime = 0;
  
  private originalConsoleLog: typeof console.log;
  private originalConsoleError: typeof console.error;
  private originalConsoleWarn: typeof console.warn;
  private originalConsoleInfo: typeof console.info;
  private originalProcessExit: typeof process.exit;
  private originalStdoutWrite: typeof process.stdout.write;
  private originalStderrWrite: typeof process.stderr.write;
  
  // Public getters for original methods
  public getOriginalConsoleError(): typeof console.error {
    return this.originalConsoleError;
  }
  
  constructor() {
    // Store original methods
    this.originalConsoleLog = console.log;
    this.originalConsoleError = console.error;
    this.originalConsoleWarn = console.warn;
    this.originalConsoleInfo = console.info;
    this.originalProcessExit = process.exit;
    this.originalStdoutWrite = process.stdout.write;
    this.originalStderrWrite = process.stderr.write;
  }
  
  startMonitoring(): void {
    if (this.isMonitoring) {
      return;
    }
    
    this.isMonitoring = true;
    this.violations = [];
    this.consoleOutput = [];
    this.processExitAttempts = 0;
    this.readlineUsageDetected = false;
    this.startTime = Date.now();
    
    // Hook console methods
    console.log = (...args: any[]) => {
      const message = args.join(' ');
      this.consoleOutput.push(`[LOG] ${message}`);
      this.violations.push(`Console.log called: ${message}`);
    };
    
    console.error = (...args: any[]) => {
      const message = args.join(' ');
      this.consoleOutput.push(`[ERROR] ${message}`);
      this.violations.push(`Console.error called: ${message}`);
    };
    
    console.warn = (...args: any[]) => {
      const message = args.join(' ');
      this.consoleOutput.push(`[WARN] ${message}`);
      this.violations.push(`Console.warn called: ${message}`);
    };
    
    console.info = (...args: any[]) => {
      const message = args.join(' ');
      this.consoleOutput.push(`[INFO] ${message}`);
      this.violations.push(`Console.info called: ${message}`);
    };
    
    // Hook process.exit
    process.exit = ((code?: number) => {
      this.processExitAttempts++;
      this.violations.push(`Process.exit called with code: ${code}`);
      throw new Error(`Process exit intercepted: ${code}`);
    }) as any;
    
    // Hook stdout/stderr
    process.stdout.write = ((chunk: any, ...args: any[]) => {
      if (typeof chunk === 'string' && chunk.trim()) {
        this.consoleOutput.push(`[STDOUT] ${chunk}`);
        this.violations.push(`Process.stdout.write called: ${chunk.substring(0, 100)}...`);
      }
      return true;
    }) as any;
    
    process.stderr.write = ((chunk: any, ...args: any[]) => {
      if (typeof chunk === 'string' && chunk.trim()) {
        this.consoleOutput.push(`[STDERR] ${chunk}`);
        this.violations.push(`Process.stderr.write called: ${chunk.substring(0, 100)}...`);
      }
      return true;
    }) as any;
    
    // Hook readline (if it gets required)
    const originalRequire = require;
    const monitor = this;
    (global as any).require = function(id: string) {
      if (id === 'readline' || id.includes('readline')) {
        monitor.readlineUsageDetected = true;
        monitor.violations.push('Readline module usage detected');
      }
      return originalRequire.apply(this, arguments as any);
    };
  }
  
  stopMonitoring(): SilentOperationReport {
    if (!this.isMonitoring) {
      throw new Error('Monitor is not currently running');
    }
    
    // Restore original methods
    console.log = this.originalConsoleLog;
    console.error = this.originalConsoleError;
    console.warn = this.originalConsoleWarn;
    console.info = this.originalConsoleInfo;
    process.exit = this.originalProcessExit;
    process.stdout.write = this.originalStdoutWrite;
    process.stderr.write = this.originalStderrWrite;
    
    // Restore require
    (global as any).require = require;
    
    this.isMonitoring = false;
    
    return {
      violations: [...this.violations],
      consoleOutputDetected: [...this.consoleOutput],
      processExitAttempts: this.processExitAttempts,
      readlineUsageDetected: this.readlineUsageDetected,
      duration: Date.now() - this.startTime,
      timestamp: new Date().toISOString()
    };
  }
  
  isCurrentlyMonitoring(): boolean {
    return this.isMonitoring;
  }
  
  getViolations(): string[] {
    return [...this.violations];
  }
}

/**
 * Global monitor instance
 */
const globalMonitor = new McpSilentOperationMonitor();

/**
 * Decorator to ensure a function operates silently
 */
export function ensureSilent<T extends (...args: any[]) => any>(fn: T): T {
  return ((...args: any[]) => {
    const wasMonitoring = globalMonitor.isCurrentlyMonitoring();
    
    if (!wasMonitoring) {
      globalMonitor.startMonitoring();
    }
    
    try {
      const result = fn(...args);
      
      // Handle both sync and async functions
      if (result && typeof result.then === 'function') {
        return result.finally(() => {
          if (!wasMonitoring) {
            const report = globalMonitor.stopMonitoring();
            if (report.violations.length > 0) {
              throw new Error(`Silent operation violated: ${report.violations.join(', ')}`);
            }
          }
        });
      } else {
        if (!wasMonitoring) {
          const report = globalMonitor.stopMonitoring();
          if (report.violations.length > 0) {
            throw new Error(`Silent operation violated: ${report.violations.join(', ')}`);
          }
        }
        return result;
      }
    } catch (error) {
      if (!wasMonitoring && globalMonitor.isCurrentlyMonitoring()) {
        globalMonitor.stopMonitoring();
      }
      throw error;
    }
  }) as T;
}

/**
 * Higher-order function to wrap MCP tool handlers for silent operation
 */
export function silentMcpTool<T extends (...args: any[]) => Promise<any>>(handler: T): T {
  return (async (...args: any[]) => {
    const monitor = new McpSilentOperationMonitor();
    monitor.startMonitoring();
    
    try {
      const result = await handler(...args);
      const report = monitor.stopMonitoring();
      
      if (report.violations.length > 0) {
        // Log violations using the original console methods for debugging
        globalMonitor.getOriginalConsoleError()('🚨 MCP Tool Handler Violations:', report.violations);
        
        // In production, you might want to return an error response instead of throwing
        if (process.env.NODE_ENV === 'production') {
          return {
            content: [{ 
              type: "text", 
              text: "Internal error: Silent operation requirements violated" 
            }],
            isError: true
          };
        }
      }
      
      return result;
    } catch (error) {
      const report = monitor.stopMonitoring();
      
      if (report.violations.length > 0) {
        globalMonitor.getOriginalConsoleError()('🚨 MCP Tool Handler Violations during error:', report.violations);
      }
      
      throw error;
    }
  }) as T;
}

/**
 * Utility to check if environment is properly configured for silent operation
 */
export function validateSilentEnvironment(): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  // Check environment variables
  if (process.env.CI !== 'true') {
    issues.push('CI environment variable not set to "true"');
  }
  
  if (process.env.ENACT_SKIP_INTERACTIVE !== 'true') {
    issues.push('ENACT_SKIP_INTERACTIVE not set to "true"');
  }
  
  if (process.env.DEBUG === 'true' || process.env.VERBOSE === 'true') {
    issues.push('DEBUG or VERBOSE environment variables are enabled');
  }
  
  // Check if we're in a TTY (which might indicate interactive mode)
  if (process.stdin.isTTY) {
    issues.push('Process is running in TTY mode (potentially interactive)');
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * Logger specifically for MCP silent operation monitoring
 */
export const silentLogger = {
  logViolation: (violation: string) => {
    // Use stderr directly to bypass any console mocking
    process.stderr.write(`[SILENT-VIOLATION] ${new Date().toISOString()}: ${violation}\n`);
  },
  
  logReport: (report: SilentOperationReport) => {
    if (report.violations.length > 0) {
      process.stderr.write(`[SILENT-REPORT] ${report.timestamp}: ${report.violations.length} violations in ${report.duration}ms\n`);
      report.violations.forEach(violation => {
        process.stderr.write(`  - ${violation}\n`);
      });
    }
  }
};

export { globalMonitor, McpSilentOperationMonitor };
export type { SilentOperationMonitor, SilentOperationReport };

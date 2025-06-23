// src/core/DirectExecutionProvider.ts - Direct execution provider that doesn't use external CLI
import { spawn } from 'child_process';
import { ExecutionProvider, type EnactTool, type ExecutionEnvironment, type ExecutionResult } from "../types.js";
import logger from "../exec/logger.js";

export class DirectExecutionProvider extends ExecutionProvider {
  async resolveEnvironmentVariables(envConfig: Record<string, any>, namespace?: string): Promise<Record<string, any>> {
    const resolved: Record<string, any> = {};
    
    for (const [key, config] of Object.entries(envConfig)) {
      if (typeof config === 'object' && config.source) {
        // Handle different sources
        switch (config.source) {
          case 'env':
            resolved[key] = process.env[key] || config.default;
            break;
          case 'user':
            // Could get from user config file
            resolved[key] = config.default;
            break;
          default:
            resolved[key] = config.default;
        }
      } else {
        // Direct value
        resolved[key] = config;
      }
    }
    
    return resolved;
  }

  async executeCommand(
    command: string, 
    inputs: Record<string, any>, 
    environment: ExecutionEnvironment,
    timeout?: string
  ): Promise<{ stdout: string; stderr: string; exitCode: number; }> {
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      
      // Prepare environment
      const env = {
        ...process.env,
        ...environment.vars
      };
      
      // Parse command and arguments properly handling quoted strings
      const commandParts = this.parseCommand(command);
      const cmd = commandParts[0];
      const args = commandParts.slice(1);
      
      logger.info(`Executing command: ${command}`);
      
      try {
        const proc = spawn(cmd, args, {
          env,
          stdio: ['pipe', 'pipe', 'pipe']
        });
        
        // Collect stdout and stream it in real-time
        proc.stdout.on('data', (data: Buffer) => {
          const chunk = data.toString();
          stdout += chunk;
          // Stream stdout to console in real-time
          process.stdout.write(chunk);
        });
        
        // Collect stderr and stream it in real-time
        proc.stderr.on('data', (data: Buffer) => {
          const chunk = data.toString();
          stderr += chunk;
          // Stream stderr to console in real-time
          process.stderr.write(chunk);
        });
        
        // Handle process completion
        proc.on('close', (code: number) => {
          resolve({ 
            stdout: stdout.trim(), 
            stderr: stderr.trim(), 
            exitCode: code || 0 
          });
        });
        
        // Handle process errors
        proc.on('error', (error: Error) => {
          reject(new Error(`Command execution error: ${error.message}`));
        });
        
        // Set timeout if specified
        if (timeout) {
          const timeoutMs = this.parseTimeout(timeout);
          setTimeout(() => {
            proc.kill('SIGTERM');
            reject(new Error(`Command timed out after ${timeout}`));
          }, timeoutMs);
        }
        
      } catch (spawnError) {
        reject(new Error(`Failed to spawn command: ${spawnError}`));
      }
    });
  }

  async setup(tool: EnactTool): Promise<boolean> {
    // No special setup needed for direct execution
    logger.debug(`Setting up direct execution for tool: ${tool.name}`);
    return true;
  }

  async execute(tool: EnactTool, inputs: Record<string, any>, environment: ExecutionEnvironment): Promise<ExecutionResult> {
    const executionId = this.generateExecutionId();
    const timeout = tool.timeout || environment.resources?.timeout;
    
    // Substitute template variables in command with input values
    let substitutedCommand = tool.command;
    for (const [key, value] of Object.entries(inputs)) {
      const templateVar = `\${${key}}`;
      // Handle different value types
      let substitutionValue: string;
      if (typeof value === 'string') {
        substitutionValue = value;
      } else if (typeof value === 'object') {
        substitutionValue = JSON.stringify(value);
      } else {
        substitutionValue = String(value);
      }
      substitutedCommand = substitutedCommand.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), substitutionValue);
    }
    
    try {
      // Execute the command
      const result = await this.executeCommand(substitutedCommand, inputs, environment, timeout);
      
      // Parse output
      let parsedOutput: any;
      try {
        // Try to parse as JSON first
        parsedOutput = JSON.parse(result.stdout);
      } catch {
        // If not JSON, return structured output
        parsedOutput = {
          stdout: result.stdout,
          stderr: result.stderr
        };
      }
      
      return {
        success: result.exitCode === 0,
        output: parsedOutput,
        ...(result.exitCode !== 0 && {
          error: {
            message: `Command failed with exit code ${result.exitCode}`,
            code: 'COMMAND_FAILED',
            details: { 
              stdout: result.stdout, 
              stderr: result.stderr,
              command: substitutedCommand, // Show the substituted command
              exitCode: result.exitCode
            }
          }
        }),
        metadata: {
          executionId,
          toolName: tool.name,
          version: tool.version,
          executedAt: new Date().toISOString(),
          environment: 'direct',
          timeout,
          command: substitutedCommand // Show the substituted command in metadata
        }
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message: (error as Error).message,
          code: 'EXECUTION_ERROR',
          details: error
        },
        metadata: {
          executionId,
          toolName: tool.name,
          version: tool.version,
          executedAt: new Date().toISOString(),
          environment: 'direct'
        }
      };
    }
  }

  async cleanup(): Promise<boolean> {
    // No cleanup needed for direct execution
    return true;
  }

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private parseTimeout(timeout: string): number {
    const match = timeout.match(/^(\d+)([smh])$/);
    if (!match) {
      throw new Error(`Invalid timeout format: ${timeout}`);
    }
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      default:
        throw new Error(`Unknown timeout unit: ${unit}`);
    }
  }

  private parseCommand(command: string): string[] {
    const parts: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';
    let i = 0;
    
    while (i < command.length) {
      const char = command[i];
      
      if (!inQuotes && (char === '"' || char === "'")) {
        // Start of quoted section
        inQuotes = true;
        quoteChar = char;
      } else if (inQuotes && char === quoteChar) {
        // End of quoted section
        inQuotes = false;
        quoteChar = '';
      } else if (!inQuotes && char === ' ') {
        // Space outside quotes - end current part
        if (current.length > 0) {
          parts.push(current);
          current = '';
        }
        // Skip whitespace
        while (i + 1 < command.length && command[i + 1] === ' ') {
          i++;
        }
      } else {
        // Regular character or space inside quotes
        current += char;
      }
      
      i++;
    }
    
    // Add the last part if it exists
    if (current.length > 0) {
      parts.push(current);
    }
    
    return parts;
  }
}

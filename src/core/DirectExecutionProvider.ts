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
      
      // Parse command and arguments
      const commandParts = command.split(' ');
      const cmd = commandParts[0];
      const args = commandParts.slice(1);
      
      logger.info(`Executing command: ${command}`);
      
      try {
        const proc = spawn(cmd, args, {
          env,
          stdio: ['pipe', 'pipe', 'pipe']
        });
        
        // Collect stdout
        proc.stdout.on('data', (data: Buffer) => {
          const chunk = data.toString();
          stdout += chunk;
          logger.debug(`[STDOUT] ${chunk.trim()}`);
        });
        
        // Collect stderr
        proc.stderr.on('data', (data: Buffer) => {
          const chunk = data.toString();
          stderr += chunk;
          logger.debug(`[STDERR] ${chunk.trim()}`);
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
    
    try {
      // Execute the command
      const result = await this.executeCommand(tool.command, inputs, environment, timeout);
      
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
              command: tool.command
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
          command: tool.command
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
}

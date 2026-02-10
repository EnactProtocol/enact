/**
 * Local Execution Provider
 *
 * Executes commands directly on the host system without containerization.
 * This is faster but provides no isolation or sandboxing.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Action, ActionsManifest, ToolManifest } from "@enactprotocol/shared";
import {
  applyDefaults,
  getEffectiveInputSchema,
  prepareActionCommand,
  prepareCommand,
  validateInputs,
} from "@enactprotocol/shared";
import type {
  EngineHealth,
  ExecutionErrorCode,
  ExecutionInput,
  ExecutionMetadata,
  ExecutionOptions,
  ExecutionOutput,
  ExecutionProvider,
  ExecutionResult,
} from "@enactprotocol/shared";

/**
 * Configuration for the local execution provider
 */
export interface LocalProviderConfig {
  /** Default timeout in milliseconds */
  defaultTimeout?: number;
  /** Enable verbose logging */
  verbose?: boolean;
  /** Working directory for execution (defaults to skill directory) */
  workdir?: string;
}

/**
 * Provider for executing commands directly on the host system
 *
 * WARNING: This provider offers no sandboxing or isolation.
 * Commands have full access to the filesystem and network.
 */
export class LocalExecutionProvider implements ExecutionProvider {
  readonly name = "local";
  private defaultTimeout: number;
  private workdir: string | undefined;

  constructor(config: LocalProviderConfig = {}) {
    this.defaultTimeout = config.defaultTimeout ?? 300000; // 5 minutes
    this.workdir = config.workdir;
  }

  /**
   * Initialize the provider
   */
  async initialize(): Promise<void> {
    // No initialization needed for local execution
  }

  /**
   * Check if the provider is available (always true for local)
   */
  async isAvailable(): Promise<boolean> {
    return true;
  }

  /**
   * Get provider health status
   */
  async getHealth(): Promise<EngineHealth> {
    return {
      healthy: true,
      runtime: "docker", // N/A but required by interface
      consecutiveFailures: 0,
    };
  }

  /**
   * Generate a unique execution ID
   */
  private generateExecutionId(): string {
    return `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * Parse a timeout string to milliseconds
   */
  private parseTimeout(timeout?: string): number {
    if (!timeout) {
      return this.defaultTimeout ?? 300000;
    }

    const match = timeout.match(/^(\d+)(ms|s|m|h)?$/);
    if (!match) {
      return this.defaultTimeout ?? 300000;
    }

    const value = Number.parseInt(match[1] ?? "300000", 10);
    const unit = match[2] ?? "ms";

    switch (unit) {
      case "ms":
        return value;
      case "s":
        return value * 1000;
      case "m":
        return value * 60000;
      case "h":
        return value * 3600000;
      default:
        return value;
    }
  }

  /**
   * Create an error result
   */
  private createErrorResult(
    toolName: string,
    executionId: string,
    startTime: Date,
    code: ExecutionErrorCode,
    message: string
  ): ExecutionResult {
    const endTime = new Date();
    return {
      success: false,
      output: {
        stdout: "",
        stderr: message,
        exitCode: 1,
      },
      metadata: {
        toolName,
        containerImage: "local",
        startTime,
        endTime,
        durationMs: endTime.getTime() - startTime.getTime(),
        cached: false,
        executionId,
      },
      error: {
        code,
        message,
      },
    };
  }

  /**
   * Run build commands if specified
   */
  private async runBuild(
    build: string | string[],
    cwd: string,
    env: Record<string, string>
  ): Promise<void> {
    const commands = Array.isArray(build) ? build : [build];

    for (const command of commands) {
      await this.runCommand(command.split(/\s+/), cwd, env, 600000); // 10 min timeout for build
    }
  }

  /**
   * Run a command and return the output
   */
  private runCommand(
    commandArray: string[],
    cwd: string,
    env: Record<string, string>,
    timeoutMs: number
  ): Promise<ExecutionOutput> {
    return new Promise((resolve, reject) => {
      const [cmd, ...args] = commandArray;
      if (!cmd) {
        reject(new Error("Empty command"));
        return;
      }

      const child = spawn(cmd, args, {
        cwd,
        env: { ...process.env, ...env },
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
        setTimeout(() => child.kill("SIGKILL"), 5000);
      }, timeoutMs);

      child.stdout?.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr?.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      child.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });

      child.on("close", (exitCode) => {
        clearTimeout(timer);

        if (timedOut) {
          reject(new Error("TIMEOUT"));
          return;
        }

        resolve({
          stdout,
          stderr,
          exitCode: exitCode ?? 1,
        });
      });
    });
  }

  /**
   * Execute a tool (for compatibility - uses manifest.command)
   */
  async execute(
    manifest: ToolManifest,
    input: ExecutionInput,
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult> {
    const startTime = new Date();
    const executionId = this.generateExecutionId();

    if (!manifest.command) {
      return this.createErrorResult(
        manifest.name,
        executionId,
        startTime,
        "COMMAND_ERROR",
        "No command specified in manifest"
      );
    }

    const workdir = options.workdir ?? this.workdir ?? process.cwd();
    const timeoutMs = this.parseTimeout(options.timeout ?? manifest.timeout);

    // Build environment
    const env: Record<string, string> = {
      ...input.envOverrides,
    };

    try {
      // Interpolate parameters and prepare command array
      const commandArray = prepareCommand(manifest.command, input.params);
      const output = await this.runCommand(commandArray, workdir, env, timeoutMs);

      const endTime = new Date();
      const metadata: ExecutionMetadata = {
        toolName: manifest.name,
        containerImage: "local",
        startTime,
        endTime,
        durationMs: endTime.getTime() - startTime.getTime(),
        cached: false,
        executionId,
      };

      if (output.exitCode !== 0) {
        return {
          success: false,
          output,
          metadata,
          error: {
            code: "COMMAND_ERROR",
            message: `Command exited with code ${output.exitCode}`,
          },
        };
      }

      return {
        success: true,
        output,
        metadata,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      let code: ExecutionErrorCode = "COMMAND_ERROR";

      if (message === "TIMEOUT") {
        code = "TIMEOUT";
      }

      return this.createErrorResult(manifest.name, executionId, startTime, code, message);
    }
  }

  /**
   * Execute a raw command
   */
  async exec(
    manifest: ToolManifest,
    command: string,
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult> {
    const execManifest: ToolManifest = {
      ...manifest,
      command,
    };
    return this.execute(execManifest, { params: {} }, options);
  }

  /**
   * Execute an action from ACTIONS.yaml
   */
  async executeAction(
    manifest: ToolManifest,
    actionsManifest: ActionsManifest,
    actionName: string,
    action: Action,
    input: ExecutionInput,
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult> {
    const startTime = new Date();
    const executionId = this.generateExecutionId();

    // Get effective inputSchema (defaults to empty if not provided)
    const effectiveSchema = getEffectiveInputSchema(action);

    // Validate inputs against action's inputSchema
    const validation = validateInputs(input.params, effectiveSchema);
    if (!validation.valid) {
      const errorMessages = validation.errors.map((e) => `${e.path}: ${e.message}`);
      return this.createErrorResult(
        `${manifest.name}:${actionName}`,
        executionId,
        startTime,
        "VALIDATION_ERROR",
        `Input validation failed: ${errorMessages.join(", ")}`
      );
    }

    // Apply defaults to inputs
    const params = applyDefaults(input.params, effectiveSchema);

    // Prepare the command using {{param}} template system
    let commandArray: string[];
    try {
      const actionCommand = action.command;
      if (typeof actionCommand === "string") {
        // String-form command (no templates allowed - validation ensures this)
        commandArray = actionCommand.split(/\s+/).filter((s) => s.length > 0);
      } else {
        // Array-form command with {{param}} templates
        commandArray = prepareActionCommand(actionCommand, params, effectiveSchema);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return this.createErrorResult(
        `${manifest.name}:${actionName}`,
        executionId,
        startTime,
        "COMMAND_ERROR",
        `Failed to prepare action command: ${message}`
      );
    }

    if (commandArray.length === 0) {
      return this.createErrorResult(
        `${manifest.name}:${actionName}`,
        executionId,
        startTime,
        "COMMAND_ERROR",
        "Action command is empty"
      );
    }

    const workdir = options.workdir ?? this.workdir ?? process.cwd();
    const timeoutMs = this.parseTimeout(options.timeout ?? manifest.timeout);

    // Build environment
    const env: Record<string, string> = {
      ...input.envOverrides,
    };

    // Add env from actions manifest
    if (actionsManifest.env) {
      for (const [key, envVar] of Object.entries(actionsManifest.env)) {
        if (envVar.default && !env[key]) {
          env[key] = envVar.default;
        }
      }
    }

    try {
      // Run build commands if present
      if (actionsManifest.build) {
        await this.runBuild(actionsManifest.build, workdir, env);
      }

      // Execute the action command
      const output = await this.runCommand(commandArray, workdir, env, timeoutMs);

      const endTime = new Date();
      const metadata: ExecutionMetadata = {
        toolName: `${manifest.name}:${actionName}`,
        containerImage: "local",
        startTime,
        endTime,
        durationMs: endTime.getTime() - startTime.getTime(),
        cached: false,
        executionId,
      };

      if (manifest.version) {
        metadata.toolVersion = manifest.version;
      }

      if (output.exitCode !== 0) {
        return {
          success: false,
          output,
          metadata,
          error: {
            code: "COMMAND_ERROR",
            message: `Action "${actionName}" exited with code ${output.exitCode}`,
            ...(output.stderr && { details: { stderr: output.stderr } }),
          },
        };
      }

      // Validate output against outputSchema if defined
      if (action.outputSchema && output.stdout) {
        try {
          const parsed = JSON.parse(output.stdout);
          output.parsed = parsed;
        } catch {
          // Output is not JSON - that's OK, leave as string
        }
      }

      return {
        success: true,
        output,
        metadata,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      let code: ExecutionErrorCode = "COMMAND_ERROR";

      if (message.startsWith("BUILD_ERROR:") || message.includes("build")) {
        code = "BUILD_ERROR";
      } else if (message === "TIMEOUT") {
        code = "TIMEOUT";
      }

      return this.createErrorResult(
        `${manifest.name}:${actionName}`,
        executionId,
        startTime,
        code,
        message
      );
    }
  }

  /**
   * Shutdown the provider (no-op for local)
   */
  async shutdown(): Promise<void> {
    // Nothing to clean up
  }
}

/**
 * Check if a directory has a Containerfile or Dockerfile
 */
export function hasContainerfile(dir: string): boolean {
  return existsSync(join(dir, "Containerfile")) || existsSync(join(dir, "Dockerfile"));
}

/**
 * Determine the execution mode based on skill directory and options
 */
export function selectExecutionMode(
  skillDir: string,
  options: { local?: boolean; container?: boolean }
): "local" | "container" {
  if (options.local) {
    return "local";
  }

  if (options.container) {
    return "container";
  }

  // Default: container if Containerfile exists, else local
  return hasContainerfile(skillDir) ? "container" : "local";
}

/**
 * Create a local execution provider
 */
export function createLocalProvider(config: LocalProviderConfig = {}): LocalExecutionProvider {
  return new LocalExecutionProvider(config);
}

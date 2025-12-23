/**
 * Dagger Execution Provider
 *
 * Main execution provider that uses Dagger SDK to run
 * containerized commands for Enact tools.
 */

import { type Client, type Container, connect } from "@dagger.io/dagger";
import type { ToolManifest } from "@enactprotocol/shared";
import {
  applyDefaults,
  detectRuntime,
  interpolateCommand,
  validateInputs,
} from "@enactprotocol/shared";
import type {
  ContainerRuntime,
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
 * Configuration for the Dagger execution provider
 */
export interface DaggerProviderConfig {
  /** Default timeout in milliseconds */
  defaultTimeout?: number;
  /** Preferred container runtime */
  preferredRuntime?: ContainerRuntime;
  /** Enable verbose logging */
  verbose?: boolean;
  /** Working directory for execution */
  workdir?: string;
}

/**
 * Provider for executing containerized commands via Dagger
 *
 * Implements the ExecutionProvider interface for running tools
 * in isolated containers using the Dagger SDK.
 */
export class DaggerExecutionProvider implements ExecutionProvider {
  readonly name = "dagger";
  private config: DaggerProviderConfig;
  private detectedRuntime: ContainerRuntime | null = null;
  private initialized = false;
  private lastHealthCheck: Date | null = null;
  private consecutiveFailures = 0;

  constructor(config: DaggerProviderConfig = {}) {
    this.config = {
      defaultTimeout: config.defaultTimeout ?? 300000, // 5 minutes
      verbose: config.verbose ?? false,
      workdir: config.workdir ?? "/work",
    };
    // Only set preferredRuntime if provided
    if (config.preferredRuntime) {
      this.config.preferredRuntime = config.preferredRuntime;
    }
  }

  /**
   * Initialize the provider
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const detection = detectRuntime();
    if (detection.found && detection.runtime) {
      this.detectedRuntime = detection.runtime;
    }

    this.initialized = true;
  }

  /**
   * Check if the provider is available
   */
  async isAvailable(): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.detectedRuntime !== null;
  }

  /**
   * Get provider health status
   */
  async getHealth(): Promise<EngineHealth> {
    if (!this.initialized) {
      await this.initialize();
    }

    const healthy = this.detectedRuntime !== null;

    const health: EngineHealth = {
      healthy,
      runtime: this.detectedRuntime ?? "docker",
      consecutiveFailures: this.consecutiveFailures,
    };

    if (!healthy) {
      health.error = "No container runtime available";
    }

    if (this.lastHealthCheck) {
      health.lastSuccess = this.lastHealthCheck;
    }

    return health;
  }

  /**
   * Execute a tool
   */
  async execute(
    manifest: ToolManifest,
    input: ExecutionInput,
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult> {
    const startTime = new Date();
    const executionId = this.generateExecutionId();

    // Get container image from manifest
    const containerImage = manifest.from ?? "alpine:latest";

    // Ensure initialized
    if (!this.initialized) {
      await this.initialize();
    }

    // Check runtime availability
    if (!this.detectedRuntime) {
      return this.createErrorResult(
        manifest.name,
        containerImage,
        executionId,
        startTime,
        "RUNTIME_NOT_FOUND",
        "No container runtime available (docker, podman, or nerdctl required)"
      );
    }

    // Validate inputs against schema
    if (manifest.inputSchema) {
      const validation = validateInputs(input.params, manifest.inputSchema);
      if (!validation.valid) {
        const errorMessages = validation.errors.map((e) => `${e.path}: ${e.message}`);
        return this.createErrorResult(
          manifest.name,
          containerImage,
          executionId,
          startTime,
          "VALIDATION_ERROR",
          `Input validation failed: ${errorMessages.join(", ")}`
        );
      }
    }

    // Apply defaults to inputs
    const params = manifest.inputSchema
      ? applyDefaults(input.params, manifest.inputSchema)
      : input.params;

    // Get the command from the manifest
    const command = manifest.command;
    if (!command) {
      return this.createErrorResult(
        manifest.name,
        containerImage,
        executionId,
        startTime,
        "COMMAND_ERROR",
        "No command defined in tool manifest"
      );
    }

    // Interpolate command with parameters - only substitute known inputSchema params
    const knownParameters = manifest.inputSchema?.properties
      ? new Set(Object.keys(manifest.inputSchema.properties))
      : undefined;
    const interpolated = interpolateCommand(
      command,
      params,
      knownParameters ? { knownParameters } : {}
    );

    // Parse timeout
    const timeoutMs = this.parseTimeout(options.timeout ?? manifest.timeout);

    // Execute with Dagger
    try {
      const output = await this.runContainer(
        manifest,
        containerImage,
        interpolated,
        input,
        options,
        timeoutMs
      );

      const endTime = new Date();
      this.consecutiveFailures = 0;
      this.lastHealthCheck = endTime;

      const metadata: ExecutionMetadata = {
        toolName: manifest.name,
        containerImage,
        startTime,
        endTime,
        durationMs: endTime.getTime() - startTime.getTime(),
        cached: false,
        executionId,
      };

      // Add version if defined
      if (manifest.version) {
        metadata.toolVersion = manifest.version;
      }

      if (output.exitCode !== 0) {
        const result: ExecutionResult = {
          success: false,
          output,
          metadata,
          error: {
            code: "COMMAND_ERROR",
            message: `Command exited with code ${output.exitCode}`,
            ...(output.stderr && { details: { stderr: output.stderr } }),
          },
        };
        return result;
      }

      return {
        success: true,
        output,
        metadata,
      };
    } catch (error) {
      this.consecutiveFailures++;
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Determine error code
      let code: ExecutionErrorCode = "CONTAINER_ERROR";
      if (errorMessage.includes("timeout") || errorMessage === "TIMEOUT") {
        code = "TIMEOUT";
      } else if (errorMessage.includes("network")) {
        code = "NETWORK_ERROR";
      } else if (errorMessage.includes("engine")) {
        code = "ENGINE_ERROR";
      }

      return this.createErrorResult(
        manifest.name,
        containerImage,
        executionId,
        startTime,
        code,
        `Container execution failed: ${errorMessage}`
      );
    }
  }

  /**
   * Execute a raw command in a tool's container
   */
  async exec(
    manifest: ToolManifest,
    command: string,
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult> {
    // Create a minimal input for raw command execution
    const input: ExecutionInput = {
      params: {},
    };

    // Create a modified manifest with the raw command
    const execManifest: ToolManifest = {
      ...manifest,
      command,
    };

    return this.execute(execManifest, input, options);
  }

  /**
   * Shutdown the provider
   */
  async shutdown(): Promise<void> {
    this.initialized = false;
    this.detectedRuntime = null;
  }

  /**
   * Run the container and capture output
   */
  private async runContainer(
    manifest: ToolManifest,
    containerImage: string,
    command: string,
    input: ExecutionInput,
    options: ExecutionOptions,
    timeoutMs: number
  ): Promise<ExecutionOutput> {
    return new Promise<ExecutionOutput>((resolve, reject) => {
      connect(
        async (client: Client) => {
          try {
            // Create container from image - this may trigger a pull
            // We do this BEFORE starting the timeout so image download
            // time doesn't count against the execution timeout
            let container: Container = client.container().from(containerImage);

            // Force the image to be pulled by accessing a property
            // This ensures the pull happens before we start the execution timeout
            await container.platform();

            // Set working directory
            const workdir = options.workdir ?? this.config.workdir ?? "/work";
            container = container.withWorkdir(workdir);

            // Add environment variables from manifest
            if (manifest.env) {
              for (const [key, envVar] of Object.entries(manifest.env)) {
                // Only add non-secret env vars with defaults here
                if (!envVar.secret && envVar.default) {
                  container = container.withEnvVariable(key, envVar.default);
                }
              }
            }

            // Add additional environment variables from options
            if (options.additionalEnv) {
              for (const [key, value] of Object.entries(options.additionalEnv)) {
                container = container.withEnvVariable(key, String(value));
              }
            }

            // Add environment variable overrides from input
            if (input.envOverrides) {
              for (const [key, value] of Object.entries(input.envOverrides)) {
                container = container.withEnvVariable(key, value);
              }
            }

            // Add secrets from input overrides (using Dagger URIs)
            if (input.secretOverrides) {
              for (const [key, secretUri] of Object.entries(input.secretOverrides)) {
                const secret = client.secret(secretUri);
                container = container.withSecretVariable(key, secret);
              }
            }

            // Mount host directories if specified
            if (options.mountDirs) {
              for (const [source, target] of Object.entries(options.mountDirs)) {
                container = container.withMountedDirectory(target, client.host().directory(source));
              }
            }

            // Mount input files
            if (input.files) {
              for (const [name, fileInput] of Object.entries(input.files)) {
                if (fileInput.content) {
                  // Create file from content
                  const content =
                    typeof fileInput.content === "string"
                      ? fileInput.content
                      : fileInput.content.toString("utf-8");
                  const file = client.directory().withNewFile(name, content);
                  container = container.withDirectory(fileInput.targetPath, file);
                } else if (fileInput.sourcePath) {
                  // Mount from host
                  container = container.withMountedDirectory(
                    fileInput.targetPath,
                    client.host().directory(fileInput.sourcePath)
                  );
                }
              }
            }

            // Run build commands if specified (cached by Dagger)
            // Build runs OUTSIDE the timeout - it's cached and shouldn't count against execution time
            if (manifest.build) {
              const buildCommands = Array.isArray(manifest.build)
                ? manifest.build
                : [manifest.build];
              for (const buildCmd of buildCommands) {
                container = container.withExec(["sh", "-c", buildCmd]);
              }
              // Force build to complete (triggers caching)
              await container.sync();
            }

            // Now start the timeout for actual command execution only
            const timeoutId = setTimeout(() => {
              reject(new Error("TIMEOUT"));
            }, timeoutMs);

            try {
              // Execute the main command (this is what the timeout applies to)
              const shellCommand = ["sh", "-c", command];
              container = container.withExec(shellCommand);

              // Capture stdout and stderr
              // Note: Newer Dagger versions use sync() to get the final container state
              const finalContainer = await container.sync();
              const [stdout, stderr] = await Promise.all([
                finalContainer.stdout(),
                finalContainer.stderr(),
              ]);
              // Exit code is determined by whether stderr contains errors
              const exitCode = stderr ? 1 : 0;

              clearTimeout(timeoutId);

              // Build output object
              const output: ExecutionOutput = {
                stdout,
                stderr,
                exitCode,
              };

              // Extract output files if requested
              if (options.outputFiles && options.outputFiles.length > 0) {
                const extractedFiles: Record<string, Buffer> = {};
                for (const filePath of options.outputFiles) {
                  try {
                    const content = await container.file(filePath).contents();
                    extractedFiles[filePath] = Buffer.from(content);
                  } catch {
                    // File doesn't exist or can't be read - skip
                  }
                }
                if (Object.keys(extractedFiles).length > 0) {
                  output.files = extractedFiles;
                }
              }

              resolve(output);
            } catch (error) {
              clearTimeout(timeoutId);
              throw error;
            }
          } catch (error) {
            reject(error);
          }
        },
        this.config.verbose ? { LogOutput: process.stderr } : {}
      ).catch((error) => {
        reject(error);
      });
    });
  }

  /**
   * Generate a unique execution ID
   */
  private generateExecutionId(): string {
    return `dagger-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Parse timeout string to milliseconds
   */
  private parseTimeout(timeout?: string): number {
    if (!timeout) {
      return this.config.defaultTimeout ?? 300000;
    }

    // Parse formats like "30s", "5m", "1h"
    const match = timeout.match(/^(\d+)(s|m|h)?$/);
    if (!match) {
      return this.config.defaultTimeout ?? 300000;
    }

    const value = Number.parseInt(match[1] ?? "0", 10);
    const unit = match[2] || "s";

    switch (unit) {
      case "h":
        return value * 60 * 60 * 1000;
      case "m":
        return value * 60 * 1000;
      default:
        return value * 1000;
    }
  }

  /**
   * Create an error result
   */
  private createErrorResult(
    toolName: string,
    containerImage: string,
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
        containerImage,
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
}

/**
 * Create a new Dagger execution provider
 */
export function createExecutionProvider(config?: DaggerProviderConfig): DaggerExecutionProvider {
  return new DaggerExecutionProvider(config);
}

/**
 * Execute a tool with default provider
 */
export async function executeToolWithDagger(
  manifest: ToolManifest,
  input: ExecutionInput,
  options?: ExecutionOptions
): Promise<ExecutionResult> {
  const provider = createExecutionProvider();
  await provider.initialize();
  return provider.execute(manifest, input, options);
}

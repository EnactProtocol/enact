/**
 * Docker Execution Provider
 *
 * Executes commands inside Docker/Podman/nerdctl containers using direct CLI invocation.
 * Simpler than the Dagger provider — no SDK dependency, just spawns `docker run`.
 */

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Action, ActionsManifest, ToolManifest } from "@enactprotocol/shared";
import {
  applyDefaults,
  detectRuntime,
  getEffectiveInputSchema,
  prepareActionCommand,
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
 * Configuration for the Docker execution provider
 */
export interface DockerProviderConfig {
  /** Default timeout in milliseconds */
  defaultTimeout?: number;
  /** Enable verbose logging */
  verbose?: boolean;
  /** Preferred container runtime (auto-detected if not set) */
  preferredRuntime?: ContainerRuntime;
}

/**
 * Provider for executing commands inside Docker/Podman containers
 *
 * Uses direct CLI invocation (`docker run`, `podman run`, etc.)
 * for simpler, dependency-free container execution.
 */
export class DockerExecutionProvider implements ExecutionProvider {
  readonly name = "docker";
  private defaultTimeout: number;
  private verbose: boolean;
  private runtime: ContainerRuntime | null = null;

  constructor(config: DockerProviderConfig = {}) {
    this.defaultTimeout = config.defaultTimeout ?? 300000; // 5 minutes
    this.verbose = config.verbose ?? false;
    if (config.preferredRuntime) {
      this.runtime = config.preferredRuntime;
    }
  }

  async initialize(): Promise<void> {
    if (!this.runtime) {
      const detection = detectRuntime();
      if (detection.found && detection.runtime) {
        this.runtime = detection.runtime;
      }
    }
  }

  async isAvailable(): Promise<boolean> {
    const detection = detectRuntime();
    return detection.found;
  }

  async getHealth(): Promise<EngineHealth> {
    const detection = detectRuntime();
    return {
      healthy: detection.found,
      runtime: this.runtime ?? "docker",
      consecutiveFailures: 0,
    };
  }

  async shutdown(): Promise<void> {
    // Nothing to clean up
  }

  /**
   * Execute a tool using its manifest.command
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

    if (!this.runtime) {
      return this.createErrorResult(
        manifest.name,
        executionId,
        startTime,
        "CONTAINER_ERROR",
        "No container runtime available"
      );
    }

    const sourceDir = this.resolveSourceDir(options);
    const timeoutMs = this.parseTimeout(options.timeout ?? manifest.timeout);
    const image = await this.resolveImage(manifest, sourceDir);

    // Merge params as env vars so ${param} shell substitution works in the container
    const env: Record<string, string> = { ...input.envOverrides };
    for (const [key, value] of Object.entries(input.params)) {
      if (value !== undefined && value !== null) {
        env[key] = String(value);
      }
    }

    try {
      // Run build commands if specified (e.g., manifest.build or hooks.build)
      if (manifest.build) {
        const buildCommands = Array.isArray(manifest.build) ? manifest.build : [manifest.build];
        for (const cmd of buildCommands) {
          const buildArgs = this.buildRunArgs(image, sourceDir, env, cmd);
          const buildOutput = await this.runContainer(buildArgs, 600000); // 10 min build timeout
          if (buildOutput.exitCode !== 0) {
            return this.createErrorResult(
              manifest.name,
              executionId,
              startTime,
              "BUILD_ERROR",
              `Build failed (exit ${buildOutput.exitCode}): ${buildOutput.stderr}`
            );
          }
        }
      }

      const dockerArgs = this.buildRunArgs(image, sourceDir, env, manifest.command);
      const output = await this.runContainer(dockerArgs, timeoutMs);

      const endTime = new Date();
      const metadata: ExecutionMetadata = {
        toolName: manifest.name,
        containerImage: image,
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

      return { success: true, output, metadata };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const code: ExecutionErrorCode = message === "TIMEOUT" ? "TIMEOUT" : "CONTAINER_ERROR";
      return this.createErrorResult(manifest.name, executionId, startTime, code, message);
    }
  }

  /**
   * Execute a raw command in a container
   */
  async exec(
    manifest: ToolManifest,
    command: string,
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult> {
    return this.execute({ ...manifest, command }, { params: {} }, options);
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
    const toolLabel = `${manifest.name}:${actionName}`;

    if (!this.runtime) {
      return this.createErrorResult(
        toolLabel,
        executionId,
        startTime,
        "CONTAINER_ERROR",
        "No container runtime available"
      );
    }

    // Validate inputs
    const effectiveSchema = getEffectiveInputSchema(action);
    const validation = validateInputs(input.params, effectiveSchema);
    if (!validation.valid) {
      const errorMessages = validation.errors.map((e) => `${e.path}: ${e.message}`);
      return this.createErrorResult(
        toolLabel,
        executionId,
        startTime,
        "VALIDATION_ERROR",
        `Input validation failed: ${errorMessages.join(", ")}`
      );
    }

    const params = applyDefaults(input.params, effectiveSchema);

    // Prepare command
    let commandArray: string[];
    try {
      if (typeof action.command === "string") {
        commandArray = action.command.split(/\s+/).filter((s) => s.length > 0);
      } else {
        commandArray = prepareActionCommand(action.command, params, effectiveSchema);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return this.createErrorResult(
        toolLabel,
        executionId,
        startTime,
        "COMMAND_ERROR",
        `Failed to prepare action command: ${message}`
      );
    }

    if (commandArray.length === 0) {
      return this.createErrorResult(
        toolLabel,
        executionId,
        startTime,
        "COMMAND_ERROR",
        "Action command is empty"
      );
    }

    const sourceDir = this.resolveSourceDir(options);
    const timeoutMs = this.parseTimeout(options.timeout ?? manifest.timeout);
    const image = await this.resolveImage(manifest, sourceDir);

    // Build environment
    const env: Record<string, string> = { ...input.envOverrides };
    if (actionsManifest.env) {
      for (const [key, envVar] of Object.entries(actionsManifest.env)) {
        if (envVar.default && !env[key]) {
          env[key] = envVar.default;
        }
      }
    }

    try {
      // Run build if needed
      if (actionsManifest.build) {
        const buildCommands = Array.isArray(actionsManifest.build)
          ? actionsManifest.build
          : [actionsManifest.build];
        for (const cmd of buildCommands) {
          const buildArgs = this.buildRunArgs(image, sourceDir, env, cmd);
          const buildOutput = await this.runContainer(buildArgs, 600000); // 10 min build timeout
          if (buildOutput.exitCode !== 0) {
            return this.createErrorResult(
              toolLabel,
              executionId,
              startTime,
              "BUILD_ERROR",
              `Build failed (exit ${buildOutput.exitCode}): ${buildOutput.stderr}`
            );
          }
        }
      }

      // Execute action
      const dockerArgs = this.buildExecArgs(image, sourceDir, env, commandArray);
      const output = await this.runContainer(dockerArgs, timeoutMs);

      const endTime = new Date();
      const metadata: ExecutionMetadata = {
        toolName: toolLabel,
        containerImage: image,
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

      // Try to parse JSON output
      if (action.outputSchema && output.stdout) {
        try {
          output.parsed = JSON.parse(output.stdout);
        } catch {
          // Not JSON — leave as string
        }
      }

      return { success: true, output, metadata };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      let code: ExecutionErrorCode = "CONTAINER_ERROR";
      if (message.includes("build")) code = "BUILD_ERROR";
      else if (message === "TIMEOUT") code = "TIMEOUT";
      return this.createErrorResult(toolLabel, executionId, startTime, code, message);
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Resolve the source directory from execution options.
   * Checks mountDirs for a /workspace mount first, then falls back to workdir or cwd.
   */
  private resolveSourceDir(options: ExecutionOptions): string {
    if (options.mountDirs) {
      for (const [hostPath, containerPath] of Object.entries(options.mountDirs)) {
        if (containerPath === "/workspace") return hostPath;
      }
    }
    return options.workdir ?? process.cwd();
  }

  private generateExecutionId(): string {
    return `docker-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  private parseTimeout(timeout?: string): number {
    if (!timeout) return this.defaultTimeout;
    const match = timeout.match(/^(\d+)(ms|s|m|h)?$/);
    if (!match) return this.defaultTimeout;
    const value = Number.parseInt(match[1] ?? "300000", 10);
    switch (match[2] ?? "ms") {
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
   * Resolve the container image to use.
   * If the skill directory has a Containerfile/Dockerfile, build it.
   * Otherwise use manifest.from or a default image.
   */
  private async resolveImage(manifest: ToolManifest, sourceDir: string): Promise<string> {
    const containerfile = existsSync(join(sourceDir, "Containerfile"))
      ? "Containerfile"
      : existsSync(join(sourceDir, "Dockerfile"))
        ? "Dockerfile"
        : null;

    if (containerfile) {
      const hash = createHash("sha256")
        .update(`${manifest.name}:${sourceDir}`)
        .digest("hex")
        .slice(0, 12);
      const tag = `enact-${hash}`;

      if (this.verbose) {
        console.error(`[docker] Building image ${tag} from ${containerfile}`);
      }

      await this.buildImage(sourceDir, containerfile, tag);
      return tag;
    }

    // Use manifest.from if available, otherwise default
    return ((manifest as unknown as Record<string, unknown>).from as string) ?? "alpine:latest";
  }

  /**
   * Build a container image from a Containerfile/Dockerfile
   */
  private async buildImage(contextDir: string, file: string, tag: string): Promise<void> {
    const runtime = this.runtime!;
    const args = ["build", "-t", tag, "-f", join(contextDir, file), contextDir];

    const output = await this.spawnProcess(runtime, args, 600000); // 10 min build timeout

    if (output.exitCode !== 0) {
      throw new Error(
        `BUILD_ERROR: Image build failed (exit ${output.exitCode}): ${output.stderr}`
      );
    }
  }

  /**
   * Build docker run args for a shell command string (used by execute and build)
   */
  private buildRunArgs(
    image: string,
    sourceDir: string,
    env: Record<string, string>,
    command: string
  ): string[] {
    const args = ["run", "--rm", "-w", "/workspace"];

    // Mount source directory
    args.push("-v", `${resolve(sourceDir)}:/workspace`);

    // Environment variables
    for (const [key, value] of Object.entries(env)) {
      args.push("-e", `${key}=${value}`);
    }

    args.push(image, "sh", "-c", command);
    return args;
  }

  /**
   * Build docker run args for an array-form command (used by executeAction)
   */
  private buildExecArgs(
    image: string,
    sourceDir: string,
    env: Record<string, string>,
    commandArray: string[]
  ): string[] {
    const args = ["run", "--rm", "-w", "/workspace"];

    args.push("-v", `${resolve(sourceDir)}:/workspace`);

    for (const [key, value] of Object.entries(env)) {
      args.push("-e", `${key}=${value}`);
    }

    args.push(image, ...commandArray);
    return args;
  }

  /**
   * Run a container and capture output
   */
  private runContainer(dockerArgs: string[], timeoutMs: number): Promise<ExecutionOutput> {
    const runtime = this.runtime!;

    if (this.verbose) {
      console.error(`[docker] ${runtime} ${dockerArgs.join(" ")}`);
    }

    return this.spawnProcess(runtime, dockerArgs, timeoutMs);
  }

  /**
   * Spawn a process and capture its output
   */
  private spawnProcess(
    command: string,
    args: string[],
    timeoutMs: number
  ): Promise<ExecutionOutput> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
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
        resolve({ stdout, stderr, exitCode: exitCode ?? 1 });
      });
    });
  }

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
      output: { stdout: "", stderr: message, exitCode: 1 },
      metadata: {
        toolName,
        containerImage: "docker",
        startTime,
        endTime,
        durationMs: endTime.getTime() - startTime.getTime(),
        cached: false,
        executionId,
      },
      error: { code, message },
    };
  }
}

/**
 * Create a Docker execution provider
 */
export function createDockerProvider(config: DockerProviderConfig = {}): DockerExecutionProvider {
  return new DockerExecutionProvider(config);
}

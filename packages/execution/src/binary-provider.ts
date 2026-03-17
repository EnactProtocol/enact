/**
 * Binary Execution Provider
 *
 * Executes tools distributed as pre-compiled platform binaries.
 * On first run, downloads the binary for the current platform and caches it
 * in ~/.enact/bin/. Subsequent runs are instant.
 *
 * The tool manifest declares binary URLs per platform:
 *   binaries:
 *     darwin-arm64: https://...
 *     darwin-x64: https://...
 *     linux-x64: https://...
 *     linux-arm64: https://...
 *
 * All arguments are passed through directly — no JSON-to-flags conversion.
 */

import { spawn } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Action, ActionsManifest, ToolManifest } from "@enactprotocol/shared";
import { getBinDir } from "@enactprotocol/shared";
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
 * Map Node.js platform/arch to manifest binary key
 */
function getPlatformKey(): string {
  const os =
    process.platform === "win32" ? "windows" : process.platform === "darwin" ? "darwin" : "linux";
  const arch = process.arch === "x64" ? "x64" : process.arch === "arm64" ? "arm64" : process.arch;
  return `${os}-${arch}`;
}

/**
 * Get the cached binary path for a tool
 */
function getCachedBinaryPath(toolName: string): string {
  const binDir = getBinDir();
  const safeName = toolName.replace(/\//g, "-").replace(/@/g, "");
  const ext = process.platform === "win32" ? ".exe" : "";
  return join(binDir, `${safeName}${ext}`);
}

/**
 * Get the URL record path (tracks which URL was used to download the binary)
 */
function getUrlRecordPath(binaryPath: string): string {
  return `${binaryPath}.url`;
}

/**
 * Download a binary from a URL and cache it
 */
async function downloadBinary(url: string, destPath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to download binary from ${url}: ${response.status} ${response.statusText}`
    );
  }

  const buffer = await response.arrayBuffer();
  writeFileSync(destPath, Buffer.from(buffer));

  // Store the URL so we can detect when the URL changes (version update)
  writeFileSync(getUrlRecordPath(destPath), url, "utf-8");

  // Make executable on non-Windows
  if (process.platform !== "win32") {
    chmodSync(destPath, 0o755);
  }
}

/**
 * Resolve the binary path for a tool, downloading if necessary
 */
async function resolveBinary(manifest: ToolManifest): Promise<string> {
  if (!manifest.binaries) {
    throw new Error(`Tool "${manifest.name}" has no binaries defined`);
  }

  const platformKey = getPlatformKey();
  const url = manifest.binaries[platformKey];

  if (!url) {
    const available = Object.keys(manifest.binaries).join(", ");
    throw new Error(`No binary available for platform "${platformKey}". Available: ${available}`);
  }

  const binPath = getCachedBinaryPath(manifest.name);
  const urlRecord = getUrlRecordPath(binPath);

  // Check if cached binary exists and URL hasn't changed
  if (existsSync(binPath)) {
    const cachedUrl = existsSync(urlRecord) ? readFileSync(urlRecord, "utf-8").trim() : null;
    if (cachedUrl === url) {
      return binPath; // Cache hit
    }
    // URL changed — re-download (new version)
  }

  // Ensure bin directory exists
  mkdirSync(getBinDir(), { recursive: true });

  // Download and cache
  await downloadBinary(url, binPath);
  return binPath;
}

/**
 * Configuration for the binary execution provider
 */
export interface BinaryProviderConfig {
  /** Default timeout in milliseconds */
  defaultTimeout?: number;
  /** Callback invoked when downloading a binary (for progress display) */
  onDownload?: (toolName: string, url: string) => void;
}

/**
 * Provider that executes pre-compiled binaries
 *
 * Download, cache, execute. No containers, no runtimes.
 */
export class BinaryExecutionProvider implements ExecutionProvider {
  readonly name = "binary";
  private defaultTimeout: number;
  private onDownload?: (toolName: string, url: string) => void;

  constructor(config: BinaryProviderConfig = {}) {
    this.defaultTimeout = config.defaultTimeout ?? 300000; // 5 minutes
    if (config.onDownload !== undefined) {
      this.onDownload = config.onDownload;
    }
  }

  // biome-ignore lint/suspicious/noEmptyBlockStatements: no-op lifecycle method
  async initialize(): Promise<void> {}

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async getHealth(): Promise<EngineHealth> {
    return {
      healthy: true,
      runtime: "docker", // N/A but required by interface
      consecutiveFailures: 0,
    };
  }

  private generateExecutionId(): string {
    return `binary-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  private parseTimeout(timeout?: string): number {
    if (!timeout) return this.defaultTimeout;
    const match = timeout.match(/^(\d+)(ms|s|m|h)?$/);
    if (!match) return this.defaultTimeout;
    const value = Number.parseInt(match[1] ?? "300000", 10);
    switch (match[2] ?? "ms") {
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
        containerImage: "binary",
        startTime,
        endTime,
        durationMs: endTime.getTime() - startTime.getTime(),
        cached: false,
        executionId,
      },
      error: { code, message },
    };
  }

  private runCommand(
    args: string[],
    env: Record<string, string>,
    timeoutMs: number,
    options?: ExecutionOptions
  ): Promise<ExecutionOutput> {
    return new Promise((resolve, reject) => {
      const [cmd, ...rest] = args;
      if (!cmd) {
        reject(new Error("Empty command"));
        return;
      }

      const child = spawn(cmd, rest, {
        cwd: process.cwd(),
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
        const chunk = data.toString();
        stdout += chunk;
        options?.onOutput?.("stdout", chunk);
      });

      child.stderr?.on("data", (data: Buffer) => {
        const chunk = data.toString();
        stderr += chunk;
        options?.onOutput?.("stderr", chunk);
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

  /**
   * Execute a binary tool.
   * Passthrough args from options.passthroughArgs are appended directly to the binary.
   */
  async execute(
    manifest: ToolManifest,
    input: ExecutionInput,
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult> {
    const startTime = new Date();
    const executionId = this.generateExecutionId();
    const timeoutMs = this.parseTimeout(options.timeout ?? manifest.timeout);

    let binPath: string;
    try {
      // Notify caller that we're downloading (if needed)
      if (this.onDownload && manifest.binaries) {
        const platformKey = getPlatformKey();
        const url = manifest.binaries[platformKey];
        if (url) this.onDownload(manifest.name, url);
      }
      binPath = await resolveBinary(manifest);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.createErrorResult(
        manifest.name,
        executionId,
        startTime,
        "RUNTIME_NOT_FOUND",
        message
      );
    }

    const passthrough = options.passthroughArgs ?? [];
    const env: Record<string, string> = { ...input.envOverrides };

    try {
      const output = await this.runCommand([binPath, ...passthrough], env, timeoutMs, options);
      const endTime = new Date();
      const metadata: ExecutionMetadata = {
        toolName: manifest.name,
        containerImage: "binary",
        startTime,
        endTime,
        durationMs: endTime.getTime() - startTime.getTime(),
        cached: false,
        executionId,
      };
      if (manifest.version) metadata.toolVersion = manifest.version;

      if (output.exitCode !== 0) {
        return {
          success: false,
          output,
          metadata,
          error: { code: "COMMAND_ERROR", message: `Binary exited with code ${output.exitCode}` },
        };
      }
      return { success: true, output, metadata };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const code: ExecutionErrorCode = message === "TIMEOUT" ? "TIMEOUT" : "COMMAND_ERROR";
      return this.createErrorResult(manifest.name, executionId, startTime, code, message);
    }
  }

  /**
   * Execute a raw command — for binary tools, runs the binary with the given command string
   */
  async exec(
    manifest: ToolManifest,
    command: string,
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult> {
    const startTime = new Date();
    const executionId = this.generateExecutionId();
    const timeoutMs = this.parseTimeout(options.timeout ?? manifest.timeout);

    let binPath: string;
    try {
      binPath = await resolveBinary(manifest);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.createErrorResult(
        manifest.name,
        executionId,
        startTime,
        "RUNTIME_NOT_FOUND",
        message
      );
    }

    const args = command ? command.split(/\s+/).filter(Boolean) : [];
    const env: Record<string, string> = { ...options.additionalEnv };

    try {
      const output = await this.runCommand([binPath, ...args], env, timeoutMs, options);
      const endTime = new Date();
      return {
        success: output.exitCode === 0,
        output,
        metadata: {
          toolName: manifest.name,
          containerImage: "binary",
          startTime,
          endTime,
          durationMs: endTime.getTime() - startTime.getTime(),
          cached: false,
          executionId,
        },
        ...(output.exitCode !== 0 && {
          error: {
            code: "COMMAND_ERROR" as ExecutionErrorCode,
            message: `Exited with code ${output.exitCode}`,
          },
        }),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const code: ExecutionErrorCode = message === "TIMEOUT" ? "TIMEOUT" : "COMMAND_ERROR";
      return this.createErrorResult(manifest.name, executionId, startTime, code, message);
    }
  }

  /**
   * Execute an action — binary tools don't have actions, so this falls back to execute()
   */
  async executeAction(
    manifest: ToolManifest,
    _actionsManifest: ActionsManifest,
    _actionName: string,
    _action: Action,
    input: ExecutionInput,
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult> {
    return this.execute(manifest, input, options);
  }

  // biome-ignore lint/suspicious/noEmptyBlockStatements: no-op lifecycle method
  async shutdown(): Promise<void> {}
}

/**
 * Create a binary execution provider
 */
export function createBinaryProvider(config: BinaryProviderConfig = {}): BinaryExecutionProvider {
  return new BinaryExecutionProvider(config);
}

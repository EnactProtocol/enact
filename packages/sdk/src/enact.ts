import {
  DaggerExecutionProvider,
  DockerExecutionProvider,
  type ExecutionProvider,
  LocalExecutionProvider,
} from "@enactprotocol/execution";
import {
  type ExecutionOptions,
  type ExecutionResult,
  loadConfig,
  resolveToolWithAction,
} from "@enactprotocol/shared";
import { Pipeline } from "./pipeline.js";
import type { RunOptions, RunResult } from "./types.js";

/**
 * Configuration options for the Enact SDK
 */
export interface EnactOptions {
  /** Default execution backend */
  defaultBackend?: "local" | "docker" | "dagger";

  /** Configuration file path (defaults to ~/.enact/config.yaml) */
  configPath?: string;

  /** Base directory for resolving tools */
  baseDir?: string;
}

/**
 * Main Enact SDK class for running skills programmatically
 */
export class Enact {
  private config: ReturnType<typeof loadConfig>;
  private providers: Map<string, ExecutionProvider>;
  private options: EnactOptions;

  constructor(options: EnactOptions = {}) {
    this.options = options;
    this.config = loadConfig();
    this.providers = new Map();

    // Initialize providers
    this.providers.set("local", new LocalExecutionProvider());
    this.providers.set("docker", new DockerExecutionProvider());
    this.providers.set("dagger", new DaggerExecutionProvider());
  }

  /**
   * Run a skill
   *
   * @param skill - Skill specifier (e.g., "enact/firecrawl:scrape" or "./my-tool:run")
   * @param options - Run options
   * @returns Execution result
   *
   * @example
   * ```typescript
   * const result = await enact.run('enact/firecrawl:scrape', {
   *   params: { url: 'https://example.com' },
   *   timeout: 60000
   * })
   *
   * if (result.success) {
   *   console.log(result.stdout)
   * }
   * ```
   */
  async run(skill: string, options: RunOptions = {}): Promise<RunResult> {
    // Resolve the tool and action
    const resolved = resolveToolWithAction(skill, {
      startDir: options.cwd || this.options.baseDir || process.cwd(),
    });

    if (!resolved) {
      const now = new Date();
      return {
        success: false,
        stdout: "",
        stderr: "",
        exitCode: 1,
        error: {
          code: "UNKNOWN",
          message: `Could not resolve tool: ${skill}`,
        },
        raw: {
          success: false,
          output: { stdout: "", stderr: "", exitCode: 1 },
          error: {
            code: "UNKNOWN",
            message: `Could not resolve tool: ${skill}`,
          },
          metadata: {
            toolName: skill,
            executionId: "",
            containerImage: "",
            startTime: now,
            endTime: now,
            durationMs: 0,
            cached: false,
          },
        },
      };
    }

    // Select execution provider
    const backend =
      options.backend ||
      (this.options.defaultBackend as string) ||
      this.config.execution?.default ||
      "local";

    const provider = this.providers.get(backend);
    if (!provider) {
      const now = new Date();
      return {
        success: false,
        stdout: "",
        stderr: "",
        exitCode: 1,
        error: {
          code: "UNKNOWN",
          message: `Invalid backend: ${backend}`,
        },
        raw: {
          success: false,
          output: { stdout: "", stderr: "", exitCode: 1 },
          error: {
            code: "UNKNOWN",
            message: `Invalid backend: ${backend}`,
          },
          metadata: {
            toolName: skill,
            executionId: "",
            containerImage: "",
            startTime: now,
            endTime: now,
            durationMs: 0,
            cached: false,
          },
        },
      };
    }

    // Initialize provider if needed
    if (typeof provider.initialize === "function") {
      await provider.initialize();
    }

    // Ensure we have an actionsManifest
    if (!resolved.actionsManifest || !resolved.action || !resolved.actionName) {
      const now = new Date();
      return {
        success: false,
        stdout: "",
        stderr: "",
        exitCode: 1,
        error: {
          code: "UNKNOWN",
          message: `No action found for skill: ${skill}`,
        },
        raw: {
          success: false,
          output: { stdout: "", stderr: "", exitCode: 1 },
          error: {
            code: "UNKNOWN",
            message: `No action found for skill: ${skill}`,
          },
          metadata: {
            toolName: skill,
            executionId: "",
            containerImage: "",
            startTime: now,
            endTime: now,
            durationMs: 0,
            cached: false,
          },
        },
      };
    }

    // Execute
    const startTime = Date.now();

    // Build execution options
    const execOptions: ExecutionOptions = {};
    if (options.timeout) {
      execOptions.timeout = `${options.timeout}ms`;
    }
    if (options.cwd) {
      execOptions.workdir = options.cwd;
    }

    const result: ExecutionResult = await provider.executeAction(
      resolved.manifest,
      resolved.actionsManifest,
      resolved.actionName,
      resolved.action,
      {
        params: options.params || {},
        envOverrides: options.env || {},
      },
      execOptions
    );

    const duration = Date.now() - startTime;

    // Convert to SDK result format
    return {
      success: result.success,
      stdout: result.output.stdout,
      stderr: result.output.stderr,
      exitCode: result.output.exitCode,
      metadata: {
        toolName: resolved.manifest.name,
        duration,
        backend,
      },
      error: result.error
        ? {
            code: result.error.code,
            message: result.error.message,
          }
        : undefined,
      raw: result,
    };
  }

  /**
   * Create a new pipeline for chaining skill executions
   *
   * @example
   * ```typescript
   * const output = await enact
   *   .pipeline()
   *   .run('enact/firecrawl:scrape', { url: 'https://example.com' })
   *   .run('enact/summarizer:summarize', { text: '$previous.stdout' })
   *   .execute()
   * ```
   */
  pipeline(): Pipeline {
    return new Pipeline(this);
  }

  /**
   * Shutdown all execution providers
   */
  async shutdown(): Promise<void> {
    const providers = Array.from(this.providers.values());
    for (const provider of providers) {
      if (typeof provider.shutdown === "function") {
        await provider.shutdown();
      }
    }
  }
}

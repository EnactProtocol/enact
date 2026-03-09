import type { ExecutionResult } from "@enactprotocol/shared";

/**
 * Options for running a skill
 */
export interface RunOptions {
  /** Input parameters for the skill */
  params?: Record<string, unknown>;

  /** Environment variable overrides */
  env?: Record<string, string>;

  /** Timeout in milliseconds */
  timeout?: number;

  /** Working directory (for local tools) */
  cwd?: string;

  /** Force a specific execution backend */
  backend?: "local" | "docker" | "dagger" | "remote";
}

/**
 * Result from running a skill
 */
export interface RunResult {
  /** Whether execution succeeded */
  success: boolean;

  /** Standard output */
  stdout: string;

  /** Standard error */
  stderr: string;

  /** Exit code */
  exitCode: number;

  /** Execution metadata */
  metadata?:
    | {
        toolName: string;
        duration: number;
        backend: string;
      }
    | undefined;

  /** Error if execution failed */
  error?:
    | {
        code: string;
        message: string;
      }
    | undefined;

  /** Raw execution result */
  raw: ExecutionResult;
}

/**
 * A step in a pipeline
 */
export interface PipelineStep {
  /** Skill to run (e.g., "enact/firecrawl:scrape") */
  skill: string;

  /** Input parameters (can reference previous step outputs) */
  params: Record<string, unknown>;

  /** Optional step name for referencing in later steps */
  name?: string | undefined;
}

/**
 * Context passed between pipeline steps
 */
export interface PipelineContext {
  /** Previous step result */
  previous?: RunResult;

  /** All step results by name */
  steps: Record<string, RunResult>;

  /** Initial pipeline input */
  input: Record<string, unknown>;
}

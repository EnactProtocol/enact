/**
 * Type definitions for the Enact execution engine
 * Provides interfaces for tool execution, container management, and results
 */

import type { ToolManifest } from "../types/manifest";

// ============================================================================
// Execution Input/Output Types
// ============================================================================

/**
 * Input to a tool execution
 */
export interface ExecutionInput {
  /** Input parameters (key-value pairs) */
  params: Record<string, unknown>;
  /** Files to mount into the container (path -> content/source) */
  files?: Record<string, FileInput>;
  /** Secret overrides (secret name -> Dagger URI) */
  secretOverrides?: Record<string, string>;
  /** Environment variable overrides */
  envOverrides?: Record<string, string>;
}

/**
 * File input for execution
 */
export interface FileInput {
  /** File content (string or Buffer) */
  content?: string | Buffer;
  /** Path to source file on host */
  sourcePath?: string;
  /** Target path in container */
  targetPath: string;
}

/**
 * Output from a tool execution
 */
export interface ExecutionOutput {
  /** Standard output from the container */
  stdout: string;
  /** Standard error from the container */
  stderr: string;
  /** Exit code from the container */
  exitCode: number;
  /** Parsed output (if outputSchema is defined and output is JSON) */
  parsed?: unknown;
  /** Files extracted from the container */
  files?: Record<string, Buffer>;
}

/**
 * Result of a tool execution
 */
export interface ExecutionResult {
  /** Whether the execution was successful */
  success: boolean;
  /** Output from the execution */
  output: ExecutionOutput;
  /** Execution metadata */
  metadata: ExecutionMetadata;
  /** Error information (if failed) */
  error?: ExecutionError;
}

/**
 * Metadata about the execution
 */
export interface ExecutionMetadata {
  /** Tool name */
  toolName: string;
  /** Tool version (if available) */
  toolVersion?: string;
  /** Container image used */
  containerImage: string;
  /** Start time */
  startTime: Date;
  /** End time */
  endTime: Date;
  /** Duration in milliseconds */
  durationMs: number;
  /** Whether the result came from cache */
  cached: boolean;
  /** Execution ID for tracking */
  executionId: string;
}

/**
 * Error codes for execution failures
 */
export type ExecutionErrorCode =
  | "TIMEOUT"
  | "CONTAINER_ERROR"
  | "BUILD_ERROR"
  | "VALIDATION_ERROR"
  | "SECRET_ERROR"
  | "NETWORK_ERROR"
  | "RUNTIME_NOT_FOUND"
  | "ENGINE_ERROR"
  | "COMMAND_ERROR"
  | "UNKNOWN";

/**
 * Execution error with details
 */
export interface ExecutionError {
  /** Error code for programmatic handling */
  code: ExecutionErrorCode;
  /** Human-readable error message */
  message: string;
  /** Stack trace (if available) */
  stack?: string;
  /** Additional error details */
  details?: Record<string, unknown>;
  /** Suggested action to resolve */
  suggestion?: string;
}

// ============================================================================
// Execution Options
// ============================================================================

/**
 * Input path configuration for mounting files/directories
 */
export interface InputPathConfig {
  /** Absolute path on host */
  path: string;
  /** Whether it's a file or directory */
  type: "file" | "directory";
  /** Named input (for multi-input support, e.g., "left" from --input left=./path) */
  name?: string;
}

/**
 * Options for tool execution
 */
export interface ExecutionOptions {
  /** Timeout override (default from manifest or 30s) */
  timeout?: string;
  /** Working directory in container */
  workdir?: string;
  /** Whether to stream output in real-time */
  stream?: boolean;
  /** Callback for streaming output */
  onOutput?: (type: "stdout" | "stderr", data: string) => void;
  /** Whether to disable network access */
  networkDisabled?: boolean;
  /** Additional environment variables */
  additionalEnv?: Record<string, string>;
  /** Mount host directories (host path -> container path) */
  mountDirs?: Record<string, string>;
  /** Input paths to mount (files or directories) */
  inputPaths?: InputPathConfig[];
  /** Output path to export /output directory to after execution */
  outputPath?: string;
  /** Output files to extract (container path) */
  outputFiles?: string[];
  /** Retry configuration */
  retry?: RetryConfig;
  /** Dry run mode (don't actually execute) */
  dryRun?: boolean;
}

/**
 * Retry configuration for transient failures
 */
export interface RetryConfig {
  /** Maximum number of retries */
  maxRetries: number;
  /** Initial delay in ms (for exponential backoff) */
  initialDelayMs: number;
  /** Maximum delay in ms */
  maxDelayMs: number;
  /** Error codes that should trigger a retry */
  retryableCodes: ExecutionErrorCode[];
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 8000,
  retryableCodes: ["NETWORK_ERROR", "ENGINE_ERROR", "TIMEOUT"],
};

// ============================================================================
// Container Runtime Types
// ============================================================================

/**
 * Supported container runtimes
 */
export type ContainerRuntime = "docker" | "podman" | "nerdctl";

/**
 * Container runtime detection result
 */
export interface RuntimeDetection {
  /** Whether a runtime was found */
  found: boolean;
  /** The detected runtime */
  runtime?: ContainerRuntime;
  /** Path to the runtime binary */
  path?: string;
  /** Runtime version */
  version?: string;
  /** Error if detection failed */
  error?: string;
}

/**
 * Container runtime status
 */
export interface RuntimeStatus {
  /** Whether the runtime is available */
  available: boolean;
  /** The runtime in use */
  runtime: ContainerRuntime;
  /** Whether the engine is healthy */
  engineHealthy: boolean;
  /** Last health check time */
  lastHealthCheck: Date;
  /** Consecutive failure count */
  failureCount: number;
}

// ============================================================================
// Engine Health Types
// ============================================================================

/**
 * Engine health check result
 */
export interface EngineHealth {
  /** Whether the engine is healthy */
  healthy: boolean;
  /** Container runtime being used */
  runtime: ContainerRuntime;
  /** Engine version */
  version?: string;
  /** Last successful operation time */
  lastSuccess?: Date;
  /** Consecutive failure count */
  consecutiveFailures: number;
  /** Error message if unhealthy */
  error?: string;
}

/**
 * Engine state for tracking health
 */
export interface EngineState {
  /** Current health status */
  health: EngineHealth;
  /** Whether engine needs reset */
  needsReset: boolean;
  /** Time of last reset */
  lastReset?: Date;
  /** Total executions */
  totalExecutions: number;
  /** Successful executions */
  successfulExecutions: number;
}

// ============================================================================
// Execution Provider Interface
// ============================================================================

/**
 * Interface for execution providers
 * Allows for different implementations (Dagger, mock, etc.)
 */
export interface ExecutionProvider {
  /** Provider name */
  readonly name: string;

  /** Initialize the provider */
  initialize(): Promise<void>;

  /** Check if the provider is available */
  isAvailable(): Promise<boolean>;

  /** Get provider health status */
  getHealth(): Promise<EngineHealth>;

  /** Execute a tool */
  execute(
    manifest: ToolManifest,
    input: ExecutionInput,
    options?: ExecutionOptions
  ): Promise<ExecutionResult>;

  /** Execute a raw command in a tool's container */
  exec(
    manifest: ToolManifest,
    command: string,
    options?: ExecutionOptions
  ): Promise<ExecutionResult>;

  /** Shutdown the provider */
  shutdown(): Promise<void>;
}

// ============================================================================
// Command Interpolation Types
// ============================================================================

/**
 * Parsed command with tokens
 */
export interface ParsedCommand {
  /** Original command string */
  original: string;
  /** Parsed tokens (strings and parameters) */
  tokens: CommandToken[];
  /** Parameters found in the command */
  parameters: string[];
}

/**
 * A token in a parsed command
 */
export type CommandToken =
  | { type: "literal"; value: string }
  | { type: "parameter"; name: string; raw?: boolean; surroundingQuotes?: "single" | "double" };

/**
 * Command interpolation options
 */
export interface InterpolationOptions {
  /** Whether to shell-escape values */
  escape?: boolean;
  /** Whether to JSON-stringify objects */
  jsonifyObjects?: boolean;
  /** Missing parameter handling */
  onMissing?: "error" | "empty" | "keep";
  /** Callback for warnings (e.g., potential double-quoting) */
  onWarning?: (warning: CommandWarning) => void;
  /**
   * Set of known parameter names from the inputSchema.
   * Only ${...} patterns matching these names will be substituted.
   * If not provided, ALL ${...} patterns are treated as parameters (legacy behavior).
   */
  knownParameters?: Set<string>;
}

/**
 * Warning types for command processing
 */
export type CommandWarningCode = "DOUBLE_QUOTING" | "RAW_MODIFIER_USED";

/**
 * Warning about command processing issues
 */
export interface CommandWarning {
  /** Warning code for programmatic handling */
  code: CommandWarningCode;
  /** Human-readable warning message */
  message: string;
  /** Parameter name that triggered the warning */
  parameter: string;
  /** Suggested fix */
  suggestion?: string;
}

// ============================================================================
// Input Validation Types
// ============================================================================

/**
 * Result of input validation
 */
export interface InputValidationResult {
  /** Whether inputs are valid */
  valid: boolean;
  /** Validation errors */
  errors: InputValidationError[];
  /** Coerced/normalized values */
  coercedValues?: Record<string, unknown>;
}

/**
 * Input validation error
 */
export interface InputValidationError {
  /** Parameter path (e.g., "params.name" or "params.config.timeout") */
  path: string;
  /** Error message */
  message: string;
  /** Expected type or format */
  expected?: string;
  /** Actual value received */
  actual?: unknown;
}

// ============================================================================
// Dry Run Types
// ============================================================================

/**
 * Dry run result showing what would be executed
 */
export interface DryRunResult {
  /** Tool name */
  toolName: string;
  /** Container image that would be used */
  containerImage: string;
  /** Interpolated command that would run */
  command: string;
  /** Environment variables that would be set (secrets masked) */
  environment: Record<string, string>;
  /** Secrets that would be injected (names only) */
  secrets: string[];
  /** Files that would be mounted */
  mounts: Array<{ source: string; target: string }>;
  /** Timeout that would be applied */
  timeout: string;
  /** Input validation result */
  validation: InputValidationResult;
}

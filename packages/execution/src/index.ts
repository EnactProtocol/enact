/**
 * @enactprotocol/execution
 *
 * Dagger-based execution engine for Enact tools.
 * This package contains Node.js-only code and should NOT be imported in browser environments.
 */

export const VERSION = "0.1.0";

// Re-export types from @enactprotocol/shared for convenience
export type {
  ExecutionInput,
  FileInput,
  ExecutionOutput,
  ExecutionResult,
  ExecutionMetadata,
  ExecutionError,
  ExecutionErrorCode,
  ExecutionOptions,
  RetryConfig,
  ContainerRuntime,
  RuntimeDetection,
  RuntimeStatus,
  EngineHealth,
  EngineState,
  ExecutionProvider,
  DryRunResult,
} from "@enactprotocol/shared";

// Dagger execution provider (Node.js only)
export {
  DaggerExecutionProvider,
  createExecutionProvider,
  executeToolWithDagger,
  type DaggerProviderConfig,
} from "./provider.js";

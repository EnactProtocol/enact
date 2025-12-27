/**
 * Execution Engine Module
 *
 * Provides containerized tool execution using the Dagger SDK.
 * This is the main entry point for Phase 3 of Enact CLI 2.0.
 */

// Types
export type {
  // Input/Output types
  ExecutionInput,
  FileInput,
  ExecutionOutput,
  ExecutionResult,
  ExecutionMetadata,
  ExecutionError,
  ExecutionErrorCode,
  // Options
  ExecutionOptions,
  InputPathConfig,
  RetryConfig,
  // Runtime types
  ContainerRuntime,
  RuntimeDetection,
  RuntimeStatus,
  // Engine health
  EngineHealth,
  EngineState,
  // Provider interface
  ExecutionProvider,
  // Command types
  ParsedCommand,
  CommandToken,
  InterpolationOptions,
  CommandWarning,
  CommandWarningCode,
  // Validation types
  InputValidationResult,
  InputValidationError,
  // Dry run
  DryRunResult,
} from "./types.js";

// Constants
export { DEFAULT_RETRY_CONFIG } from "./types.js";

// Runtime detection
export {
  detectRuntime,
  clearRuntimeCache,
  isRuntimeAvailable,
  getAvailableRuntimes,
  RuntimeStatusTracker,
  createRuntimeTracker,
} from "./runtime.js";

// Command interpolation
export {
  parseCommand,
  interpolateCommand,
  shellEscape,
  parseCommandArgs,
  prepareCommand,
  getMissingParams,
  type ParseCommandOptions,
} from "./command.js";

// Input validation
export {
  validateInputs,
  applyDefaults,
  getRequiredParams,
  getParamInfo,
} from "./validation.js";

// NOTE: Dagger provider moved to @enactprotocol/execution package
// This keeps @enactprotocol/shared browser-safe (no Dagger SDK dependency)

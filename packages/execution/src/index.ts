/**
 * @enactprotocol/execution
 *
 * Pluggable execution backends for Enact tools.
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

// Local execution provider (no containerization)
export {
  LocalExecutionProvider,
  createLocalProvider,
  hasContainerfile,
  selectExecutionMode,
  type LocalProviderConfig,
} from "./local-provider.js";

// Docker execution provider (direct CLI, no Dagger SDK)
export {
  DockerExecutionProvider,
  createDockerProvider,
  type DockerProviderConfig,
} from "./docker-provider.js";

// Remote execution provider (delegates to remote endpoint)
export {
  RemoteExecutionProvider,
  createRemoteProvider,
  type RemoteProviderConfig,
} from "./remote-provider.js";

// Execution router (config-driven backend selection)
export {
  ExecutionRouter,
  createRouter,
  type ExecutionRoutingConfig,
  type ProviderSelectionOptions,
} from "./router.js";

/**
 * @enactprotocol/secrets
 *
 * OS keyring integration and environment variable management for Enact.
 * Provides secure secret storage using platform-native keychains.
 */

export const version = "0.1.0";

// ============================================================================
// Types
// ============================================================================

export type {
  SecretResolution,
  SecretNotFound,
  SecretResolutionResult,
  SecretMetadata,
  SecretTrace,
  SecretTraceEntry,
  EnvScope,
  EnvFileLocation,
  EnvironmentVariable,
  EnvResolution,
  ParsedEnvFile,
  EnvFileLine,
  DaggerSecretScheme,
  DaggerSecretUri,
  GetSecretOptions,
  SecretObject,
} from "./types";

export { KEYRING_SERVICE } from "./types";

// ============================================================================
// Keyring Functions
// ============================================================================

export {
  buildAccount,
  parseAccount,
  setSecret,
  getSecret,
  deleteSecret,
  listSecrets,
  listAllSecrets,
  secretExists,
  isKeyringAvailable,
} from "./keyring";

// ============================================================================
// Secret Resolution
// ============================================================================

export {
  getNamespaceChain,
  resolveSecret,
  traceSecretResolution,
  resolveSecrets,
  checkRequiredSecrets,
} from "./resolver";

// ============================================================================
// Environment Variables
// ============================================================================

export {
  // Parser
  parseEnvFile,
  parseEnvContent,
  serializeEnvFile,
  createEnvContent,
  updateEnvVar,
  removeEnvVar,
  // Reader
  getGlobalEnvPath,
  getLocalEnvPath,
  readEnvFile,
  readEnvVars,
  loadGlobalEnv,
  loadLocalEnv,
  loadGlobalEnvFile,
  loadLocalEnvFile,
  globalEnvExists,
  localEnvExists,
  // Writer
  writeEnvFile,
  writeEnvVars,
  setEnvVar,
  deleteEnvVar,
  setGlobalEnvVar,
  setLocalEnvVar,
  deleteGlobalEnvVar,
  deleteLocalEnvVar,
  // Manager (high-level API)
  setEnv,
  getEnv,
  getEnvValue,
  deleteEnv,
  listEnv,
  resolveAllEnv,
  resolveToolEnv,
  hasLocalEnv,
  hasGlobalEnv,
} from "./env";

// ============================================================================
// Dagger Secret Integration
// ============================================================================

export {
  parseSecretUri,
  resolveSecretUri,
  isSecretUri,
  getSupportedSchemes,
  getSecretObject,
  getSecretObjects,
  parseSecretOverride,
  parseSecretOverrides,
} from "./dagger";

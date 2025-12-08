/**
 * Environment variable management
 *
 * Re-exports all env-related functions
 */

// Parser functions
export {
  parseEnvFile,
  parseEnvContent,
  serializeEnvFile,
  createEnvContent,
  updateEnvVar,
  removeEnvVar,
} from "./parser";

// Reader functions
export {
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
} from "./reader";

// Writer functions
export {
  writeEnvFile,
  writeEnvVars,
  setEnvVar,
  deleteEnvVar,
  setGlobalEnvVar,
  setLocalEnvVar,
  deleteGlobalEnvVar,
  deleteLocalEnvVar,
} from "./writer";

// Manager functions (high-level API)
export {
  setEnv,
  getEnv,
  getEnvValue,
  deleteEnv,
  listEnv,
  resolveAllEnv,
  resolveToolEnv,
  hasLocalEnv,
  hasGlobalEnv,
} from "./manager";

/**
 * @enactprotocol/shared
 *
 * Core business logic and utilities for Enact.
 * Provides manifest parsing, configuration management, tool resolution,
 * and execution engine interfaces.
 */

export const version = "0.1.0";

// Constants
export {
  ENACT_BASE_URL,
  ENACT_API_URL,
  ENACT_WEB_URL,
  ENACT_TOOL_TYPE,
  ENACT_AUDIT_TYPE,
  ENACT_BUILD_TYPE,
  INTOTO_STATEMENT_TYPE,
  SLSA_PROVENANCE_TYPE,
} from "./constants";

// Path utilities
export {
  getEnactHome,
  getProjectEnactDir,
  getToolsDir,
  getCacheDir,
  getConfigPath,
  getGlobalEnvPath,
  getProjectEnvPath,
  type ToolScope,
} from "./paths";

// Configuration manager
export {
  loadConfig,
  saveConfig,
  getConfigValue,
  setConfigValue,
  resetConfig,
  configExists,
  ensureGlobalSetup,
  DEFAULT_CONFIG,
  PLATFORM_TRUSTED_SIGNERS,
  // Local trust management (new unified API)
  getTrustedIdentities,
  addTrustedIdentity,
  removeTrustedIdentity,
  isIdentityTrusted,
  getMinimumAttestations,
  getTrustPolicy,
  emailToProviderIdentity,
  // Legacy aliases (deprecated)
  getTrustedAuditors,
  addTrustedAuditor,
  removeTrustedAuditor,
  isAuditorTrusted,
  type EnactConfig,
  type TrustConfig,
  type CacheConfig,
  type ExecutionConfig,
  type RegistryConfig,
} from "./config";

// Manifest types
export type {
  ToolManifest,
  PackageManifest,
  ParsedManifest,
  EnvVariable,
  EnvVariables,
  Author,
  ToolAnnotations,
  ResourceRequirements,
  ToolExample,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ToolLocation,
  ToolResolution,
  ManifestFileName,
} from "./types/manifest";

export { MANIFEST_FILES, PACKAGE_MANIFEST_FILE } from "./types/manifest";

// Manifest parsing, validation, and loading
export {
  // Parser
  ManifestParseError,
  parseManifest,
  parseManifestAuto,
  parseYaml,
  extractFrontmatter,
  detectFormat,
  type ManifestFormat,
  // Validator
  validateManifest,
  validateManifestStrict,
  isValidToolName,
  isValidVersion,
  isValidTimeout,
  ToolManifestSchema,
  // Loader
  ManifestLoadError,
  loadManifest,
  loadManifestFromDir,
  findManifestFile,
  hasManifest,
  tryLoadManifest,
  tryLoadManifestFromDir,
  type LoadedManifest,
} from "./manifest";

// Tool resolver
export {
  ToolResolveError,
  resolveTool,
  resolveToolAuto,
  resolveToolFromPath,
  tryResolveTool,
  tryResolveToolDetailed,
  normalizeToolName,
  toolNameToPath,
  getToolPath,
  getToolSearchPaths,
  type ResolveOptions,
  type TryResolveResult,
} from "./resolver";

// Local tool registry (tools.json management)
export {
  loadToolsRegistry,
  saveToolsRegistry,
  addToolToRegistry,
  removeToolFromRegistry,
  isToolInstalled,
  getInstalledVersion,
  getToolCachePath,
  listInstalledTools,
  getInstalledToolInfo,
  getToolsJsonPath,
  type ToolsRegistry,
  type RegistryScope,
  type InstalledToolInfo,
} from "./registry";

// MCP tool registry (mcp.json management)
export {
  loadMcpRegistry,
  saveMcpRegistry,
  addMcpTool,
  removeMcpTool,
  isMcpToolInstalled,
  getMcpToolVersion,
  listMcpTools,
  getMcpToolInfo,
  getMcpJsonPath,
  syncMcpWithGlobalTools,
  // Toolset management
  createToolset,
  deleteToolset,
  addToolToToolset,
  removeToolFromToolset,
  setActiveToolset,
  getActiveToolset,
  listToolsets,
  type McpRegistry,
  type McpToolInfo,
} from "./mcp-registry";

// Logger utility
export {
  Logger,
  createLogger,
  configureLogger,
  getLogger,
  debug,
  info,
  warn,
  error,
  type LogLevel,
  type LogEntry,
  type LoggerOptions,
} from "./utils/logger";

// Version utilities
export {
  parseVersion,
  isValidVersion as isValidSemver,
  compareVersions,
  parseRange,
  satisfiesRange,
  sortVersions,
  getHighestVersion,
  incrementVersion,
  coerceVersion,
  formatVersion,
  type ParsedVersion,
  type VersionRange,
} from "./utils/version";

// File system helpers
export {
  ensureDir,
  ensureParentDir,
  pathExists,
  isDirectory,
  isFile,
  readJsonFile,
  tryReadJsonFile,
  writeJsonFile,
  readTextFile,
  tryReadTextFile,
  writeTextFile,
  copyFile,
  copyDir,
  remove,
  listDir,
  listDirEntries,
  findFiles,
  findFilesRecursive,
  getStats,
  getFileSize,
  touchFile,
} from "./utils/fs";

// Execution engine (browser-safe utilities only)
// NOTE: DaggerExecutionProvider moved to @enactprotocol/execution package
export {
  // Types
  type ExecutionInput,
  type FileInput,
  type ExecutionOutput,
  type ExecutionResult,
  type ExecutionMetadata,
  type ExecutionError,
  type ExecutionErrorCode,
  type ExecutionOptions,
  type InputPathConfig,
  type RetryConfig,
  type ContainerRuntime,
  type RuntimeDetection,
  type RuntimeStatus,
  type EngineHealth,
  type EngineState,
  type ExecutionProvider,
  type ParsedCommand,
  type CommandToken,
  type InterpolationOptions,
  type InputValidationResult,
  type InputValidationError,
  type DryRunResult,
  // Constants
  DEFAULT_RETRY_CONFIG,
  // Runtime
  detectRuntime,
  clearRuntimeCache,
  isRuntimeAvailable,
  getAvailableRuntimes,
  RuntimeStatusTracker,
  createRuntimeTracker,
  // Command
  parseCommand,
  interpolateCommand,
  shellEscape,
  parseCommandArgs,
  prepareCommand,
  getMissingParams,
  // Validation
  validateInputs,
  applyDefaults,
  getRequiredParams,
  getParamInfo,
} from "./execution";

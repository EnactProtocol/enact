/**
 * Manifest module exports
 */

// Parser
export {
  ManifestParseError,
  parseManifest,
  parseManifestAuto,
  parseYaml,
  extractFrontmatter,
  detectFormat,
  type ManifestFormat,
} from "./parser";

// Validator
export {
  validateManifest,
  validateManifestStrict,
  isValidToolName,
  isValidLocalToolName,
  isValidVersion,
  isValidTimeout,
  ToolManifestSchema,
  type ValidateManifestOptions,
} from "./validator";

// Loader
export {
  ManifestLoadError,
  loadManifest,
  loadManifestFromDir,
  findManifestFile,
  hasManifest,
  tryLoadManifest,
  tryLoadManifestFromDir,
  type LoadedManifest,
  type LoadManifestOptions,
} from "./loader";

// Manifest with scripts
export {
  loadManifestWithActions,
  type LoadedManifestWithActions,
} from "./actions-loader";

// Scripts (inline scripts → Action bridge)
export {
  scriptToAction,
  manifestScriptsToActionsManifest,
} from "./scripts";

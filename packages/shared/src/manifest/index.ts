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
  isValidVersion,
  isValidTimeout,
  ToolManifestSchema,
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
} from "./loader";

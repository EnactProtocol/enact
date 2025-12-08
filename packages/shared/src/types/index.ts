/**
 * Type exports from @enactprotocol/shared
 */

export type {
  // Manifest types
  ToolManifest,
  PackageManifest,
  ParsedManifest,
  // Sub-types
  EnvVariable,
  EnvVariables,
  Author,
  ToolAnnotations,
  ResourceRequirements,
  ToolExample,
  // Validation types
  ValidationResult,
  ValidationError,
  ValidationWarning,
  // Resolution types
  ToolLocation,
  ToolResolution,
  ManifestFileName,
} from "./manifest";

export {
  MANIFEST_FILES,
  PACKAGE_MANIFEST_FILE,
} from "./manifest";

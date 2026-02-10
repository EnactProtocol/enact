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
  ToolHooks,
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

// Actions types (internal — used by scripts bridge and execution pipeline)
export type {
  ActionEnvVar,
  ActionEnvVars,
  Action,
  ActionsManifest,
} from "./actions";

export { DEFAULT_INPUT_SCHEMA, getEffectiveInputSchema } from "./actions";

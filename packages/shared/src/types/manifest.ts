/**
 * TypeScript types for Enact tool manifests
 * These types define the structure of SKILL.md (and legacy enact.yaml/enact.md) frontmatter
 */

import type { JSONSchema7 } from "json-schema";

/**
 * Environment variable declaration in a tool manifest
 */
export interface EnvVariable {
  /** Human-readable description of what this variable is for */
  description: string;
  /** If true, stored in OS keyring; if false, stored in .env files */
  secret?: boolean;
  /** Default value if not set (only for non-secrets) */
  default?: string;
}

/**
 * Environment variables map
 */
export type EnvVariables = Record<string, EnvVariable>;

/**
 * Author information
 */
export interface Author {
  /** Author name */
  name: string;
  /** Author email (optional) */
  email?: string;
  /** Author website URL (optional) */
  url?: string;
}

/**
 * Behavior annotations for AI models
 */
export interface ToolAnnotations {
  /** Human-readable display name */
  title?: string;
  /** Tool does not modify the environment */
  readOnlyHint?: boolean;
  /** Tool may make irreversible changes */
  destructiveHint?: boolean;
  /** Multiple executions produce the same result */
  idempotentHint?: boolean;
  /** Tool interacts with external systems (network, APIs) */
  openWorldHint?: boolean;
}

/**
 * Resource requirements for tool execution
 */
export interface ResourceRequirements {
  /** System memory needed (e.g., "512Mi", "2Gi") */
  memory?: string;
  /** GPU memory needed (e.g., "24Gi") */
  gpu?: string;
  /** Disk space needed (e.g., "100Gi") */
  disk?: string;
}

/**
 * Example/test case for a tool
 */
export interface ToolExample {
  /** Input parameters for this example */
  input?: Record<string, unknown>;
  /** Expected output (for validation) */
  output?: unknown;
  /** Description of this test case */
  description?: string;
}

/**
 * Complete tool manifest structure
 * This represents the YAML frontmatter in SKILL.md (or legacy enact.md/enact.yaml)
 */
export interface ToolManifest {
  // ==================== Required Fields ====================

  /** Hierarchical tool identifier (e.g., "org/category/tool-name") */
  name: string;

  /** Human-readable description of what the tool does */
  description: string;

  // ==================== Recommended Fields ====================

  /** Version of the Enact protocol specification (e.g., "2.0.0") */
  enact?: string;

  /** Tool version in semver format (e.g., "1.2.3") */
  version?: string;

  /** Container base image for tool execution (e.g., "node:18-alpine") */
  from?: string;

  /** Build command(s) to run before execution (cached by Dagger) */
  build?: string | string[];

  /** Shell command to execute with ${parameter} substitution */
  command?: string;

  /** Maximum execution time (e.g., "30s", "5m", "1h") */
  timeout?: string;

  /** SPDX license identifier (e.g., "MIT", "Apache-2.0") */
  license?: string;

  /** Keywords for tool discovery and categorization */
  tags?: string[];

  // ==================== Schema Fields ====================

  /** JSON Schema defining input parameters */
  inputSchema?: JSONSchema7;

  /** JSON Schema defining output structure */
  outputSchema?: JSONSchema7;

  // ==================== Environment Variables ====================

  /** Environment variables and secrets required by the tool */
  env?: EnvVariables;

  // ==================== Behavior & Resources ====================

  /** Behavior hints for AI models */
  annotations?: ToolAnnotations;

  /** Resource limits and requirements */
  resources?: ResourceRequirements;

  // ==================== Documentation ====================

  /** Extended documentation (Markdown) */
  doc?: string;

  /** Tool creators and maintainers */
  authors?: Author[];

  // ==================== Testing ====================

  /** Test cases and expected outputs */
  examples?: ToolExample[];

  // ==================== Custom Extensions ====================

  /** Custom fields starting with x- (not included in signature verification) */
  [key: `x-${string}`]: unknown;
}

/**
 * Package-level configuration (enact-package.yaml)
 * Provides shared configuration for all tools in a directory
 */
export interface PackageManifest {
  /** Version of the Enact protocol specification */
  enact?: string;

  /** Shared environment variables for all tools in this folder */
  env?: EnvVariables;

  /** Shared authors for all tools */
  authors?: Author[];

  /** Shared license for all tools */
  license?: string;

  /** Custom extension fields */
  [key: `x-${string}`]: unknown;
}

/**
 * Parsed manifest with optional markdown body
 */
export interface ParsedManifest {
  /** The parsed YAML frontmatter */
  manifest: ToolManifest;
  /** The markdown body content (if from .md file) */
  body?: string | undefined;
  /** The file format the manifest was loaded from */
  format: "yaml" | "md";
}

/**
 * Result of manifest validation
 */
export interface ValidationResult {
  /** Whether the manifest is valid */
  valid: boolean;
  /** Validation errors (if any) */
  errors?: ValidationError[] | undefined;
  /** Warnings (non-fatal issues) */
  warnings?: ValidationWarning[] | undefined;
}

/**
 * A validation error
 */
export interface ValidationError {
  /** Path to the field with the error (e.g., "inputSchema.properties.name") */
  path: string;
  /** Error message */
  message: string;
  /** Error code for programmatic handling */
  code: string;
}

/**
 * A validation warning
 */
export interface ValidationWarning {
  /** Path to the field with the warning */
  path: string;
  /** Warning message */
  message: string;
  /** Warning code */
  code: string;
}

/**
 * Tool location types for resolution
 */
export type ToolLocation = "file" | "project" | "user" | "cache" | "registry";

/**
 * Result of tool resolution
 */
export interface ToolResolution {
  /** The loaded and validated manifest */
  manifest: ToolManifest;
  /** Directory containing the tool */
  sourceDir: string;
  /** Where the tool was found */
  location: ToolLocation;
  /** Path to the manifest file */
  manifestPath: string;
  /** Tool version (if available) */
  version?: string | undefined;
}

/**
 * Supported manifest file names
 * SKILL.md is the primary format (aligned with Anthropic Agent Skills)
 * enact.md/yaml/yml are supported for backwards compatibility
 */
export const MANIFEST_FILES = ["SKILL.md", "enact.md", "enact.yaml", "enact.yml"] as const;
export type ManifestFileName = (typeof MANIFEST_FILES)[number];

/**
 * Package manifest file name
 */
export const PACKAGE_MANIFEST_FILE = "enact-package.yaml";

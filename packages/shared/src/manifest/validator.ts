/**
 * Manifest validator using Zod
 *
 * Validates that parsed manifests conform to the Enact specification
 */

import { z } from "zod/v4";
import type {
  ToolManifest,
  ValidationError,
  ValidationResult,
  ValidationWarning,
} from "../types/manifest";

// ==================== Zod Schemas ====================

/**
 * Environment variable schema
 */
const EnvVariableSchema = z.object({
  description: z.string().min(1, "Description is required"),
  secret: z.boolean().optional(),
  default: z.string().optional(),
});

/**
 * Author schema
 */
const AuthorSchema = z.object({
  name: z.string().min(1, "Author name is required"),
  email: z.string().email().optional(),
  url: z.string().url().optional(),
});

/**
 * Tool annotations schema
 */
const ToolAnnotationsSchema = z.object({
  title: z.string().optional(),
  readOnlyHint: z.boolean().optional(),
  destructiveHint: z.boolean().optional(),
  idempotentHint: z.boolean().optional(),
  openWorldHint: z.boolean().optional(),
});

/**
 * Resource requirements schema
 */
const ResourceRequirementsSchema = z.object({
  memory: z.string().optional(),
  gpu: z.string().optional(),
  disk: z.string().optional(),
});

/**
 * Tool example schema
 */
const ToolExampleSchema = z.object({
  input: z.record(z.string(), z.unknown()).optional(),
  output: z.unknown().optional(),
  description: z.string().optional(),
});

/**
 * JSON Schema validation (basic structure check)
 * We don't fully validate JSON Schema here, just ensure it's an object
 */
const JsonSchemaSchema = z
  .object({
    type: z.string().optional(),
    properties: z.record(z.string(), z.unknown()).optional(),
    required: z.array(z.string()).optional(),
    items: z.unknown().optional(),
    enum: z.array(z.unknown()).optional(),
    description: z.string().optional(),
  })
  .passthrough(); // Allow additional JSON Schema fields

/**
 * Semantic version regex
 */
const SEMVER_REGEX =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

/**
 * Tool name regex - hierarchical path format
 */
const TOOL_NAME_REGEX = /^[a-z0-9_-]+(?:\/[a-z0-9_-]+)+$/;

/**
 * Go duration regex (used for timeout)
 */
const GO_DURATION_REGEX = /^(\d+)(ns|us|µs|ms|s|m|h)$/;

/**
 * Complete tool manifest schema
 */
const ToolManifestSchema = z
  .object({
    // Required fields
    name: z
      .string()
      .min(1, "Tool name is required")
      .regex(
        TOOL_NAME_REGEX,
        "Tool name must be hierarchical path format (e.g., 'org/tool' or 'org/category/tool')"
      ),

    description: z
      .string()
      .min(1, "Description is required")
      .max(500, "Description should be 500 characters or less"),

    // Recommended fields
    enact: z.string().optional(),
    version: z
      .string()
      .regex(SEMVER_REGEX, "Version must be valid semver (e.g., '1.0.0')")
      .optional(),
    from: z.string().optional(),
    command: z.string().optional(),
    timeout: z
      .string()
      .regex(GO_DURATION_REGEX, "Timeout must be Go duration format (e.g., '30s', '5m', '1h')")
      .optional(),
    license: z.string().optional(),
    tags: z.array(z.string()).optional(),

    // Schema fields
    inputSchema: JsonSchemaSchema.optional(),
    outputSchema: JsonSchemaSchema.optional(),

    // Environment variables
    env: z.record(z.string(), EnvVariableSchema).optional(),

    // Behavior & Resources
    annotations: ToolAnnotationsSchema.optional(),
    resources: ResourceRequirementsSchema.optional(),

    // Documentation
    doc: z.string().optional(),
    authors: z.array(AuthorSchema).optional(),

    // Testing
    examples: z.array(ToolExampleSchema).optional(),
  })
  .passthrough(); // Allow x-* custom fields

// ==================== Validation Functions ====================

/**
 * Convert Zod error to our ValidationError format
 */
function zodErrorToValidationErrors(zodError: z.ZodError): ValidationError[] {
  return zodError.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
    code: issue.code,
  }));
}

/**
 * Generate warnings for recommended but missing fields
 */
function generateWarnings(manifest: ToolManifest): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  // Check for recommended fields
  if (!manifest.enact) {
    warnings.push({
      path: "enact",
      message: "Protocol version (enact) is recommended for compatibility",
      code: "MISSING_RECOMMENDED",
    });
  }

  if (!manifest.version) {
    warnings.push({
      path: "version",
      message: "Tool version is recommended for versioning and updates",
      code: "MISSING_RECOMMENDED",
    });
  }

  if (!manifest.from && manifest.command) {
    warnings.push({
      path: "from",
      message: "Container image (from) is recommended for reproducibility",
      code: "MISSING_RECOMMENDED",
    });
  }

  if (!manifest.license) {
    warnings.push({
      path: "license",
      message: "License is recommended for published tools",
      code: "MISSING_RECOMMENDED",
    });
  }

  if (!manifest.inputSchema && manifest.command) {
    warnings.push({
      path: "inputSchema",
      message: "Input schema is recommended for tools with parameters",
      code: "MISSING_RECOMMENDED",
    });
  }

  if (!manifest.outputSchema) {
    warnings.push({
      path: "outputSchema",
      message: "Output schema is recommended for structured output validation",
      code: "MISSING_RECOMMENDED",
    });
  }

  // Check for potential issues
  if (manifest.env) {
    for (const [key, value] of Object.entries(manifest.env)) {
      if (value.secret && value.default) {
        warnings.push({
          path: `env.${key}`,
          message: "Secret variables should not have default values",
          code: "SECRET_WITH_DEFAULT",
        });
      }
    }
  }

  // Check for timeout on command tools
  if (manifest.command && !manifest.timeout) {
    warnings.push({
      path: "timeout",
      message: "Timeout is recommended for command-based tools",
      code: "MISSING_RECOMMENDED",
    });
  }

  return warnings;
}

/**
 * Validate a tool manifest
 *
 * @param manifest - The manifest to validate (parsed but unvalidated)
 * @returns ValidationResult with valid flag, errors, and warnings
 */
export function validateManifest(manifest: unknown): ValidationResult {
  const result = ToolManifestSchema.safeParse(manifest);

  if (!result.success) {
    return {
      valid: false,
      errors: zodErrorToValidationErrors(result.error),
      warnings: [],
    };
  }

  // Generate warnings for missing recommended fields
  const warnings = generateWarnings(result.data as ToolManifest);

  return {
    valid: true,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Validate and return the typed manifest
 * Throws if validation fails
 *
 * @param manifest - The manifest to validate
 * @returns The validated ToolManifest
 * @throws Error if validation fails
 */
export function validateManifestStrict(manifest: unknown): ToolManifest {
  const result = validateManifest(manifest);

  if (!result.valid) {
    const errorMessages = result.errors?.map((e) => `${e.path}: ${e.message}`).join(", ");
    throw new Error(`Manifest validation failed: ${errorMessages}`);
  }

  return manifest as ToolManifest;
}

/**
 * Check if a string is a valid tool name
 */
export function isValidToolName(name: string): boolean {
  return TOOL_NAME_REGEX.test(name);
}

/**
 * Check if a string is a valid semver version
 */
export function isValidVersion(version: string): boolean {
  return SEMVER_REGEX.test(version);
}

/**
 * Check if a string is a valid Go duration
 */
export function isValidTimeout(timeout: string): boolean {
  return GO_DURATION_REGEX.test(timeout);
}

// Export the schema for external use
export { ToolManifestSchema };

/**
 * TypeScript types for Agent Actions (ACTIONS.yaml)
 *
 * Agent Actions extends the Agent Skills specification with structured execution semantics,
 * enabling skills to define executable actions with typed inputs, validated outputs,
 * and secure credential handling.
 *
 * @see RFC-001-AGENT-ACTIONS.md
 */

import type { JSONSchema7 } from "json-schema";
import type { ToolAnnotations } from "./manifest";

/**
 * Environment variable declaration in ACTIONS.yaml
 */
export interface ActionEnvVar {
  /** Human-readable description of what this variable is for */
  description?: string;
  /** If true, value should be stored securely and masked in logs */
  secret?: boolean;
  /** If true, execution fails if not set */
  required?: boolean;
  /** Default value if not provided */
  default?: string;
}

/**
 * Environment variables map for actions
 */
export type ActionEnvVars = Record<string, ActionEnvVar>;

/**
 * A single executable action within a skill
 *
 * Each action maps directly to an MCP tool with:
 * - (key) → tool name (action name is the map key, not a field)
 * - description → tool description
 * - inputSchema → tool parameters
 * - outputSchema → expected response shape
 * - annotations → behavioral hints
 */
export interface Action {
  /** Human-readable description of what this action does */
  description: string;

  /**
   * Execution command
   *
   * Can be string form (simple commands without templates) or array form
   * (required when using {{}} templates).
   *
   * Template syntax: {{param}} - each template is replaced with the literal
   * value as a single argument, regardless of content.
   *
   * @example
   * // String form (no templates)
   * command: "python main.py --version"
   *
   * // Array form (with templates)
   * command: ["python", "main.py", "scrape", "{{url}}"]
   */
  command: string | string[];

  /**
   * JSON Schema defining expected input parameters
   *
   * Uses standard JSON Schema conventions:
   * - Required fields listed in 'required' array must be provided
   * - Optional fields with 'default' use the default value if not provided
   * - Optional fields without 'default' cause the argument to be omitted entirely
   *
   * If omitted, defaults to { type: 'object', properties: {} } (no parameters)
   */
  inputSchema?: JSONSchema7;

  /**
   * JSON Schema defining expected output structure
   *
   * If provided, clients must validate results against this schema.
   * Results that don't conform are treated as errors.
   */
  outputSchema?: JSONSchema7;

  /**
   * Behavioral hints for AI models and clients
   *
   * Open-ended object for attaching metadata to actions.
   * Clients may use these for UI presentation, filtering, or custom behavior.
   */
  annotations?: ToolAnnotations;
}

/**
 * Complete ACTIONS.yaml manifest structure
 *
 * Defines how to execute actions for a skill, including environment
 * variables, build steps, and the map of executable actions.
 *
 * @example
 * ```yaml
 * actions:
 *   scrape:
 *     description: Scrape a URL
 *     command: ["python", "main.py", "{{url}}"]
 *     inputSchema:
 *       type: object
 *       required: [url]
 *       properties:
 *         url: { type: string }
 * ```
 */
export interface ActionsManifest {
  /**
   * Environment variables and secrets required by all actions
   *
   * Key benefit: Unlike traditional skills where you discover missing
   * credentials at runtime, ACTIONS.yaml declares requirements upfront.
   */
  env?: ActionEnvVars;

  /**
   * Map of action names to action definitions
   *
   * Each action becomes an MCP tool that can be executed directly.
   * The key is the action name (e.g., "scrape", "crawl").
   *
   * @example
   * actions:
   *   scrape:
   *     description: Scrape a URL
   *     command: ["python", "main.py", "{{url}}"]
   *   list-formats:
   *     description: List supported formats
   *     command: ffmpeg -formats
   */
  actions: Record<string, Action>;

  /**
   * Build commands to run before execution
   *
   * For projects that require setup (e.g., pip install, npm install).
   * Build runs once per environment setup, not per action invocation.
   * Build failures prevent action execution.
   *
   * @example
   * build:
   *   - pip install -r requirements.txt
   *   - npm install
   *   - npm run build
   */
  build?: string | string[];
}

/**
 * Result of parsing an ACTIONS.yaml file
 */
export interface ParsedActionsManifest {
  /** The parsed actions manifest */
  actions: ActionsManifest;
  /** The file path the manifest was loaded from */
  filePath: string;
}

/**
 * Validation error specific to actions
 */
export interface ActionValidationError {
  /** Path to the field with the error (e.g., "actions[0].command") */
  path: string;
  /** Error message */
  message: string;
  /** Error code for programmatic handling */
  code: ActionValidationErrorCode;
}

/**
 * Error codes for action validation
 */
export type ActionValidationErrorCode =
  | "MISSING_REQUIRED_FIELD"
  | "INVALID_COMMAND_FORMAT"
  | "STRING_COMMAND_WITH_TEMPLATE"
  | "DUPLICATE_ACTION_NAME"
  | "INVALID_INPUT_SCHEMA"
  | "INVALID_OUTPUT_SCHEMA"
  | "EMPTY_ACTIONS_ARRAY";

/**
 * Result of validating an actions manifest
 */
export interface ActionValidationResult {
  /** Whether the manifest is valid */
  valid: boolean;
  /** Validation errors (if any) */
  errors?: ActionValidationError[];
}

/**
 * Actions manifest file names (in order of preference)
 */
export const ACTIONS_FILES = ["ACTIONS.yaml", "ACTIONS.yml"] as const;
export type ActionsFileName = (typeof ACTIONS_FILES)[number];

/**
 * Default inputSchema when not provided
 *
 * Actions without inputSchema default to accepting no parameters.
 */
export const DEFAULT_INPUT_SCHEMA: JSONSchema7 = {
  type: "object",
  properties: {},
} as const;

/**
 * Get the effective inputSchema for an action
 *
 * Returns the action's inputSchema if provided, otherwise returns
 * the default empty schema.
 */
export function getEffectiveInputSchema(action: Action): JSONSchema7 {
  return action.inputSchema ?? DEFAULT_INPUT_SCHEMA;
}

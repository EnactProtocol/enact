/**
 * Action command interpolation for Agent Actions
 *
 * Implements the {{param}} template syntax specified in RFC-001-AGENT-ACTIONS.
 *
 * ## Key Differences from ${param} (command.ts)
 *
 * 1. **No shell escaping**: Values are passed directly as arguments to execve()
 * 2. **Array form only**: Templates only work in array-form commands
 * 3. **Argument omission**: Optional params without values are omitted entirely
 * 4. **Single argument substitution**: Each {{var}} becomes exactly one argument
 *
 * ## Security
 *
 * This template system is designed to prevent command injection:
 * - Values are never passed through a shell interpreter
 * - No argument splitting on whitespace or metacharacters
 * - Each template becomes a single argument regardless of content
 *
 * @see RFC-001-AGENT-ACTIONS.md
 */

import type { JSONSchema7 } from "json-schema";

/**
 * Token types for action command parsing
 */
export interface ActionCommandLiteralToken {
  type: "literal";
  value: string;
}

export interface ActionCommandParamToken {
  type: "parameter";
  name: string;
}

export type ActionCommandToken = ActionCommandLiteralToken | ActionCommandParamToken;

/**
 * Parsed representation of a single command argument
 */
export interface ParsedArgument {
  /** The tokens that make up this argument */
  tokens: ActionCommandToken[];
  /** Parameter names referenced in this argument */
  parameters: string[];
}

/**
 * Result of parsing an action command
 */
export interface ParsedActionCommand {
  /** Original command (array form) */
  original: string[];
  /** Parsed arguments with tokens */
  arguments: ParsedArgument[];
  /** All unique parameter names across all arguments */
  allParameters: string[];
}

/**
 * Regex to match {{param}} template syntax
 */
const ACTION_TEMPLATE_REGEX = /\{\{([^}]+)\}\}/g;

/**
 * Check if a string contains {{param}} templates
 */
export function hasActionTemplates(str: string): boolean {
  // Reset regex state and test
  ACTION_TEMPLATE_REGEX.lastIndex = 0;
  return ACTION_TEMPLATE_REGEX.test(str);
}

/**
 * Parse a single argument string into tokens
 *
 * @param arg - The argument string to parse
 * @returns ParsedArgument with tokens and parameter names
 */
export function parseActionArgument(arg: string): ParsedArgument {
  const tokens: ActionCommandToken[] = [];
  const parameters: string[] = [];

  let lastIndex = 0;
  const regex = /\{\{([^}]+)\}\}/g;
  let match: RegExpExecArray | null = regex.exec(arg);

  while (match !== null) {
    // Add literal text before this match
    if (match.index > lastIndex) {
      tokens.push({
        type: "literal",
        value: arg.slice(lastIndex, match.index),
      });
    }

    // Add the parameter token
    const paramName = match[1]?.trim();
    if (paramName) {
      tokens.push({
        type: "parameter",
        name: paramName,
      });

      if (!parameters.includes(paramName)) {
        parameters.push(paramName);
      }
    }

    lastIndex = match.index + match[0].length;
    match = regex.exec(arg);
  }

  // Add any remaining literal text
  if (lastIndex < arg.length) {
    tokens.push({
      type: "literal",
      value: arg.slice(lastIndex),
    });
  }

  // If no tokens were created, the whole arg is a literal
  if (tokens.length === 0) {
    tokens.push({
      type: "literal",
      value: arg,
    });
  }

  return { tokens, parameters };
}

/**
 * Parse an action command (array form) into tokens
 *
 * @param command - The command array to parse
 * @returns ParsedActionCommand with all arguments parsed
 */
export function parseActionCommand(command: string[]): ParsedActionCommand {
  const parsedArgs: ParsedArgument[] = [];
  const allParameters: string[] = [];

  for (const arg of command) {
    const parsed = parseActionArgument(arg);
    parsedArgs.push(parsed);

    // Collect unique parameters
    for (const param of parsed.parameters) {
      if (!allParameters.includes(param)) {
        allParameters.push(param);
      }
    }
  }

  return {
    original: command,
    arguments: parsedArgs,
    allParameters,
  };
}

/**
 * Options for action command interpolation
 */
export interface ActionInterpolationOptions {
  /**
   * JSON Schema for input validation
   * Used to determine which parameters are optional and have defaults
   */
  inputSchema?: JSONSchema7;

  /**
   * Whether to omit arguments for optional params with no value
   * Default: true (as per RFC-001)
   */
  omitMissingOptional?: boolean;
}

/**
 * Get the default value for a parameter from the input schema
 */
function getDefaultValue(paramName: string, inputSchema?: JSONSchema7): unknown | undefined {
  if (!inputSchema || inputSchema.type !== "object") {
    return undefined;
  }

  const properties = inputSchema.properties as Record<string, JSONSchema7> | undefined;
  if (!properties) {
    return undefined;
  }

  const propSchema = properties[paramName];
  if (!propSchema || typeof propSchema === "boolean") {
    return undefined;
  }

  return propSchema.default;
}

/**
 * Check if a parameter is required according to the input schema
 */
function isRequired(paramName: string, inputSchema?: JSONSchema7): boolean {
  if (!inputSchema) {
    return true; // Conservative default
  }

  const required = inputSchema.required as string[] | undefined;
  return required?.includes(paramName) ?? false;
}

/**
 * Convert a value to string for command argument
 *
 * Unlike command.ts, we don't shell-escape here because values
 * are passed directly to execve(), not through a shell.
 */
function valueToArgString(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

/**
 * Interpolate a single argument with parameter values
 *
 * @param parsed - Parsed argument with tokens
 * @param params - Parameter values
 * @param inputSchema - JSON Schema for defaults and required checks
 * @returns Interpolated string, or undefined if argument should be omitted
 */
function interpolateArgument(
  parsed: ParsedArgument,
  params: Record<string, unknown>,
  inputSchema?: JSONSchema7
): string | undefined {
  // Check if any parameter in this argument should cause omission
  for (const paramName of parsed.parameters) {
    const value = params[paramName];
    const defaultValue = getDefaultValue(paramName, inputSchema);
    const required = isRequired(paramName, inputSchema);

    // If parameter is not provided
    if (value === undefined) {
      // Use default if available
      if (defaultValue !== undefined) {
        // Continue with default value (handled below in token processing)
        continue;
      }

      // If optional (not required) and no default, omit entire argument
      if (!required) {
        return undefined;
      }

      // If required and no value, this is an error
      throw new Error(`Missing required parameter: ${paramName}`);
    }
  }

  // Build the interpolated string
  const parts: string[] = [];

  for (const token of parsed.tokens) {
    if (token.type === "literal") {
      parts.push(token.value);
    } else {
      const paramName = token.name;
      let value = params[paramName];

      // Apply default if value not provided
      if (value === undefined) {
        value = getDefaultValue(paramName, inputSchema);
      }

      parts.push(valueToArgString(value));
    }
  }

  return parts.join("");
}

/**
 * Interpolate an action command with parameter values
 *
 * Implements RFC-001 template substitution rules:
 * 1. Each {{var}} is replaced with the literal value as a single argument
 * 2. Optional parameters without values cause the argument to be omitted
 * 3. No shell interpolation - values passed directly to execve()
 *
 * @param command - Array-form command with {{param}} templates
 * @param params - Parameter values
 * @param options - Interpolation options
 * @returns Array of command arguments ready for execve()
 */
export function interpolateActionCommand(
  command: string[],
  params: Record<string, unknown>,
  options: ActionInterpolationOptions = {}
): string[] {
  const { inputSchema, omitMissingOptional = true } = options;
  const parsed = parseActionCommand(command);
  const result: string[] = [];

  for (const arg of parsed.arguments) {
    // If argument has no parameters, include it as-is
    if (arg.parameters.length === 0) {
      // It's just a literal
      const literal = arg.tokens[0];
      if (literal && literal.type === "literal") {
        result.push(literal.value);
      }
      continue;
    }
    const interpolated = interpolateArgument(arg, params, inputSchema);

    // undefined means omit this argument
    if (interpolated === undefined) {
      if (!omitMissingOptional) {
        // If not omitting, use empty string
        result.push("");
      }
      // Otherwise skip this argument entirely
      continue;
    }

    result.push(interpolated);
  }

  return result;
}

/**
 * Validate that all required parameters are provided
 *
 * @param command - Array-form command
 * @param params - Provided parameter values
 * @param inputSchema - JSON Schema for required field info
 * @returns Array of missing required parameter names
 */
export function getMissingRequiredParams(
  command: string[],
  params: Record<string, unknown>,
  inputSchema?: JSONSchema7
): string[] {
  const parsed = parseActionCommand(command);
  const missing: string[] = [];

  for (const paramName of parsed.allParameters) {
    const value = params[paramName];
    const defaultValue = getDefaultValue(paramName, inputSchema);
    const required = isRequired(paramName, inputSchema);

    if (required && value === undefined && defaultValue === undefined) {
      missing.push(paramName);
    }
  }

  return missing;
}

/**
 * Get all parameters referenced in a command
 *
 * @param command - Array-form command
 * @returns Array of parameter names
 */
export function getActionCommandParams(command: string[]): string[] {
  return parseActionCommand(command).allParameters;
}

/**
 * Prepare an action command for execution
 *
 * This is the main entry point for preparing action commands.
 * It validates required parameters and interpolates the command.
 *
 * @param command - Array-form command with {{param}} templates
 * @param params - Parameter values
 * @param inputSchema - JSON Schema for validation
 * @returns Array of command arguments ready for execve()
 * @throws Error if required parameters are missing
 */
export function prepareActionCommand(
  command: string[],
  params: Record<string, unknown>,
  inputSchema?: JSONSchema7
): string[] {
  // Validate required parameters
  const missing = getMissingRequiredParams(command, params, inputSchema);
  if (missing.length > 0) {
    throw new Error(`Missing required parameters: ${missing.join(", ")}`);
  }

  // Interpolate and return
  const options: ActionInterpolationOptions = {};
  if (inputSchema !== undefined) {
    options.inputSchema = inputSchema;
  }
  return interpolateActionCommand(command, params, options);
}

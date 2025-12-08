/**
 * Command interpolation and parsing
 *
 * Handles ${parameter} substitution in command templates with proper escaping.
 */

import type { CommandToken, InterpolationOptions, ParsedCommand } from "./types";

/**
 * Pattern to match ${parameter} in command strings
 */
const PARAM_PATTERN = /\$\{([^}]+)\}/g;

/**
 * Parse a command template into tokens
 *
 * @param command - Command template with ${parameter} placeholders
 * @returns Parsed command with tokens and parameter list
 */
export function parseCommand(command: string): ParsedCommand {
  const tokens: CommandToken[] = [];
  const parameters: string[] = [];

  let lastIndex = 0;
  let match: RegExpExecArray | null = null;

  // Reset regex state
  PARAM_PATTERN.lastIndex = 0;

  match = PARAM_PATTERN.exec(command);
  while (match !== null) {
    // Add literal text before this match
    if (match.index > lastIndex) {
      tokens.push({
        type: "literal",
        value: command.slice(lastIndex, match.index),
      });
    }

    // Add the parameter token
    const paramName = match[1];
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
    match = PARAM_PATTERN.exec(command);
  }

  // Add any remaining literal text
  if (lastIndex < command.length) {
    tokens.push({
      type: "literal",
      value: command.slice(lastIndex),
    });
  }

  return {
    original: command,
    tokens,
    parameters,
  };
}

/**
 * Shell-escape a value for safe inclusion in a command
 *
 * Uses single quotes and handles embedded single quotes.
 * Example: "it's a test" becomes "'it'\"'\"'s a test'"
 *
 * @param value - Value to escape
 * @returns Shell-safe escaped string
 */
export function shellEscape(value: string): string {
  // If the value is empty, return empty quoted string
  if (value === "") {
    return "''";
  }

  // If value contains no special characters, return as-is
  if (/^[a-zA-Z0-9._\-/]+$/.test(value)) {
    return value;
  }

  // Use single quotes, escaping any embedded single quotes
  // The technique: end quote, add escaped quote, start new quote
  // 'it'"'"'s' means: 'it' + "'" + 's'
  return `'${value.replace(/'/g, "'\"'\"'")}'`;
}

/**
 * Convert a value to string for command interpolation
 *
 * Handles different types:
 * - string: as-is
 * - number: toString()
 * - boolean: "true" or "false"
 * - object/array: JSON.stringify
 * - null/undefined: empty string
 *
 * @param value - Value to convert
 * @param jsonifyObjects - Whether to JSON-stringify objects
 * @returns String representation
 */
export function valueToString(value: unknown, jsonifyObjects = true): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (jsonifyObjects && (typeof value === "object" || Array.isArray(value))) {
    return JSON.stringify(value);
  }

  return String(value);
}

/**
 * Interpolate a command template with parameter values
 *
 * @param command - Command template or parsed command
 * @param params - Parameter values
 * @param options - Interpolation options
 * @returns Interpolated command string
 * @throws Error if required parameter is missing and onMissing is "error"
 */
export function interpolateCommand(
  command: string | ParsedCommand,
  params: Record<string, unknown>,
  options: InterpolationOptions = {}
): string {
  const { escape: shouldEscape = true, jsonifyObjects = true, onMissing = "error" } = options;

  const parsed = typeof command === "string" ? parseCommand(command) : command;

  const parts: string[] = [];

  for (const token of parsed.tokens) {
    if (token.type === "literal") {
      parts.push(token.value);
    } else {
      const paramName = token.name;
      const value = params[paramName];

      if (value === undefined) {
        switch (onMissing) {
          case "error":
            throw new Error(`Missing required parameter: ${paramName}`);
          case "empty":
            parts.push("");
            break;
          case "keep":
            parts.push(`\${${paramName}}`);
            break;
        }
      } else {
        const stringValue = valueToString(value, jsonifyObjects);
        parts.push(shouldEscape ? shellEscape(stringValue) : stringValue);
      }
    }
  }

  return parts.join("");
}

/**
 * Parse a command string respecting quotes
 *
 * Splits a command into arguments, respecting single and double quotes.
 *
 * @param command - Command string to parse
 * @returns Array of command arguments
 */
export function parseCommandArgs(command: string): string[] {
  const args: string[] = [];
  let current = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escapeNext = false;

  for (let i = 0; i < command.length; i++) {
    const char = command[i] as string;

    if (escapeNext) {
      current += char;
      escapeNext = false;
      continue;
    }

    if (char === "\\") {
      escapeNext = true;
      continue;
    }

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (char === " " && !inSingleQuote && !inDoubleQuote) {
      if (current.length > 0) {
        args.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  // Add the last argument
  if (current.length > 0) {
    args.push(current);
  }

  return args;
}

/**
 * Wrap a command with sh -c for execution
 *
 * Useful when the command contains shell features like pipes, redirects, etc.
 *
 * @param command - Command to wrap
 * @returns Arguments for sh -c execution
 */
export function wrapWithShell(command: string): string[] {
  return ["sh", "-c", command];
}

/**
 * Check if a command needs shell wrapping
 *
 * Returns true if the command contains shell special characters.
 *
 * @param command - Command to check
 * @returns Whether the command needs sh -c wrapping
 */
export function needsShellWrap(command: string): boolean {
  // Check for shell operators and features
  return /[|&;<>()$`\\"\n*?[\]#~=%]/.test(command);
}

/**
 * Prepare a command for execution
 *
 * Parses the command and determines if it needs shell wrapping.
 *
 * @param command - Command template
 * @param params - Parameter values for interpolation
 * @param options - Interpolation options
 * @returns Command ready for execution [program, ...args]
 */
export function prepareCommand(
  command: string,
  params: Record<string, unknown>,
  options: InterpolationOptions = {}
): string[] {
  // Interpolate parameters
  const interpolated = interpolateCommand(command, params, options);

  // Check if we need shell wrapping
  if (needsShellWrap(interpolated)) {
    return wrapWithShell(interpolated);
  }

  // Parse into arguments
  return parseCommandArgs(interpolated);
}

/**
 * Validate that all required parameters are provided
 *
 * @param command - Parsed command
 * @param params - Provided parameters
 * @returns Array of missing parameter names
 */
export function getMissingParams(
  command: string | ParsedCommand,
  params: Record<string, unknown>
): string[] {
  const parsed = typeof command === "string" ? parseCommand(command) : command;

  return parsed.parameters.filter((param) => params[param] === undefined);
}

/**
 * Get all parameters in a command template
 *
 * @param command - Command template
 * @returns Array of parameter names
 */
export function getCommandParams(command: string): string[] {
  return parseCommand(command).parameters;
}

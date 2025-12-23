/**
 * Command interpolation and parsing
 *
 * Handles ${parameter} substitution in command templates with proper escaping.
 *
 * ## Parameter Recognition
 *
 * Only `${...}` patterns that match parameters defined in the tool's inputSchema
 * are substituted. Other `${...}` patterns (like bash variables, arrays, etc.)
 * are passed through unchanged to the shell.
 *
 * This allows natural use of shell syntax:
 * - `${name}` - Substituted if "name" is in inputSchema
 * - `${MY_VAR}` - Passed through to bash (not in inputSchema)
 * - `${array[$i]}` - Passed through to bash (not in inputSchema)
 *
 * ## Quoting Behavior
 *
 * Enact automatically applies shell-escaping (quoting) to parameter values
 * that contain special characters. This means you should NOT add quotes
 * around parameters in your command templates:
 *
 * ✅ Correct: `command: "node script.js ${input}"`
 * ❌ Incorrect: `command: "node script.js '${input}'"` (causes double-quoting)
 *
 * ### Modifiers
 *
 * - `${param}` - Normal substitution with auto-quoting
 * - `${param:raw}` - Raw substitution without any quoting (use with caution)
 *
 * ### Smart Quote Detection
 *
 * If a parameter is surrounded by quotes in the template (e.g., `'${param}'`),
 * Enact will:
 * 1. Strip the surrounding quotes from the template
 * 2. Apply its own quoting as needed
 * 3. Emit a warning to help tool authors fix their templates
 */

import type { CommandToken, InterpolationOptions, ParsedCommand } from "./types";

/**
 * Pattern to match ${parameter} or ${parameter:modifier} in command strings
 * Captures: paramName and optional modifier (e.g., "raw")
 */
const PARAM_PATTERN = /\$\{([^}:]+)(?::([^}]+))?\}/g;

/**
 * Options for parsing a command template
 */
export interface ParseCommandOptions {
  /**
   * Set of known parameter names from the inputSchema.
   * Only ${...} patterns matching these names will be treated as parameters.
   * If not provided, ALL ${...} patterns are treated as parameters (legacy behavior).
   */
  knownParameters?: Set<string>;
}

/**
 * Parse a command template into tokens
 *
 * Detects:
 * - Parameters with modifiers: ${param:raw}
 * - Parameters surrounded by quotes: '${param}' or "${param}"
 *
 * When knownParameters is provided, only ${...} patterns matching known parameter
 * names are treated as parameters. Other patterns are kept as literals, allowing
 * natural shell syntax like ${MY_VAR} or ${array[$i]} to pass through.
 *
 * @param command - Command template with ${parameter} placeholders
 * @param options - Parse options including knownParameters
 * @returns Parsed command with tokens and parameter list
 */
export function parseCommand(command: string, options: ParseCommandOptions = {}): ParsedCommand {
  const { knownParameters } = options;
  const tokens: CommandToken[] = [];
  const parameters: string[] = [];

  let lastIndex = 0;
  let match: RegExpExecArray | null = null;

  // Reset regex state
  PARAM_PATTERN.lastIndex = 0;

  match = PARAM_PATTERN.exec(command);
  while (match !== null) {
    const paramName = match[1];
    const modifier = match[2]; // e.g., "raw"
    const isRaw = modifier === "raw";

    // Check if this is a known parameter (or if we're in legacy mode with no filter)
    const isKnownParameter = !knownParameters || (paramName && knownParameters.has(paramName));

    if (!isKnownParameter) {
      // Not a known parameter - skip and continue
      // The text will be included in the next literal segment
      match = PARAM_PATTERN.exec(command);
      continue;
    }

    // Check if preceded by a quote
    let startIndex = match.index;
    let surroundingQuotes: "single" | "double" | undefined;

    // Look for surrounding quotes pattern: '${param}' or "${param}"
    const charBefore = startIndex > 0 ? command[startIndex - 1] : "";
    const charAfter = command[startIndex + match[0].length];

    if (charBefore === "'" && charAfter === "'") {
      surroundingQuotes = "single";
      startIndex--; // Include the opening quote in the consumed range
    } else if (charBefore === '"' && charAfter === '"') {
      surroundingQuotes = "double";
      startIndex--; // Include the opening quote in the consumed range
    }

    // Add literal text before this match (excluding any opening quote we're consuming)
    if (startIndex > lastIndex) {
      tokens.push({
        type: "literal",
        value: command.slice(lastIndex, startIndex),
      });
    }

    // Add the parameter token
    if (paramName) {
      const token: CommandToken = {
        type: "parameter",
        name: paramName,
      };

      // Only add optional properties if they have values
      if (isRaw) {
        token.raw = true;
      }
      if (surroundingQuotes) {
        token.surroundingQuotes = surroundingQuotes;
      }

      tokens.push(token);

      if (!parameters.includes(paramName)) {
        parameters.push(paramName);
      }
    }

    // Update lastIndex, skipping the closing quote if we detected surrounding quotes
    lastIndex = match.index + match[0].length;
    if (surroundingQuotes) {
      lastIndex++; // Skip the closing quote
    }

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
 * Handles:
 * - Normal parameters: `${param}` - auto-quoted as needed
 * - Raw parameters: `${param:raw}` - no quoting applied
 * - Quoted parameters: `'${param}'` - quotes stripped, warning emitted
 *
 * When knownParameters is provided in options, only matching ${...} patterns
 * are substituted. Other patterns pass through unchanged for shell processing.
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
  const {
    escape: shouldEscape = true,
    jsonifyObjects = true,
    onMissing = "error",
    onWarning,
    knownParameters,
  } = options;

  const parsed =
    typeof command === "string"
      ? parseCommand(command, knownParameters ? { knownParameters } : {})
      : command;

  const parts: string[] = [];

  for (const token of parsed.tokens) {
    if (token.type === "literal") {
      parts.push(token.value);
    } else {
      const paramName = token.name;
      const value = params[paramName];
      const isRaw = token.raw === true;
      const hadSurroundingQuotes = token.surroundingQuotes;

      // Emit warning if surrounding quotes were detected and stripped
      if (hadSurroundingQuotes && onWarning) {
        const quoteChar = hadSurroundingQuotes === "single" ? "'" : '"';
        onWarning({
          code: "DOUBLE_QUOTING",
          message: `Parameter '${paramName}' was surrounded by ${hadSurroundingQuotes} quotes in the command template. This would cause double-quoting. The quotes have been automatically removed.`,
          parameter: paramName,
          suggestion: `Change ${quoteChar}\${${paramName}}${quoteChar} to \${${paramName}} in your command template.`,
        });
      }

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

        // Determine if we should escape this value
        // - Raw modifier (${param:raw}) disables escaping
        // - Global escape option can disable escaping
        const shouldEscapeThis = shouldEscape && !isRaw;

        parts.push(shouldEscapeThis ? shellEscape(stringValue) : stringValue);
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
 * When knownParameters is provided, only matching ${...} patterns are
 * substituted, allowing shell syntax to pass through unchanged.
 *
 * @param command - Command template
 * @param params - Parameter values for interpolation
 * @param options - Interpolation options (including knownParameters)
 * @returns Command ready for execution [program, ...args]
 */
export function prepareCommand(
  command: string,
  params: Record<string, unknown>,
  options: InterpolationOptions = {}
): string[] {
  // Default to empty string for missing params since validation
  // already catches truly missing required params before this is called.
  // This allows optional params without defaults to work correctly.
  const effectiveOptions: InterpolationOptions = {
    onMissing: "empty",
    ...options,
  };

  // Interpolate parameters
  const interpolated = interpolateCommand(command, params, effectiveOptions);

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
 * @param options - Parse options including knownParameters
 * @returns Array of missing parameter names
 */
export function getMissingParams(
  command: string | ParsedCommand,
  params: Record<string, unknown>,
  options: ParseCommandOptions = {}
): string[] {
  const parsed = typeof command === "string" ? parseCommand(command, options) : command;

  return parsed.parameters.filter((param) => params[param] === undefined);
}

/**
 * Get all parameters in a command template
 *
 * @param command - Command template
 * @param options - Parse options including knownParameters
 * @returns Array of parameter names
 */
export function getCommandParams(command: string, options: ParseCommandOptions = {}): string[] {
  return parseCommand(command, options).parameters;
}

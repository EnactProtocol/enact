/**
 * .env file parser
 *
 * Parses KEY=VALUE format with support for:
 * - Comments (lines starting with #)
 * - Empty lines
 * - Quoted values (single and double quotes)
 * - Inline comments
 * - Values with = signs
 */

import type { EnvFileLine, ParsedEnvFile } from "../types";

/**
 * Parse a single line from an .env file
 */
function parseLine(line: string): EnvFileLine {
  const trimmed = line.trim();

  // Empty line
  if (trimmed === "") {
    return { type: "empty", raw: line };
  }

  // Comment line
  if (trimmed.startsWith("#")) {
    return { type: "comment", raw: line };
  }

  // Variable line - find the first =
  const eqIndex = trimmed.indexOf("=");
  if (eqIndex === -1) {
    // No = sign, treat as comment (invalid line)
    return { type: "comment", raw: line };
  }

  const key = trimmed.slice(0, eqIndex).trim();
  let value = trimmed.slice(eqIndex + 1);

  // Handle inline comments (but not inside quotes)
  value = parseValue(value);

  return {
    type: "variable",
    raw: line,
    key,
    value,
  };
}

/**
 * Parse a value, handling quotes and inline comments
 */
function parseValue(rawValue: string): string {
  let value = rawValue.trim();

  // Handle quoted values
  if (value.length > 1) {
    const firstChar = value[0];
    if (firstChar === '"' || firstChar === "'") {
      const quote = firstChar;
      // Find the end quote, accounting for escaped quotes
      let endQuote = -1;
      for (let i = 1; i < value.length; i++) {
        if (value[i] === quote && value[i - 1] !== "\\") {
          endQuote = i;
          break;
        }
      }

      if (endQuote !== -1) {
        // Extract value between quotes
        value = value.slice(1, endQuote);
        // Handle escape sequences in double-quoted strings
        if (quote === '"') {
          value = value
            .replace(/\\n/g, "\n")
            .replace(/\\r/g, "\r")
            .replace(/\\t/g, "\t")
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, "\\");
        }
        return value;
      }
    }
  }

  // Handle inline comments for unquoted values
  const commentIndex = value.indexOf(" #");
  if (commentIndex !== -1) {
    value = value.slice(0, commentIndex).trim();
  }

  return value;
}

/**
 * Parse .env file content
 *
 * @param content - The file content to parse
 * @returns Parsed env file with vars and preserved lines
 */
export function parseEnvFile(content: string): ParsedEnvFile {
  const lines = content.split("\n");
  const parsedLines: EnvFileLine[] = [];
  const vars: Record<string, string> = {};

  for (const line of lines) {
    const parsed = parseLine(line);
    parsedLines.push(parsed);

    if (parsed.type === "variable" && parsed.key && parsed.value !== undefined) {
      vars[parsed.key] = parsed.value;
    }
  }

  return {
    vars,
    lines: parsedLines,
  };
}

/**
 * Parse .env file content to simple key-value object
 *
 * @param content - The file content to parse
 * @returns Object with key-value pairs
 */
export function parseEnvContent(content: string): Record<string, string> {
  return parseEnvFile(content).vars;
}

/**
 * Serialize an env file back to string format
 * Preserves comments and formatting
 *
 * @param parsed - The parsed env file
 * @returns String content for .env file
 */
export function serializeEnvFile(parsed: ParsedEnvFile): string {
  return parsed.lines
    .map((line) => {
      if (line.type === "variable" && line.key) {
        const value = parsed.vars[line.key] ?? line.value ?? "";
        // Quote values with spaces or special characters
        if (value.includes(" ") || value.includes("=") || value.includes("#")) {
          return `${line.key}="${value.replace(/"/g, '\\"')}"`;
        }
        return `${line.key}=${value}`;
      }
      return line.raw;
    })
    .join("\n");
}

/**
 * Create a new env file content from a vars object
 *
 * @param vars - Key-value pairs to serialize
 * @returns String content for .env file
 */
export function createEnvContent(vars: Record<string, string>): string {
  const lines: string[] = [];

  for (const [key, value] of Object.entries(vars)) {
    // Quote values with spaces or special characters
    if (value.includes(" ") || value.includes("=") || value.includes("#")) {
      lines.push(`${key}="${value.replace(/"/g, '\\"')}"`);
    } else {
      lines.push(`${key}=${value}`);
    }
  }

  return lines.join("\n");
}

/**
 * Update a single variable in parsed env file
 *
 * @param parsed - The parsed env file
 * @param key - The variable key
 * @param value - The new value
 * @returns Updated parsed env file
 */
export function updateEnvVar(parsed: ParsedEnvFile, key: string, value: string): ParsedEnvFile {
  // Update the vars
  const newVars = { ...parsed.vars, [key]: value };

  // Check if key exists in lines
  const existingIndex = parsed.lines.findIndex(
    (line) => line.type === "variable" && line.key === key
  );

  let newLines: EnvFileLine[];
  if (existingIndex !== -1) {
    // Update existing line
    newLines = [...parsed.lines];
    newLines[existingIndex] = {
      type: "variable",
      raw: `${key}=${value}`,
      key,
      value,
    };
  } else {
    // Add new line at end
    newLines = [
      ...parsed.lines,
      {
        type: "variable",
        raw: `${key}=${value}`,
        key,
        value,
      },
    ];
  }

  return {
    vars: newVars,
    lines: newLines,
  };
}

/**
 * Remove a variable from parsed env file
 *
 * @param parsed - The parsed env file
 * @param key - The variable key to remove
 * @returns Updated parsed env file
 */
export function removeEnvVar(parsed: ParsedEnvFile, key: string): ParsedEnvFile {
  const newVars = { ...parsed.vars };
  delete newVars[key];

  const newLines = parsed.lines.filter((line) => !(line.type === "variable" && line.key === key));

  return {
    vars: newVars,
    lines: newLines,
  };
}

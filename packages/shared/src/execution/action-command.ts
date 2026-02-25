/**
 * Action command building for script execution
 *
 * Implements a simple passthrough model: the script command is the base,
 * and arguments are appended as-is (from CLI) or converted to --key value
 * flags (from JSON/MCP).
 *
 * ## Design
 *
 * - No template substitution — scripts handle their own arg parsing
 * - CLI args pass through directly (like `just`)
 * - JSON args (from -a or MCP) are converted to --key value flags
 * - inputSchema is optional/informational, not used for validation
 *
 * ## Security
 *
 * Values are passed directly as arguments to execve(), never through a shell.
 */

/**
 * Build a command array from a base command and additional arguments
 *
 * @param baseCommand - The script command (string or array)
 * @param args - Additional arguments to append
 * @returns Array of command arguments ready for execve()
 */
export function buildCommand(baseCommand: string | string[], args: string[] = []): string[] {
  const cmd =
    typeof baseCommand === "string"
      ? baseCommand.split(/\s+/).filter((s) => s.length > 0)
      : [...baseCommand];
  return [...cmd, ...args];
}

/**
 * Convert a JSON params object to --key value CLI flags
 *
 * Conversion rules:
 * - `true` → `--key` (flag only)
 * - `false` → omitted
 * - `null`/`undefined` → omitted
 * - string/number → `--key value`
 * - object/array → `--key <json-stringified>`
 *
 * @param params - JSON params from -a flag or MCP input
 * @returns Array of CLI flag strings
 */
export function jsonArgsToFlags(params: Record<string, unknown>): string[] {
  const flags: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === false || value === null || value === undefined) {
      // Skip falsy/nullish values — no flag generated
    } else if (value === true) {
      flags.push(`--${key}`);
    } else if (typeof value === "object") {
      flags.push(`--${key}`, JSON.stringify(value));
    } else {
      flags.push(`--${key}`, String(value));
    }
  }
  return flags;
}

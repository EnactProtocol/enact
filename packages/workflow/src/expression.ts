/**
 * Expression evaluator for workflow ${{ }} templates
 *
 * Supports safe property-path lookup only — no eval() or Function().
 *
 * Supported forms:
 *   ${{ inputs.key }}
 *   ${{ steps.id.outputs.field }}
 *   ${{ secrets.KEY }}
 *   ${{ env.VAR }}
 *   ${{ steps.id.status }}
 *
 * Supported operators (for if: conditions):
 *   ${{ steps.id.outputs.status == 'ok' }}
 *   ${{ steps.id.outputs.status != 'error' }}
 */

import type { EvaluationContext } from "./types.js";
import { ExpressionError } from "./types.js";

const EXPR_PATTERN = /\$\{\{\s*(.*?)\s*\}\}/g;

/**
 * Resolve a single dot-path expression against the context.
 * Supports == and != comparison operators.
 */
function resolvePath(expr: string, ctx: EvaluationContext): unknown {
  const trimmed = expr.trim();

  // Check for comparison operators
  const eqMatch = trimmed.match(/^(.+?)\s*==\s*(.+)$/);
  const neMatch = trimmed.match(/^(.+?)\s*!=\s*(.+)$/);

  if (eqMatch?.[1] && eqMatch[2]) {
    const left = resolvePath(eqMatch[1].trim(), ctx);
    const right = resolveScalar(eqMatch[2].trim());
    return left === right;
  }

  if (neMatch?.[1] && neMatch[2]) {
    const left = resolvePath(neMatch[1].trim(), ctx);
    const right = resolveScalar(neMatch[2].trim());
    return left !== right;
  }

  // Dot-path traversal
  const parts = trimmed.split(".");
  const root = parts[0];

  let current: unknown;

  switch (root) {
    case "inputs":
      current = ctx.inputs;
      break;
    case "steps":
      current = ctx.steps;
      break;
    case "secrets":
      current = ctx.secrets;
      break;
    case "env":
      current = ctx.env;
      break;
    default:
      // Unknown root — return undefined (not an error, just missing)
      return undefined;
  }

  for (const part of parts.slice(1)) {
    if (current == null || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Resolve a scalar literal (string literal with quotes, or bare value).
 */
function resolveScalar(raw: string): unknown {
  const s = raw.trim();
  // Quoted string literals
  if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
    return s.slice(1, -1);
  }
  if (s === "true") return true;
  if (s === "false") return false;
  if (s === "null") return null;
  const n = Number(s);
  if (!Number.isNaN(n)) return n;
  return s;
}

/**
 * Evaluate a template string containing zero or more ${{ }} expressions.
 *
 * - If the entire string is a single expression, returns the raw resolved value
 *   (preserving type — object, boolean, number, etc.)
 * - If there are multiple expressions or surrounding text, each resolved value
 *   is stringified and concatenated.
 */
export function evaluateExpression(template: string, ctx: EvaluationContext): unknown {
  // Count matches
  const matches = [...template.matchAll(EXPR_PATTERN)];

  if (matches.length === 0) {
    return template;
  }

  // Single expression covering the entire string — return raw value
  if (matches.length === 1 && matches[0] && template.trim() === matches[0][0].trim()) {
    return resolvePath(matches[0][1] ?? "", ctx);
  }

  // Multiple expressions or mixed text — stringify each and concatenate
  return template.replace(EXPR_PATTERN, (_, expr: string) => {
    const value = resolvePath(expr, ctx);
    if (value === undefined || value === null) return "";
    return String(value);
  });
}

/**
 * Expand all string values in an object through evaluateExpression.
 * Returns a new object with all values as strings.
 */
export function expandObject(
  obj: Record<string, string>,
  ctx: EvaluationContext
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const resolved = evaluateExpression(value, ctx);
    result[key] = resolved === undefined || resolved === null ? "" : String(resolved);
  }
  return result;
}

/**
 * Evaluate an if: condition string.
 * Returns true if the step should run, false if it should be skipped.
 */
export function evaluateCondition(condition: string, ctx: EvaluationContext): boolean {
  const value = evaluateExpression(condition, ctx);
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return value !== "" && value !== "false" && value !== "0";
  }
  return value != null && value !== false && value !== 0;
}

/**
 * Collect all secret key names referenced in a set of env maps.
 * Scans for patterns like ${{ secrets.KEY_NAME }}.
 */
export function collectSecretRefs(envMaps: (Record<string, string> | undefined)[]): string[] {
  const secretNames = new Set<string>();
  const secretPattern = /\$\{\{\s*secrets\.(\w+)\s*\}\}/g;

  for (const envMap of envMaps) {
    if (!envMap) continue;
    for (const value of Object.values(envMap)) {
      for (const match of value.matchAll(secretPattern)) {
        if (match[1]) secretNames.add(match[1]);
      }
    }
  }

  return [...secretNames];
}

export { ExpressionError };

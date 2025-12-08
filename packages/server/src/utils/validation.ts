/**
 * Validation utilities
 */

/**
 * Validate tool name format (namespace/path)
 */
export function isValidToolName(name: string): boolean {
  // Format: username/path/to/tool
  // Example: alice/utils/greeter
  return /^[a-z0-9_-]+(?:\/[a-z0-9_-]+)+$/.test(name);
}

/**
 * Validate username format
 */
export function isValidUsername(username: string): boolean {
  // Lowercase alphanumeric, hyphens, underscores
  return /^[a-z0-9_-]+$/.test(username);
}

/**
 * Validate semantic version format
 */
export function isValidVersion(version: string): boolean {
  // Semver format: major.minor.patch(-prerelease)?(+build)?
  return /^\d+\.\d+\.\d+(-[a-z0-9.-]+)?(\+[a-z0-9.-]+)?$/.test(version);
}

/**
 * Extract namespace from tool name
 */
export function extractNamespace(toolName: string): string {
  const parts = toolName.split("/");
  return parts[0] ?? "";
}

/**
 * Extract short name from tool name (everything after username)
 */
export function extractShortName(toolName: string): string {
  const parts = toolName.split("/");
  return parts.slice(1).join("/");
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Parse pagination params
 */
export function parsePaginationParams(url: URL): { limit: number; offset: number } {
  const limit = Math.min(Number.parseInt(url.searchParams.get("limit") ?? "20", 10), 100);
  const offset = Number.parseInt(url.searchParams.get("offset") ?? "0", 10);

  return {
    limit: Number.isNaN(limit) ? 20 : limit,
    offset: Number.isNaN(offset) ? 0 : offset,
  };
}

/**
 * Parse tags from query string
 */
export function parseTags(tagsParam: string | null): string[] | null {
  if (!tagsParam) return null;
  return tagsParam
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * Sanitize user input
 */
export function sanitizeInput(input: string): string {
  return input.trim().replace(/[<>]/g, "");
}

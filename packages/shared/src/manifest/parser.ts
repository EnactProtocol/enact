/**
 * YAML and Markdown parser for Enact tool manifests
 *
 * Handles parsing of:
 * - SKILL.md files (YAML frontmatter + Markdown body) - primary format
 * - enact.yaml/yml files (pure YAML) - legacy format
 * - enact.md files (YAML frontmatter + Markdown body) - legacy format
 */

import yaml from "js-yaml";
import type { ParsedManifest, ToolManifest } from "../types/manifest";

/**
 * Error thrown when parsing fails
 */
export class ManifestParseError extends Error {
  public readonly originalError: Error | undefined;

  constructor(message: string, originalError?: Error) {
    super(message);
    this.name = "ManifestParseError";
    this.originalError = originalError;
  }
}

/**
 * Regex to match YAML frontmatter in Markdown files
 * Matches content between --- delimiters at the start of the file
 */
const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

/**
 * Parse format type
 */
export type ManifestFormat = "yaml" | "md";

/**
 * Extract YAML frontmatter from Markdown content
 *
 * @param content - The full Markdown file content
 * @returns Object with frontmatter YAML and body Markdown, or null if no frontmatter
 */
export function extractFrontmatter(content: string): {
  frontmatter: string;
  body: string;
} | null {
  const match = content.match(FRONTMATTER_REGEX);

  if (!match) {
    return null;
  }

  const frontmatter = match[1];
  const body = match[2];

  return {
    frontmatter: frontmatter ? frontmatter.trim() : "",
    body: body ? body.trim() : "",
  };
}

/**
 * Parse YAML content into a ToolManifest object
 *
 * @param yamlContent - Raw YAML string
 * @returns Parsed object (not yet validated)
 * @throws ManifestParseError if YAML parsing fails
 */
export function parseYaml(yamlContent: string): Record<string, unknown> {
  try {
    const parsed = yaml.load(yamlContent);

    if (parsed === null || parsed === undefined) {
      throw new ManifestParseError("YAML content is empty or null");
    }

    if (typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new ManifestParseError("YAML content must be an object, not an array or primitive");
    }

    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof ManifestParseError) {
      throw error;
    }

    const yamlError = error as Error;
    throw new ManifestParseError(`Failed to parse YAML: ${yamlError.message}`, yamlError);
  }
}

/**
 * Parse a manifest from content string
 *
 * @param content - The file content (YAML or Markdown with frontmatter)
 * @param format - The format of the content ('yaml' or 'md')
 * @returns ParsedManifest with manifest object and optional body
 * @throws ManifestParseError if parsing fails
 */
export function parseManifest(content: string, format: ManifestFormat): ParsedManifest {
  if (!content || content.trim() === "") {
    throw new ManifestParseError("Manifest content is empty");
  }

  if (format === "yaml") {
    const parsed = parseYaml(content);
    return {
      manifest: parsed as unknown as ToolManifest,
      format: "yaml",
    };
  }

  // Handle Markdown format
  const extracted = extractFrontmatter(content);

  if (!extracted) {
    throw new ManifestParseError(
      "Markdown file must contain YAML frontmatter between --- delimiters"
    );
  }

  if (!extracted.frontmatter) {
    throw new ManifestParseError("YAML frontmatter is empty");
  }

  const parsed = parseYaml(extracted.frontmatter);

  const result: ParsedManifest = {
    manifest: parsed as unknown as ToolManifest,
    format: "md",
  };

  if (extracted.body) {
    result.body = extracted.body;
  }

  return result;
}

/**
 * Detect manifest format from filename
 *
 * @param filename - The manifest filename
 * @returns The detected format
 * @throws ManifestParseError if format cannot be detected
 */
export function detectFormat(filename: string): ManifestFormat {
  const lower = filename.toLowerCase();

  if (lower.endsWith(".yaml") || lower.endsWith(".yml")) {
    return "yaml";
  }

  if (lower.endsWith(".md")) {
    return "md";
  }

  throw new ManifestParseError(
    `Cannot detect manifest format from filename: ${filename}. Expected .yaml, .yml, or .md extension.`
  );
}

/**
 * Parse manifest content with automatic format detection
 *
 * @param content - The file content
 * @param filename - The filename (for format detection)
 * @returns ParsedManifest
 * @throws ManifestParseError if parsing fails
 */
export function parseManifestAuto(content: string, filename: string): ParsedManifest {
  const format = detectFormat(filename);
  return parseManifest(content, format);
}

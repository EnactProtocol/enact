/**
 * Shiki syntax highlighter setup for code viewing
 */
import { type BundledLanguage, type Highlighter, createHighlighter } from "shiki";

let highlighterPromise: Promise<Highlighter> | null = null;

const SUPPORTED_LANGUAGES: BundledLanguage[] = [
  "python",
  "javascript",
  "typescript",
  "json",
  "yaml",
  "markdown",
  "bash",
  "dockerfile",
  "toml",
  "html",
  "css",
  "tsx",
  "jsx",
];

/**
 * Get or create the singleton highlighter instance
 */
export async function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ["github-dark", "github-light"],
      langs: SUPPORTED_LANGUAGES,
    });
  }
  return highlighterPromise;
}

/**
 * Map file extension to language
 */
export function getLanguageFromPath(filePath: string): BundledLanguage {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";

  const extMap: Record<string, BundledLanguage> = {
    py: "python",
    js: "javascript",
    mjs: "javascript",
    cjs: "javascript",
    ts: "typescript",
    mts: "typescript",
    cts: "typescript",
    tsx: "tsx",
    jsx: "jsx",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    md: "markdown",
    markdown: "markdown",
    sh: "bash",
    bash: "bash",
    zsh: "bash",
    dockerfile: "dockerfile",
    toml: "toml",
    html: "html",
    htm: "html",
    css: "css",
    txt: "markdown",
  };

  // Handle special filenames
  const filename = filePath.split("/").pop()?.toLowerCase() || "";
  if (filename === "dockerfile") return "dockerfile";
  if (filename === "makefile") return "bash";
  if (filename.startsWith(".env")) return "bash";

  return extMap[ext] || "markdown";
}

/**
 * Highlight code with Shiki
 */
export async function highlightCode(
  code: string,
  lang: BundledLanguage,
  theme: "github-dark" | "github-light" = "github-dark"
): Promise<string> {
  const highlighter = await getHighlighter();
  return highlighter.codeToHtml(code, { lang, theme });
}

/**
 * Get file type icon name based on extension
 */
export function getFileIcon(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  const filename = filePath.split("/").pop()?.toLowerCase() || "";

  // Special files
  if (filename === "dockerfile") return "docker";
  if (filename === "makefile") return "terminal";
  if (filename.endsWith(".enact.yaml") || filename.endsWith(".enact.yml")) return "enact";
  if (filename === "readme.md") return "info";
  if (filename === "license" || filename === "license.md") return "scale";
  if (filename.startsWith(".env")) return "settings";
  if (filename === "package.json") return "package";
  if (filename === "requirements.txt" || filename === "pyproject.toml") return "package";

  // By extension
  const iconMap: Record<string, string> = {
    py: "python",
    js: "javascript",
    mjs: "javascript",
    ts: "typescript",
    tsx: "react",
    jsx: "react",
    json: "braces",
    yaml: "file-code",
    yml: "file-code",
    md: "file-text",
    sh: "terminal",
    bash: "terminal",
    toml: "file-code",
    html: "globe",
    css: "palette",
    txt: "file-text",
  };

  return iconMap[ext] || "file";
}

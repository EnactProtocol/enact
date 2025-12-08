/**
 * Tests for file ignore utilities
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ALWAYS_IGNORE,
  loadGitignore,
  matchesPattern,
  parseGitignoreContent,
  shouldIgnore,
} from "../../src/utils/ignore";

describe("file ignore utilities", () => {
  describe("ALWAYS_IGNORE list", () => {
    test("includes .env files", () => {
      expect(ALWAYS_IGNORE).toContain(".env");
      expect(ALWAYS_IGNORE).toContain(".env.local");
      expect(ALWAYS_IGNORE).toContain(".env.development");
      expect(ALWAYS_IGNORE).toContain(".env.production");
    });

    test("includes secret key files", () => {
      expect(ALWAYS_IGNORE).toContain("*.pem");
      expect(ALWAYS_IGNORE).toContain("*.key");
      expect(ALWAYS_IGNORE).toContain("*.p12");
      expect(ALWAYS_IGNORE).toContain("*.pfx");
    });

    test("includes version control directories", () => {
      expect(ALWAYS_IGNORE).toContain(".git");
      expect(ALWAYS_IGNORE).toContain(".gitignore");
      expect(ALWAYS_IGNORE).toContain(".gitattributes");
    });

    test("includes IDE directories", () => {
      expect(ALWAYS_IGNORE).toContain(".vscode");
      expect(ALWAYS_IGNORE).toContain(".idea");
    });

    test("includes OS files", () => {
      expect(ALWAYS_IGNORE).toContain(".DS_Store");
      expect(ALWAYS_IGNORE).toContain("Thumbs.db");
    });

    test("includes dependency directories", () => {
      expect(ALWAYS_IGNORE).toContain("node_modules");
      expect(ALWAYS_IGNORE).toContain("__pycache__");
      expect(ALWAYS_IGNORE).toContain(".venv");
      expect(ALWAYS_IGNORE).toContain("venv");
    });

    test("includes build artifact directories", () => {
      expect(ALWAYS_IGNORE).toContain("dist");
      expect(ALWAYS_IGNORE).toContain("build");
      expect(ALWAYS_IGNORE).toContain("out");
      expect(ALWAYS_IGNORE).toContain("target");
    });
  });

  describe("parseGitignoreContent", () => {
    test("parses simple patterns", () => {
      const content = `
node_modules
*.log
dist/
`;
      const patterns = parseGitignoreContent(content);
      expect(patterns).toEqual(["node_modules", "*.log", "dist/"]);
    });

    test("ignores comments", () => {
      const content = `
# This is a comment
node_modules
# Another comment
*.log
`;
      const patterns = parseGitignoreContent(content);
      expect(patterns).toEqual(["node_modules", "*.log"]);
    });

    test("ignores empty lines", () => {
      const content = `
node_modules

*.log

dist
`;
      const patterns = parseGitignoreContent(content);
      expect(patterns).toEqual(["node_modules", "*.log", "dist"]);
    });

    test("trims whitespace", () => {
      const content = `  node_modules  
  *.log
dist   `;
      const patterns = parseGitignoreContent(content);
      expect(patterns).toEqual(["node_modules", "*.log", "dist"]);
    });

    test("handles empty content", () => {
      const patterns = parseGitignoreContent("");
      expect(patterns).toEqual([]);
    });

    test("preserves negation patterns", () => {
      const content = `
*.log
!important.log
`;
      const patterns = parseGitignoreContent(content);
      expect(patterns).toEqual(["*.log", "!important.log"]);
    });
  });

  describe("matchesPattern", () => {
    describe("exact matches", () => {
      test("matches exact filename", () => {
        expect(matchesPattern("file.txt", "file.txt")).toBe(true);
        expect(matchesPattern("other.txt", "file.txt")).toBe(false);
      });

      test("matches exact directory name", () => {
        expect(matchesPattern("node_modules", "node_modules")).toBe(true);
        expect(matchesPattern("src/node_modules", "node_modules")).toBe(true);
      });
    });

    describe("wildcard patterns (*)", () => {
      test("matches *.extension patterns", () => {
        expect(matchesPattern("file.log", "*.log")).toBe(true);
        expect(matchesPattern("error.log", "*.log")).toBe(true);
        expect(matchesPattern("file.txt", "*.log")).toBe(false);
      });

      test("matches prefix* patterns", () => {
        expect(matchesPattern("test-file.js", "test-*")).toBe(true);
        expect(matchesPattern("test-another.ts", "test-*")).toBe(true);
        expect(matchesPattern("other-file.js", "test-*")).toBe(false);
      });

      test("matches patterns in subdirectories", () => {
        expect(matchesPattern("src/file.log", "*.log")).toBe(true);
        expect(matchesPattern("deep/nested/file.log", "*.log")).toBe(true);
      });
    });

    describe("globstar patterns (**)", () => {
      test("matches **/*.extension patterns", () => {
        expect(matchesPattern("src/file.js", "**/*.js")).toBe(true);
        expect(matchesPattern("deep/nested/file.js", "**/*.js")).toBe(true);
        // Note: **/*.js requires at least one directory level
        // For root-level matching, use *.js pattern
        expect(matchesPattern("file.js", "*.js")).toBe(true);
      });

      test("matches prefix/** patterns", () => {
        expect(matchesPattern("logs/error.log", "logs/**")).toBe(true);
        expect(matchesPattern("logs/2024/01/error.log", "logs/**")).toBe(true);
      });
    });

    describe("rooted patterns (/)", () => {
      test("matches only at root with leading /", () => {
        expect(matchesPattern("dist", "/dist")).toBe(true);
        expect(matchesPattern("src/dist", "/dist")).toBe(false);
      });

      test("matches nested paths at root", () => {
        expect(matchesPattern("build/output", "/build/output")).toBe(true);
        expect(matchesPattern("src/build/output", "/build/output")).toBe(false);
      });
    });

    describe("directory patterns (/)", () => {
      test("matches directories with trailing /", () => {
        expect(matchesPattern("logs", "logs/")).toBe(true);
        expect(matchesPattern("src/logs", "logs/")).toBe(true);
      });
    });

    describe("negation patterns", () => {
      test("negation patterns return false (not supported)", () => {
        expect(matchesPattern("important.log", "!important.log")).toBe(false);
        expect(matchesPattern("file.txt", "!*.txt")).toBe(false);
      });
    });

    describe("special characters", () => {
      test("escapes dots in patterns", () => {
        expect(matchesPattern(".env", ".env")).toBe(true);
        expect(matchesPattern("aenv", ".env")).toBe(false);
      });

      test("handles question mark wildcard", () => {
        expect(matchesPattern("file1.txt", "file?.txt")).toBe(true);
        expect(matchesPattern("file2.txt", "file?.txt")).toBe(true);
        expect(matchesPattern("file12.txt", "file?.txt")).toBe(false);
      });
    });
  });

  describe("shouldIgnore", () => {
    describe("hidden files", () => {
      test("ignores all hidden files", () => {
        expect(shouldIgnore(".hidden", ".hidden")).toBe(true);
        expect(shouldIgnore(".env", ".env")).toBe(true);
        expect(shouldIgnore(".gitignore", ".gitignore")).toBe(true);
      });

      test("ignores hidden directories", () => {
        expect(shouldIgnore(".git", ".git")).toBe(true);
        expect(shouldIgnore(".vscode", ".vscode")).toBe(true);
      });
    });

    describe("ALWAYS_IGNORE patterns", () => {
      test("ignores .env files", () => {
        expect(shouldIgnore("src/.env", ".env")).toBe(true);
        expect(shouldIgnore(".env.local", ".env.local")).toBe(true);
      });

      test("ignores key files", () => {
        expect(shouldIgnore("private.key", "private.key")).toBe(true);
        expect(shouldIgnore("cert.pem", "cert.pem")).toBe(true);
        expect(shouldIgnore("keys/server.pfx", "server.pfx")).toBe(true);
      });

      test("ignores node_modules", () => {
        expect(shouldIgnore("node_modules", "node_modules")).toBe(true);
        expect(shouldIgnore("packages/cli/node_modules", "node_modules")).toBe(true);
      });

      test("ignores log files", () => {
        expect(shouldIgnore("error.log", "error.log")).toBe(true);
        expect(shouldIgnore("logs/debug.log", "debug.log")).toBe(true);
      });

      test("ignores build directories", () => {
        expect(shouldIgnore("dist", "dist")).toBe(true);
        expect(shouldIgnore("build", "build")).toBe(true);
        expect(shouldIgnore("out", "out")).toBe(true);
      });
    });

    describe("custom gitignore patterns", () => {
      test("ignores files matching custom patterns", () => {
        const patterns = ["*.tmp", "cache/"];
        expect(shouldIgnore("temp.tmp", "temp.tmp", patterns)).toBe(true);
        expect(shouldIgnore("data.tmp", "data.tmp", patterns)).toBe(true);
        expect(shouldIgnore("cache", "cache", patterns)).toBe(true);
      });

      test("allows files not matching any pattern", () => {
        const patterns = ["*.tmp"];
        expect(shouldIgnore("data.txt", "data.txt", patterns)).toBe(false);
        expect(shouldIgnore("src/index.ts", "index.ts", patterns)).toBe(false);
      });

      test("combines default and custom patterns", () => {
        const patterns = ["custom.ignore"];
        // Should ignore from ALWAYS_IGNORE
        expect(shouldIgnore("error.log", "error.log", patterns)).toBe(true);
        // Should ignore from custom patterns
        expect(shouldIgnore("custom.ignore", "custom.ignore", patterns)).toBe(true);
        // Should allow normal files
        expect(shouldIgnore("index.ts", "index.ts", patterns)).toBe(false);
      });
    });

    describe("allowed files", () => {
      test("allows normal source files", () => {
        expect(shouldIgnore("index.ts", "index.ts")).toBe(false);
        expect(shouldIgnore("src/main.py", "main.py")).toBe(false);
        expect(shouldIgnore("lib/utils.js", "utils.js")).toBe(false);
      });

      test("allows enact manifest files", () => {
        expect(shouldIgnore("enact.md", "enact.md")).toBe(false);
        expect(shouldIgnore("enact.yaml", "enact.yaml")).toBe(false);
        expect(shouldIgnore("enact.yml", "enact.yml")).toBe(false);
      });

      test("allows README files", () => {
        expect(shouldIgnore("README.md", "README.md")).toBe(false);
        expect(shouldIgnore("readme.md", "readme.md")).toBe(false);
      });

      test("allows data files", () => {
        expect(shouldIgnore("data.json", "data.json")).toBe(false);
        expect(shouldIgnore("config.yaml", "config.yaml")).toBe(false);
      });
    });
  });

  describe("loadGitignore", () => {
    let testDir: string;

    beforeEach(() => {
      testDir = join(tmpdir(), `enact-test-${Date.now()}`);
      mkdirSync(testDir, { recursive: true });
    });

    afterEach(() => {
      try {
        rmSync(testDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    test("returns empty array when no .gitignore exists", () => {
      const patterns = loadGitignore(testDir);
      expect(patterns).toEqual([]);
    });

    test("parses .gitignore file", () => {
      writeFileSync(
        join(testDir, ".gitignore"),
        `# Dependencies
node_modules
*.log
dist/
`
      );
      const patterns = loadGitignore(testDir);
      expect(patterns).toEqual(["node_modules", "*.log", "dist/"]);
    });

    test("handles complex .gitignore", () => {
      writeFileSync(
        join(testDir, ".gitignore"),
        `# Build output
dist/
build/
*.min.js
*.min.css

# Test coverage
coverage/
.nyc_output/

# Temp files
*.tmp
*.bak
*~

# Secrets
.env*
!.env.example
`
      );
      const patterns = loadGitignore(testDir);
      expect(patterns).toContain("dist/");
      expect(patterns).toContain("*.min.js");
      expect(patterns).toContain("coverage/");
      expect(patterns).toContain("*.tmp");
      expect(patterns).toContain(".env*");
      expect(patterns).toContain("!.env.example");
      expect(patterns).not.toContain("# Build output");
    });
  });

  describe("integration scenarios", () => {
    test("typical project structure filtering", () => {
      const projectFiles = [
        "enact.md",
        "README.md",
        "src/index.ts",
        "src/utils.ts",
        ".env",
        ".env.local",
        ".git/config",
        ".gitignore",
        "node_modules/lodash/index.js",
        "dist/bundle.js",
        "private.key",
        ".DS_Store",
      ];

      const allowedFiles = projectFiles.filter((file) => {
        const fileName = file.split("/").pop() || file;
        return !shouldIgnore(file, fileName);
      });

      expect(allowedFiles).toContain("enact.md");
      expect(allowedFiles).toContain("README.md");
      expect(allowedFiles).toContain("src/index.ts");
      expect(allowedFiles).toContain("src/utils.ts");

      expect(allowedFiles).not.toContain(".env");
      expect(allowedFiles).not.toContain(".env.local");
      expect(allowedFiles).not.toContain(".git/config");
      expect(allowedFiles).not.toContain("node_modules/lodash/index.js");
      expect(allowedFiles).not.toContain("dist/bundle.js");
      expect(allowedFiles).not.toContain("private.key");
      expect(allowedFiles).not.toContain(".DS_Store");
    });

    test("respects custom gitignore patterns", () => {
      const projectFiles = [
        "enact.md",
        "src/index.ts",
        "test.log",
        "data.tmp",
        "cache/data.json",
        "output.txt",
      ];

      const customPatterns = ["test.log", "*.tmp", "cache/"];

      const allowedFiles = projectFiles.filter((file) => {
        const fileName = file.split("/").pop() || file;
        return !shouldIgnore(file, fileName, customPatterns);
      });

      expect(allowedFiles).toContain("enact.md");
      expect(allowedFiles).toContain("src/index.ts");
      expect(allowedFiles).toContain("output.txt");

      expect(allowedFiles).not.toContain("test.log");
      expect(allowedFiles).not.toContain("data.tmp");
      expect(allowedFiles).not.toContain("cache/data.json");
    });

    test("security: never includes sensitive files", () => {
      const sensitiveFiles = [
        // These are caught by hidden file check (starting with .)
        ".env",
        ".env.local",
        ".env.development",
        ".env.production",
        ".env.staging.local",
        // These are caught by extension patterns
        "secrets.key",
        "private.pem",
        "cert.p12",
        "keystore.pfx",
      ];

      for (const file of sensitiveFiles) {
        const fileName = file.split("/").pop() || file;
        const isIgnored = shouldIgnore(file, fileName);
        expect(isIgnored).toBe(true);
      }
    });

    test("note: SSH keys without extensions need explicit gitignore", () => {
      // SSH keys like id_rsa don't have a recognizable extension
      // They need to be explicitly added to .gitignore
      // This test documents expected behavior
      expect(shouldIgnore("id_rsa", "id_rsa", ["id_rsa"])).toBe(true);
      expect(shouldIgnore("id_rsa.pub", "id_rsa.pub", ["id_rsa.pub"])).toBe(true);
    });
  });
});

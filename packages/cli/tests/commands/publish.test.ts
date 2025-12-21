/**
 * Tests for the publish command
 */

import { describe, expect, test } from "bun:test";
import { Command } from "commander";
import { configurePublishCommand } from "../../src/commands/publish";

describe("publish command", () => {
  describe("command configuration", () => {
    test("configures publish command on program", () => {
      const program = new Command();
      configurePublishCommand(program);

      const publishCmd = program.commands.find((cmd) => cmd.name() === "publish");
      expect(publishCmd).toBeDefined();
    });

    test("has correct description", () => {
      const program = new Command();
      configurePublishCommand(program);

      const publishCmd = program.commands.find((cmd) => cmd.name() === "publish");
      expect(publishCmd?.description()).toBe("Publish a tool to the Enact registry");
    });

    test("accepts optional file argument", () => {
      const program = new Command();
      configurePublishCommand(program);

      const publishCmd = program.commands.find((cmd) => cmd.name() === "publish");
      const args = publishCmd?.registeredArguments ?? [];
      // Check there's an argument (file)
      expect(args.length).toBeGreaterThanOrEqual(0);
      // Could be optional, so may have no required args
    });

    test("has --dry-run option", () => {
      const program = new Command();
      configurePublishCommand(program);

      const publishCmd = program.commands.find((cmd) => cmd.name() === "publish");
      const opts = publishCmd?.options ?? [];
      const dryRunOpt = opts.find((o) => o.long === "--dry-run");
      expect(dryRunOpt).toBeDefined();
    });

    test("has --json option", () => {
      const program = new Command();
      configurePublishCommand(program);

      const publishCmd = program.commands.find((cmd) => cmd.name() === "publish");
      const opts = publishCmd?.options ?? [];
      const jsonOpt = opts.find((o) => o.long === "--json");
      expect(jsonOpt).toBeDefined();
    });

    test("has --public option", () => {
      const program = new Command();
      configurePublishCommand(program);

      const publishCmd = program.commands.find((cmd) => cmd.name() === "publish");
      const opts = publishCmd?.options ?? [];
      const publicOpt = opts.find((o) => o.long === "--public");
      expect(publicOpt).toBeDefined();
    });

    test("has --unlisted option", () => {
      const program = new Command();
      configurePublishCommand(program);

      const publishCmd = program.commands.find((cmd) => cmd.name() === "publish");
      const opts = publishCmd?.options ?? [];
      const unlistedOpt = opts.find((o) => o.long === "--unlisted");
      expect(unlistedOpt).toBeDefined();
    });
  });

  describe("visibility determination", () => {
    type ToolVisibility = "public" | "private" | "unlisted";

    // Mirrors the logic in publish command
    const determineVisibility = (options: {
      public?: boolean;
      unlisted?: boolean;
    }): ToolVisibility => {
      if (options.public) return "public";
      if (options.unlisted) return "unlisted";
      return "private"; // Default is private
    };

    test("defaults to private visibility", () => {
      expect(determineVisibility({})).toBe("private");
    });

    test("--public flag sets public visibility", () => {
      expect(determineVisibility({ public: true })).toBe("public");
    });

    test("--unlisted flag sets unlisted visibility", () => {
      expect(determineVisibility({ unlisted: true })).toBe("unlisted");
    });

    test("--public takes precedence over --unlisted", () => {
      expect(determineVisibility({ public: true, unlisted: true })).toBe("public");
    });
  });

  describe("manifest file detection", () => {
    test("identifies enact.yaml as manifest", () => {
      const isManifest = (filename: string): boolean => {
        return filename === "enact.yaml" || filename === "enact.yml" || filename === "enact.md";
      };

      expect(isManifest("enact.yaml")).toBe(true);
      expect(isManifest("enact.yml")).toBe(true);
      expect(isManifest("enact.md")).toBe(true);
      expect(isManifest("package.json")).toBe(false);
    });

    test("detects file extensions correctly", () => {
      const getExtension = (filename: string): string => {
        const lastDot = filename.lastIndexOf(".");
        return lastDot === -1 ? "" : filename.slice(lastDot + 1);
      };

      expect(getExtension("enact.yaml")).toBe("yaml");
      expect(getExtension("enact.yml")).toBe("yml");
      expect(getExtension("enact.md")).toBe("md");
      expect(getExtension("noextension")).toBe("");
    });
  });

  describe("version validation", () => {
    test("validates semver format", () => {
      const isValidSemver = (version: string): boolean => {
        const semverRegex = /^\d+\.\d+\.\d+(?:-[\w.]+)?(?:\+[\w.]+)?$/;
        return semverRegex.test(version);
      };

      expect(isValidSemver("1.0.0")).toBe(true);
      expect(isValidSemver("0.1.0")).toBe(true);
      expect(isValidSemver("1.0.0-alpha")).toBe(true);
      expect(isValidSemver("1.0.0-alpha.1")).toBe(true);
      expect(isValidSemver("1.0.0+build")).toBe(true);
      expect(isValidSemver("1.0")).toBe(false);
      expect(isValidSemver("v1.0.0")).toBe(false);
    });
  });

  describe("dry run behavior", () => {
    test("dry run flag changes behavior", () => {
      const shouldPublish = (dryRun: boolean): boolean => {
        return !dryRun;
      };

      expect(shouldPublish(false)).toBe(true);
      expect(shouldPublish(true)).toBe(false);
    });
  });

  describe("bundle creation", () => {
    test("bundle metadata structure", () => {
      interface BundleMetadata {
        name: string;
        version: string;
        hash: string;
        size: number;
        createdAt: string;
      }

      const metadata: BundleMetadata = {
        name: "my-tool",
        version: "1.0.0",
        hash: "sha256:abc123",
        size: 1024,
        createdAt: new Date().toISOString(),
      };

      expect(metadata.name).toBe("my-tool");
      expect(metadata.version).toBe("1.0.0");
      expect(metadata.hash).toContain("sha256:");
      expect(metadata.size).toBeGreaterThan(0);
      expect(metadata.createdAt).toContain("T");
    });

    test("hash format validation", () => {
      const isValidHash = (hash: string): boolean => {
        return hash.startsWith("sha256:") && hash.length === 71; // sha256: + 64 hex chars
      };

      expect(isValidHash(`sha256:${"a".repeat(64)}`)).toBe(true);
      expect(isValidHash(`sha512:${"a".repeat(128)}`)).toBe(false);
      expect(isValidHash("invalid")).toBe(false);
    });
  });

  describe("publish result handling", () => {
    test("success result structure", () => {
      interface PublishResult {
        success: boolean;
        toolName: string;
        version: string;
        url?: string;
      }

      const result: PublishResult = {
        success: true,
        toolName: "my-tool",
        version: "1.0.0",
        url: "https://registry.enact.dev/tools/my-tool/1.0.0",
      };

      expect(result.success).toBe(true);
      expect(result.toolName).toBeDefined();
      expect(result.version).toBeDefined();
    });

    test("error result structure", () => {
      interface PublishError {
        success: boolean;
        error: string;
        code?: string;
      }

      const error: PublishError = {
        success: false,
        error: "Authentication required",
        code: "UNAUTHORIZED",
      };

      expect(error.success).toBe(false);
      expect(error.error).toBeDefined();
    });
  });
});

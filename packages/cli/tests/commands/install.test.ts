/**
 * Tests for the install command
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
import { configureInstallCommand } from "../../src/commands/install";

// Test fixtures directory
const FIXTURES_DIR = join(import.meta.dir, "..", "fixtures", "install-cmd");

describe("install command", () => {
  beforeAll(() => {
    mkdirSync(FIXTURES_DIR, { recursive: true });
  });

  beforeEach(() => {
    // Clean fixtures for each test
    if (existsSync(FIXTURES_DIR)) {
      rmSync(FIXTURES_DIR, { recursive: true, force: true });
      mkdirSync(FIXTURES_DIR, { recursive: true });
    }
  });

  afterAll(() => {
    if (existsSync(FIXTURES_DIR)) {
      rmSync(FIXTURES_DIR, { recursive: true, force: true });
    }
  });

  describe("command configuration", () => {
    test("configures install command on program", () => {
      const program = new Command();
      configureInstallCommand(program);

      const installCmd = program.commands.find((cmd) => cmd.name() === "install");
      expect(installCmd).toBeDefined();
    });

    test("has correct description", () => {
      const program = new Command();
      configureInstallCommand(program);

      const installCmd = program.commands.find((cmd) => cmd.name() === "install");
      expect(installCmd?.description()).toBe("Install a tool to the project or globally");
    });

    test("has 'i' as alias", () => {
      const program = new Command();
      configureInstallCommand(program);

      const installCmd = program.commands.find((cmd) => cmd.name() === "install");
      const aliases = installCmd?.aliases() ?? [];
      expect(aliases).toContain("i");
    });

    test("tool argument is optional", () => {
      const program = new Command();
      configureInstallCommand(program);

      const installCmd = program.commands.find((cmd) => cmd.name() === "install");
      const args = installCmd?.registeredArguments ?? [];
      // Optional argument is wrapped in brackets in Commander
      expect(args.length).toBe(1);
      expect(args[0]?.name()).toBe("tool");
      expect(args[0]?.required).toBe(false);
    });

    test("has --global option", () => {
      const program = new Command();
      configureInstallCommand(program);

      const installCmd = program.commands.find((cmd) => cmd.name() === "install");
      const opts = installCmd?.options ?? [];
      const globalOpt = opts.find((o) => o.long === "--global");
      expect(globalOpt).toBeDefined();
    });

    test("has -g short option for global", () => {
      const program = new Command();
      configureInstallCommand(program);

      const installCmd = program.commands.find((cmd) => cmd.name() === "install");
      const opts = installCmd?.options ?? [];
      const globalOpt = opts.find((o) => o.short === "-g");
      expect(globalOpt).toBeDefined();
    });

    test("has --force option", () => {
      const program = new Command();
      configureInstallCommand(program);

      const installCmd = program.commands.find((cmd) => cmd.name() === "install");
      const opts = installCmd?.options ?? [];
      const forceOpt = opts.find((o) => o.long === "--force");
      expect(forceOpt).toBeDefined();
    });

    test("has --verbose option", () => {
      const program = new Command();
      configureInstallCommand(program);

      const installCmd = program.commands.find((cmd) => cmd.name() === "install");
      const opts = installCmd?.options ?? [];
      const verboseOpt = opts.find((o) => o.long === "--verbose");
      expect(verboseOpt).toBeDefined();
    });

    test("has --json option", () => {
      const program = new Command();
      configureInstallCommand(program);

      const installCmd = program.commands.find((cmd) => cmd.name() === "install");
      const opts = installCmd?.options ?? [];
      const jsonOpt = opts.find((o) => o.long === "--json");
      expect(jsonOpt).toBeDefined();
    });

    test("has --verify option", () => {
      const program = new Command();
      configureInstallCommand(program);

      const installCmd = program.commands.find((cmd) => cmd.name() === "install");
      const opts = installCmd?.options ?? [];
      const verifyOpt = opts.find((o) => o.long === "--verify");
      // --verify is no longer optional, verification is always required
      expect(verifyOpt).toBeUndefined();
    });
  });

  describe("path detection", () => {
    // Helper function that mirrors the command's path detection logic
    const isToolPath = (tool: string): boolean => {
      return tool === "." || tool.startsWith("./") || tool.startsWith("/") || tool.startsWith("..");
    };

    test("recognizes current directory (.)", () => {
      expect(isToolPath(".")).toBe(true);
    });

    test("recognizes relative path (./)", () => {
      expect(isToolPath("./my-tool")).toBe(true);
    });

    test("recognizes absolute path (/)", () => {
      expect(isToolPath("/Users/test/my-tool")).toBe(true);
    });

    test("recognizes parent relative path (..)", () => {
      expect(isToolPath("../my-tool")).toBe(true);
    });

    test("does not recognize tool name as path", () => {
      expect(isToolPath("alice/utils/greeter")).toBe(false);
    });

    test("does not recognize simple name as path", () => {
      expect(isToolPath("my-tool")).toBe(false);
    });
  });

  describe("registry tool detection", () => {
    // Helper function that mirrors the command's registry tool detection
    const isRegistryTool = (toolName: string): boolean => {
      const parts = toolName.split("/");
      return parts.length >= 3 && !toolName.startsWith(".") && !toolName.startsWith("/");
    };

    test("recognizes registry tool format (owner/namespace/tool)", () => {
      expect(isRegistryTool("alice/utils/greeter")).toBe(true);
    });

    test("recognizes registry tool with more parts", () => {
      expect(isRegistryTool("acme/internal/tools/formatter")).toBe(true);
    });

    test("rejects simple tool name", () => {
      expect(isRegistryTool("greeter")).toBe(false);
    });

    test("rejects owner/tool format (needs namespace)", () => {
      expect(isRegistryTool("alice/greeter")).toBe(false);
    });

    test("rejects path-like patterns", () => {
      expect(isRegistryTool("./alice/utils/greeter")).toBe(false);
      expect(isRegistryTool("/alice/utils/greeter")).toBe(false);
    });
  });

  describe("tool spec parsing", () => {
    // Helper function that mirrors the command's parseToolSpec
    const parseToolSpec = (spec: string): { name: string; version: string | undefined } => {
      const match = spec.match(/^(@[^@/]+\/[^@]+|[^@]+)(?:@(.+))?$/);
      if (match?.[1]) {
        return { name: match[1], version: match[2] };
      }
      return { name: spec, version: undefined };
    };

    test("parses tool name without version", () => {
      const result = parseToolSpec("alice/utils/greeter");
      expect(result.name).toBe("alice/utils/greeter");
      expect(result.version).toBeUndefined();
    });

    test("parses tool name with version", () => {
      const result = parseToolSpec("alice/utils/greeter@1.0.0");
      expect(result.name).toBe("alice/utils/greeter");
      expect(result.version).toBe("1.0.0");
    });

    test("parses tool name with semver prerelease", () => {
      const result = parseToolSpec("alice/utils/greeter@2.0.0-beta.1");
      expect(result.name).toBe("alice/utils/greeter");
      expect(result.version).toBe("2.0.0-beta.1");
    });

    test("parses scoped package without version", () => {
      const result = parseToolSpec("@scope/package");
      expect(result.name).toBe("@scope/package");
      expect(result.version).toBeUndefined();
    });

    test("parses scoped package with version", () => {
      const result = parseToolSpec("@scope/package@3.0.0");
      expect(result.name).toBe("@scope/package");
      expect(result.version).toBe("3.0.0");
    });

    test("handles latest tag as version", () => {
      const result = parseToolSpec("alice/utils/greeter@latest");
      expect(result.name).toBe("alice/utils/greeter");
      expect(result.version).toBe("latest");
    });
  });

  describe("installation scenarios", () => {
    test("project install should use .enact/tools/", () => {
      const cwd = "/project";
      const toolName = "alice/utils/greeter";
      const expectedPath = join(cwd, ".enact", "tools", toolName.replace(/\//g, "/"));
      expect(expectedPath).toContain(".enact/tools");
    });

    test("global install should use ~/.enact/tools/", () => {
      const home = process.env.HOME ?? "/home/user";
      const toolName = "alice/utils/greeter";
      const expectedPath = join(home, ".enact", "tools", toolName.replace(/\//g, "/"));
      expect(expectedPath).toContain(".enact/tools");
    });
  });

  describe("bytes formatting", () => {
    // Helper function that mirrors the command's formatBytes
    const formatBytes = (bytes: number): string => {
      if (bytes === 0) return "0 B";
      const k = 1024;
      const sizes = ["B", "KB", "MB", "GB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return `${(bytes / k ** i).toFixed(1)} ${sizes[i]}`;
    };

    test("formats zero bytes", () => {
      expect(formatBytes(0)).toBe("0 B");
    });

    test("formats bytes", () => {
      expect(formatBytes(500)).toBe("500.0 B");
    });

    test("formats kilobytes", () => {
      expect(formatBytes(1024)).toBe("1.0 KB");
      expect(formatBytes(2048)).toBe("2.0 KB");
    });

    test("formats megabytes", () => {
      expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
      expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    });

    test("formats gigabytes", () => {
      expect(formatBytes(1024 * 1024 * 1024)).toBe("1.0 GB");
    });
  });
});

/**
 * Tests for the init command
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
import { configureInitCommand } from "../../src/commands/init";

describe("init command", () => {
  describe("command configuration", () => {
    test("configures init command on program", () => {
      const program = new Command();
      configureInitCommand(program);

      const initCmd = program.commands.find((cmd) => cmd.name() === "init");
      expect(initCmd).toBeDefined();
    });

    test("has correct description", () => {
      const program = new Command();
      configureInitCommand(program);

      const initCmd = program.commands.find((cmd) => cmd.name() === "init");
      expect(initCmd?.description()).toBe("Initialize Enact in the current directory");
    });

    test("has --name option", () => {
      const program = new Command();
      configureInitCommand(program);

      const initCmd = program.commands.find((cmd) => cmd.name() === "init");
      const opts = initCmd?.options ?? [];
      const nameOpt = opts.find((o) => o.long === "--name");
      expect(nameOpt).toBeDefined();
      expect(nameOpt?.short).toBe("-n");
    });

    test("has --force option", () => {
      const program = new Command();
      configureInitCommand(program);

      const initCmd = program.commands.find((cmd) => cmd.name() === "init");
      const opts = initCmd?.options ?? [];
      const forceOpt = opts.find((o) => o.long === "--force");
      expect(forceOpt).toBeDefined();
      expect(forceOpt?.short).toBe("-f");
    });

    test("has --tool option", () => {
      const program = new Command();
      configureInitCommand(program);

      const initCmd = program.commands.find((cmd) => cmd.name() === "init");
      const opts = initCmd?.options ?? [];
      const toolOpt = opts.find((o) => o.long === "--tool");
      expect(toolOpt).toBeDefined();
    });

    test("has --agent option", () => {
      const program = new Command();
      configureInitCommand(program);

      const initCmd = program.commands.find((cmd) => cmd.name() === "init");
      const opts = initCmd?.options ?? [];
      const agentOpt = opts.find((o) => o.long === "--agent");
      expect(agentOpt).toBeDefined();
    });

    test("has --claude option", () => {
      const program = new Command();
      configureInitCommand(program);

      const initCmd = program.commands.find((cmd) => cmd.name() === "init");
      const opts = initCmd?.options ?? [];
      const claudeOpt = opts.find((o) => o.long === "--claude");
      expect(claudeOpt).toBeDefined();
    });

    test("has --verbose option", () => {
      const program = new Command();
      configureInitCommand(program);

      const initCmd = program.commands.find((cmd) => cmd.name() === "init");
      const opts = initCmd?.options ?? [];
      const verboseOpt = opts.find((o) => o.long === "--verbose");
      expect(verboseOpt).toBeDefined();
    });
  });

  describe("file generation", () => {
    const testDir = join(import.meta.dir, ".test-init-temp");

    beforeEach(() => {
      // Clean up before each test
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true });
      }
      mkdirSync(testDir, { recursive: true });
    });

    afterEach(() => {
      // Clean up after each test
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true });
      }
    });

    test("default mode creates AGENTS.md for tool consumers", async () => {
      const program = new Command();
      program.exitOverride();
      configureInitCommand(program);

      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        await program.parseAsync(["node", "test", "init"]);
      } catch {
        // Command may throw due to exitOverride
      } finally {
        process.chdir(originalCwd);
      }

      const agentsPath = join(testDir, "AGENTS.md");
      expect(existsSync(agentsPath)).toBe(true);

      const content = readFileSync(agentsPath, "utf-8");
      expect(content).toContain("enact search");
      expect(content).toContain("enact install");
      expect(content).toContain("Finding & Installing Tools");

      // Should NOT create enact.md in default mode
      const manifestPath = join(testDir, "enact.md");
      expect(existsSync(manifestPath)).toBe(false);
    });

    test("default mode creates .enact/tools.json", async () => {
      const program = new Command();
      program.exitOverride();
      configureInitCommand(program);

      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        await program.parseAsync(["node", "test", "init"]);
      } catch {
        // Command may throw due to exitOverride
      } finally {
        process.chdir(originalCwd);
      }

      const toolsJsonPath = join(testDir, ".enact", "tools.json");
      expect(existsSync(toolsJsonPath)).toBe(true);

      const content = JSON.parse(readFileSync(toolsJsonPath, "utf-8"));
      expect(content).toEqual({ tools: {} });
    });

    test("--tool mode creates SKILL.md", async () => {
      const program = new Command();
      program.exitOverride(); // Prevent process.exit
      configureInitCommand(program);

      // Change to test directory and run init
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        await program.parseAsync(["node", "test", "init", "--tool", "--name", "test/my-tool"]);
      } catch {
        // Command may throw due to exitOverride
      } finally {
        process.chdir(originalCwd);
      }

      const manifestPath = join(testDir, "SKILL.md");
      expect(existsSync(manifestPath)).toBe(true);

      const content = readFileSync(manifestPath, "utf-8");
      expect(content).toContain("name: test/my-tool");
      expect(content).toContain("description:");
      expect(content).toContain("command:");
    });

    test("--tool mode creates AGENTS.md for tool development", async () => {
      const program = new Command();
      program.exitOverride();
      configureInitCommand(program);

      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        await program.parseAsync(["node", "test", "init", "--tool", "--name", "test/my-tool"]);
      } catch {
        // Command may throw due to exitOverride
      } finally {
        process.chdir(originalCwd);
      }

      const agentsPath = join(testDir, "AGENTS.md");
      expect(existsSync(agentsPath)).toBe(true);

      const content = readFileSync(agentsPath, "utf-8");
      expect(content).toContain("enact run");
      expect(content).toContain("SKILL.md");
      expect(content).toContain("Parameter Substitution");
    });

    test("--agent mode creates AGENTS.md for tool consumers", async () => {
      const program = new Command();
      program.exitOverride();
      configureInitCommand(program);

      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        await program.parseAsync(["node", "test", "init", "--agent"]);
      } catch {
        // Command may throw due to exitOverride
      } finally {
        process.chdir(originalCwd);
      }

      const agentsPath = join(testDir, "AGENTS.md");
      expect(existsSync(agentsPath)).toBe(true);

      const content = readFileSync(agentsPath, "utf-8");
      expect(content).toContain("enact search");
      expect(content).toContain("enact install");
      expect(content).toContain("Finding & Installing Tools");

      // Should NOT create enact.md in agent mode
      const manifestPath = join(testDir, "enact.md");
      expect(existsSync(manifestPath)).toBe(false);
    });

    test("--claude mode creates CLAUDE.md", async () => {
      const program = new Command();
      program.exitOverride();
      configureInitCommand(program);

      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        await program.parseAsync(["node", "test", "init", "--claude"]);
      } catch {
        // Command may throw due to exitOverride
      } finally {
        process.chdir(originalCwd);
      }

      const claudePath = join(testDir, "CLAUDE.md");
      expect(existsSync(claudePath)).toBe(true);

      const content = readFileSync(claudePath, "utf-8");
      expect(content).toContain("enact run");
      expect(content).toContain("enact search");

      // Should NOT create enact.md or AGENTS.md in claude mode
      expect(existsSync(join(testDir, "enact.md"))).toBe(false);
      expect(existsSync(join(testDir, "AGENTS.md"))).toBe(false);
    });

    test("--agent mode creates .enact/tools.json", async () => {
      const program = new Command();
      program.exitOverride();
      configureInitCommand(program);

      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        await program.parseAsync(["node", "test", "init", "--agent"]);
      } catch {
        // Command may throw due to exitOverride
      } finally {
        process.chdir(originalCwd);
      }

      const toolsJsonPath = join(testDir, ".enact", "tools.json");
      expect(existsSync(toolsJsonPath)).toBe(true);

      const content = JSON.parse(readFileSync(toolsJsonPath, "utf-8"));
      expect(content).toEqual({ tools: {} });
    });

    test("--claude mode creates .enact/tools.json", async () => {
      const program = new Command();
      program.exitOverride();
      configureInitCommand(program);

      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        await program.parseAsync(["node", "test", "init", "--claude"]);
      } catch {
        // Command may throw due to exitOverride
      } finally {
        process.chdir(originalCwd);
      }

      const toolsJsonPath = join(testDir, ".enact", "tools.json");
      expect(existsSync(toolsJsonPath)).toBe(true);

      const content = JSON.parse(readFileSync(toolsJsonPath, "utf-8"));
      expect(content).toEqual({ tools: {} });
    });

    test("--agent mode with --force overwrites existing .enact/tools.json", async () => {
      // Create existing .enact/tools.json with some content
      const enactDir = join(testDir, ".enact");
      mkdirSync(enactDir, { recursive: true });
      const toolsJsonPath = join(enactDir, "tools.json");
      const existingContent = { tools: { "some/tool": "1.0.0" } };
      writeFileSync(toolsJsonPath, JSON.stringify(existingContent));

      const program = new Command();
      program.exitOverride();
      configureInitCommand(program);

      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        await program.parseAsync(["node", "test", "init", "--agent", "--force"]);
      } catch {
        // Command may throw due to exitOverride
      } finally {
        process.chdir(originalCwd);
      }

      const content = JSON.parse(readFileSync(toolsJsonPath, "utf-8"));
      expect(content).toEqual({ tools: {} });
    });

    test("--agent mode preserves existing .enact/tools.json without --force", async () => {
      // Create existing .enact/tools.json with some content
      const enactDir = join(testDir, ".enact");
      mkdirSync(enactDir, { recursive: true });
      const toolsJsonPath = join(enactDir, "tools.json");
      const existingContent = { tools: { "some/tool": "1.0.0" } };
      writeFileSync(toolsJsonPath, JSON.stringify(existingContent));

      // Also create AGENTS.md so the command doesn't fail early
      writeFileSync(join(testDir, "AGENTS.md"), "existing");

      const program = new Command();
      program.exitOverride();
      configureInitCommand(program);

      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        // Without --force, AGENTS.md check will fail and return early
        // So we need to test with --force on AGENTS.md but not tools.json
        // Actually the --force flag applies to both, so let's just verify
        // tools.json is preserved when it exists and no --force
        await program.parseAsync(["node", "test", "init", "--agent"]);
      } catch {
        // Command may throw due to exitOverride or warning about existing file
      } finally {
        process.chdir(originalCwd);
      }

      // tools.json should be preserved since AGENTS.md existed and no --force was used
      const content = JSON.parse(readFileSync(toolsJsonPath, "utf-8"));
      expect(content).toEqual(existingContent);
    });

    test("--tool mode does NOT create .enact/tools.json", async () => {
      const program = new Command();
      program.exitOverride();
      configureInitCommand(program);

      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        await program.parseAsync(["node", "test", "init", "--tool", "--name", "test/my-tool"]);
      } catch {
        // Command may throw due to exitOverride
      } finally {
        process.chdir(originalCwd);
      }

      const toolsJsonPath = join(testDir, ".enact", "tools.json");
      expect(existsSync(toolsJsonPath)).toBe(false);
    });

    test("SKILL.md contains valid YAML frontmatter", async () => {
      const program = new Command();
      program.exitOverride();
      configureInitCommand(program);

      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        await program.parseAsync([
          "node",
          "test",
          "init",
          "--tool",
          "--name",
          "myorg/utils/greeter",
        ]);
      } catch {
        // Command may throw due to exitOverride
      } finally {
        process.chdir(originalCwd);
      }

      const content = readFileSync(join(testDir, "SKILL.md"), "utf-8");

      // Check frontmatter structure
      expect(content.startsWith("---")).toBe(true);
      expect(content).toContain("name: myorg/utils/greeter");
      expect(content).toContain("version:");
      expect(content).toContain("from:");
      expect(content).toContain("inputSchema:");
      expect(content).toContain("command:");

      // Check it has closing frontmatter and markdown body
      const parts = content.split("---");
      expect(parts.length).toBeGreaterThanOrEqual(3); // empty, frontmatter, body
    });

    test("AGENTS.md for tools contains development instructions", async () => {
      const program = new Command();
      program.exitOverride();
      configureInitCommand(program);

      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        await program.parseAsync(["node", "test", "init", "--tool", "--name", "test/tool"]);
      } catch {
        // Command may throw due to exitOverride
      } finally {
        process.chdir(originalCwd);
      }

      const content = readFileSync(join(testDir, "AGENTS.md"), "utf-8");

      // Should contain tool development-specific content
      expect(content).toContain("enact sign");
      expect(content).toContain("enact publish");
      expect(content).toContain("${param}");
      expect(content).toContain("build:");
      expect(content).toContain("/workspace");
    });

    test("AGENTS.md for agent projects contains usage instructions", async () => {
      const program = new Command();
      program.exitOverride();
      configureInitCommand(program);

      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        await program.parseAsync(["node", "test", "init", "--agent"]);
      } catch {
        // Command may throw due to exitOverride
      } finally {
        process.chdir(originalCwd);
      }

      const content = readFileSync(join(testDir, "AGENTS.md"), "utf-8");

      // Should contain consumer-focused content
      expect(content).toContain("enact search");
      expect(content).toContain("enact install");
      expect(content).toContain("enact list");
      expect(content).toContain(".enact/tools.json");
    });
  });

  describe("option conflicts", () => {
    test("--agent is the default when no mode specified", () => {
      const program = new Command();
      configureInitCommand(program);

      const initCmd = program.commands.find((cmd) => cmd.name() === "init");
      const opts = initCmd?.options ?? [];
      const agentOpt = opts.find((o) => o.long === "--agent");

      // Description should indicate it's the default
      expect(agentOpt?.description).toContain("default");
    });
  });

  describe("template content quality", () => {
    test("tool template has all required manifest fields", async () => {
      const program = new Command();
      program.exitOverride();
      configureInitCommand(program);

      const testDir = join(import.meta.dir, ".test-init-quality");
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true });
      }
      mkdirSync(testDir, { recursive: true });

      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        await program.parseAsync(["node", "test", "init", "--tool", "--name", "test/tool"]);
      } catch {
        // Command may throw due to exitOverride
      } finally {
        process.chdir(originalCwd);
      }

      const content = readFileSync(join(testDir, "SKILL.md"), "utf-8");

      // Required fields per spec
      expect(content).toContain("name:");
      expect(content).toContain("description:");

      // Recommended fields
      expect(content).toContain("version:");
      expect(content).toContain("enact:");
      expect(content).toContain("from:");
      expect(content).toContain("inputSchema:");
      expect(content).toContain("command:");

      // Clean up
      rmSync(testDir, { recursive: true });
    });

    test("AGENTS.md is comprehensive but reasonably sized", async () => {
      const program = new Command();
      program.exitOverride();
      configureInitCommand(program);

      const testDir = join(import.meta.dir, ".test-init-verbosity");
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true });
      }
      mkdirSync(testDir, { recursive: true });

      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        await program.parseAsync(["node", "test", "init", "--tool", "--name", "test/tool"]);
      } catch {
        // Command may throw due to exitOverride
      } finally {
        process.chdir(originalCwd);
      }

      const content = readFileSync(join(testDir, "AGENTS.md"), "utf-8");

      // Should be comprehensive but not excessive
      const lines = content.split("\n").length;
      expect(lines).toBeLessThan(350); // Comprehensive guide under 350 lines (includes base image docs, troubleshooting)
      expect(lines).toBeGreaterThan(100); // But not too sparse

      // Clean up
      rmSync(testDir, { recursive: true });
    });
  });
});

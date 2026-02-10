/**
 * Tests for the ToolHooks type and postinstall hook behavior.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { ToolHooks, ToolManifest } from "../src/types/manifest";

const FIXTURES_DIR = join(import.meta.dir, "fixtures", "hooks-test");

beforeAll(() => {
  mkdirSync(FIXTURES_DIR, { recursive: true });
});

afterAll(() => {
  if (existsSync(FIXTURES_DIR)) {
    rmSync(FIXTURES_DIR, { recursive: true, force: true });
  }
});

describe("ToolHooks type", () => {
  test("manifest accepts hooks with postinstall string", () => {
    const manifest: ToolManifest = {
      name: "@test/with-hook",
      description: "A tool with a postinstall hook",
      hooks: {
        postinstall: "npm install",
      },
    };
    expect(manifest.hooks?.postinstall).toBe("npm install");
  });

  test("manifest accepts hooks with postinstall array", () => {
    const manifest: ToolManifest = {
      name: "@test/with-hooks",
      description: "A tool with multiple postinstall commands",
      hooks: {
        postinstall: ["npm install", "npm run build"],
      },
    };
    expect(manifest.hooks?.postinstall).toEqual(["npm install", "npm run build"]);
  });

  test("manifest works without hooks", () => {
    const manifest: ToolManifest = {
      name: "@test/no-hooks",
      description: "A tool without hooks",
    };
    expect(manifest.hooks).toBeUndefined();
  });

  test("hooks field can be empty object", () => {
    const hooks: ToolHooks = {};
    expect(hooks.postinstall).toBeUndefined();
  });
});

describe("postinstall hook execution", () => {
  test("single command creates expected side-effect", async () => {
    const toolDir = join(FIXTURES_DIR, "single-cmd");
    mkdirSync(toolDir, { recursive: true });

    const markerFile = join(toolDir, "postinstall-ran.txt");
    const cmd = `echo "hook executed" > postinstall-ran.txt`;

    const proc = Bun.spawn(["sh", "-c", cmd], {
      cwd: toolDir,
      stdout: "pipe",
      stderr: "pipe",
    });
    await proc.exited;

    expect(existsSync(markerFile)).toBe(true);
    const content = await Bun.file(markerFile).text();
    expect(content.trim()).toBe("hook executed");
  });

  test("multiple commands run sequentially", async () => {
    const toolDir = join(FIXTURES_DIR, "multi-cmd");
    mkdirSync(toolDir, { recursive: true });

    const commands = [
      'echo "step1" > step1.txt',
      'echo "step2" > step2.txt',
      "cat step1.txt step2.txt > combined.txt",
    ];

    for (const cmd of commands) {
      const proc = Bun.spawn(["sh", "-c", cmd], {
        cwd: toolDir,
        stdout: "pipe",
        stderr: "pipe",
      });
      const exitCode = await proc.exited;
      expect(exitCode).toBe(0);
    }

    const combined = await Bun.file(join(toolDir, "combined.txt")).text();
    expect(combined).toContain("step1");
    expect(combined).toContain("step2");
  });

  test("failing command returns non-zero exit code", async () => {
    const toolDir = join(FIXTURES_DIR, "fail-cmd");
    mkdirSync(toolDir, { recursive: true });

    const proc = Bun.spawn(["sh", "-c", "exit 1"], {
      cwd: toolDir,
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;

    expect(exitCode).toBe(1);
  });

  test("command runs in the tool directory (cwd)", async () => {
    const toolDir = join(FIXTURES_DIR, "cwd-check");
    mkdirSync(toolDir, { recursive: true });

    const proc = Bun.spawn(["sh", "-c", "pwd"], {
      cwd: toolDir,
      stdout: "pipe",
      stderr: "pipe",
    });
    await proc.exited;

    const output = await new Response(proc.stdout).text();
    expect(output.trim()).toBe(toolDir);
  });

  test("command inherits environment variables", async () => {
    const toolDir = join(FIXTURES_DIR, "env-check");
    mkdirSync(toolDir, { recursive: true });

    const proc = Bun.spawn(["sh", "-c", "echo $HOME"], {
      cwd: toolDir,
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env },
    });
    await proc.exited;

    const output = await new Response(proc.stdout).text();
    expect(output.trim()).toBeTruthy();
    expect(output.trim()).toBe(process.env.HOME!);
  });
});

describe("manifest with hooks serialization", () => {
  test("hooks survive JSON round-trip (single command)", () => {
    const manifest: ToolManifest = {
      name: "@test/roundtrip",
      description: "test",
      hooks: { postinstall: "make build" },
    };

    const json = JSON.stringify(manifest);
    const parsed = JSON.parse(json) as ToolManifest;

    expect(parsed.hooks?.postinstall).toBe("make build");
  });

  test("hooks survive JSON round-trip (command array)", () => {
    const manifest: ToolManifest = {
      name: "@test/roundtrip-array",
      description: "test",
      hooks: { postinstall: ["npm ci", "npm run build"] },
    };

    const json = JSON.stringify(manifest);
    const parsed = JSON.parse(json) as ToolManifest;

    expect(parsed.hooks?.postinstall).toEqual(["npm ci", "npm run build"]);
  });
});

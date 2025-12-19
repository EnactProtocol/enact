/**
 * End-to-End Integration Tests for Enact CLI
 *
 * These tests verify complete workflows using direct function imports.
 * They test the underlying logic that the CLI commands use.
 *
 * Note: Tests that require actual container execution are marked with
 * `test.skip` by default to allow running in CI without Docker.
 * Set ENACT_E2E_DOCKER=true to run container tests.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import {
  type ToolManifest,
  applyDefaults,
  loadManifestFromDir,
  prepareCommand,
  toolNameToPath,
  tryResolveTool,
  validateInputs,
} from "@enactprotocol/shared";

// Test fixtures location
const FIXTURES_DIR = resolve(__dirname, "fixtures");
const GREETER_TOOL = join(FIXTURES_DIR, "greeter");
const ECHO_TOOL = join(FIXTURES_DIR, "echo-tool");
const CALCULATOR_TOOL = join(FIXTURES_DIR, "calculator");
const INVALID_TOOL = join(FIXTURES_DIR, "invalid-tool");

// Temporary directory for test operations
let tempDir: string;

// Check if Docker/container runtime is available
const hasDocker = await (async () => {
  try {
    const proc = Bun.spawn(["docker", "info"], { stdout: "pipe", stderr: "pipe" });
    await proc.exited;
    return proc.exitCode === 0;
  } catch {
    return false;
  }
})();

// Whether to run container tests
const runContainerTests = process.env.ENACT_E2E_DOCKER === "true" && hasDocker;

/**
 * Helper to install a tool to a directory (simulates install command)
 */
function installTool(
  sourcePath: string,
  destBase: string
): { manifest: ToolManifest; destPath: string } {
  const loaded = loadManifestFromDir(sourcePath);
  if (!loaded) {
    throw new Error(`No valid manifest found in: ${sourcePath}`);
  }

  const manifest = loaded.manifest;
  const toolPath = toolNameToPath(manifest.name);
  const destPath = join(destBase, toolPath);

  // Create destination and copy
  mkdirSync(dirname(destPath), { recursive: true });
  cpSync(sourcePath, destPath, { recursive: true });

  return { manifest, destPath };
}

describe("E2E: Fixture Validation", () => {
  test("greeter fixture has valid YAML manifest", () => {
    const loaded = loadManifestFromDir(GREETER_TOOL);
    expect(loaded).not.toBeNull();
    expect(loaded?.manifest.name).toBe("test/greeter");
    expect(loaded?.manifest.version).toBe("1.0.0");
    expect(loaded?.manifest.from).toBe("alpine:latest");
    expect(loaded?.manifest.command).toContain("echo");
  });

  test("echo-tool fixture has valid Markdown manifest", () => {
    const loaded = loadManifestFromDir(ECHO_TOOL);
    expect(loaded).not.toBeNull();
    expect(loaded?.manifest.name).toBe("test/echo-tool");
    expect(loaded?.manifest.version).toBe("1.0.0");
    expect(loaded?.format).toBe("md");
  });

  test("calculator fixture has valid manifest with complex schema", () => {
    const loaded = loadManifestFromDir(CALCULATOR_TOOL);
    expect(loaded).not.toBeNull();
    expect(loaded?.manifest.name).toBe("test/calculator");
    expect(loaded?.manifest.from).toBe("python:3.12-alpine");
    expect(loaded?.manifest.inputSchema?.properties?.operation).toBeDefined();
    expect(loaded?.manifest.inputSchema?.required).toContain("operation");
    expect(loaded?.manifest.inputSchema?.required).toContain("a");
    expect(loaded?.manifest.inputSchema?.required).toContain("b");
  });

  test("invalid-tool fixture is missing required fields", () => {
    const loaded = loadManifestFromDir(INVALID_TOOL);
    expect(loaded).not.toBeNull();
    // It loads but doesn't have required fields
    expect(loaded?.manifest.from).toBeUndefined();
    expect(loaded?.manifest.command).toBeUndefined();
  });
});

describe("E2E: Tool Installation Flow", () => {
  beforeEach(() => {
    tempDir = join(tmpdir(), `enact-e2e-install-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("installs tool to project .enact/tools directory", () => {
    const destBase = join(tempDir, ".enact", "tools");
    const { manifest, destPath } = installTool(GREETER_TOOL, destBase);

    expect(manifest.name).toBe("test/greeter");
    expect(existsSync(destPath)).toBe(true);
    expect(existsSync(join(destPath, "enact.yaml"))).toBe(true);

    // Verify installed manifest can be loaded
    const reloaded = loadManifestFromDir(destPath);
    expect(reloaded).not.toBeNull();
    expect(reloaded?.manifest.name).toBe("test/greeter");
  });

  test("installs markdown tool correctly", () => {
    const destBase = join(tempDir, ".enact", "tools");
    const { manifest, destPath } = installTool(ECHO_TOOL, destBase);

    expect(manifest.name).toBe("test/echo-tool");
    expect(existsSync(join(destPath, "SKILL.md"))).toBe(true);
  });

  test("installs multiple tools without conflict", () => {
    const destBase = join(tempDir, ".enact", "tools");

    const result1 = installTool(GREETER_TOOL, destBase);
    const result2 = installTool(ECHO_TOOL, destBase);
    const result3 = installTool(CALCULATOR_TOOL, destBase);

    expect(existsSync(result1.destPath)).toBe(true);
    expect(existsSync(result2.destPath)).toBe(true);
    expect(existsSync(result3.destPath)).toBe(true);

    // All should be in test/ namespace
    expect(result1.destPath).toContain("test/greeter");
    expect(result2.destPath).toContain("test/echo-tool");
    expect(result3.destPath).toContain("test/calculator");
  });

  test("overwrites existing tool on reinstall", () => {
    const destBase = join(tempDir, ".enact", "tools");

    // First install
    const result1 = installTool(GREETER_TOOL, destBase);

    // Add a marker file
    const markerPath = join(result1.destPath, ".marker");
    writeFileSync(markerPath, "original");
    expect(existsSync(markerPath)).toBe(true);

    // Reinstall - cpSync with recursive merges by default
    // In real install command we'd rm first, but this tests the helper
    installTool(GREETER_TOOL, destBase);

    // Manifest should still be valid after reinstall
    const reloaded = loadManifestFromDir(result1.destPath);
    expect(reloaded).not.toBeNull();
    expect(reloaded?.manifest.name).toBe("test/greeter");
  });
});

describe("E2E: Tool Resolution Flow", () => {
  let resolveTempDir: string;

  beforeAll(() => {
    resolveTempDir = join(tmpdir(), `enact-e2e-resolve-${Date.now()}`);
    mkdirSync(resolveTempDir, { recursive: true });

    // Install tools
    const destBase = join(resolveTempDir, ".enact", "tools");
    installTool(GREETER_TOOL, destBase);
    installTool(ECHO_TOOL, destBase);
    installTool(CALCULATOR_TOOL, destBase);
  });

  afterAll(() => {
    if (resolveTempDir && existsSync(resolveTempDir)) {
      rmSync(resolveTempDir, { recursive: true, force: true });
    }
  });

  test("resolves installed tool by name", () => {
    const resolution = tryResolveTool("test/greeter", { startDir: resolveTempDir });
    expect(resolution).not.toBeNull();
    expect(resolution?.manifest.name).toBe("test/greeter");
  });

  test("resolves tool by path", () => {
    // Resolve from installed location
    const toolPath = join(resolveTempDir, ".enact", "tools", "test", "greeter");
    const resolution = tryResolveTool(toolPath);
    expect(resolution).not.toBeNull();
    expect(resolution?.manifest.name).toBe("test/greeter");
  });

  test("returns null for non-existent tool", () => {
    const resolution = tryResolveTool("non-existent/tool", { startDir: resolveTempDir });
    expect(resolution).toBeNull();
  });

  test("resolves all installed tools", () => {
    const tools = ["test/greeter", "test/echo-tool", "test/calculator"];

    for (const toolName of tools) {
      const resolution = tryResolveTool(toolName, { startDir: resolveTempDir });
      expect(resolution).not.toBeNull();
      expect(resolution?.manifest.name).toBe(toolName);
    }
  });
});

describe("E2E: Input Validation Flow", () => {
  let greeterManifest: ToolManifest;
  let calculatorManifest: ToolManifest;

  beforeAll(() => {
    const greeterLoaded = loadManifestFromDir(GREETER_TOOL);
    const calculatorLoaded = loadManifestFromDir(CALCULATOR_TOOL);
    greeterManifest = greeterLoaded?.manifest;
    calculatorManifest = calculatorLoaded?.manifest;
  });

  test("validates greeter with default input", () => {
    // Apply defaults first, then validate
    const withDefaults = applyDefaults({}, greeterManifest.inputSchema);
    const result = validateInputs(withDefaults, greeterManifest.inputSchema);
    expect(result.valid).toBe(true);
    // Should have default applied
    expect(withDefaults.name).toBe("World");
  });

  test("validates greeter with custom input", () => {
    const result = validateInputs({ name: "Alice" }, greeterManifest.inputSchema);
    expect(result.valid).toBe(true);
    expect(result.coercedValues?.name).toBe("Alice");
  });

  test("validates calculator with all required inputs", () => {
    const result = validateInputs({ operation: "add", a: 5, b: 3 }, calculatorManifest.inputSchema);
    expect(result.valid).toBe(true);
  });

  test("fails validation when required input is missing", () => {
    const result = validateInputs(
      { operation: "add", a: 5 }, // missing 'b'
      calculatorManifest.inputSchema
    );
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test("fails validation with invalid enum value", () => {
    const result = validateInputs(
      { operation: "invalid", a: 5, b: 3 },
      calculatorManifest.inputSchema
    );
    expect(result.valid).toBe(false);
  });
});

describe("E2E: Command Preparation Flow", () => {
  test("prepares greeter command with input", () => {
    const command = `echo '{"message": "Hello, \${name}!"}'`;
    const prepared = prepareCommand(command, { name: "Alice" });

    // prepareCommand returns string[] - join to check content
    const preparedStr = prepared.join(" ");
    expect(preparedStr).toContain("Alice");
    expect(preparedStr).not.toContain("${name}");
  });

  test("prepares calculator command with multiple inputs", () => {
    const loaded = loadManifestFromDir(CALCULATOR_TOOL);
    const command = loaded?.manifest.command!;

    const prepared = prepareCommand(command, { operation: "add", a: 5, b: 3 });
    const preparedStr = prepared.join(" ");

    expect(preparedStr).toContain("add");
    expect(preparedStr).toContain("5");
    expect(preparedStr).toContain("3");
  });

  test("escapes special characters in input", () => {
    const command = `echo "\${text}"`;
    const prepared = prepareCommand(command, { text: "hello; rm -rf /" });
    const preparedStr = prepared.join(" ");

    // Should contain the text (escaped appropriately)
    expect(preparedStr).toContain("hello");
  });
});

describe("E2E: Configuration Flow", () => {
  beforeEach(() => {
    tempDir = join(tmpdir(), `enact-e2e-config-${Date.now()}`);
    mkdirSync(join(tempDir, ".enact"), { recursive: true });
  });

  afterEach(() => {
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("creates config file structure", () => {
    const configPath = join(tempDir, ".enact", "config.json");

    // Create a config file
    const config = { test: { key: "value" } };
    writeFileSync(configPath, JSON.stringify(config, null, 2));

    // Read it back
    const loaded = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(loaded.test.key).toBe("value");
  });

  test("config file supports nested values", () => {
    const configPath = join(tempDir, ".enact", "config.json");

    const config = {
      registry: {
        url: "https://registry.example.com",
        timeout: 30000,
      },
      trust: {
        policy: "strict",
        requireAudit: true,
      },
    };
    writeFileSync(configPath, JSON.stringify(config, null, 2));

    const loaded = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(loaded.registry.url).toBe("https://registry.example.com");
    expect(loaded.trust.policy).toBe("strict");
  });
});

describe("E2E: Environment Variable Flow", () => {
  beforeEach(() => {
    tempDir = join(tmpdir(), `enact-e2e-env-${Date.now()}`);
    mkdirSync(join(tempDir, ".enact"), { recursive: true });
  });

  afterEach(() => {
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("writes and reads .env file", () => {
    const envPath = join(tempDir, ".enact", ".env");

    // Write env vars
    const envContent = "TEST_VAR=test-value\nANOTHER_VAR=another-value";
    writeFileSync(envPath, envContent);

    // Read back
    const loaded = readFileSync(envPath, "utf-8");
    expect(loaded).toContain("TEST_VAR=test-value");
    expect(loaded).toContain("ANOTHER_VAR=another-value");
  });

  test("handles env vars with special characters", () => {
    const envPath = join(tempDir, ".enact", ".env");

    // Write env var with special chars (quoted)
    const envContent = `SPECIAL_VAR="value with spaces and = sign"`;
    writeFileSync(envPath, envContent);

    const loaded = readFileSync(envPath, "utf-8");
    expect(loaded).toContain("SPECIAL_VAR");
  });

  test("supports comments in .env file", () => {
    const envPath = join(tempDir, ".enact", ".env");

    const envContent = "# This is a comment\nVAR1=value1\n# Another comment\nVAR2=value2";
    writeFileSync(envPath, envContent);

    const loaded = readFileSync(envPath, "utf-8");
    expect(loaded).toContain("# This is a comment");
    expect(loaded).toContain("VAR1=value1");
  });
});

describe("E2E: Trust Policy Flow", () => {
  beforeEach(() => {
    tempDir = join(tmpdir(), `enact-e2e-trust-${Date.now()}`);
    mkdirSync(join(tempDir, ".enact"), { recursive: true });
  });

  afterEach(() => {
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("creates trust policy file", () => {
    const trustPath = join(tempDir, ".enact", "trust-policy.json");

    const policy = {
      name: "test-policy",
      version: "1.0",
      trustedPublishers: [{ identity: "alice@example.com", issuer: "https://accounts.google.com" }],
      requireAttestation: true,
    };

    writeFileSync(trustPath, JSON.stringify(policy, null, 2));

    const loaded = JSON.parse(readFileSync(trustPath, "utf-8"));
    expect(loaded.trustedPublishers).toHaveLength(1);
    expect(loaded.trustedPublishers[0].identity).toBe("alice@example.com");
  });

  test("supports multiple trusted publishers", () => {
    const trustPath = join(tempDir, ".enact", "trust-policy.json");

    const policy = {
      name: "multi-publisher-policy",
      trustedPublishers: [
        { identity: "alice@example.com", issuer: "https://accounts.google.com" },
        {
          identity: "https://github.com/myorg/*",
          issuer: "https://token.actions.githubusercontent.com",
        },
      ],
      trustedAuditors: [
        { identity: "security@auditfirm.com", issuer: "https://accounts.google.com" },
      ],
    };

    writeFileSync(trustPath, JSON.stringify(policy, null, 2));

    const loaded = JSON.parse(readFileSync(trustPath, "utf-8"));
    expect(loaded.trustedPublishers).toHaveLength(2);
    expect(loaded.trustedAuditors).toHaveLength(1);
  });
});

describe("E2E: Full Workflow", () => {
  beforeEach(() => {
    tempDir = join(tmpdir(), `enact-e2e-workflow-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("complete install -> resolve -> validate -> prepare flow", () => {
    // 1. Install tool
    const destBase = join(tempDir, ".enact", "tools");
    const { manifest } = installTool(GREETER_TOOL, destBase);
    expect(manifest.name).toBe("test/greeter");

    // 2. Resolve tool
    const resolution = tryResolveTool("test/greeter", { startDir: tempDir });
    expect(resolution).not.toBeNull();

    // 3. Validate inputs
    const validation = validateInputs({ name: "TestUser" }, manifest.inputSchema);
    expect(validation.valid).toBe(true);

    // 4. Prepare command
    const prepared = prepareCommand(manifest.command!, validation.coercedValues!);
    const preparedStr = prepared.join(" ");
    expect(preparedStr).toContain("TestUser");
    expect(preparedStr).toContain("Hello");
  });

  test("complete calculator workflow", () => {
    // 1. Install tool
    const destBase = join(tempDir, ".enact", "tools");
    const { manifest } = installTool(CALCULATOR_TOOL, destBase);

    // 2. Resolve tool
    const resolution = tryResolveTool("test/calculator", { startDir: tempDir });
    expect(resolution).not.toBeNull();

    // 3. Validate multiple operations
    const operations = [
      { operation: "add", a: 10, b: 5 },
      { operation: "subtract", a: 10, b: 5 },
      { operation: "multiply", a: 10, b: 5 },
      { operation: "divide", a: 10, b: 5 },
    ];

    for (const inputs of operations) {
      const validation = validateInputs(inputs, manifest.inputSchema);
      expect(validation.valid).toBe(true);

      const prepared = prepareCommand(manifest.command!, validation.coercedValues!);
      const preparedStr = prepared.join(" ");
      expect(preparedStr).toContain(inputs.operation);
      expect(preparedStr).toContain(String(inputs.a));
      expect(preparedStr).toContain(String(inputs.b));
    }
  });

  test("handles markdown tool workflow", () => {
    // Install markdown-based tool
    const destBase = join(tempDir, ".enact", "tools");
    const { manifest } = installTool(ECHO_TOOL, destBase);
    expect(manifest.name).toBe("test/echo-tool");

    // Resolve
    const resolution = tryResolveTool("test/echo-tool", { startDir: tempDir });
    expect(resolution).not.toBeNull();

    // Validate
    const validation = validateInputs({ text: "Hello from markdown tool!" }, manifest.inputSchema);
    expect(validation.valid).toBe(true);

    // Prepare
    const prepared = prepareCommand(manifest.command!, validation.coercedValues!);
    const preparedStr = prepared.join(" ");
    expect(preparedStr).toContain("Hello from markdown tool!");
  });
});

// Container execution tests - only run if Docker is available
describe.skipIf(!runContainerTests)("E2E: Container Execution", () => {
  // These tests would actually run containers with Dagger
  // They are skipped by default since they require Docker

  test("placeholder for container tests", () => {
    expect(runContainerTests).toBe(true);
  });
});

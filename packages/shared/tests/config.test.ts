import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import yaml from "js-yaml";
import {
  DEFAULT_CONFIG,
  type EnactConfig,
  // Legacy aliases for backwards compatibility
  addTrustedAuditor,
  addTrustedIdentity,
  configExists,
  emailToProviderIdentity,
  ensureGlobalSetup,
  getConfigValue,
  getMinimumAttestations,
  getTrustPolicy,
  getTrustedAuditors,
  getTrustedIdentities,
  isAuditorTrusted,
  isIdentityTrusted,
  loadConfig,
  removeTrustedAuditor,
  removeTrustedIdentity,
  resetConfig,
  saveConfig,
  setConfigValue,
} from "../src/config";
import { getCacheDir, getConfigPath, getEnactHome } from "../src/paths";

// Use a test-specific home directory to avoid affecting real config
const TEST_HOME = join(import.meta.dir, "fixtures", "config-test-home");

describe("configuration manager", () => {
  beforeAll(() => {
    // Mock homedir to use test directory
    // We need to mock the module-level function
    // For this test, we'll manipulate the files directly and test the logic
  });

  beforeEach(() => {
    // Clean up test directory before each test
    if (existsSync(TEST_HOME)) {
      rmSync(TEST_HOME, { recursive: true, force: true });
    }
  });

  afterAll(() => {
    // Clean up test directory
    if (existsSync(TEST_HOME)) {
      rmSync(TEST_HOME, { recursive: true, force: true });
    }
  });

  describe("DEFAULT_CONFIG", () => {
    test("has all required top-level keys", () => {
      expect(DEFAULT_CONFIG.version).toBeDefined();
      expect(DEFAULT_CONFIG.trust).toBeDefined();
      expect(DEFAULT_CONFIG.cache).toBeDefined();
      expect(DEFAULT_CONFIG.execution).toBeDefined();
      expect(DEFAULT_CONFIG.registry).toBeDefined();
    });

    test("has sensible default values", () => {
      expect(DEFAULT_CONFIG.trust?.policy).toBe("prompt");
      expect(DEFAULT_CONFIG.trust?.minimum_attestations).toBe(1);
      expect(DEFAULT_CONFIG.cache?.maxSizeMb).toBe(1024);
      expect(DEFAULT_CONFIG.execution?.defaultTimeout).toBe("30s");
      expect(DEFAULT_CONFIG.registry?.url).toBe(
        "https://siikwkfgsmouioodghho.supabase.co/functions/v1"
      );
    });
  });

  describe("loadConfig", () => {
    test("returns default config if file does not exist", () => {
      // The actual homedir doesn't have config, or we test with mock
      const config = loadConfig();
      expect(config).toBeDefined();
      expect(config.version).toBeDefined();
    });

    test("returns default config structure", () => {
      const config = loadConfig();
      expect(config.trust).toBeDefined();
      expect(config.cache).toBeDefined();
      expect(config.execution).toBeDefined();
      expect(config.registry).toBeDefined();
    });
  });

  describe("saveConfig", () => {
    test("creates ~/.enact/ directory if needed", () => {
      const config: EnactConfig = { ...DEFAULT_CONFIG };

      // This will create in the real home directory
      // For integration test purposes
      saveConfig(config);

      // Verify config was saved
      expect(configExists()).toBe(true);
    });

    test("writes valid YAML", () => {
      const config: EnactConfig = {
        version: "1.0.0",
        trust: {
          auditors: ["github:alice"],
          policy: "require_attestation",
        },
        cache: {
          maxSizeMb: 2048,
        },
      };

      saveConfig(config);

      // Reload and verify
      const loaded = loadConfig();
      expect(loaded.trust?.auditors).toContain("github:alice");
      expect(loaded.trust?.policy).toBe("require_attestation");
      expect(loaded.cache?.maxSizeMb).toBe(2048);
    });

    test("preserves all config fields", () => {
      const config: EnactConfig = {
        version: "2.0.0",
        trust: {
          auditors: ["github:aud1", "google:aud2"],
          policy: "require_attestation",
          minimum_attestations: 2,
        },
        cache: {
          maxSizeMb: 512,
          ttlSeconds: 3600,
        },
        execution: {
          defaultTimeout: "1m",
          verbose: true,
        },
        registry: {
          url: "https://custom.registry.com",
          authTokenRef: "token-ref",
        },
      };

      saveConfig(config);
      const loaded = loadConfig();

      expect(loaded.version).toBe("2.0.0");
      expect(loaded.trust?.auditors).toEqual(["github:aud1", "google:aud2"]);
      expect(loaded.trust?.policy).toBe("require_attestation");
      expect(loaded.trust?.minimum_attestations).toBe(2);
      expect(loaded.cache?.maxSizeMb).toBe(512);
      expect(loaded.cache?.ttlSeconds).toBe(3600);
      expect(loaded.execution?.defaultTimeout).toBe("1m");
      expect(loaded.execution?.verbose).toBe(true);
      expect(loaded.registry?.url).toBe("https://custom.registry.com");
      expect(loaded.registry?.authTokenRef).toBe("token-ref");
    });
  });

  describe("getConfigValue", () => {
    test("returns default for missing keys", () => {
      const value = getConfigValue("nonexistent.key", "default");
      expect(value).toBe("default");
    });

    test("returns value for existing top-level key", () => {
      saveConfig({ ...DEFAULT_CONFIG, version: "test-version" });
      const value = getConfigValue("version", "fallback");
      expect(value).toBe("test-version");
    });

    test("returns value for nested key", () => {
      saveConfig({
        ...DEFAULT_CONFIG,
        trust: { policy: "require_attestation" },
      });
      const value = getConfigValue("trust.policy", "fallback");
      expect(value).toBe("require_attestation");
    });

    test("returns value for deeply nested key", () => {
      saveConfig({
        ...DEFAULT_CONFIG,
        cache: { maxSizeMb: 999 },
      });
      const value = getConfigValue("cache.maxSizeMb", 0);
      expect(value).toBe(999);
    });

    test("returns default for partially missing path", () => {
      saveConfig({ ...DEFAULT_CONFIG });
      const value = getConfigValue("trust.nonexistent.deep", "default");
      expect(value).toBe("default");
    });
  });

  describe("setConfigValue", () => {
    test("sets top-level value and persists", () => {
      saveConfig({ ...DEFAULT_CONFIG });
      setConfigValue("version", "new-version");

      const loaded = loadConfig();
      expect(loaded.version).toBe("new-version");
    });

    test("sets nested value and persists", () => {
      saveConfig({ ...DEFAULT_CONFIG });
      setConfigValue("trust.policy", "allow");

      const loaded = loadConfig();
      expect(loaded.trust?.policy).toBe("allow");
    });

    test("creates intermediate objects if needed", () => {
      saveConfig({ ...DEFAULT_CONFIG });
      setConfigValue("cache.newField", "newValue");

      const value = getConfigValue("cache.newField", "fallback");
      expect(value).toBe("newValue");
    });

    test("preserves other values when setting", () => {
      saveConfig({
        ...DEFAULT_CONFIG,
        trust: { auditors: ["github:alice"], policy: "prompt" },
      });

      setConfigValue("trust.policy", "require_attestation");

      const loaded = loadConfig();
      expect(loaded.trust?.policy).toBe("require_attestation");
      expect(loaded.trust?.auditors).toContain("github:alice");
    });

    test("throws error for empty key", () => {
      expect(() => setConfigValue("", "value")).toThrow("Invalid configuration key");
    });
  });

  describe("resetConfig", () => {
    test("resets config to defaults", () => {
      // First, set a custom config
      saveConfig({
        version: "custom",
        trust: { policy: "allow" },
        cache: { maxSizeMb: 1 },
      });

      // Reset
      resetConfig();

      // Verify defaults restored
      const loaded = loadConfig();
      expect(loaded.version).toBe(DEFAULT_CONFIG.version);
      expect(loaded.trust?.policy).toBe(DEFAULT_CONFIG.trust?.policy);
      expect(loaded.cache?.maxSizeMb).toBe(DEFAULT_CONFIG.cache?.maxSizeMb);
    });
  });

  describe("configExists", () => {
    test("returns true after saving config", () => {
      saveConfig({ ...DEFAULT_CONFIG });
      expect(configExists()).toBe(true);
    });
  });

  describe("YAML format", () => {
    test("config file is valid YAML", () => {
      saveConfig({
        ...DEFAULT_CONFIG,
        trust: { auditors: ["github:test"] },
      });

      // Read raw file and parse with yaml
      const configPath = join(homedir(), ".enact", "config.yaml");
      const content = readFileSync(configPath, "utf-8");

      // Should not throw
      const parsed = yaml.load(content);
      expect(parsed).toBeDefined();
      expect(typeof parsed).toBe("object");
    });

    test("config file has readable formatting", () => {
      saveConfig({
        ...DEFAULT_CONFIG,
        trust: {
          auditors: ["github:alice", "github:bob"],
          policy: "require_attestation",
        },
      });

      const configPath = join(homedir(), ".enact", "config.yaml");
      const content = readFileSync(configPath, "utf-8");

      // Should have proper indentation (not be on one line)
      expect(content).toContain("\n");
      expect(content).toContain("trust:");
      expect(content).toContain("auditors:");
    });
  });

  describe("error handling", () => {
    test("loadConfig handles malformed YAML gracefully", () => {
      // Save valid config first
      saveConfig({ ...DEFAULT_CONFIG });

      // Corrupt the file
      const configPath = join(homedir(), ".enact", "config.yaml");
      writeFileSync(configPath, "invalid: yaml: [unclosed", "utf-8");

      // Should return defaults, not throw
      const config = loadConfig();
      expect(config).toBeDefined();
      expect(config.version).toBe(DEFAULT_CONFIG.version);
    });

    test("loadConfig handles empty file gracefully", () => {
      saveConfig({ ...DEFAULT_CONFIG });

      const configPath = join(homedir(), ".enact", "config.yaml");
      writeFileSync(configPath, "", "utf-8");

      const config = loadConfig();
      expect(config).toBeDefined();
      expect(config.version).toBe(DEFAULT_CONFIG.version);
    });

    test("loadConfig handles null content gracefully", () => {
      saveConfig({ ...DEFAULT_CONFIG });

      const configPath = join(homedir(), ".enact", "config.yaml");
      writeFileSync(configPath, "null", "utf-8");

      const config = loadConfig();
      expect(config).toBeDefined();
    });
  });

  describe("merge behavior", () => {
    test("merges partial config with defaults", () => {
      // Save config with only some fields
      const configPath = join(homedir(), ".enact", "config.yaml");
      mkdirSync(join(homedir(), ".enact"), { recursive: true });
      writeFileSync(configPath, yaml.dump({ trust: { policy: "require_attestation" } }), "utf-8");

      const loaded = loadConfig();

      // Custom value should be preserved
      expect(loaded.trust?.policy).toBe("require_attestation");

      // Default values should be filled in
      expect(loaded.cache?.maxSizeMb).toBe(DEFAULT_CONFIG.cache?.maxSizeMb);
      expect(loaded.execution?.defaultTimeout).toBe(DEFAULT_CONFIG.execution?.defaultTimeout);
    });
  });

  describe("Trust Management", () => {
    describe("Unified Identity Model", () => {
      test("getTrustedIdentities returns platform defaults by default", () => {
        resetConfig();
        const identities = getTrustedIdentities();
        expect(identities).toContain("github:keith.groves@jointheleague.org");
      });

      test("addTrustedIdentity adds identity and returns true", () => {
        resetConfig();
        const added = addTrustedIdentity("github:alice");
        expect(added).toBe(true);

        const identities = getTrustedIdentities();
        expect(identities).toContain("github:alice");
      });

      test("addTrustedIdentity returns false for duplicate", () => {
        resetConfig();
        addTrustedIdentity("github:alice");
        const added = addTrustedIdentity("github:alice");
        expect(added).toBe(false);
      });

      test("removeTrustedIdentity removes identity and returns true", () => {
        resetConfig();
        addTrustedIdentity("github:alice");
        const removed = removeTrustedIdentity("github:alice");
        expect(removed).toBe(true);

        const identities = getTrustedIdentities();
        expect(identities).not.toContain("github:alice");
      });

      test("removeTrustedIdentity returns false for non-existent identity", () => {
        resetConfig();
        const removed = removeTrustedIdentity("github:nonexistent");
        expect(removed).toBe(false);
      });

      test("isIdentityTrusted checks exact match", () => {
        resetConfig();
        addTrustedIdentity("github:alice");
        expect(isIdentityTrusted("github:alice")).toBe(true);
        expect(isIdentityTrusted("github:bob")).toBe(false);
      });

      test("isIdentityTrusted supports wildcard patterns", () => {
        resetConfig();
        addTrustedIdentity("github:my-org/*");
        expect(isIdentityTrusted("github:my-org/alice")).toBe(true);
        expect(isIdentityTrusted("github:my-org/bob")).toBe(true);
        expect(isIdentityTrusted("github:other-org/alice")).toBe(false);
      });

      test("isIdentityTrusted supports email wildcards", () => {
        resetConfig();
        addTrustedIdentity("*@company.com");
        expect(isIdentityTrusted("alice@company.com")).toBe(true);
        expect(isIdentityTrusted("bob@company.com")).toBe(true);
        expect(isIdentityTrusted("alice@other.com")).toBe(false);
      });
    });

    describe("Legacy Aliases (Backwards Compatibility)", () => {
      test("getTrustedAuditors works as alias", () => {
        resetConfig();
        const auditors = getTrustedAuditors();
        expect(auditors).toContain("github:keith.groves@jointheleague.org");
      });

      test("addTrustedAuditor works as alias", () => {
        resetConfig();
        const added = addTrustedAuditor("github:alice");
        expect(added).toBe(true);

        const auditors = getTrustedAuditors();
        expect(auditors).toContain("github:alice");
      });

      test("removeTrustedAuditor works as alias", () => {
        resetConfig();
        addTrustedAuditor("github:alice");
        const removed = removeTrustedAuditor("github:alice");
        expect(removed).toBe(true);
      });

      test("isAuditorTrusted works as alias", () => {
        resetConfig();
        addTrustedAuditor("github:alice");
        expect(isAuditorTrusted("github:alice")).toBe(true);
      });
    });

    describe("Trust Policy", () => {
      test("getTrustPolicy returns default policy", () => {
        resetConfig();
        const policy = getTrustPolicy();
        expect(policy).toBe("prompt");
      });

      test("getTrustPolicy returns configured policy", () => {
        saveConfig({
          ...DEFAULT_CONFIG,
          trust: { policy: "require_attestation" },
        });
        const policy = getTrustPolicy();
        expect(policy).toBe("require_attestation");
      });

      test("getMinimumAttestations returns default", () => {
        resetConfig();
        const min = getMinimumAttestations();
        expect(min).toBe(1);
      });

      test("getMinimumAttestations returns configured value", () => {
        saveConfig({
          ...DEFAULT_CONFIG,
          trust: { minimum_attestations: 3 },
        });
        const min = getMinimumAttestations();
        expect(min).toBe(3);
      });
    });

    describe("emailToProviderIdentity", () => {
      test("converts GitHub noreply email", () => {
        const result = emailToProviderIdentity("alice@users.noreply.github.com");
        expect(result).toBe("github:alice");
      });

      test("converts GitHub email", () => {
        const result = emailToProviderIdentity("alice@github.com");
        expect(result).toBe("github:alice");
      });

      test("converts Google email", () => {
        const result = emailToProviderIdentity("alice@gmail.com");
        expect(result).toBe("google:alice");
      });

      test("converts Microsoft email", () => {
        const result = emailToProviderIdentity("alice@outlook.com");
        expect(result).toBe("microsoft:alice");
      });

      test("converts GitHub workflow URL", () => {
        const result = emailToProviderIdentity("https://github.com/my-org/my-workflow");
        expect(result).toBe("github:my-org/my-workflow");
      });

      test("returns email as-is for unknown providers", () => {
        const result = emailToProviderIdentity("alice@unknown.com");
        expect(result).toBe("alice@unknown.com");
      });
    });
  });

  describe("ensureGlobalSetup", () => {
    test("creates ~/.enact/ directory if it doesn't exist", () => {
      const enactHome = getEnactHome();

      // Clean up first to ensure fresh state
      if (existsSync(enactHome)) {
        rmSync(enactHome, { recursive: true, force: true });
      }

      // Run setup
      const result = ensureGlobalSetup();

      // Should have performed setup
      expect(result).toBe(true);
      expect(existsSync(enactHome)).toBe(true);
    });

    test("creates ~/.enact/cache/ directory", () => {
      const enactHome = getEnactHome();
      const cacheDir = getCacheDir();

      // Clean up first
      if (existsSync(enactHome)) {
        rmSync(enactHome, { recursive: true, force: true });
      }

      ensureGlobalSetup();

      expect(existsSync(cacheDir)).toBe(true);
    });

    test("creates default config.yaml", () => {
      const enactHome = getEnactHome();
      const configPath = getConfigPath();

      // Clean up first
      if (existsSync(enactHome)) {
        rmSync(enactHome, { recursive: true, force: true });
      }

      ensureGlobalSetup();

      expect(existsSync(configPath)).toBe(true);

      // Verify config content
      const config = loadConfig();
      expect(config.version).toBe(DEFAULT_CONFIG.version);
      expect(config.trust?.policy).toBe(DEFAULT_CONFIG.trust?.policy);
      expect(config.registry?.url).toBe(DEFAULT_CONFIG.registry?.url);
    });

    test("returns false if already initialized", () => {
      // First call should perform setup
      ensureGlobalSetup();

      // Second call should return false (already set up)
      const result = ensureGlobalSetup();
      expect(result).toBe(false);
    });

    test("is idempotent - multiple calls don't break things", () => {
      // Run setup multiple times
      ensureGlobalSetup();
      ensureGlobalSetup();
      ensureGlobalSetup();

      // Everything should still work
      expect(configExists()).toBe(true);
      const config = loadConfig();
      expect(config.version).toBeDefined();
    });

    test("preserves existing config if present", () => {
      const enactHome = getEnactHome();

      // Clean up first
      if (existsSync(enactHome)) {
        rmSync(enactHome, { recursive: true, force: true });
      }

      // Create initial config
      ensureGlobalSetup();

      // Modify the config
      saveConfig({
        ...DEFAULT_CONFIG,
        trust: { policy: "require_attestation", auditors: ["github:test-user"] },
      });

      // Run setup again
      ensureGlobalSetup();

      // Config should be preserved
      const config = loadConfig();
      expect(config.trust?.policy).toBe("require_attestation");
      expect(config.trust?.auditors).toContain("github:test-user");
    });

    test("creates cache directory even if config exists", () => {
      const enactHome = getEnactHome();
      const cacheDir = getCacheDir();

      // Clean up first
      if (existsSync(enactHome)) {
        rmSync(enactHome, { recursive: true, force: true });
      }

      // Create only the home and config
      mkdirSync(enactHome, { recursive: true });
      saveConfig({ ...DEFAULT_CONFIG });

      // Manually remove cache dir if it exists
      if (existsSync(cacheDir)) {
        rmSync(cacheDir, { recursive: true, force: true });
      }

      // Run setup
      const result = ensureGlobalSetup();

      // Should have created cache dir
      expect(result).toBe(true);
      expect(existsSync(cacheDir)).toBe(true);
    });

    test("default config has correct registry URL", () => {
      const enactHome = getEnactHome();

      // Clean up first
      if (existsSync(enactHome)) {
        rmSync(enactHome, { recursive: true, force: true });
      }

      ensureGlobalSetup();

      const config = loadConfig();
      expect(config.registry?.url).toBe("https://siikwkfgsmouioodghho.supabase.co/functions/v1");
    });

    test("default config has correct trust settings", () => {
      const enactHome = getEnactHome();

      // Clean up first
      if (existsSync(enactHome)) {
        rmSync(enactHome, { recursive: true, force: true });
      }

      ensureGlobalSetup();

      const config = loadConfig();
      expect(config.trust?.policy).toBe("prompt");
      expect(config.trust?.minimum_attestations).toBe(1);
      expect(config.trust?.auditors).toContain("github:keith.groves@jointheleague.org");
    });

    test("default config has correct cache settings", () => {
      const enactHome = getEnactHome();

      // Clean up first
      if (existsSync(enactHome)) {
        rmSync(enactHome, { recursive: true, force: true });
      }

      ensureGlobalSetup();

      const config = loadConfig();
      expect(config.cache?.maxSizeMb).toBe(1024);
      expect(config.cache?.ttlSeconds).toBe(86400 * 7); // 7 days
    });

    test("default config has correct execution settings", () => {
      const enactHome = getEnactHome();

      // Clean up first
      if (existsSync(enactHome)) {
        rmSync(enactHome, { recursive: true, force: true });
      }

      ensureGlobalSetup();

      const config = loadConfig();
      expect(config.execution?.defaultTimeout).toBe("30s");
      expect(config.execution?.verbose).toBe(false);
    });
  });
});

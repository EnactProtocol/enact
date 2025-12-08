import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  getSupportedSchemes,
  isSecretUri,
  parseSecretUri,
  resolveSecretUri,
} from "../../src/dagger/uri-parser";

describe("dagger/uri-parser", () => {
  const testDir = join(tmpdir(), `enact-uri-test-${Date.now()}`);

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  describe("parseSecretUri", () => {
    it("should parse env:// URI", () => {
      const result = parseSecretUri("env://API_KEY");

      expect(result.scheme).toBe("env");
      expect(result.value).toBe("API_KEY");
      expect(result.original).toBe("env://API_KEY");
    });

    it("should parse file:// URI", () => {
      const result = parseSecretUri("file:///path/to/secret.txt");

      expect(result.scheme).toBe("file");
      expect(result.value).toBe("/path/to/secret.txt");
    });

    it("should parse cmd:// URI", () => {
      const result = parseSecretUri("cmd://echo hello");

      expect(result.scheme).toBe("cmd");
      expect(result.value).toBe("echo hello");
    });

    it("should parse op:// URI (1Password)", () => {
      const result = parseSecretUri("op://Private/API Token/credential");

      expect(result.scheme).toBe("op");
      expect(result.value).toBe("Private/API Token/credential");
    });

    it("should parse vault:// URI", () => {
      const result = parseSecretUri("vault://secret/data/myapp#api_key");

      expect(result.scheme).toBe("vault");
      expect(result.value).toBe("secret/data/myapp#api_key");
    });

    it("should throw for invalid URI format", () => {
      expect(() => parseSecretUri("not-a-uri")).toThrow(/Invalid secret URI format/);
    });

    it("should throw for missing scheme", () => {
      expect(() => parseSecretUri("://value")).toThrow(/Invalid secret URI format/);
    });

    it("should throw for missing value", () => {
      expect(() => parseSecretUri("env://")).toThrow(/Invalid secret URI format/);
    });

    it("should throw for invalid scheme", () => {
      expect(() => parseSecretUri("http://example.com")).toThrow(/Invalid secret URI scheme/);
    });
  });

  describe("isSecretUri", () => {
    it("should return true for valid env:// URI", () => {
      expect(isSecretUri("env://API_KEY")).toBe(true);
    });

    it("should return true for valid file:// URI", () => {
      expect(isSecretUri("file:///etc/secret")).toBe(true);
    });

    it("should return true for valid cmd:// URI", () => {
      expect(isSecretUri("cmd://cat /etc/secret")).toBe(true);
    });

    it("should return true for valid op:// URI", () => {
      expect(isSecretUri("op://Vault/Item/Field")).toBe(true);
    });

    it("should return true for valid vault:// URI", () => {
      expect(isSecretUri("vault://secret/path")).toBe(true);
    });

    it("should return false for plain string", () => {
      expect(isSecretUri("just-a-value")).toBe(false);
    });

    it("should return false for invalid scheme", () => {
      expect(isSecretUri("http://example.com")).toBe(false);
    });

    it("should return false for malformed URI", () => {
      expect(isSecretUri("env:API_KEY")).toBe(false);
    });
  });

  describe("resolveSecretUri", () => {
    describe("env:// scheme", () => {
      it("should resolve environment variable", async () => {
        process.env.TEST_SECRET_VAR = "secret-value";

        const result = await resolveSecretUri("env://TEST_SECRET_VAR");

        expect(result).toBe("secret-value");

        process.env.TEST_SECRET_VAR = undefined;
      });

      it("should throw for undefined environment variable", async () => {
        await expect(resolveSecretUri("env://NONEXISTENT_VAR_12345")).rejects.toThrow(
          /Environment variable.*is not set/
        );
      });
    });

    describe("file:// scheme", () => {
      it("should read file contents", async () => {
        const secretFile = join(testDir, "secret.txt");
        writeFileSync(secretFile, "file-secret-value\n");

        const result = await resolveSecretUri(`file://${secretFile}`);

        expect(result).toBe("file-secret-value");
      });

      it("should trim whitespace from file contents", async () => {
        const secretFile = join(testDir, "secret-ws.txt");
        writeFileSync(secretFile, "  secret  \n\n");

        const result = await resolveSecretUri(`file://${secretFile}`);

        expect(result).toBe("secret");
      });

      it("should throw for non-existent file", async () => {
        await expect(resolveSecretUri(`file://${testDir}/nonexistent.txt`)).rejects.toThrow(
          /File not found/
        );
      });
    });

    describe("cmd:// scheme", () => {
      it("should execute command and return output", async () => {
        const result = await resolveSecretUri("cmd://echo test-output");

        expect(result).toBe("test-output");
      });

      it("should trim command output", async () => {
        const result = await resolveSecretUri("cmd://printf '  value  '");

        expect(result).toBe("value");
      });

      it("should throw for failed command", async () => {
        await expect(
          resolveSecretUri("cmd://false") // 'false' command always fails
        ).rejects.toThrow(/Command failed/);
      });
    });

    // Note: op:// and vault:// tests would require those tools to be installed
    // They're tested in integration tests with mocks
  });

  describe("getSupportedSchemes", () => {
    it("should return all supported schemes", () => {
      const schemes = getSupportedSchemes();

      expect(schemes).toContain("env");
      expect(schemes).toContain("file");
      expect(schemes).toContain("cmd");
      expect(schemes).toContain("op");
      expect(schemes).toContain("vault");
      expect(schemes).toHaveLength(5);
    });
  });
});

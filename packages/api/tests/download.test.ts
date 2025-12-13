/**
 * Tests for download functionality
 */

import { beforeEach, describe, expect, test } from "bun:test";
import { getAttestations } from "../src/attestations";
import { createApiClient } from "../src/client";
import { downloadBundle, getToolInfo, getToolVersion } from "../src/download";
import { type MockServer, createMockServer } from "./mocks/server";

describe("download module", () => {
  let mockServer: MockServer;

  beforeEach(() => {
    mockServer = createMockServer();
    // @ts-expect-error - Simplified fetch mock for testing
    globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const request = new Request(url, init);
      return mockServer.fetch(request);
    };
  });

  describe("getToolInfo", () => {
    test("gets tool info by name", async () => {
      const client = createApiClient({ baseUrl: "http://localhost" });
      const info = await getToolInfo(client, "alice/utils/greeter");

      expect(info.name).toBe("alice/utils/greeter");
      expect(info.description).toBeDefined();
      expect(info.versions).toBeArray();
      expect(info.latestVersion).toBeDefined();
      expect(info.createdAt).toBeInstanceOf(Date);
      expect(info.updatedAt).toBeInstanceOf(Date);
      expect(info.tags).toBeArray();
    });

    test("includes license info", async () => {
      const client = createApiClient({ baseUrl: "http://localhost" });
      const info = await getToolInfo(client, "alice/utils/greeter");

      expect(info.license).toBeDefined();
    });

    test("includes author", async () => {
      const client = createApiClient({ baseUrl: "http://localhost" });
      const info = await getToolInfo(client, "alice/utils/greeter");

      expect(info.author).toBeDefined();
      expect(info.author.username).toBeDefined();
    });
  });

  describe("getToolVersion", () => {
    test("gets specific version info", async () => {
      const client = createApiClient({ baseUrl: "http://localhost" });
      const version = await getToolVersion(client, "alice/utils/greeter", "1.2.0");

      expect(version.version).toBe("1.2.0");
      expect(version.bundle.hash).toBeDefined();
      expect(version.publishedAt).toBeInstanceOf(Date);
      expect(version.downloads).toBeNumber();
    });

    test("includes manifest", async () => {
      const client = createApiClient({ baseUrl: "http://localhost" });
      const version = await getToolVersion(client, "alice/utils/greeter", "1.2.0");

      expect(version.manifest).toBeDefined();
      expect(version.manifest.enact).toBeDefined();
    });

    test("includes bundle info", async () => {
      const client = createApiClient({ baseUrl: "http://localhost" });
      const version = await getToolVersion(client, "alice/utils/greeter", "1.2.0");

      expect(version.bundle).toBeDefined();
      expect(version.bundle.hash).toBeDefined();
      expect(version.bundle.size).toBeNumber();
      expect(version.bundle.downloadUrl).toBeDefined();
    });

    test("includes rawManifest (enact.md content) when available", async () => {
      const client = createApiClient({ baseUrl: "http://localhost" });
      const version = await getToolVersion(client, "alice/utils/greeter", "1.2.0");

      expect(version.rawManifest).toBeDefined();
      expect(version.rawManifest).toBeString();
      expect(version.rawManifest).toContain("# Greeter Tool");
      expect(version.rawManifest).toContain("enact: 2.0.0");
    });

    test("rawManifest is undefined when not provided", async () => {
      const client = createApiClient({ baseUrl: "http://localhost" });
      const version = await getToolVersion(client, "bob/data/csv-parser", "2.0.0");

      expect(version.rawManifest).toBeUndefined();
    });
  });

  describe("getAttestations (v2)", () => {
    test("gets attestations for a version", async () => {
      const client = createApiClient({ baseUrl: "http://localhost" });
      const result = await getAttestations(client, "alice/utils/greeter", "1.2.0");

      expect(result.attestations).toBeArray();
      expect(result.total).toBeNumber();
      expect(result.limit).toBeNumber();
      expect(result.offset).toBeNumber();
    });

    test("includes attestation verification details", async () => {
      const client = createApiClient({ baseUrl: "http://localhost" });
      const result = await getAttestations(client, "alice/utils/greeter", "1.2.0");

      if (result.attestations.length > 0) {
        const attestation = result.attestations[0];
        expect(attestation).toBeDefined();
        expect(attestation?.auditor).toBeDefined();
        expect(attestation?.auditor_provider).toBeDefined();
        expect(attestation?.verification).toBeDefined();
        expect(attestation?.verification?.verified).toBeBoolean();
      }
    });
  });

  describe("downloadBundle", () => {
    test("downloads bundle with metadata", async () => {
      const client = createApiClient({ baseUrl: "http://localhost" });
      const result = await downloadBundle(client, {
        name: "alice/utils/greeter",
        version: "1.2.0",
      });

      expect(result.data).toBeInstanceOf(ArrayBuffer);
      expect(result.data.byteLength).toBeGreaterThan(0);
      expect(result.size).toBeGreaterThan(0);
      expect(result.contentType).toBeDefined();
    });

    test("returns hash", async () => {
      const client = createApiClient({ baseUrl: "http://localhost" });
      const result = await downloadBundle(client, {
        name: "alice/utils/greeter",
        version: "1.2.0",
      });

      expect(result.hash).toBeDefined();
    });

    test("works with different tool names", async () => {
      const client = createApiClient({ baseUrl: "http://localhost" });
      const result = await downloadBundle(client, {
        name: "bob/data/csv-parser",
        version: "2.0.0",
      });

      expect(result.data).toBeInstanceOf(ArrayBuffer);
    });

    test("can verify hash on download", async () => {
      const client = createApiClient({ baseUrl: "http://localhost" });
      const result = await downloadBundle(client, {
        name: "alice/utils/greeter",
        version: "1.2.0",
        verify: true,
      });

      expect(result.hash).toMatch(/^sha256:/);
    });
  });
});

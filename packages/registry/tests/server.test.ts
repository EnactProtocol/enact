/**
 * Tests for the self-hosted registry server.
 * Tests the Hono app directly (no HTTP server needed).
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { Hono } from "hono";
import { closeDatabase } from "../src/db";
import { createApp } from "../src/index";

const TEST_DATA_DIR = join(import.meta.dir, "fixtures", "test-registry-data");

let app: Hono;

beforeAll(() => {
  if (existsSync(TEST_DATA_DIR)) {
    rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  }
  mkdirSync(TEST_DATA_DIR, { recursive: true });
  app = createApp(TEST_DATA_DIR);
});

afterAll(() => {
  closeDatabase();
  if (existsSync(TEST_DATA_DIR)) {
    rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  }
});

// Helper to make requests against the Hono app
async function request(
  method: string,
  path: string,
  body?: unknown,
  headers?: Record<string, string>
): Promise<Response> {
  const init: RequestInit = {
    method,
    headers: {
      Accept: "application/json",
      ...headers,
    },
  };

  if (body instanceof FormData) {
    init.body = body;
  } else if (body !== undefined) {
    init.headers = {
      ...(init.headers as Record<string, string>),
      "Content-Type": "application/json",
    };
    init.body = JSON.stringify(body);
  }

  return app.request(`http://localhost${path}`, init);
}

describe("Registry Server", () => {
  describe("health check", () => {
    test("GET /health returns ok", async () => {
      const res = await request("GET", "/health");
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.status).toBe("ok");
      expect(body.version).toBe("2.2.4");
    });
  });

  describe("search", () => {
    test("GET /tools/search returns empty results initially", async () => {
      const res = await request("GET", "/tools/search?q=test");
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.tools).toBeArray();
      expect(body.tools.length).toBe(0);
      expect(body.total).toBe(0);
    });

    test("GET /tools/search without query returns browse results", async () => {
      const res = await request("GET", "/tools/search");
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.search_type).toBe("browse");
    });

    test("GET /tools/search respects limit parameter", async () => {
      const res = await request("GET", "/tools/search?limit=5");
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.limit).toBe(5);
    });
  });

  describe("publish and retrieve", () => {
    test("POST /tools/:name/versions publishes a tool", async () => {
      const manifest = {
        enact: "2.0.0",
        name: "@test/hello",
        version: "1.0.0",
        description: "A test tool",
        tags: ["test", "hello"],
      };

      const bundleContent = Buffer.from("fake-bundle-content");

      const formData = new FormData();
      formData.append("manifest", JSON.stringify(manifest));
      formData.append("bundle", new Blob([bundleContent]), "bundle.tar.gz");

      const res = await request("POST", "/tools/@test/hello/versions", formData);
      expect(res.status).toBe(201);

      const body: any = await res.json();
      expect(body.name).toBe("@test/hello");
      expect(body.version).toBe("1.0.0");
      expect(body.bundle_hash).toMatch(/^sha256:/);
      expect(body.bundle_size).toBeGreaterThan(0);
    });

    test("GET /tools/:name returns published tool info", async () => {
      const res = await request("GET", "/tools/@test/hello");
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.name).toBe("@test/hello");
      expect(body.description).toBe("A test tool");
      expect(body.tags).toContain("test");
      expect(body.latest_version).toBe("1.0.0");
      expect(body.versions).toBeArray();
      expect(body.versions.length).toBe(1);
      expect(body.versions_total).toBe(1);
    });

    test("GET /tools/:name/versions/:version returns version details", async () => {
      const res = await request("GET", "/tools/@test/hello/versions/1.0.0");
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.name).toBe("@test/hello");
      expect(body.version).toBe("1.0.0");
      expect(body.manifest).toBeDefined();
      expect(body.manifest.name).toBe("@test/hello");
      expect(body.bundle).toBeDefined();
      expect(body.bundle.hash).toMatch(/^sha256:/);
      expect(body.yanked).toBe(false);
    });

    test("GET /tools/:name/versions/:version/download returns bundle", async () => {
      const res = await request("GET", "/tools/@test/hello/versions/1.0.0/download");
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("application/gzip");
      expect(res.headers.get("ETag")).toMatch(/^"sha256:/);

      const data = await res.arrayBuffer();
      expect(data.byteLength).toBeGreaterThan(0);
    });

    test("POST duplicate version returns 409", async () => {
      const manifest = {
        enact: "2.0.0",
        name: "@test/hello",
        version: "1.0.0",
      };

      const formData = new FormData();
      formData.append("manifest", JSON.stringify(manifest));
      formData.append("bundle", new Blob([Buffer.from("dupe")]), "bundle.tar.gz");

      const res = await request("POST", "/tools/@test/hello/versions", formData);
      expect(res.status).toBe(409);

      const body: any = await res.json();
      expect(body.error.code).toBe("CONFLICT");
    });
  });

  describe("search after publish", () => {
    test("finds published tool via text search", async () => {
      const res = await request("GET", "/tools/search?q=hello");
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.tools.length).toBeGreaterThanOrEqual(1);
      expect(body.tools[0].name).toBe("@test/hello");
    });

    test("finds published tool via browse", async () => {
      const res = await request("GET", "/tools/search");
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.tools.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("tool not found", () => {
    test("GET /tools/:name returns 404 for unknown tool", async () => {
      const res = await request("GET", "/tools/@test/nonexistent");
      expect(res.status).toBe(404);

      const body: any = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });

    test("GET /tools/:name/versions/:version returns 404 for unknown version", async () => {
      const res = await request("GET", "/tools/@test/hello/versions/99.99.99");
      expect(res.status).toBe(404);

      const body: any = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("yank and unyank", () => {
    test("POST /tools/:name/versions/:version/yank yanks a version", async () => {
      const res = await request("POST", "/tools/@test/hello/versions/1.0.0/yank", {
        reason: "Security issue",
        replacement_version: "1.0.1",
      });
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.yanked).toBe(true);
      expect(body.reason).toBe("Security issue");
    });

    test("download of yanked version returns 410 without acknowledge", async () => {
      const res = await request("GET", "/tools/@test/hello/versions/1.0.0/download");
      expect(res.status).toBe(410);

      const body: any = await res.json();
      expect(body.error.code).toBe("VERSION_YANKED");
    });

    test("download of yanked version works with acknowledge_yanked=true", async () => {
      const res = await request(
        "GET",
        "/tools/@test/hello/versions/1.0.0/download?acknowledge_yanked=true"
      );
      expect(res.status).toBe(200);
    });

    test("POST unyank restores the version", async () => {
      const res = await request("POST", "/tools/@test/hello/versions/1.0.0/unyank");
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.yanked).toBe(false);
    });
  });

  describe("attestations", () => {
    test("GET attestations returns empty list initially", async () => {
      const res = await request("GET", "/tools/@test/hello/versions/1.0.0/attestations");
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.attestations).toBeArray();
      expect(body.attestations.length).toBe(0);
    });

    test("POST creates an attestation", async () => {
      const res = await request("POST", "/tools/@test/hello/versions/1.0.0/attestations", {
        auditor: "github:alice",
        auditor_provider: "github",
        bundle: { verificationMaterial: {}, dsseEnvelope: {} },
        rekor_log_id: "test-log-id",
      });
      expect(res.status).toBe(201);

      const body: any = await res.json();
      expect(body.auditor).toBe("github:alice");
      expect(body.verification.verified).toBe(true);
    });

    test("GET attestations returns created attestation", async () => {
      const res = await request("GET", "/tools/@test/hello/versions/1.0.0/attestations");
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.attestations.length).toBe(1);
      expect(body.attestations[0].auditor).toBe("github:alice");
    });
  });

  describe("visibility", () => {
    test("PATCH /tools/:name/visibility changes visibility", async () => {
      const res = await request("PATCH", "/tools/@test/hello/visibility", {
        visibility: "private",
      });
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.visibility).toBe("private");
    });

    test("private tool is hidden from search", async () => {
      const res = await request("GET", "/tools/search?q=hello");
      expect(res.status).toBe(200);

      const body: any = await res.json();
      // Tool is now private, shouldn't appear in public search
      const found = body.tools.find((t: { name: string }) => t.name === "@test/hello");
      expect(found).toBeUndefined();
    });

    test("restore visibility to public", async () => {
      await request("PATCH", "/tools/@test/hello/visibility", {
        visibility: "public",
      });

      const res = await request("GET", "/tools/search?q=hello");
      const body: any = await res.json();
      expect(body.tools.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("delete", () => {
    test("publish a second tool for delete testing", async () => {
      const formData = new FormData();
      formData.append(
        "manifest",
        JSON.stringify({
          enact: "2.0.0",
          name: "@test/to-delete",
          version: "1.0.0",
          description: "Will be deleted",
        })
      );
      formData.append("bundle", new Blob([Buffer.from("delete-me")]), "bundle.tar.gz");

      const res = await request("POST", "/tools/@test/to-delete/versions", formData);
      expect(res.status).toBe(201);
    });

    test("DELETE /tools/:name removes tool", async () => {
      const res = await request("DELETE", "/tools/@test/to-delete");
      expect(res.status).toBe(204);
    });

    test("deleted tool returns 404", async () => {
      const res = await request("GET", "/tools/@test/to-delete");
      expect(res.status).toBe(404);
    });
  });

  describe("auth", () => {
    test("GET /auth/me returns admin profile in open mode", async () => {
      const res = await request("GET", "/auth/me");
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.username).toBe("admin");
      expect(body.namespaces).toContain("admin");
    });
  });

  describe("storage", () => {
    test("database file is created in data directory", () => {
      expect(existsSync(join(TEST_DATA_DIR, "registry.db"))).toBe(true);
    });

    test("bundles directory is created", () => {
      expect(existsSync(join(TEST_DATA_DIR, "bundles"))).toBe(true);
    });
  });
});

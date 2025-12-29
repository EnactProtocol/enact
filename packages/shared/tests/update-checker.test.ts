import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getEnactHome } from "../src/paths";
import { checkForUpdates } from "../src/update-checker";

/**
 * Helper to create a mock fetch function that satisfies TypeScript
 */
function createMockFetch(handler: () => Promise<Partial<Response>>): typeof globalThis.fetch {
  const mockFn = (() => handler()) as unknown as typeof globalThis.fetch;
  // Add preconnect property required by Bun's fetch type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (mockFn as any).preconnect = () => {};
  return mockFn;
}

describe("update-checker", () => {
  const enactHome = getEnactHome();
  const updateCachePath = join(enactHome, "update-check.json");

  beforeEach(() => {
    // Clean up cache file before each test
    if (existsSync(updateCachePath)) {
      rmSync(updateCachePath);
    }
  });

  afterEach(() => {
    // Clean up cache file after each test
    if (existsSync(updateCachePath)) {
      rmSync(updateCachePath);
    }
  });

  describe("checkForUpdates", () => {
    test("returns null when current version matches latest", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = createMockFetch(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ version: "2.1.30" }),
        })
      );

      try {
        const result = await checkForUpdates("2.1.30");
        expect(result).toBeNull();
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    test("returns update info when newer version is available", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = createMockFetch(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ version: "2.2.0" }),
        })
      );

      try {
        const result = await checkForUpdates("2.1.30");
        expect(result).not.toBeNull();
        expect(result?.currentVersion).toBe("2.1.30");
        expect(result?.latestVersion).toBe("2.2.0");
        expect(result?.updateCommand).toBe("npm install -g @enactprotocol/enact@latest");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    test("returns null when current version is newer than latest", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = createMockFetch(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ version: "2.0.0" }),
        })
      );

      try {
        const result = await checkForUpdates("2.1.30");
        expect(result).toBeNull();
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    test("returns null when fetch fails", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = createMockFetch(() => Promise.reject(new Error("Network error")));

      try {
        const result = await checkForUpdates("2.1.30");
        expect(result).toBeNull();
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    test("returns null when response is not ok", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = createMockFetch(() =>
        Promise.resolve({
          ok: false,
          status: 500,
        })
      );

      try {
        const result = await checkForUpdates("2.1.30");
        expect(result).toBeNull();
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    test("creates cache file after successful check", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = createMockFetch(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ version: "2.1.30" }),
        })
      );

      try {
        await checkForUpdates("2.1.30");
        expect(existsSync(updateCachePath)).toBe(true);

        const cache = JSON.parse(readFileSync(updateCachePath, "utf-8"));
        expect(cache.latestVersion).toBe("2.1.30");
        expect(cache.lastCheck).toBeGreaterThan(0);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    test("uses cached version when cache is fresh", async () => {
      // Write a fresh cache file
      const cache = {
        lastCheck: Date.now(),
        latestVersion: "3.0.0",
      };
      if (!existsSync(enactHome)) {
        mkdirSync(enactHome, { recursive: true });
      }
      writeFileSync(updateCachePath, JSON.stringify(cache), "utf-8");

      // Fetch should not be called when cache is fresh
      let fetchCalled = false;
      const originalFetch = globalThis.fetch;
      globalThis.fetch = createMockFetch(() => {
        fetchCalled = true;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ version: "2.1.30" }),
        });
      });

      try {
        const result = await checkForUpdates("2.1.30");
        expect(fetchCalled).toBe(false);
        expect(result).not.toBeNull();
        expect(result?.latestVersion).toBe("3.0.0");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    test("fetches new version when cache is stale", async () => {
      // Write an old cache file (25 hours ago)
      const cache = {
        lastCheck: Date.now() - 25 * 60 * 60 * 1000,
        latestVersion: "2.0.0",
      };
      if (!existsSync(enactHome)) {
        mkdirSync(enactHome, { recursive: true });
      }
      writeFileSync(updateCachePath, JSON.stringify(cache), "utf-8");

      let fetchCalled = false;
      const originalFetch = globalThis.fetch;
      globalThis.fetch = createMockFetch(() => {
        fetchCalled = true;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ version: "2.5.0" }),
        });
      });

      try {
        const result = await checkForUpdates("2.1.30");
        expect(fetchCalled).toBe(true);
        expect(result).not.toBeNull();
        expect(result?.latestVersion).toBe("2.5.0");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    test("handles corrupted cache file gracefully", async () => {
      // Write an invalid cache file
      if (!existsSync(enactHome)) {
        mkdirSync(enactHome, { recursive: true });
      }
      writeFileSync(updateCachePath, "not valid json", "utf-8");

      const originalFetch = globalThis.fetch;
      globalThis.fetch = createMockFetch(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ version: "2.1.30" }),
        })
      );

      try {
        // Should not throw, should fetch fresh data
        const result = await checkForUpdates("2.1.30");
        expect(result).toBeNull(); // Same version, no update
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    test("handles prerelease versions correctly", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = createMockFetch(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ version: "2.2.0" }),
        })
      );

      try {
        // Prerelease should be considered older than release
        const result = await checkForUpdates("2.2.0-alpha");
        expect(result).not.toBeNull();
        expect(result?.latestVersion).toBe("2.2.0");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});

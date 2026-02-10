/**
 * Tests for the registry storage module.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { deleteBundle, getBundlePath, initStorage, loadBundle, storeBundle } from "../src/storage";

const TEST_DATA_DIR = join(import.meta.dir, "fixtures", "storage-test");

beforeAll(() => {
  if (existsSync(TEST_DATA_DIR)) {
    rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  }
  mkdirSync(TEST_DATA_DIR, { recursive: true });
  initStorage(TEST_DATA_DIR);
});

afterAll(() => {
  if (existsSync(TEST_DATA_DIR)) {
    rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  }
});

describe("getBundlePath", () => {
  test("returns correct relative path for simple name", () => {
    const path = getBundlePath("my-tool", "1.0.0");
    expect(path).toBe(join("my-tool", "1.0.0", "bundle.tar.gz"));
  });

  test("returns correct relative path for scoped name", () => {
    const path = getBundlePath("@acme/scraper", "2.1.0");
    expect(path).toBe(join("@acme/scraper", "2.1.0", "bundle.tar.gz"));
  });

  test("returns correct relative path for nested name", () => {
    const path = getBundlePath("alice/utils/greeter", "0.5.0");
    expect(path).toBe(join("alice/utils/greeter", "0.5.0", "bundle.tar.gz"));
  });
});

describe("storeBundle", () => {
  test("stores data and returns relative path", () => {
    const data = Buffer.from("test-bundle-data");
    const relativePath = storeBundle("@test/store-test", "1.0.0", data);

    expect(relativePath).toBe(getBundlePath("@test/store-test", "1.0.0"));

    const fullPath = join(TEST_DATA_DIR, "bundles", relativePath);
    expect(existsSync(fullPath)).toBe(true);
  });

  test("creates nested directories as needed", () => {
    const data = Buffer.from("nested-data");
    const relativePath = storeBundle("@org/deep/tool", "3.0.0", data);

    const fullPath = join(TEST_DATA_DIR, "bundles", relativePath);
    expect(existsSync(fullPath)).toBe(true);
  });

  test("overwrites existing bundle", () => {
    const first = Buffer.from("first-version");
    const second = Buffer.from("second-version");

    storeBundle("@test/overwrite", "1.0.0", first);
    storeBundle("@test/overwrite", "1.0.0", second);

    const loaded = loadBundle(getBundlePath("@test/overwrite", "1.0.0"));
    expect(loaded).not.toBeNull();
    expect(loaded!.toString()).toBe("second-version");
  });
});

describe("loadBundle", () => {
  test("returns stored data", () => {
    const original = Buffer.from("load-test-content");
    const relativePath = storeBundle("@test/load-test", "1.0.0", original);

    const loaded = loadBundle(relativePath);
    expect(loaded).not.toBeNull();
    expect(loaded!.toString()).toBe("load-test-content");
  });

  test("returns null for non-existent bundle", () => {
    const loaded = loadBundle("nonexistent/1.0.0/bundle.tar.gz");
    expect(loaded).toBeNull();
  });

  test("handles binary data correctly", () => {
    const binary = Buffer.from([0x00, 0x1f, 0x8b, 0xff, 0xde, 0xad]);
    storeBundle("@test/binary", "1.0.0", binary);

    const loaded = loadBundle(getBundlePath("@test/binary", "1.0.0"));
    expect(loaded).not.toBeNull();
    expect(loaded!.length).toBe(6);
    expect(loaded![0]).toBe(0x00);
    expect(loaded![3]).toBe(0xff);
  });
});

describe("deleteBundle", () => {
  test("removes an existing bundle", () => {
    const data = Buffer.from("delete-me");
    const relativePath = storeBundle("@test/to-delete", "1.0.0", data);

    expect(loadBundle(relativePath)).not.toBeNull();

    deleteBundle(relativePath);
    expect(loadBundle(relativePath)).toBeNull();
  });

  test("does not throw for non-existent bundle", () => {
    expect(() => deleteBundle("ghost/1.0.0/bundle.tar.gz")).not.toThrow();
  });
});

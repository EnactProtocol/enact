/**
 * Basic tests for @enactprotocol/api package
 */

import { describe, expect, test } from "bun:test";
import { VERSION } from "../src/index";

describe("@enactprotocol/api", () => {
  test("exports version", () => {
    expect(VERSION).toBeDefined();
    expect(typeof VERSION).toBe("string");
  });

  test("version is valid semver", () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });
});

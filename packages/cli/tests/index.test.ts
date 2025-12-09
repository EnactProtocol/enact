import { describe, expect, test } from "bun:test";
import { version } from "../src/index";

describe("@enactprotocol/cli", () => {
  test("exports version", () => {
    // Just verify version is a valid semver string
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

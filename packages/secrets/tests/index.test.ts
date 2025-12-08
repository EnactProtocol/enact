import { describe, expect, it } from "bun:test";
import { version } from "../src/index";

describe("@enactprotocol/secrets", () => {
  it("should export version", () => {
    expect(version).toBe("0.1.0");
  });

  it("should be a valid semver version", () => {
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

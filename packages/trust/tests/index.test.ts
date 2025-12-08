import { describe, expect, test } from "bun:test";
import { version } from "../src/index";

describe("@enactprotocol/security", () => {
  test("exports version", () => {
    expect(version).toBe("0.1.0");
  });
});

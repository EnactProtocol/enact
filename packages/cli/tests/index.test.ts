import { describe, expect, test } from "bun:test";
import { version } from "../src/index";

describe("@enactprotocol/cli", () => {
  test("exports version", () => {
    expect(version).toBe("2.0.1");
  });
});

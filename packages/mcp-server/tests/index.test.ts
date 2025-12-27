import { describe, expect, test } from "bun:test";
import { version } from "../src/index";

describe("@enactprotocol/mcp-server", () => {
  test("exports version", () => {
    expect(version).toBe("2.0.2");
  });
});

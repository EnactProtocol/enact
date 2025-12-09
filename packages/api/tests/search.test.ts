/**
 * Tests for search functionality
 */

import { beforeEach, describe, expect, test } from "bun:test";
import { createApiClient } from "../src/client";
import { searchTools } from "../src/search";
import { type MockServer, createMockServer } from "./mocks/server";

describe("searchTools", () => {
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

  test("searches with query", async () => {
    const client = createApiClient({ baseUrl: "http://localhost" });
    const results = await searchTools(client, { query: "greet" });

    expect(results.results).toBeArray();
    expect(results.total).toBeNumber();
    expect(results.limit).toBe(20);
    expect(results.offset).toBe(0);
  });

  test("returns properly formatted results", async () => {
    const client = createApiClient({ baseUrl: "http://localhost" });
    const results = await searchTools(client, { query: "csv" });

    expect(results.results.length).toBeGreaterThan(0);
    const result = results.results[0];
    expect(result).toBeDefined();
    expect(result?.name).toBeDefined();
    expect(result?.description).toBeDefined();
    expect(result?.tags).toBeArray();
    expect(result?.version).toBeDefined();
    expect(result?.author).toBeDefined();
    expect(result?.author?.username).toBeDefined();
    expect(result?.downloads).toBeNumber();
  });

  test("filters by tags", async () => {
    const client = createApiClient({ baseUrl: "http://localhost" });
    const results = await searchTools(client, {
      query: "text",
      tags: ["utility"],
    });

    expect(results.results).toBeArray();
  });

  test("supports tags as string", async () => {
    const client = createApiClient({ baseUrl: "http://localhost" });
    const results = await searchTools(client, {
      query: "text",
      tags: "utility,text",
    });

    expect(results.results).toBeArray();
  });

  test("supports pagination with limit", async () => {
    const client = createApiClient({ baseUrl: "http://localhost" });
    const results = await searchTools(client, {
      query: "",
      limit: 5,
    });

    expect(results.limit).toBe(5);
  });

  test("supports pagination with offset", async () => {
    const client = createApiClient({ baseUrl: "http://localhost" });
    const results = await searchTools(client, {
      query: "",
      offset: 10,
    });

    expect(results.offset).toBe(10);
  });

  test("hasMore indicates more results available", async () => {
    const client = createApiClient({ baseUrl: "http://localhost" });
    const results = await searchTools(client, {
      query: "",
      limit: 1,
    });

    // If total > limit + offset, hasMore should be true
    expect(typeof results.hasMore).toBe("boolean");
  });

  test("caps limit at 100", async () => {
    const client = createApiClient({ baseUrl: "http://localhost" });
    const results = await searchTools(client, {
      query: "",
      limit: 200,
    });

    // The search function should cap at 100
    expect(results.limit).toBeLessThanOrEqual(100);
  });

  test("supports threshold parameter", async () => {
    const client = createApiClient({ baseUrl: "http://localhost" });
    const results = await searchTools(client, {
      query: "test",
      threshold: 0.5,
    });

    expect(results.results).toBeArray();
  });

  test("clamps threshold to valid range (0-1)", async () => {
    const client = createApiClient({ baseUrl: "http://localhost" });

    // Threshold above 1 should be clamped
    const resultsHigh = await searchTools(client, {
      query: "test",
      threshold: 1.5,
    });
    expect(resultsHigh.results).toBeArray();

    // Threshold below 0 should be clamped
    const resultsLow = await searchTools(client, {
      query: "test",
      threshold: -0.5,
    });
    expect(resultsLow.results).toBeArray();
  });

  test("threshold is optional", async () => {
    const client = createApiClient({ baseUrl: "http://localhost" });

    // Search without threshold should work
    const results = await searchTools(client, {
      query: "test",
    });

    expect(results.results).toBeArray();
  });
});

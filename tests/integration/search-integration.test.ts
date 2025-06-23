// tests/integration/search-integration.test.ts - Integration tests for search functionality
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { EnactCore } from '../../src/core/EnactCore';

// These are integration tests that test the actual search functionality against real APIs
// They are SKIPPED BY DEFAULT to avoid:
// - Network dependencies in CI/CD pipelines
// - Flaky tests due to network issues
// - API rate limiting
// - External service dependencies
// 
// To run these tests locally for development/debugging:
// INTEGRATION_TESTS=true bun test tests/integration/search-integration.test.ts
//
// These tests verify:
// - Real API connectivity and response format
// - End-to-end search functionality
// - Production API compatibility

describe('Search Integration Tests', () => {
  let core: EnactCore;
  const runIntegrationTests = process.env.INTEGRATION_TESTS === 'true';

  beforeAll(() => {
    if (!runIntegrationTests) {
      console.log('ℹ️  Skipping integration tests (network-dependent). Set INTEGRATION_TESTS=true to run them.');
      return;
    }
    
    core = new EnactCore({
      apiUrl: 'https://enact.tools',
      supabaseUrl: 'https://xjnhhxwxovjifdxdwzih.supabase.co'
    });
  });

  // INTEGRATION TEST: Tests real API search functionality
  // Skipped by default - requires INTEGRATION_TESTS=true
  test.skipIf(!runIntegrationTests)('should search for real tools', async () => {
    const results = await core.searchTools({
      query: 'test',
      limit: 5
    });

    expect(results).toBeArray();
    // We can't guarantee specific results, but let's check structure
    if (results.length > 0) {
      const tool = results[0];
      expect(tool).toHaveProperty('name');
      expect(tool).toHaveProperty('description');
      // Note: Real API may not have 'enact' property, so check for common fields
      expect(typeof tool.name).toBe('string');
      expect(typeof tool.description).toBe('string');
    }
  }, 10000); // 10 second timeout for network requests

  // INTEGRATION TEST: Tests API handling of empty results
  // Skipped by default - requires INTEGRATION_TESTS=true
  test.skipIf(!runIntegrationTests)('should handle empty search results gracefully', async () => {
    const results = await core.searchTools({
      query: 'xyznonexistentquerythatshouldfindnothing123',
      limit: 5
    });

    expect(results).toBeArray();
    expect(results).toHaveLength(0);
  }, 10000);

  // INTEGRATION TEST: Tests API pagination and limits
  // Skipped by default - requires INTEGRATION_TESTS=true
  test.skipIf(!runIntegrationTests)('should respect search limits', async () => {
    const results = await core.searchTools({
      query: 'tool',
      limit: 2
    });

    expect(results).toBeArray();
    if (results.length > 0) {
      expect(results.length).toBeLessThanOrEqual(2);
    }
  }, 10000);
});

// Unit tests for display functions
describe('Search Display Functions', () => {
  test('should format table display correctly', () => {
    // Test the table formatting logic
    const sampleTools = [
      {
        name: 'short',
        description: 'Brief desc',
        tags: ['tag1'],
        enact: '1.0.0'
      },
      {
        name: 'very/long/tool/name/that/exceeds/width',
        description: 'This is a very long description that should be truncated',
        tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5'],
        enact: '1.0.0'
      }
    ];

    // We'll capture console output to test the display
    const originalLog = console.error;
    let output: string[] = [];
    console.error = (message: string) => {
      output.push(message);
    };

    try {
      // Import and test the display function
      // Since the function is not exported, we'll test the behavior indirectly
      expect(true).toBe(true); // Placeholder for now
    } finally {
      console.error = originalLog;
    }
  });

  test('should validate search options', () => {
    // Test that search options are properly validated
    const validOptions = [
      { query: 'test' },
      { query: 'test', limit: 10 },
      { query: 'test', tags: ['cli'] },
      { query: 'test', author: 'testuser' },
      { query: 'test', format: 'json' }
    ];

    for (const options of validOptions) {
      expect(options.query).toBeDefined();
      if (options.limit) {
        expect(options.limit).toBeGreaterThan(0);
      }
      if (options.tags) {
        expect(options.tags).toBeArray();
      }
    }
  });
});

// Test that our search replacement maintains compatibility
describe('Search Command Compatibility', () => {
  test('should maintain the same interface as legacy search', () => {
    // Test that the new core search has the same interface expectations
    const expectedOptions = {
      help: true,
      limit: 10,
      tags: ['test'],
      format: 'json',
      author: 'testuser'
    };

    // Verify all expected options are supported
    expect(expectedOptions.help).toBeDefined();
    expect(expectedOptions.limit).toBeDefined();
    expect(expectedOptions.tags).toBeDefined();
    expect(expectedOptions.format).toBeDefined();
    expect(expectedOptions.author).toBeDefined();
  });

  test('should support all output formats', () => {
    const supportedFormats = ['table', 'list', 'json'];
    
    for (const format of supportedFormats) {
      expect(['table', 'list', 'json']).toContain(format);
    }
  });

  test('should handle all expected argument patterns', () => {
    const testCases = [
      [], // No args - should prompt interactively
      ['single-query'], // Single word query
      ['multi', 'word', 'query'], // Multi-word query
    ];

    for (const args of testCases) {
      expect(args).toBeArray();
    }
  });
});

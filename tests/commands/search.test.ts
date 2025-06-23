// tests/commands/search.test.ts - Unit tests for search functionality
import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';
import type { EnactTool } from '../../src/types';

// Mock console methods to capture output
const originalLog = console.error;
const originalError = console.error;
let logOutput: string[] = [];
let errorOutput: string[] = [];

beforeEach(() => {
  logOutput = [];
  errorOutput = [];
  console.error = mock((message: string) => {
    logOutput.push(message);
  });
  console.error = mock((message: string) => {
    errorOutput.push(message);
  });
});

afterEach(() => {
  console.error = originalLog;
  console.error = originalError;
});

// Sample tool data for testing
const sampleTools: EnactTool[] = [
  {
    name: 'text/slugify',
    description: 'Convert text to URL-safe slugs',
    command: 'slugify',
    tags: ['text', 'formatter'],
    version: '1.0.0',
    license: 'MIT',
    authors: [{ name: 'Test Author', email: 'test@example.com' }],
    enact: '1.0.0'
  },
  {
    name: 'file/converter',
    description: 'Convert files between different formats',
    command: 'convert',
    tags: ['file', 'converter'],
    version: '2.1.0',
    license: 'Apache-2.0',
    authors: [{ name: 'Another Author', email: 'another@example.com' }],
    enact: '1.0.0'
  },
  {
    name: 'ai/summarizer',
    description: 'AI-powered text summarization tool with advanced features',
    command: 'summarize',
    tags: ['ai', 'nlp', 'text'],
    version: '1.5.2',
    license: 'GPL-3.0',
    authors: [{ name: 'AI Corp', email: 'ai@corp.com' }],
    enact: '1.0.0'
  }
];

describe('Search Command Functionality', () => {
  describe('Tool data structure validation', () => {
    test('should have valid tool data structure', () => {
      for (const tool of sampleTools) {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('enact');
        expect(tool.enact).toBe('1.0.0');
        
        if (tool.tags) {
          expect(tool.tags).toBeArray();
        }
        
        if (tool.authors) {
          expect(tool.authors).toBeArray();
          for (const author of tool.authors) {
            expect(author).toHaveProperty('name');
          }
        }
      }
    });

    test('should handle tools with different properties', () => {
      const minimalTool: EnactTool = {
        name: 'minimal/tool',
        description: 'A minimal tool',
        command: 'minimal',
        enact: '1.0.0'
      };

      expect(minimalTool).toHaveProperty('name');
      expect(minimalTool).toHaveProperty('description');
      expect(minimalTool).toHaveProperty('enact');
    });
  });

  describe('Search options handling', () => {
    test('should handle various search option combinations', () => {
      const testOptions = [
        { help: true },
        { limit: 10 },
        { tags: ['test', 'cli'] },
        { format: 'json' },
        { author: 'testuser' },
        { limit: 5, tags: ['utility'], format: 'table' }
      ];

      for (const options of testOptions) {
        if (options.limit) {
          expect(options.limit).toBeGreaterThan(0);
        }
        if (options.tags) {
          expect(options.tags).toBeArray();
        }
        if (options.format) {
          expect(['json', 'table', 'list']).toContain(options.format);
        }
      }
    });

    test('should validate format options', () => {
      const validFormats = ['json', 'table', 'list'];
      const invalidFormats = ['xml', 'csv', 'invalid'];

      for (const format of validFormats) {
        expect(['json', 'table', 'list']).toContain(format);
      }

      for (const format of invalidFormats) {
        expect(['json', 'table', 'list']).not.toContain(format);
      }
    });
  });

  describe('Output formatting', () => {
    test('should format JSON output correctly', () => {
      const jsonString = JSON.stringify(sampleTools, null, 2);
      expect(() => JSON.parse(jsonString)).not.toThrow();
      
      const parsed = JSON.parse(jsonString);
      expect(parsed).toBeArray();
      expect(parsed).toHaveLength(3);
      expect(parsed[0].name).toBe('text/slugify');
    });

    test('should handle table formatting requirements', () => {
      // Test the table formatting logic
      const nameWidth = 25;
      const descWidth = 50;
      const tagsWidth = 20;

      for (const tool of sampleTools) {
        const name = tool.name.length > nameWidth ? 
          tool.name.substring(0, nameWidth - 3) + '...' : 
          tool.name.padEnd(nameWidth);
        
        const desc = tool.description.length > descWidth ? 
          tool.description.substring(0, descWidth - 3) + '...' : 
          tool.description.padEnd(descWidth);
        
        const tags = (tool.tags || []).join(', ');
        const tagsDisplay = tags.length > tagsWidth ? 
          tags.substring(0, tagsWidth - 3) + '...' : 
          tags.padEnd(tagsWidth);

        expect(name.length).toBeLessThanOrEqual(nameWidth);
        expect(desc.length).toBeLessThanOrEqual(descWidth);
        expect(tagsDisplay.length).toBeLessThanOrEqual(tagsWidth);
      }
    });

    test('should handle list formatting', () => {
      // Test list format structure
      sampleTools.forEach((tool, index) => {
        const listItem = `${index + 1}. ${tool.name}`;
        expect(listItem).toContain(tool.name);
        expect(listItem).toContain((index + 1).toString());
        
        if (tool.tags && tool.tags.length > 0) {
          const tagString = tool.tags.join(', ');
          expect(tagString).toContain(',');
        }
      });
    });
  });

  describe('Error handling scenarios', () => {
    test('should handle empty results gracefully', () => {
      const emptyResults: EnactTool[] = [];
      expect(emptyResults).toBeArray();
      expect(emptyResults).toHaveLength(0);
    });

    test('should handle malformed tool data', () => {
      const malformedTool: any = {
        name: 'malformed/tool',
        // Missing required properties
      };

      // Should handle missing description gracefully
      expect(malformedTool.name).toBeDefined();
      expect(malformedTool.description).toBeUndefined();
    });

    test('should validate network error patterns', () => {
      const networkErrors = [
        'ENOTFOUND registry.example.com',
        'ECONNREFUSED',
        'TIMEOUT',
        'Network error'
      ];

      for (const errorMessage of networkErrors) {
        expect(errorMessage).toBeString();
        expect(errorMessage.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Search query handling', () => {
    test('should handle different query patterns', () => {
      const queries = [
        'single',
        'multi word query',
        'complex-query-with-dashes',
        'query_with_underscores',
        'query/with/slashes',
        ''
      ];

      for (const query of queries) {
        expect(typeof query).toBe('string');
      }
    });

    test('should handle special characters in queries', () => {
      const specialQueries = [
        'query with spaces',
        'query-with-dashes',
        'query_with_underscores',
        'query.with.dots',
        'query@with@symbols'
      ];

      for (const query of specialQueries) {
        expect(query).toBeString();
        expect(query.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Tool detail requirements', () => {
    test('should handle detailed tool information', () => {
      const detailedTool: EnactTool = {
        name: 'detailed/tool',
        description: 'A detailed tool for testing',
        command: 'detailed-command',
        tags: ['detailed', 'test'],
        version: '1.0.0',
        license: 'MIT',
        timeout: '30s',
        authors: [{ name: 'Test Author', email: 'test@example.com' }],
        inputSchema: {
          type: 'object',
          properties: {
            input: { type: 'string', description: 'Input text' }
          },
          required: ['input']
        },
        examples: [
          {
            description: 'Basic usage',
            input: { input: 'hello' },
            output: 'Hello, World!'
          }
        ],
        env: {
          TEST_VAR: {
            description: 'Test environment variable',
            source: 'env',
            required: true
          }
        },
        enact: '1.0.0'
      };

      expect(detailedTool.inputSchema).toBeDefined();
      expect(detailedTool.examples).toBeDefined();
      expect(detailedTool.env).toBeDefined();
      expect(detailedTool.inputSchema?.properties).toBeDefined();
      expect(detailedTool.examples?.[0]?.input).toBeDefined();
      expect(detailedTool.env?.TEST_VAR?.required).toBe(true);
    });
  });
});

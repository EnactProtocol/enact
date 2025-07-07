// tests/core/core.search.test.ts - Tests for EnactCore search functionality
import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';
import type { ToolSearchOptions, EnactCoreOptions } from '../../src/core/EnactCore';
import type { EnactTool } from '../../src/types';
import { createMockConsole, createTestEnvironment } from '../helpers/test-utils';

// Sample API responses for testing
const sampleApiSearchResults = [
  { name: 'text/slugify' },
  { name: 'file/converter' },
  { name: 'ai/summarizer' }
];

const sampleToolResponse = {
  name: 'text/slugify',
  description: 'Convert text to URL-safe slugs',
  command: 'slugify',
  tags: ['text', 'formatter'],
  version: '1.0.0',
  license: 'MIT',
  content: `name: text/slugify
description: Convert text to URL-safe slugs
command: slugify
tags:
  - text
  - formatter
version: 1.0.0
license: MIT`,
  namespace: 'text'
};

describe('EnactCore Search', () => {
  let mockApiClient: any;
  let mockExecutionProvider: any;
  let EnactCore: any;
  let core: any;
  let mockConsole: any;

  beforeEach(() => {
    // Set up mock console
    mockConsole = createMockConsole();

    // Create fresh mocks for each test
    mockApiClient = {
      searchTools: mock(),
      getTool: mock()
    };

    mockExecutionProvider = {
      resolveEnvironmentVariables: mock(),
      executeCommand: mock()
    };

    // Create a mock class that we can control
    EnactCore = class MockEnactCore {
      private apiClient: any;
      private executionProvider: any;
      private options: EnactCoreOptions;

      constructor(options: EnactCoreOptions = {}) {
        this.options = {
          apiUrl: 'https://test-api.example.com',
          supabaseUrl: 'https://test-supabase.example.com',
          executionProvider: 'direct',
          defaultTimeout: '30s',
          verificationPolicy: 'permissive',
          ...options
        };
        this.apiClient = mockApiClient;
        this.executionProvider = mockExecutionProvider;
      }

      async searchTools(options: ToolSearchOptions): Promise<EnactTool[]> {
        try {
          const searchResults = await this.apiClient.searchTools({
            query: options.query,
            limit: options.limit,
            tags: options.tags
          });

          const tools: EnactTool[] = [];
          for (const result of searchResults) {
            try {
              const toolData = await this.apiClient.getTool(result.name);
              if (toolData) {
                tools.push(this.parseToolData(toolData));
              }
            } catch (error) {
              // Skip failed tool fetches
              continue;
            }
          }

          return tools;
        } catch (error: any) {
          throw new Error(`Search failed: ${error.message}`);
        }
      }

      async getToolByName(name: string, version?: string): Promise<EnactTool | null> {
        try {
          const toolData = await this.apiClient.getTool(name);
          return this.parseToolData(toolData);
        } catch (error: any) {
          if (error.message.includes('404')) {
            return null;
          }
          throw error;
        }
      }

      private parseToolData(data: any): EnactTool {
        // Simple parsing logic for testing
        if (data.content) {
          // Parse YAML content
          const lines = data.content.split('\n');
          const tool: any = {};
          let inTags = false;
          const tags: string[] = [];
          
          for (const line of lines) {
            if (line.trim().startsWith('tags:')) {
              inTags = true;
              continue;
            }
            if (inTags && line.trim().startsWith('- ')) {
              tags.push(line.trim().substring(2));
              continue;
            }
            if (inTags && !line.trim().startsWith('- ') && line.trim() !== '') {
              inTags = false;
            }
            
            const [key, value] = line.split(': ');
            if (key && value) {
              tool[key] = value;
            }
          }
          
          if (tags.length > 0) {
            tool.tags = tags;
          }
          
          return tool;
        } else if (data.raw_content) {
          try {
            const parsed = JSON.parse(data.raw_content);
            return { ...parsed, signature: data.signature, signatures: data.signatures };
          } catch {
            // Fallback to YAML parsing for raw_content
            return this.parseToolData({ content: data.raw_content });
          }
        } else {
          // Map database fields to tool format
          return {
            name: data.name,
            description: data.description,
            command: data.command,
            timeout: data.timeout,
            tags: data.tags,
            license: data.spdx_license,
            outputSchema: data.output_schema,
            enact: data.protocol_version,
            version: data.version,
            inputSchema: data.input_schema,
            examples: data.examples,
            annotations: data.annotations,
            env: data.env_vars,
            resources: data.resources,
            signature: data.signature,
            signatures: data.signatures,
            namespace: data.namespace
          };
        }
      }
    };

    // Create an instance for each test
    core = new EnactCore({
      apiUrl: 'https://test-api.example.com',
      supabaseUrl: 'https://test-supabase.example.com'
    });
  });

  afterEach(() => {
    mockConsole.restore();
  });

  describe('searchTools method', () => {
    test('should search and fetch tool details', async () => {
      // Mock API responses
      mockApiClient.searchTools.mockResolvedValue(sampleApiSearchResults);
      mockApiClient.getTool.mockResolvedValue(sampleToolResponse);

      const options: ToolSearchOptions = {
        query: 'text processing',
        limit: 10,
        tags: ['text'],
        author: 'test-author'
      };

      const results = await core.searchTools(options);

      // Verify API calls
      expect(mockApiClient.searchTools).toHaveBeenCalledWith({
        query: 'text processing',
        limit: 10,
        tags: ['text']
      });

      // Should fetch each tool found in search
      expect(mockApiClient.getTool).toHaveBeenCalledWith('text/slugify');
      expect(mockApiClient.getTool).toHaveBeenCalledWith('file/converter');
      expect(mockApiClient.getTool).toHaveBeenCalledWith('ai/summarizer');

      // Should return parsed tools
      expect(results).toBeArray();
      expect(results).toHaveLength(3);
      expect(results[0].name).toBe('text/slugify');
    }, { timeout: 10000 });

    test('should handle search with minimal options', async () => {
      mockApiClient.searchTools.mockResolvedValue([{ name: 'simple/tool' }]);
      mockApiClient.getTool.mockResolvedValue({
        name: 'simple/tool',
        description: 'A simple tool',
        command: 'simple'
      });

      const results = await core.searchTools({ query: 'simple' });

      expect(mockApiClient.searchTools).toHaveBeenCalledWith({
        query: 'simple',
        limit: undefined,
        tags: undefined
      });

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('simple/tool');
    }, { timeout: 10000 });

    test('should handle empty search results', async () => {
      mockApiClient.searchTools.mockResolvedValue([]);

      const results = await core.searchTools({ query: 'nonexistent' });

      expect(results).toBeArray();
      expect(results).toHaveLength(0);
    }, { timeout: 10000 });

    test('should handle API search errors', async () => {
      mockApiClient.searchTools.mockRejectedValue(new Error('API Error'));

      await expect(core.searchTools({ query: 'test' })).rejects.toThrow('Search failed: API Error');
    }, { timeout: 10000 });

    test('should handle failed tool fetches gracefully', async () => {
      mockApiClient.searchTools.mockResolvedValue([
        { name: 'good/tool' },
        { name: 'bad/tool' },
        { name: 'another/good/tool' }
      ]);

      // Mock successful and failed tool fetches
      mockApiClient.getTool
        .mockResolvedValueOnce({ name: 'good/tool', command: 'good' })
        .mockRejectedValueOnce(new Error('Tool not found'))
        .mockResolvedValueOnce({ name: 'another/good/tool', command: 'another' });

      const results = await core.searchTools({ query: 'test' });

      // Should only return successfully fetched tools
      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('good/tool');
      expect(results[1].name).toBe('another/good/tool');
    }, { timeout: 10000 });
  });

  describe('getToolByName method', () => {
    test('should fetch and parse tool from content field', async () => {
      const toolResponse = {
        name: 'test/tool',
        content: `name: test/tool
description: Test tool
command: test
version: 1.0.0`
      };

      mockApiClient.getTool.mockResolvedValue(toolResponse);

      const result = await core.getToolByName('test/tool');

      expect(mockApiClient.getTool).toHaveBeenCalledWith('test/tool');
      expect(result).toBeTruthy();
      expect(result!.name).toBe('test/tool');
      expect(result!.description).toBe('Test tool');
      expect(result!.command).toBe('test');
      expect(result!.version).toBe('1.0.0');
    }, { timeout: 10000 });

    test('should fetch and parse tool from raw_content field', async () => {
      const toolResponse = {
        name: 'test/tool',
        raw_content: JSON.stringify({
          name: 'test/tool',
          description: 'Test tool from raw content',
          command: 'test-raw'
        }),
        signature: {
          algorithm: 'RS256',
          type: 'author',
          signer: 'test@example.com',
          created: '2025-06-21T00:00:00Z',
          value: 'some-signature'
        },
        signatures: { 
          sig1: { 
            algorithm: 'RS256',
            type: 'author',
            signer: 'test@example.com',
            created: '2025-06-21T00:00:00Z',
            value: 'abc'
          }
        }
      };

      mockApiClient.getTool.mockResolvedValue(toolResponse);

      const result = await core.getToolByName('test/tool');

      expect(result).toBeTruthy();
      expect(result!.name).toBe('test/tool');
      expect(result!.description).toBe('Test tool from raw content');
      expect(result!.signature).toEqual({
        algorithm: 'RS256',
        type: 'author',
        signer: 'test@example.com',
        created: '2025-06-21T00:00:00Z',
        value: 'some-signature'
      });
      expect(result!.signatures).toEqual({ 
        sig1: { 
          algorithm: 'RS256',
          type: 'author',
          signer: 'test@example.com',
          created: '2025-06-21T00:00:00Z',
          value: 'abc'
        }
      });
    }, { timeout: 10000 });

    test('should map database fields to tool format', async () => {
      const toolResponse = {
        name: 'mapped/tool',
        description: 'Mapped tool',
        command: 'mapped',
        timeout: '60s',
        tags: ['mapped', 'test'],
        spdx_license: 'MIT',
        output_schema: { type: 'string' },
        protocol_version: '1.1.0',
        version: '2.0.0',
        input_schema: { type: 'object' },
        examples: [{ input: 'test' }],
        annotations: { category: 'utility' },
        env_vars: { VAR1: { description: 'Test variable', source: 'env', required: false } },
        resources: { memory: '512MB' },
        signature: 'mapped-sig',
        signatures: { sig1: { value: 'xyz' } },
        namespace: 'mapped'
      };

      mockApiClient.getTool.mockResolvedValue(toolResponse);

      const result = await core.getToolByName('mapped/tool');

      expect(result).toBeTruthy();
      expect(result!.name).toBe('mapped/tool');
      expect(result!.license).toBe('MIT');
      expect(result!.outputSchema).toEqual({ type: 'string' });
      expect(result!.enact).toBe('1.1.0');
      expect(result!.inputSchema).toEqual({ type: 'object' });
      expect(result!.env).toEqual({ VAR1: { description: 'Test variable', source: 'env', required: false } });
    }, { timeout: 10000 });

    test('should return null for 404 errors', async () => {
      const error404 = new Error('Not found');
      (error404 as any).message = 'Tool not found (404)';
      mockApiClient.getTool.mockRejectedValue(error404);

      const result = await core.getToolByName('nonexistent/tool');

      expect(result).toBeNull();
    }, { timeout: 10000 });

    test('should throw for other errors', async () => {
      mockApiClient.getTool.mockRejectedValue(new Error('Server error'));

      await expect(core.getToolByName('error/tool')).rejects.toThrow('Server error');
    }, { timeout: 10000 });

    test('should handle tool with version', async () => {
      const toolResponse = {
        name: 'versioned/tool',
        version: '2.1.0',
        command: 'versioned'
      };

      mockApiClient.getTool.mockResolvedValue(toolResponse);

      const result = await core.getToolByName('versioned/tool', '2.1.0');

      expect(mockApiClient.getTool).toHaveBeenCalledWith('versioned/tool');
      expect(result!.version).toBe('2.1.0');
    }, { timeout: 10000 });
  });

  describe('Search options validation', () => {
    test('should handle all search option combinations', async () => {
      mockApiClient.searchTools.mockResolvedValue([]);

      const testCases: ToolSearchOptions[] = [
        { query: 'test' },
        { query: 'test', limit: 5 },
        { query: 'test', tags: ['utility'] },
        { query: 'test', author: 'testuser' },
        { query: 'test', format: 'json' as any },
        { query: 'test', limit: 10, tags: ['cli', 'text'], author: 'author', format: 'table' as any }
      ];

      for (const options of testCases) {
        mockApiClient.searchTools.mockClear();
        await core.searchTools(options);
        expect(mockApiClient.searchTools).toHaveBeenCalledTimes(1);
      }
    }, { timeout: 10000 });

    test('should pass through search parameters correctly', async () => {
      mockApiClient.searchTools.mockResolvedValue([]);

      await core.searchTools({
        query: 'complex search',
        limit: 15,
        tags: ['tag1', 'tag2'],
        author: 'complex-author'
      });

      expect(mockApiClient.searchTools).toHaveBeenCalledWith({
        query: 'complex search',
        limit: 15,
        tags: ['tag1', 'tag2']
      });
    }, { timeout: 10000 });
  });

  describe('YAML and JSON parsing', () => {
    test('should parse YAML tool definitions', async () => {
      const yamlContent = `name: yaml/tool
description: A YAML tool
command: yaml-cmd
tags:
  - yaml
  - parsing
version: 1.0.0`;

      mockApiClient.getTool.mockResolvedValue({
        name: 'yaml/tool',
        content: yamlContent
      });

      const result = await core.getToolByName('yaml/tool');

      expect(result!.name).toBe('yaml/tool');
      expect(result!.description).toBe('A YAML tool');
      expect(result!.tags).toEqual(['yaml', 'parsing']);
      expect(result!.version).toBe('1.0.0');
    }, { timeout: 10000 });

    test('should parse JSON tool definitions from raw_content', async () => {
      const jsonTool = {
        name: 'json/tool',
        description: 'A JSON tool',
        command: 'json-cmd',
        tags: ['json'],
        inputSchema: {
          type: 'object',
          properties: {
            data: { type: 'string' }
          }
        }
      };

      mockApiClient.getTool.mockResolvedValue({
        name: 'json/tool',
        raw_content: JSON.stringify(jsonTool)
      });

      const result = await core.getToolByName('json/tool');

      expect(result!.name).toBe('json/tool');
      expect(result!.tags).toEqual(['json']);
      expect(result!.inputSchema?.properties?.data?.type).toBe('string');
    }, { timeout: 10000 });

    test('should fallback to YAML parsing for raw_content', async () => {
      const yamlContent = `name: fallback/tool
description: Fallback YAML tool
command: fallback`;

      mockApiClient.getTool.mockResolvedValue({
        name: 'fallback/tool',
        raw_content: yamlContent
      });

      const result = await core.getToolByName('fallback/tool');

      expect(result!.name).toBe('fallback/tool');
      expect(result!.description).toBe('Fallback YAML tool');
    }, { timeout: 10000 });
  });
});

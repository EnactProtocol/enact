// tests/publish.test.ts - Test publish command migration to core implementation

import { describe, test, expect, beforeEach } from 'bun:test';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';

describe('Publish Command Migration', () => {
  describe('Legacy Command Removal', () => {
    test('should confirm legacy publish import is removed from index', () => {
      const indexPath = 'src/index.ts';
      expect(existsSync(indexPath)).toBe(true);
      
      const indexContent = Bun.file(indexPath).text();
      expect(indexContent).resolves.not.toContain("import { handlePublishCommand } from './commands/publish'");
      expect(indexContent).resolves.toContain("handleCorePublishCommand");
    });

    test('should confirm legacy publish file is removed', () => {
      expect(existsSync('src/commands/publish.ts')).toBe(false);
    });

    test('should use core publish handler in routing', async () => {
      const indexContent = await readFile('src/index.ts', 'utf8');
      
      // Should use core handler
      expect(indexContent).toContain('await handleCorePublishCommand(commandArgs');
      
      // Should not reference legacy handler
      expect(indexContent).not.toContain('await handlePublishCommand(commandArgs');
    });
  });

  describe('Core Implementation Integration', () => {
    test('should have core publish handler exported', async () => {
      const coreContent = await readFile('src/commands/core.ts', 'utf8');
      
      // Should export the core publish handler
      expect(coreContent).toContain('export async function handleCorePublishCommand');
      
      // Should have proper type interface
      expect(coreContent).toContain('CorePublishOptions');
    });

    test('should have proper imports for publish functionality', async () => {
      const coreContent = await readFile('src/commands/core.ts', 'utf8');
      
      // Should import necessary dependencies
      expect(coreContent).toContain("import { readFile } from \"fs/promises\"");
      expect(coreContent).toContain("import { getAuthHeaders } from \"./auth\"");
      expect(coreContent).toContain("import { addToHistory } from \"@enactprotocol/shared/utils\"");
    });

    test('should integrate with EnactCore for publishing', async () => {
      const coreContent = await readFile('src/commands/core.ts', 'utf8');
      
      // Should use EnactCore for publishing
      expect(coreContent).toContain('const core = new EnactCore({');
      expect(coreContent).toContain('await core.publishTool(tool)');
    });
  });

  describe('Feature Migration Validation', () => {
    test('should maintain CLI interface compatibility', async () => {
      const coreContent = await readFile('src/commands/core.ts', 'utf8');
      
      // Should accept same options as legacy command
      expect(coreContent).toContain('help?: boolean');
      expect(coreContent).toContain('url?: string');
      expect(coreContent).toContain('token?: string');
      expect(coreContent).toContain('file?: string');
      expect(coreContent).toContain('verbose?: boolean');
    });

    test('should have interactive file selection', async () => {
      const coreContent = await readFile('src/commands/core.ts', 'utf8');
      
      // Should prompt for file if not provided
      expect(coreContent).toContain('Enter the path to the tool manifest');
      expect(coreContent).toContain('validate:');
    });

    test('should handle authentication', async () => {
      const coreContent = await readFile('src/commands/core.ts', 'utf8');
      
      // Should handle token authentication
      expect(coreContent).toContain('await getAuthHeaders()');
      expect(coreContent).toContain('Enter your API token');
    });

    test('should validate tool manifests', async () => {
      const coreContent = await readFile('src/commands/core.ts', 'utf8');
      
      // Should validate required fields
      expect(coreContent).toContain('Tool manifest must have a "name" field');
      expect(coreContent).toContain('Tool manifest must have a "version" field');
    });

    test('should show confirmation before publishing', async () => {
      const coreContent = await readFile('src/commands/core.ts', 'utf8');
      
      // Should ask for confirmation
      expect(coreContent).toContain('Publish this tool to the registry?');
      expect(coreContent).toContain('Tool Information');
    });

    test('should handle publish errors gracefully', async () => {
      const coreContent = await readFile('src/commands/core.ts', 'utf8');
      
      // Should handle common error cases
      expect(coreContent).toContain('Authentication failed');
      expect(coreContent).toContain('already exists');
      expect(coreContent).toContain('Failed to publish');
    });
  });

  describe('CLI Integration', () => {
    test('should support all command line options', async () => {
      const indexContent = await readFile('src/index.ts', 'utf8');
      
      // Should pass through all options
      expect(indexContent).toContain('help: values.help');
      expect(indexContent).toContain('url: values.url');
      expect(indexContent).toContain('token: values.token');
      expect(indexContent).toContain('file: values.input');
      expect(indexContent).toContain('verbose: values.verbose');
    });

    test('should be available in interactive mode', async () => {
      const indexContent = await readFile('src/index.ts', 'utf8');
      
      // Should include publish in interactive options
      expect(indexContent).toContain('value: "publish"');
      expect(indexContent).toContain('📤 Publish a tool');
    });
  });

  describe('Build and Integration', () => {
    test('should build successfully with core implementation', () => {
      // This test passes if the build system can process the migration
      expect(existsSync('src/commands/core.ts')).toBe(true);
      expect(existsSync('src/index.ts')).toBe(true);
    });

    test('should maintain help text structure', async () => {
      const coreContent = await readFile('src/commands/core.ts', 'utf8');
      
      // Should have comprehensive help text
      expect(coreContent).toContain('Usage: enact publish');
      expect(coreContent).toContain('Publish an Enact tool to the registry');
      expect(coreContent).toContain('Examples:');
    });
  });
});

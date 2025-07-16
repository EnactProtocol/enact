import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll } from 'bun:test';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { parse, stringify } from 'yaml';

import {
  signTool,
  generateKeyPair,
  addTrustedKey,
  type EnactTool,
} from '../src/security/sign';

describe('Canonical JSON Consistency', () => {
  let tempDir: string;
  let testKeysDir: string;
  let privateKeyPath: string;
  let publicKeyPath: string;
  let originalHome: string | undefined;

  beforeAll(async () => {
    // Create temporary directory for test keys
    tempDir = await fs.mkdtemp(join(tmpdir(), 'enact-canonical-test-'));
    testKeysDir = join(tempDir, 'keys');
    await fs.mkdir(testKeysDir, { recursive: true });

    // Override HOME environment variable to point to our test directory
    originalHome = process.env.HOME;
    process.env.HOME = tempDir;

    // Generate test key pair
    const keyPair = generateKeyPair(testKeysDir, 'test');
    privateKeyPath = keyPair.privateKeyPath;
    publicKeyPath = keyPair.publicKeyPath;

    // Create a trusted keys directory and add our test key
    const trustedKeysDir = join(tempDir, '.enact', 'trusted-keys');
    await fs.mkdir(trustedKeysDir, { recursive: true });
    addTrustedKey(publicKeyPath, 'test-trusted.pem');
  });

  afterEach(() => {
    delete process.env.DEBUG;
    delete process.env.NODE_ENV;
  });

  afterAll(async () => {
    // Restore original HOME
    if (originalHome !== undefined) {
      process.env.HOME = originalHome;
    } else {
      delete process.env.HOME;
    }

    // Clean up temporary directory
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('Field Ordering Independence', () => {
    test('should produce identical canonical JSON regardless of field order', async () => {
      // Tool with fields in one order
      const tool1: EnactTool = {
        name: 'test/ordering',
        description: 'Test field ordering',
        command: 'echo "test"',
        enact: '1.0.0',
        version: '1.0.0',
        timeout: '30s',
        from: 'alpine:latest'
      };

      // Same tool with fields in different order
      const tool2: EnactTool = {
        from: 'alpine:latest',
        timeout: '30s',
        version: '1.0.0',
        enact: '1.0.0',
        command: 'echo "test"',
        description: 'Test field ordering',
        name: 'test/ordering'
      };
      
      const toolPath1 = join(tempDir, 'tool1.yaml');
      const toolPath2 = join(tempDir, 'tool2.yaml');
      
      await fs.writeFile(toolPath1, stringify(tool1));
      await fs.writeFile(toolPath2, stringify(tool2));

      // Capture console output to check canonical JSON
      const messages: string[] = [];
      
      const originalConsoleError = console.error;
      console.error = (...args: any[]) => {
        messages.push(args.join(' '));
      };

      try {
        await signTool(toolPath1, privateKeyPath, publicKeyPath, { id: 'test-signer' });
        await signTool(toolPath2, privateKeyPath, publicKeyPath, { id: 'test-signer' });

        // Find canonical JSON messages
        const canonicalMessages = messages.filter(msg => 
          msg.includes('Canonical JSON (webapp format):')
        );
        
        expect(canonicalMessages).toHaveLength(2);
        
        const canonicalJson1 = canonicalMessages[0].split('Canonical JSON (webapp format): ')[1];
        const canonicalJson2 = canonicalMessages[1].split('Canonical JSON (webapp format): ')[1];

        // Both should produce identical canonical JSON
        expect(canonicalJson1).toBe(canonicalJson2);
        expect(canonicalJson1).not.toBe('');
        
        // Canonical JSON should be deterministic (sorted keys)
        const parsed = JSON.parse(canonicalJson1);
        const keys = Object.keys(parsed);
        const sortedKeys = [...keys].sort();
        expect(keys).toEqual(sortedKeys);
        
      } finally {
        console.error = originalConsoleError;
      }
    });

    test('should exclude empty objects and arrays from canonical JSON', async () => {
      const toolWithEmptyFields: EnactTool = {
        name: 'test/empty-fields',
        description: 'Test tool with empty fields',
        command: 'echo "test"',
        enact: '1.0.0',
        // These should be excluded from canonical JSON when empty
        annotations: {},           // Empty object
        env: {},                   // Empty object  
        inputSchema: {},           // Empty object
        // Non-empty field should be included
        version: '1.0.0'
      };

      const toolWithoutEmptyFields: EnactTool = {
        name: 'test/empty-fields',
        description: 'Test tool with empty fields',
        command: 'echo "test"',
        enact: '1.0.0',
        version: '1.0.0'
        // No empty fields
      };
      
      const toolPath1 = join(tempDir, 'tool-with-empty.yaml');
      const toolPath2 = join(tempDir, 'tool-without-empty.yaml');
      
      await fs.writeFile(toolPath1, stringify(toolWithEmptyFields));
      await fs.writeFile(toolPath2, stringify(toolWithoutEmptyFields));

      const messages: string[] = [];
      
      const originalConsoleError = console.error;
      console.error = (...args: any[]) => {
        messages.push(args.join(' '));
      };

      try {
        await signTool(toolPath1, privateKeyPath, publicKeyPath, { id: 'test-signer' });
        await signTool(toolPath2, privateKeyPath, publicKeyPath, { id: 'test-signer' });

        // Find canonical JSON messages
        const canonicalMessages = messages.filter(msg => 
          msg.includes('Canonical JSON (webapp format):')
        );
        
        expect(canonicalMessages).toHaveLength(2);
        
        const canonicalJson1 = canonicalMessages[0].split('Canonical JSON (webapp format): ')[1];
        const canonicalJson2 = canonicalMessages[1].split('Canonical JSON (webapp format): ')[1];

        // Both should produce identical canonical JSON (empty objects excluded)
        expect(canonicalJson1).toBe(canonicalJson2);
        
        // Canonical JSON should not contain empty objects
        expect(canonicalJson1).not.toContain('{}');
        expect(canonicalJson1).not.toContain('"annotations":{}');
        expect(canonicalJson1).not.toContain('"env":{}');
        expect(canonicalJson1).not.toContain('"inputSchema":{}');
        
      } finally {
        console.error = originalConsoleError;
      }
    });

    test('should handle deeply nested field ordering', async () => {
      const tool1: EnactTool = {
        name: 'test/nested',
        description: 'Test nested ordering',
        command: 'echo "test"',
        inputSchema: {
          type: 'object',
          properties: {
            b: { type: 'string' },
            a: { type: 'number' }
          }
        },
        annotations: {
          readOnlyHint: true,
          destructiveHint: false
        }
      };

      const tool2: EnactTool = {
        annotations: {
          destructiveHint: false,
          readOnlyHint: true
        },
        inputSchema: {
          properties: {
            a: { type: 'number' },
            b: { type: 'string' }
          },
          type: 'object'
        },
        command: 'echo "test"',
        description: 'Test nested ordering',
        name: 'test/nested'
      };

      const toolPath1 = join(tempDir, 'nested1.yaml');
      const toolPath2 = join(tempDir, 'nested2.yaml');
      
      await fs.writeFile(toolPath1, stringify(tool1));
      await fs.writeFile(toolPath2, stringify(tool2));

      const messages: string[] = [];
      
      const originalConsoleError = console.error;
      console.error = (...args: any[]) => {
        messages.push(args.join(' '));
      };

      try {
        await signTool(toolPath1, privateKeyPath, publicKeyPath, { id: 'test-signer' });
        await signTool(toolPath2, privateKeyPath, publicKeyPath, { id: 'test-signer' });

        // Find canonical JSON messages
        const canonicalMessages = messages.filter(msg => 
          msg.includes('Canonical JSON (webapp format):')
        );
        
        expect(canonicalMessages).toHaveLength(2);
        
        const canonicalJson1 = canonicalMessages[0].split('Canonical JSON (webapp format): ')[1];
        const canonicalJson2 = canonicalMessages[1].split('Canonical JSON (webapp format): ')[1];

        // Should produce identical canonical JSON despite nested field reordering
        expect(canonicalJson1).toBe(canonicalJson2);
        
      } finally {
        console.error = originalConsoleError;
      }
    });
  });

  describe('Empty Value Handling', () => {
    test('should exclude various empty values consistently', async () => {
      const toolWithVariousEmptyValues: EnactTool = {
        name: 'test/empty-values',
        description: 'Test various empty values',
        command: 'echo "test"',
        // These should all be excluded
        annotations: {},
        env: {},
        inputSchema: null as any,
        version: undefined as any,
        timeout: '',  // Empty string
      };

      const cleanTool: EnactTool = {
        name: 'test/empty-values',
        description: 'Test various empty values', 
        command: 'echo "test"'
      };

      const toolPath1 = join(tempDir, 'empty-values.yaml');
      const toolPath2 = join(tempDir, 'clean.yaml');
      
      await fs.writeFile(toolPath1, stringify(toolWithVariousEmptyValues));
      await fs.writeFile(toolPath2, stringify(cleanTool));

      const messages: string[] = [];
      
      const originalConsoleError = console.error;
      console.error = (...args: any[]) => {
        messages.push(args.join(' '));
      };

      try {
        await signTool(toolPath1, privateKeyPath, publicKeyPath, { id: 'test-signer' });
        await signTool(toolPath2, privateKeyPath, publicKeyPath, { id: 'test-signer' });

        // Find canonical JSON messages
        const canonicalMessages = messages.filter(msg => 
          msg.includes('Canonical JSON (webapp format):')
        );
        
        expect(canonicalMessages).toHaveLength(2);
        
        const canonicalJson1 = canonicalMessages[0].split('Canonical JSON (webapp format): ')[1];
        const canonicalJson2 = canonicalMessages[1].split('Canonical JSON (webapp format): ')[1];

        // Should produce identical canonical JSON (all empty values excluded)
        expect(canonicalJson1).toBe(canonicalJson2);
        
      } finally {
        console.error = originalConsoleError;
      }
    });
  });
});
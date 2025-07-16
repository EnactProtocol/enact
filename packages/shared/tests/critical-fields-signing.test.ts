import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll } from 'bun:test';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { parse, stringify } from 'yaml';
import * as crypto from 'crypto';

import {
  verifyTool,
  signTool,
  generateKeyPair,
  addTrustedKey,
  type EnactTool,
} from '../src/security/sign';

describe('Critical Fields Only Signing', () => {
  let tempDir: string;
  let testKeysDir: string;
  let privateKeyPath: string;
  let publicKeyPath: string;
  let originalHome: string | undefined;

  beforeAll(async () => {
    // Create temporary directory for test keys
    tempDir = await fs.mkdtemp(join(tmpdir(), 'enact-critical-fields-test-'));
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
    // Clean up any environment variables that might affect tests
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

  describe('Critical Fields Inclusion', () => {
    test('should only sign critical security fields', async () => {
      const toolWithManyFields: EnactTool = {
        // Critical fields (should be signed)
        enact: '1.0.0',
        name: 'test/critical-fields',
        description: 'Test tool for critical fields',
        command: 'echo "test"',
        version: '1.0.0',
        from: 'node:18-alpine',
        timeout: '30s',
        inputSchema: {
          type: 'object',
          properties: { input: { type: 'string' } }
        },
        annotations: {
          readOnlyHint: true,
          destructiveHint: false
        },
        env: {
          TEST_VAR: {
            description: 'Test variable',
            source: 'Environment',
            required: true
          }
        },

        // Non-critical fields (should NOT affect signature)
        tags: ['test', 'example'],
        license: 'MIT',
        authors: [{ name: 'Test Author', email: 'test@example.com' }],
        examples: [{ input: { test: 'value' }, output: 'result' }],
        outputSchema: { type: 'string' },
        doc: 'This is documentation',
        resources: { memory: '512Mi', cpu: '0.5' }
      };

      // Create temporary tool file
      const toolPath = join(tempDir, 'test-tool-with-many-fields.yaml');
      await fs.writeFile(toolPath, stringify(toolWithManyFields));

      // Sign the tool
      const signedYaml = await signTool(
        toolPath,
        privateKeyPath,
        publicKeyPath,
        { id: 'test-signer', role: 'author' }
      );

      const signedTool = parse(signedYaml) as EnactTool;

      // Verify the original tool
      const result1 = await verifyTool(signedTool);
      expect(result1.isValid).toBe(true);

      // Create the same tool but without non-critical fields
      const toolWithOnlyCriticalFields: EnactTool = {
        enact: toolWithManyFields.enact,
        name: toolWithManyFields.name,
        description: toolWithManyFields.description,
        command: toolWithManyFields.command,
        version: toolWithManyFields.version,
        from: toolWithManyFields.from,
        timeout: toolWithManyFields.timeout,
        inputSchema: toolWithManyFields.inputSchema,
        annotations: toolWithManyFields.annotations,
        env: toolWithManyFields.env,
        signatures: signedTool.signatures // Copy the signature
      };

      // Verification should still work with only critical fields
      const result2 = await verifyTool(toolWithOnlyCriticalFields);
      expect(result2.isValid).toBe(true);
    });

    test('should not be affected by changes to non-critical fields', async () => {
      const baseTool: EnactTool = {
        enact: '1.0.0',
        name: 'test/non-critical-changes',
        description: 'Test tool for non-critical field changes',
        command: 'echo "test"',
        tags: ['original', 'test'],
        license: 'MIT',
        authors: [{ name: 'Original Author' }]
      };

      // Create and sign the tool
      const toolPath = join(tempDir, 'test-tool-base.yaml');
      await fs.writeFile(toolPath, stringify(baseTool));

      const signedYaml = await signTool(
        toolPath,
        privateKeyPath,
        publicKeyPath,
        { id: 'test-signer', role: 'author' }
      );

      const signedTool = parse(signedYaml) as EnactTool;

      // Verify original tool
      const result1 = await verifyTool(signedTool);
      expect(result1.isValid).toBe(true);

      // Change non-critical fields
      const modifiedTool: EnactTool = {
        ...signedTool,
        tags: ['modified', 'different'], // Changed
        license: 'Apache-2.0',             // Changed
        authors: [{ name: 'Different Author', email: 'new@example.com' }], // Changed
        outputSchema: { type: 'string' },  // Added
        doc: 'Added documentation',        // Added
        examples: [{ input: {}, output: 'result' }] // Added
      };

      // Verification should still work because only critical fields are signed
      const result2 = await verifyTool(modifiedTool);
      expect(result2.isValid).toBe(true);
      expect(result2.validSignatures).toBe(1);
    });

    test('should be affected by changes to critical fields', async () => {
      const baseTool: EnactTool = {
        enact: '1.0.0',
        name: 'test/critical-changes',
        description: 'Test tool for critical field changes',
        command: 'echo "test"',
        version: '1.0.0'
      };

      // Create and sign the tool
      const toolPath = join(tempDir, 'test-tool-critical.yaml');
      await fs.writeFile(toolPath, stringify(baseTool));

      const signedYaml = await signTool(
        toolPath,
        privateKeyPath,
        publicKeyPath,
        { id: 'test-signer', role: 'author' }
      );

      const signedTool = parse(signedYaml) as EnactTool;

      // Verify original tool
      const result1 = await verifyTool(signedTool);
      expect(result1.isValid).toBe(true);

      // Test changing each critical field
      const criticalFieldTests = [
        { field: 'name', newValue: 'test/different-name' },
        { field: 'description', newValue: 'Different description' },
        { field: 'command', newValue: 'echo "different"' },
        { field: 'version', newValue: '2.0.0' },
        { field: 'enact', newValue: '2.0.0' }
      ];

      for (const { field, newValue } of criticalFieldTests) {
        const modifiedTool = { ...signedTool, [field]: newValue };
        const result = await verifyTool(modifiedTool);
        expect(result.isValid).toBe(false);
        expect(result.validSignatures).toBe(0);
      }
    });
  });

  describe('Field Format Compatibility', () => {
    test('should handle both underscore and camelCase field formats', async () => {
      // Tool with underscore format (legacy)
      const underscoreFormatTool = {
        enact: '1.0.0',
        name: 'test/format-compatibility',
        description: 'Test tool for format compatibility',
        command: 'echo "test"',
        input_schema: {  // underscore format
          type: 'object',
          properties: { input: { type: 'string' } }
        },
        env_vars: {      // underscore format
          TEST_VAR: {
            description: 'Test variable',
            source: 'Environment',
            required: true
          }
        }
      };

      // Tool with camelCase format (modern)
      const camelCaseFormatTool = {
        enact: '1.0.0',
        name: 'test/format-compatibility',
        description: 'Test tool for format compatibility',
        command: 'echo "test"',
        inputSchema: {   // camelCase format
          type: 'object',
          properties: { input: { type: 'string' } }
        },
        env: {           // camelCase format
          TEST_VAR: {
            description: 'Test variable',
            source: 'Environment',
            required: true
          }
        }
      };

      // Sign tool with underscore format
      const underscoreToolPath = join(tempDir, 'underscore-tool.yaml');
      await fs.writeFile(underscoreToolPath, stringify(underscoreFormatTool));

      const signedUnderscoreYaml = await signTool(
        underscoreToolPath,
        privateKeyPath,
        publicKeyPath,
        { id: 'test-signer', role: 'author' }
      );

      // Sign tool with camelCase format  
      const camelCaseToolPath = join(tempDir, 'camelcase-tool.yaml');
      await fs.writeFile(camelCaseToolPath, stringify(camelCaseFormatTool));

      const signedCamelCaseYaml = await signTool(
        camelCaseToolPath,
        privateKeyPath,
        publicKeyPath,
        { id: 'test-signer', role: 'author' }
      );

      const signedUnderscoreTool = parse(signedUnderscoreYaml) as EnactTool;
      const signedCamelCaseTool = parse(signedCamelCaseYaml) as EnactTool;

      // Both should verify successfully
      const underscoreResult = await verifyTool(signedUnderscoreTool);
      expect(underscoreResult.isValid).toBe(true);

      const camelCaseResult = await verifyTool(signedCamelCaseTool);
      expect(camelCaseResult.isValid).toBe(true);

      // Cross-verification: underscore signature should work with camelCase data
      const crossVerifyTool = {
        ...camelCaseFormatTool,
        signatures: signedUnderscoreTool.signatures
      };

      const crossResult = await verifyTool(crossVerifyTool);
      expect(crossResult.isValid).toBe(true);
    });
  });

  describe('Field Normalization', () => {
    test('should normalize different field name formats correctly', async () => {
      const toolWithMixedFormats: EnactTool = {
        enact: '1.0.0',
        protocol_version: '1.0.0', // Should be normalized to enact
        name: 'test/normalization',
        description: 'Test normalization',
        command: 'echo "test"',
        input_schema: { type: 'object' }, // Should be normalized to inputSchema
        env_vars: { TEST: { description: 'test', source: 'env', required: true } } // Should be normalized to env
      };

      const toolPath = join(tempDir, 'mixed-formats-tool.yaml');
      await fs.writeFile(toolPath, stringify(toolWithMixedFormats));

      const signedYaml = await signTool(
        toolPath,
        privateKeyPath,
        publicKeyPath,
        { id: 'test-signer', role: 'author' }
      );

      const signedTool = parse(signedYaml) as EnactTool;

      // Should verify successfully
      const result = await verifyTool(signedTool);
      expect(result.isValid).toBe(true);

      // Should still verify if we convert to standard format
      const normalizedTool: EnactTool = {
        enact: toolWithMixedFormats.enact,
        name: toolWithMixedFormats.name,
        description: toolWithMixedFormats.description,
        command: toolWithMixedFormats.command,
        inputSchema: toolWithMixedFormats.input_schema,
        env: toolWithMixedFormats.env_vars,
        signatures: signedTool.signatures
      };

      const normalizedResult = await verifyTool(normalizedTool);
      expect(normalizedResult.isValid).toBe(true);
    });

    test('should handle tools with only required fields', async () => {
      const minimalTool: EnactTool = {
        name: 'test/minimal',
        description: 'Minimal test tool',
        command: 'echo "minimal"'
      };

      const toolPath = join(tempDir, 'minimal-tool.yaml');
      await fs.writeFile(toolPath, stringify(minimalTool));

      const signedYaml = await signTool(
        toolPath,
        privateKeyPath,
        publicKeyPath,
        { id: 'test-signer', role: 'author' }
      );

      const signedTool = parse(signedYaml) as EnactTool;

      // Should verify successfully even with minimal fields
      const result = await verifyTool(signedTool);
      expect(result.isValid).toBe(true);
      expect(result.validSignatures).toBe(1);
    });

    test('should handle tools with all critical fields present', async () => {
      const fullTool: EnactTool = {
        enact: '1.0.0',
        name: 'test/full-critical',
        description: 'Tool with all critical fields',
        command: 'echo "full test"',
        from: 'alpine:latest',
        env: {
          API_KEY: {
            description: 'API key for service',
            source: 'Environment variable',
            required: true
          }
        },
        timeout: '60s',
        inputSchema: {
          type: 'object',
          properties: {
            input: { type: 'string', description: 'Input data' }
          },
          required: ['input']
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          openWorldHint: true,
          idempotentHint: false
        },
        version: '2.1.0'
      };

      const toolPath = join(tempDir, 'full-critical-tool.yaml');
      await fs.writeFile(toolPath, stringify(fullTool));

      const signedYaml = await signTool(
        toolPath,
        privateKeyPath,
        publicKeyPath,
        { id: 'test-signer', role: 'author' }
      );

      const signedTool = parse(signedYaml) as EnactTool;

      // Should verify successfully with all critical fields
      const result = await verifyTool(signedTool);
      expect(result.isValid).toBe(true);
      expect(result.validSignatures).toBe(1);
    });
  });

  describe('Signature Integrity', () => {
    test('should produce consistent signatures for equivalent tools', async () => {
      const tool1: EnactTool = {
        enact: '1.0.0',
        name: 'test/consistency',
        description: 'Test consistency',
        command: 'echo "test"',
        version: '1.0.0',
        // Extra non-critical fields
        tags: ['test'],
        license: 'MIT'
      };

      const tool2: EnactTool = {
        enact: '1.0.0',
        name: 'test/consistency',
        description: 'Test consistency',
        command: 'echo "test"',
        version: '1.0.0',
        // Different non-critical fields
        authors: [{ name: 'Test Author' }],
        doc: 'Documentation'
      };

      // Sign both tools
      const toolPath1 = join(tempDir, 'consistency-tool1.yaml');
      const toolPath2 = join(tempDir, 'consistency-tool2.yaml');
      
      await fs.writeFile(toolPath1, stringify(tool1));
      await fs.writeFile(toolPath2, stringify(tool2));

      const signedYaml1 = await signTool(
        toolPath1,
        privateKeyPath,
        publicKeyPath,
        { id: 'test-signer', role: 'author' }
      );

      const signedYaml2 = await signTool(
        toolPath2,
        privateKeyPath,
        publicKeyPath,
        { id: 'test-signer', role: 'author' }
      );

      const signedTool1 = parse(signedYaml1) as EnactTool;
      const signedTool2 = parse(signedYaml2) as EnactTool;

      // Both should verify
      const result1 = await verifyTool(signedTool1);
      const result2 = await verifyTool(signedTool2);

      expect(result1.isValid).toBe(true);
      expect(result2.isValid).toBe(true);

      // Cross-verification should work (signature from tool1 should work on tool2's critical fields)
      const crossTool = {
        ...tool2,
        signatures: signedTool1.signatures
      };

      const crossResult = await verifyTool(crossTool);
      expect(crossResult.isValid).toBe(true);
    });

    test('should maintain signature validity across field reordering', async () => {
      const tool: EnactTool = {
        enact: '1.0.0',
        name: 'test/field-order',
        description: 'Test field ordering',
        command: 'echo "test"',
        version: '1.0.0',
        timeout: '30s',
        from: 'alpine:latest',
        inputSchema: { type: 'object' },
        annotations: { readOnlyHint: true },
        env: { TEST: { description: 'test', source: 'env', required: true } }
      };

      // Sign the tool
      const toolPath = join(tempDir, 'field-order-tool.yaml');
      await fs.writeFile(toolPath, stringify(tool));

      const signedYaml = await signTool(
        toolPath,
        privateKeyPath,
        publicKeyPath,
        { id: 'test-signer', role: 'author' }
      );

      const signedTool = parse(signedYaml) as EnactTool;

      // Create tool with fields in different order
      const reorderedTool: EnactTool = {
        version: signedTool.version,
        command: signedTool.command,
        enact: signedTool.enact,
        annotations: signedTool.annotations,
        name: signedTool.name,
        env: signedTool.env,
        from: signedTool.from,
        timeout: signedTool.timeout,
        description: signedTool.description,
        inputSchema: signedTool.inputSchema,
        signatures: signedTool.signatures
      };

      // Should still verify correctly despite different field order
      const result = await verifyTool(reorderedTool);
      expect(result.isValid).toBe(true);
      expect(result.validSignatures).toBe(1);
    });
  });
});
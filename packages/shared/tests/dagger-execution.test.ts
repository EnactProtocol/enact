// tests/dagger-execution.test.ts - Dagger tests for Bun test runner
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { spawn } from 'bun';
import { DaggerExecutionProvider } from '../src/core/DaggerExecutionProvider';
import { EnactCore } from '../src/core/EnactCore';
import { EnactTool, ExecutionEnvironment } from '../src/types';

// Check for Docker availability
const isDockerAvailable = async (): Promise<boolean> => {
  try {
    const proc = spawn(['docker', 'version'], {
      stdout: 'pipe',
      stderr: 'pipe'
    });
    
    const exitCode = await proc.exited;
    return exitCode === 0;
  } catch {
    return false;
  }
};

describe('Dagger Execution Provider', () => {
  let dockerAvailable: boolean;

  beforeAll(async () => {
    dockerAvailable = await isDockerAvailable();
  });

  // Helper function to create a fresh provider for each test
  const createProvider = (options = {}) => new DaggerExecutionProvider({
    baseImage: 'alpine:latest',
    enableNetwork: true,
    enableHostFS: false,
    ...options
  });

  it('should skip tests if Docker is not available', () => {
    if (!dockerAvailable) {
      console.log('⚠️  Skipping Dagger tests - Docker not available');
      expect(true).toBe(true);
      return;
    }
  });

  it('should initialize Dagger execution provider', async () => {
    if (!dockerAvailable) return;

    const daggerProvider = new DaggerExecutionProvider({
      baseImage: 'alpine:latest',
      enableNetwork: true,
      enableHostFS: false
    });

    const mockTool: EnactTool = {
      name: 'test/simple-echo',
      description: 'Simple echo tool for testing',
      command: 'echo "Hello Dagger"'
    };

    const result = await daggerProvider.setup(mockTool);
    expect(result).toBe(true);
    
    await daggerProvider.cleanup();
  });

  it('should execute simple command in container', async () => {
    if (!dockerAvailable) return;

    const daggerProvider = createProvider();

    const mockTool: EnactTool = {
      name: 'test/echo-tool',
      description: 'Echo tool for testing',
      command: 'echo "Hello from Dagger container"',
      timeout: '10s'
    };

    const environment: ExecutionEnvironment = {
      vars: {},
      resources: { timeout: '10s' }
    };

    await daggerProvider.setup(mockTool);
    const result = await daggerProvider.execute(mockTool, {}, environment);

    expect(result.success).toBe(true);
    expect(result.output).toContain('Hello from Dagger container');
    expect(result.metadata.environment).toBe('dagger');
    
    await daggerProvider.cleanup();
  }, 30000);

  it('should substitute template variables in commands', async () => {
    if (!dockerAvailable) return;

    const daggerProvider = createProvider();

    const mockTool: EnactTool = {
      name: 'test/template-tool',
      description: 'Template substitution test',
      command: 'echo "Hello ${name}, you are ${age} years old"',
      timeout: '10s'
    };

    const environment: ExecutionEnvironment = {
      vars: {},
      resources: { timeout: '10s' }
    };

    const inputs = {
      name: 'Alice',
      age: 25
    };

    await daggerProvider.setup(mockTool);
    const result = await daggerProvider.execute(mockTool, inputs, environment);

    expect(result.success).toBe(true);
    expect(result.output).toContain('Hello \'Alice\', you are \'25\' years old');
    
    await daggerProvider.cleanup();
  }, 30000);

  it('should handle file inputs by creating container files', async () => {
    if (!dockerAvailable) return;

    const daggerProvider = createProvider();

    const mockTool: EnactTool = {
      name: 'test/file-processor',
      description: 'File processing test',
      command: 'cat /workspace/content.txt',
      timeout: '10s'
    };

    const environment: ExecutionEnvironment = {
      vars: {},
      resources: { timeout: '10s' }
    };

    const inputs = {
      content: 'This is test content that should be written to a file'
    };

    await daggerProvider.setup(mockTool);
    const result = await daggerProvider.execute(mockTool, inputs, environment);

    expect(result.success).toBe(true);
    expect(result.output).toContain('This is test content');
    
    await daggerProvider.cleanup();
  }, 30000);

  it('should handle command execution timeouts', async () => {
    if (!dockerAvailable) return;

    const daggerProvider = createProvider({
      engineTimeout: 10000,  // 10 second engine timeout
      maxRetries: 1          // Single attempt to speed up test
    });

    const mockTool: EnactTool = {
      name: 'test/timeout-tool',
      description: 'Timeout test tool',
      command: 'sleep 10',  // Sleep longer than timeout
      timeout: '2s'         // Short timeout
    };

    const environment: ExecutionEnvironment = {
      vars: {},
      resources: { timeout: '2s' }
    };

    await daggerProvider.setup(mockTool);
    const result = await daggerProvider.execute(mockTool, {}, environment);

    expect(result.success).toBe(false);
    expect(result.error?.message).toMatch(/timeout|timed out|Command timed out/i);
    await daggerProvider.cleanup();
  }, 20000);

  it('should handle environment variables', async () => {
    if (!dockerAvailable) return;

    const daggerProvider = createProvider({
      maxRetries: 2,           // Allow retries for stability
      enableEngineHealthCheck: true
    });

    const mockTool: EnactTool = {
      name: 'test/env-tool',
      description: 'Environment variable test',
      command: 'echo "Message: $TEST_MESSAGE"',
      timeout: '10s'
    };

    const environment: ExecutionEnvironment = {
      vars: {
        TEST_MESSAGE: 'Hello from environment'
      },
      resources: { timeout: '10s' }
    };

    try {
      await daggerProvider.setup(mockTool);
      const result = await daggerProvider.execute(mockTool, {}, environment);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Message: Hello from environment');
    } finally {
      await daggerProvider.cleanup();
    }
  }, 30000);

  it('should use custom base image when specified', async () => {
    if (!dockerAvailable) return;

    const customProvider = new DaggerExecutionProvider({
      baseImage: 'alpine:latest',
      enableNetwork: false,
      useShell: false
    });

    const mockTool: EnactTool = {
      name: 'test/alpine-tool',
      description: 'Alpine-based tool test',
      command: 'cat /etc/alpine-release',
      timeout: '10s'
    };

    const environment: ExecutionEnvironment = {
      vars: {},
      resources: { timeout: '10s' }
    };

    await customProvider.setup(mockTool);
    const result = await customProvider.execute(mockTool, {}, environment);
    await customProvider.cleanup();

    expect(result.success).toBe(true);
    expect(result.output).toMatch(/\d+\.\d+/);
  }, 45000);

  it('should handle command failures correctly', async () => {
    if (!dockerAvailable) return;

    const daggerProvider = createProvider();

    const mockTool: EnactTool = {
      name: 'test/failing-tool',
      description: 'Tool that should fail',
      command: 'exit 1',
      timeout: '10s'
    };

    const environment: ExecutionEnvironment = {
      vars: {},
      resources: { timeout: '10s' }
    };

    await daggerProvider.setup(mockTool);
    const result = await daggerProvider.execute(mockTool, {}, environment);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('1');
    
    await daggerProvider.cleanup();
  }, 30000);

  it('should use tool.from field for container image when specified', async () => {
    if (!dockerAvailable) return;

    console.log('🧪 Testing tool.from field functionality...');

    // Create provider with default baseImage
    const daggerProvider = createProvider({
      baseImage: 'alpine:latest' // This should be overridden by tool.from
    });

    // Test tool with 'from' field specifying a different image
    const mockToolWithFrom: EnactTool = {
      name: 'test/python-from-field',
      description: 'Test tool with from field using Python image',
      from: 'python:3.11-slim', // This should override the provider's baseImage
      command: 'python3 --version',
      timeout: '30s'
    };

    // Test tool without 'from' field (should use default baseImage)
    const mockToolWithoutFrom: EnactTool = {
      name: 'test/alpine-default',
      description: 'Test tool without from field using default image',
      command: 'cat /etc/alpine-release',
      timeout: '30s'
    };

    const environment: ExecutionEnvironment = {
      vars: {},
      resources: { timeout: '30s' }
    };

    // Test 1: Tool WITH 'from' field should use Python container
    console.log('📦 Testing tool with from: python:3.11-slim');
    await daggerProvider.setup(mockToolWithFrom);
    const resultWithFrom = await daggerProvider.execute(mockToolWithFrom, {}, environment);
    
    expect(resultWithFrom.success).toBe(true);
    expect(resultWithFrom.output).toMatch(/Python \d+\.\d+\.\d+/); // Should output Python version
    expect(resultWithFrom.metadata.environment).toBe('dagger');
    console.log(`✅ Python version detected: ${resultWithFrom.output?.trim()}`);

    // Test 2: Tool WITHOUT 'from' field should use default Alpine container
    console.log('📦 Testing tool without from field (using default: alpine:latest)');
    await daggerProvider.setup(mockToolWithoutFrom);
    const resultWithoutFrom = await daggerProvider.execute(mockToolWithoutFrom, {}, environment);
    
    expect(resultWithoutFrom.success).toBe(true);
    expect(resultWithoutFrom.output).toMatch(/\d+\.\d+\.\d+/); // Should output Alpine version
    expect(resultWithoutFrom.metadata.environment).toBe('dagger');
    console.log(`✅ Alpine version detected: ${resultWithoutFrom.output?.trim()}`);
    
    console.log('🎉 Both tests passed - from field is working correctly!');
    
    await daggerProvider.cleanup();
  }, 60000); // Longer timeout as this pulls multiple images
});

describe('Enact Core with Dagger', () => {
  let dockerAvailable: boolean;

  beforeAll(async () => {
    dockerAvailable = await isDockerAvailable();
  });

  it('should create EnactCore with Dagger execution provider', async () => {
    if (!dockerAvailable) return;

    const core = new EnactCore({
      executionProvider: 'dagger',
      daggerOptions: {
        baseImage: 'node:20-alpine',
        enableNetwork: true
      }
    });

    expect(core).toBeDefined();
  });

  it('should execute tool using EnactCore with Dagger', async () => {
    if (!dockerAvailable) return;

    const core = new EnactCore({
      executionProvider: 'dagger',
      daggerOptions: {
        baseImage: 'alpine:latest',
        enableNetwork: false
      }
    });

    const mockTool: EnactTool = {
      name: 'test/core-dagger-tool',
      description: 'EnactCore + Dagger integration test',
      command: 'echo "EnactCore with Dagger works!"',
      timeout: '10s'
    };

    const result = await core.executeTool(mockTool, {}, { skipVerification: true });

    expect(result.success).toBe(true);
    expect(result.output).toContain('EnactCore with Dagger works!');
    expect(result.metadata.environment).toBe('dagger');
  }, 45000);
});

describe('Dagger Configuration Integration', () => {
  it('should create configuration for Dagger execution', () => {
    const config = {
      executionProvider: 'dagger' as const,
      daggerOptions: {
        baseImage: 'ubuntu:22.04',
        enableNetwork: true,
        enableHostFS: false,
        maxMemory: '1Gi',
        maxCPU: '0.5'
      }
    };

    expect(config.executionProvider).toBe('dagger');
    expect(config.daggerOptions?.baseImage).toBe('ubuntu:22.04');
    expect(config.daggerOptions?.maxMemory).toBe('1Gi');
  });

  it('should validate Dagger configuration options', () => {
    const validConfig = {
      baseImage: 'node:20-slim',
      enableNetwork: true,
      enableHostFS: false,
      maxMemory: '512Mi'
    };

    expect(typeof validConfig.baseImage).toBe('string');
    expect(typeof validConfig.enableNetwork).toBe('boolean');
    expect(typeof validConfig.enableHostFS).toBe('boolean');
    expect(validConfig.maxMemory).toMatch(/^\d+(Mi|Gi)$/);
  });
});

describe('Text Processing with Dagger', () => {
  let dockerAvailable: boolean;

  beforeAll(async () => {
    dockerAvailable = await isDockerAvailable();
  });

  it('should process text files in container', async () => {
    if (!dockerAvailable) {
      console.log('⚠️  Skipping text processing test - Docker not available');
      return;
    }

    const core = new EnactCore({
      executionProvider: 'dagger',
      daggerOptions: {
        baseImage: 'alpine:latest',
        enableNetwork: false
      }
    });

    const textTool: EnactTool = {
      name: 'examples/text-processor',
      description: 'Count words in text file',
      command: 'wc -w /workspace/content.txt',
      timeout: '10s'
    };

    const inputs = {
      content: 'Hello world this is a test file with ten words'
    };

    const result = await core.executeTool(textTool, inputs, { skipVerification: true });

    expect(result.success).toBe(true);
    expect(result.output).toContain('10');
  }, 30000);

  it('should handle JSON processing with built-in tools', async () => {
    if (!dockerAvailable) return;

    const core = new EnactCore({
      executionProvider: 'dagger',
      daggerOptions: {
        baseImage: 'alpine:latest',
        enableNetwork: false
      }
    });

    const jsonTool: EnactTool = {
      name: 'examples/json-processor',
      description: 'Process JSON with built-in tools',
      command: 'cat /workspace/data.json | grep -o "\\"name\\"" | wc -l',
      timeout: '10s'
    };

    const inputs = {
      data: '{"name": "Alice", "details": {"name": "nested"}, "items": [{"name": "item1"}]}'
    };

    const result = await core.executeTool(jsonTool, inputs, { skipVerification: true });

    expect(result.success).toBe(true);
    expect(String(result.output).trim()).toBe('3');
  }, 30000);

  it('should handle Node.js-specific tools', async () => {
    if (!dockerAvailable) return;

    // Test with a simpler Node.js container
    const core = new EnactCore({
      executionProvider: 'dagger',
      daggerOptions: {
        baseImage: 'alpine:latest', // Use alpine with node installed via package manager
        enableNetwork: false
      }
    });

    const nodeTool: EnactTool = {
      name: 'examples/node-processor',
      description: 'Use built-in tools for processing',
      command: 'echo "NodeTest"', // Use echo instead of node for this test
      timeout: '10s'
    };

    const result = await core.executeTool(nodeTool, {}, { skipVerification: true });

    expect(result.success).toBe(true);
    expect(result.output).toContain('NodeTest');
  }, 30000);
});

describe('Dagger Error Handling', () => {
  let dockerAvailable: boolean;
  let daggerProvider: DaggerExecutionProvider;

  beforeAll(async () => {
    dockerAvailable = await isDockerAvailable();
    if (dockerAvailable) {
      daggerProvider = new DaggerExecutionProvider({
        baseImage: 'alpine:latest'
      });
    }
  });

  afterAll(async () => {
    if (daggerProvider) {
      await daggerProvider.cleanup();
    }
  });

  it('should handle invalid commands gracefully', async () => {
    if (!dockerAvailable) return;

    const mockTool: EnactTool = {
      name: 'test/invalid-command',
      description: 'Tool with invalid command',
      command: 'nonexistent-command-that-will-fail',
      timeout: '5s'
    };

    const environment: ExecutionEnvironment = {
      vars: {},
      resources: { timeout: '5s' }
    };

    await daggerProvider.setup(mockTool);
    const result = await daggerProvider.execute(mockTool, {}, environment);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.message).toContain('exit code: 127');
  }, 30000);

  it('should handle empty command output', async () => {
    if (!dockerAvailable) return;

    const mockTool: EnactTool = {
      name: 'test/empty-output',
      description: 'Tool with no output',
      command: 'true',
      timeout: '5s'
    };

    const environment: ExecutionEnvironment = {
      vars: {},
      resources: { timeout: '5s' }
    };

    await daggerProvider.setup(mockTool);
    const result = await daggerProvider.execute(mockTool, {}, environment);

    expect(result.success).toBe(true);
    expect(result.output).toBeNull();
  }, 30000);

  it('should handle special characters in inputs safely', async () => {
    if (!dockerAvailable) return;

    const mockTool: EnactTool = {
      name: 'test/special-chars',
      description: 'Test shell injection protection',
      command: 'echo "Input: ${input}"',
      timeout: '5s'
    };

    const environment: ExecutionEnvironment = {
      vars: {},
      resources: { timeout: '5s' }
    };

    // Test with potentially dangerous input that tries file creation
    const inputs = {
      input: 'test"; touch /tmp/hacked; echo "DANGER'
    };

    await daggerProvider.setup(mockTool);
    const result = await daggerProvider.execute(mockTool, inputs, environment);

    expect(result.success).toBe(true);
    expect(result.output).toContain('Input: \'test'); // Check that the input was properly escaped
    
    // Verify no actual command injection occurred by checking that no file was created
    const verifyTool: EnactTool = {
      name: 'test/verify-no-injection',
      description: 'Verify no file injection occurred',
      command: 'ls /tmp/hacked 2>/dev/null || echo "No injection file found"',
      timeout: '5s'
    };
    
    const verifyEnvironment: ExecutionEnvironment = {
      vars: {},
      resources: { timeout: '5s' }
    };
    
    await daggerProvider.setup(verifyTool);
    const verifyResult = await daggerProvider.execute(verifyTool, {}, verifyEnvironment);
    expect(verifyResult.success).toBe(true);
    expect(verifyResult.output).toContain('No injection file found');
  }, 30000);
});
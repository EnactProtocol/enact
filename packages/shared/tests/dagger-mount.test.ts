// tests/dagger-mount.test.ts - Tests for Dagger directory mounting functionality
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';
import { spawn } from 'bun';
import { DaggerExecutionProvider } from '../src/core/DaggerExecutionProvider';
import { EnactCore } from '../src/core/EnactCore';
import { EnactTool, ExecutionEnvironment } from '../src/types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

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

describe('Dagger Directory Mounting', () => {
  let dockerAvailable: boolean;
  let testDir: string;
  let daggerProvider: DaggerExecutionProvider;

  beforeAll(async () => {
    dockerAvailable = await isDockerAvailable();
  });

  beforeEach(async () => {
    if (!dockerAvailable) return;

    // Create a temporary test directory with some files
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'enact-mount-test-'));
    
    // Create test files in the directory
    fs.writeFileSync(path.join(testDir, 'test.txt'), 'Hello from mounted directory!');
    fs.writeFileSync(path.join(testDir, 'config.json'), '{"name": "test", "value": 42}');
    fs.mkdirSync(path.join(testDir, 'subdirectory'));
    fs.writeFileSync(path.join(testDir, 'subdirectory', 'nested.txt'), 'Nested file content');

    // Create fresh provider for each test
    daggerProvider = new DaggerExecutionProvider({
      baseImage: 'alpine:latest',
      enableNetwork: false,
      enableHostFS: true,
    });
  });

  afterEach(async () => {
    if (!dockerAvailable) return;

    // Cleanup
    if (daggerProvider) {
      await daggerProvider.cleanup();
    }
    
    if (testDir && fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should skip tests if Docker is not available', () => {
    if (!dockerAvailable) {
      console.log('⚠️  Skipping Dagger mount tests - Docker not available');
      expect(true).toBe(true);
      return;
    }
  });

  it('should mount local directory with default container path', async () => {
    if (!dockerAvailable) return;

    const mockTool: EnactTool = {
      name: 'test/mount-default-path',
      description: 'Test mounting with default container path',
      command: 'cat /workspace/src/test.txt',
      timeout: '10s'
    };

    const environment: ExecutionEnvironment = {
      vars: {},
      resources: { timeout: '10s' },
      mount: testDir // Should mount to default /workspace/src
    };

    await daggerProvider.setup(mockTool);
    const result = await daggerProvider.execute(mockTool, {}, environment);

    expect(result.success).toBe(true);
    expect(result.output).toContain('Hello from mounted directory!');
  }, 30000);

  it('should mount local directory with custom container path', async () => {
    if (!dockerAvailable) return;

    const mockTool: EnactTool = {
      name: 'test/mount-custom-path',
      description: 'Test mounting with custom container path',
      command: 'cat /custom/mount/test.txt',
      timeout: '10s'
    };

    const environment: ExecutionEnvironment = {
      vars: {},
      resources: { timeout: '10s' },
      mount: `${testDir}:/custom/mount` // Custom container path
    };

    await daggerProvider.setup(mockTool);
    const result = await daggerProvider.execute(mockTool, {}, environment);

    expect(result.success).toBe(true);
    expect(result.output).toContain('Hello from mounted directory!');
  }, 30000);

  it('should handle relative path mounting', async () => {
    if (!dockerAvailable) return;

    // Change to parent directory and use relative path
    const originalCwd = process.cwd();
    const parentDir = path.dirname(testDir);
    const relativePath = `./${path.basename(testDir)}`;
    
    try {
      process.chdir(parentDir);

      const mockTool: EnactTool = {
        name: 'test/mount-relative-path',
        description: 'Test mounting with relative path',
        command: 'ls -la /workspace/src/ && cat /workspace/src/test.txt',
        timeout: '10s'
      };

      const environment: ExecutionEnvironment = {
        vars: {},
        resources: { timeout: '10s' },
        mount: relativePath
      };

      await daggerProvider.setup(mockTool);
      const result = await daggerProvider.execute(mockTool, {}, environment);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Hello from mounted directory!');
    } finally {
      process.chdir(originalCwd);
    }
  }, 30000);

  it('should preserve directory structure in mount', async () => {
    if (!dockerAvailable) return;

    const mockTool: EnactTool = {
      name: 'test/mount-directory-structure',
      description: 'Test that directory structure is preserved',
      command: 'find /workspace/src -type f | sort',
      timeout: '10s'
    };

    const environment: ExecutionEnvironment = {
      vars: {},
      resources: { timeout: '10s' },
      mount: testDir
    };

    await daggerProvider.setup(mockTool);
    const result = await daggerProvider.execute(mockTool, {}, environment);

    expect(result.success).toBe(true);
    expect(result.output).toContain('/workspace/src/test.txt');
    expect(result.output).toContain('/workspace/src/config.json');
    expect(result.output).toContain('/workspace/src/subdirectory/nested.txt');
  }, 30000);

  it('should handle mount with file operations', async () => {
    if (!dockerAvailable) return;

    const mockTool: EnactTool = {
      name: 'test/mount-file-operations',
      description: 'Test file operations on mounted directory',
      command: 'grep -r "test" /workspace/src/ | wc -l',
      timeout: '10s'
    };

    const environment: ExecutionEnvironment = {
      vars: {},
      resources: { timeout: '10s' },
      mount: testDir
    };

    await daggerProvider.setup(mockTool);
    const result = await daggerProvider.execute(mockTool, {}, environment);

    expect(result.success).toBe(true);
    // Should find "test" in test.txt and config.json
    const outputString = typeof result.output === 'string' ? result.output : String(result.output || '');
    expect(parseInt(outputString.trim() || '0')).toBeGreaterThan(0);
  }, 30000);

  it('should fail gracefully with non-existent directory', async () => {
    if (!dockerAvailable) return;

    const nonExistentDir = path.join(os.tmpdir(), 'does-not-exist-' + Date.now());

    const mockTool: EnactTool = {
      name: 'test/mount-non-existent',
      description: 'Test mounting non-existent directory',
      command: 'echo "This should not run"',
      timeout: '10s'
    };

    const environment: ExecutionEnvironment = {
      vars: {},
      resources: { timeout: '10s' },
      mount: nonExistentDir
    };

    await daggerProvider.setup(mockTool);
    
    // This should throw an error during execution
    const result = await daggerProvider.execute(mockTool, {}, environment);
    
    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('does not exist');
  }, 30000);

  it('should work with complex file processing tools', async () => {
    if (!dockerAvailable) return;

    // Create a more complex test file
    const complexFile = path.join(testDir, 'data.csv');
    fs.writeFileSync(complexFile, 'name,age,city\nAlice,25,NYC\nBob,30,LA');

    const mockTool: EnactTool = {
      name: 'test/mount-csv-processing',
      description: 'Test CSV processing on mounted directory',
      command: 'cat /workspace/src/data.csv | tail -n +2 | wc -l', // Count data rows (excluding header)
      timeout: '10s'
    };

    const environment: ExecutionEnvironment = {
      vars: {},
      resources: { timeout: '10s' },
      mount: testDir
    };

    await daggerProvider.setup(mockTool);
    const result = await daggerProvider.execute(mockTool, {}, environment);

    expect(result.success).toBe(true);
    const outputString = typeof result.output === 'string' ? result.output : String(result.output || '');
    expect(parseInt(outputString.trim() || '0')).toBeGreaterThan(0); // Should have data rows
  }, 30000);

  it('should handle mount path parsing correctly', async () => {
    if (!dockerAvailable) return;

    // Test various mount path formats
    const testCases = [
      {
        mount: testDir,
        expectedPath: '/workspace/src',
        description: 'default path'
      },
      {
        mount: `${testDir}:/custom/path`,
        expectedPath: '/custom/path',
        description: 'custom path'
      },
      {
        mount: `${testDir}:/usr/local/app`,
        expectedPath: '/usr/local/app',
        description: 'deep custom path'
      }
    ];

    for (const testCase of testCases) {
      const mockTool: EnactTool = {
        name: `test/mount-path-${testCase.description.replace(' ', '-')}`,
        description: `Test mount path parsing for ${testCase.description}`,
        command: `cat ${testCase.expectedPath}/test.txt`,
        timeout: '10s'
      };

      const environment: ExecutionEnvironment = {
        vars: {},
        resources: { timeout: '10s' },
        mount: testCase.mount
      };

      await daggerProvider.setup(mockTool);
      const result = await daggerProvider.execute(mockTool, {}, environment);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Hello from mounted directory!');
    }
  }, 60000);
});

describe('EnactCore Mount Integration', () => {
  let dockerAvailable: boolean;
  let testDir: string;

  beforeAll(async () => {
    dockerAvailable = await isDockerAvailable();
  });

  beforeEach(async () => {
    if (!dockerAvailable) return;

    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'enact-core-mount-test-'));
    fs.writeFileSync(path.join(testDir, 'source.txt'), 'Source file for EnactCore test');
  });

  afterEach(async () => {
    if (!dockerAvailable) return;
    
    if (testDir && fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should execute tool with mount via EnactCore', async () => {
    if (!dockerAvailable) return;

    const core = new EnactCore({
      executionProvider: 'dagger',
      daggerOptions: {
        baseImage: 'alpine:latest',
        enableNetwork: false,
        enableHostFS: true
      }
    });

    const mockTool: EnactTool = {
      name: 'test/core-mount-integration',
      description: 'EnactCore mount integration test',
      command: 'cat /workspace/src/source.txt',
      timeout: '10s'
    };

    const result = await core.executeTool(mockTool, {}, {
      dangerouslySkipVerification: true,
      mount: testDir
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('Source file for EnactCore test');
    expect(result.metadata.environment).toBe('dagger');
  }, 30000);

  it('should handle mount with template substitution', async () => {
    if (!dockerAvailable) return;

    // Create a file with template variables
    fs.writeFileSync(path.join(testDir, 'template.txt'), 'Processing file: ${filename}');

    const core = new EnactCore({
      executionProvider: 'dagger',
      daggerOptions: {
        baseImage: 'alpine:latest',
        enableNetwork: false
      }
    });

    const mockTool: EnactTool = {
      name: 'test/mount-with-templates', 
      description: 'Test mount with template variables',
      command: 'echo "Processing file: ${filename}" && cat /workspace/src/template.txt',
      timeout: '10s'
    };

    const inputs = {
      filename: 'myfile.txt'
    };

    const result = await core.executeTool(mockTool, inputs, {
      dangerouslySkipVerification: true,
      mount: testDir
    });

    expect(result.success).toBe(true);
    // Template substitution works in the echo command
    expect(result.output).toMatch(/Processing file: .*myfile\.txt/);
    expect(result.output).toContain('Processing file: ${filename}'); // File content not substituted
  }, 30000);

  it('should work with complex directory structures', async () => {
    if (!dockerAvailable) return;

    // Create a complex directory structure
    const srcDir = path.join(testDir, 'src');
    const testSubDir = path.join(srcDir, 'tests');
    const configDir = path.join(testDir, 'config');
    
    fs.mkdirSync(srcDir, { recursive: true });
    fs.mkdirSync(testSubDir, { recursive: true });
    fs.mkdirSync(configDir, { recursive: true });
    
    fs.writeFileSync(path.join(srcDir, 'main.js'), 'console.log("Hello World");');
    fs.writeFileSync(path.join(testSubDir, 'test.js'), 'test("should work", () => {});');
    fs.writeFileSync(path.join(configDir, 'config.yml'), 'env: test');

    const core = new EnactCore({
      executionProvider: 'dagger',
      daggerOptions: {
        baseImage: 'alpine:latest',
        enableNetwork: false
      }
    });

    const mockTool: EnactTool = {
      name: 'test/complex-directory-mount',
      description: 'Test mounting complex directory structure',
      command: 'find /workspace/src -name "*.js" -o -name "*.yml" | sort',
      timeout: '10s'
    };

    const result = await core.executeTool(mockTool, {}, {
      dangerouslySkipVerification: true,
      mount: testDir
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('/workspace/src/src/main.js');
    expect(result.output).toContain('/workspace/src/src/tests/test.js');
    expect(result.output).toContain('/workspace/src/config/config.yml');
  }, 30000);
});

describe('Mount Error Handling', () => {
  let dockerAvailable: boolean;
  let daggerProvider: DaggerExecutionProvider;

  beforeAll(async () => {
    dockerAvailable = await isDockerAvailable();
    if (dockerAvailable) {
      daggerProvider = new DaggerExecutionProvider({
        baseImage: 'alpine:latest',
        enableHostFS: true
      });
    }
  });

  afterAll(async () => {
    if (daggerProvider) {
      await daggerProvider.cleanup();
    }
  });

  it('should handle malformed mount specifications gracefully', async () => {
    if (!dockerAvailable) return;

    // Test with non-existent directory (should actually fail)
    const nonExistentMount = '/this/directory/definitely/does/not/exist/anywhere';

    const mockTool: EnactTool = {
      name: 'test/malformed-mount',
      description: 'Test malformed mount specification',
      command: 'echo "Should not run"',
      timeout: '5s'
    };

    const environment: ExecutionEnvironment = {
      vars: {},
      resources: { timeout: '5s' },
      mount: nonExistentMount
    };

    await daggerProvider.setup(mockTool);
    const result = await daggerProvider.execute(mockTool, {}, environment);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.message).toContain('does not exist');
  }, 30000);

  it('should handle permission errors gracefully', async () => {
    if (!dockerAvailable) return;

    // Try to mount a system directory that might have permission issues
    const restrictedPath = '/root'; // This should exist but may not be accessible

    const mockTool: EnactTool = {
      name: 'test/permission-error',
      description: 'Test permission error handling',
      command: 'ls /workspace/src',
      timeout: '5s'
    };

    const environment: ExecutionEnvironment = {
      vars: {},
      resources: { timeout: '5s' },
      mount: restrictedPath
    };

    await daggerProvider.setup(mockTool);
    
    // This might succeed or fail depending on Docker setup, but shouldn't crash
    const result = await daggerProvider.execute(mockTool, {}, environment);
    
    // Either succeeds or fails gracefully
    expect(typeof result.success).toBe('boolean');
    if (!result.success) {
      expect(result.error).toBeDefined();
    }
  }, 30000);
});
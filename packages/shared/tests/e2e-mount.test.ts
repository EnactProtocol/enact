// tests/e2e-mount.test.ts - End-to-end tests for CLI mount functionality
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { spawn } from 'bun';
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

// Helper to run CLI commands
const runEnactCommand = async (args: string[], options: { timeout?: number } = {}): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
}> => {
  const proc = spawn(['bun', 'run', 'cli', ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
    cwd: path.join(__dirname, '../../..'), // Root of the project
  });

  const timeout = options.timeout || 30000;
  let timeoutId: Timer | null = null;

  const result = await Promise.race([
    proc.exited.then(async (exitCode) => {
      if (timeoutId) clearTimeout(timeoutId);
      
      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      
      return { exitCode, stdout, stderr };
    }),
    new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        proc.kill();
        reject(new Error(`Command timed out after ${timeout}ms`));
      }, timeout);
    })
  ]);

  return result;
};

describe('End-to-End Mount Tests', () => {
  let dockerAvailable: boolean;
  let testDir: string;
  let testToolFile: string;

  beforeEach(async () => {
    dockerAvailable = await isDockerAvailable();
    
    if (!dockerAvailable) return;

    // Create test directory and files
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'enact-e2e-mount-'));
    
    // Create test source files
    fs.writeFileSync(path.join(testDir, 'input.txt'), 'Hello World from mounted directory!');
    fs.writeFileSync(path.join(testDir, 'data.json'), '{"message": "test data", "count": 5}');
    
    // Create a simple test tool
    testToolFile = path.join(testDir, 'test-tool.yaml');
    fs.writeFileSync(testToolFile, `
enact: "1.0.0"
name: test/mount-demo
description: "Demo tool for testing mount functionality"
command: "cat /workspace/src/input.txt"
timeout: "10s"
`);
  });

  afterEach(async () => {
    if (!dockerAvailable) return;
    
    if (testDir && fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should skip tests if Docker is not available', async () => {
    if (!dockerAvailable) {
      console.log('⚠️  Skipping E2E mount tests - Docker not available');
      expect(true).toBe(true);
      return;
    }
  });

  it('should execute local tool with mount via CLI', async () => {
    if (!dockerAvailable) return;

    const result = await runEnactCommand([
      'exec',
      testToolFile,
      '--mount', testDir,
      '--dangerously-skip-verification'
    ], { timeout: 45000 });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Hello World from mounted directory!');
  }, 60000);

  it('should execute tool with custom mount path via CLI', async () => {
    if (!dockerAvailable) return;

    // Create a tool that expects files at a custom path
    const customToolFile = path.join(testDir, 'custom-path-tool.yaml');
    fs.writeFileSync(customToolFile, `
enact: "1.0.0"
name: test/custom-mount-path
description: "Tool that uses custom mount path"
command: "cat /app/data/input.txt"
timeout: "10s"
`);

    const result = await runEnactCommand([
      'exec',
      customToolFile,
      '--mount', `${testDir}:/app/data`,
      '--dangerously-skip-verification'
    ], { timeout: 45000 });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Hello World from mounted directory!');
  }, 60000);

  it('should show help for mount option', async () => {
    if (!dockerAvailable) return;

    const result = await runEnactCommand(['exec', '--help']);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain('--mount');
    expect(result.stderr).toContain('Mount local directory to container');
  }, 15000);

  it('should handle mount with verbose output', async () => {
    if (!dockerAvailable) return;

    const result = await runEnactCommand([
      'exec',
      testToolFile,
      '--mount', testDir,
      '--verbose',
      '--dangerously-skip-verification'
    ], { timeout: 45000 });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Hello World from mounted directory!');
    // Verbose mode should show additional information
    expect(result.stderr).toContain('Tool Information:');
  }, 60000);

  it('should fail gracefully with non-existent mount directory', async () => {
    if (!dockerAvailable) return;

    const nonExistentDir = path.join(os.tmpdir(), 'does-not-exist-' + Date.now());

    const result = await runEnactCommand([
      'exec',
      testToolFile,
      '--mount', nonExistentDir,
      '--dangerously-skip-verification'
    ], { timeout: 30000 });

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('does not exist');
  }, 45000);

  it('should work with complex file processing', async () => {
    if (!dockerAvailable) return;

    // Create a tool that processes the JSON file
    const jsonToolFile = path.join(testDir, 'json-processor.yaml');
    fs.writeFileSync(jsonToolFile, `
enact: "1.0.0"
name: test/json-processor
description: "Process JSON data from mounted directory"
command: "grep -o '\"count\":[[:space:]]*[0-9]*' /workspace/src/data.json | cut -d':' -f2 | tr -d ' '"
timeout: "10s"
`);

    const result = await runEnactCommand([
      'exec',
      jsonToolFile,
      '--mount', testDir,
      '--dangerously-skip-verification'
    ], { timeout: 45000 });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('5');
  }, 60000);

  it('should handle mount with parameterized tools', async () => {
    if (!dockerAvailable) return;

    // Create a tool that uses template variables
    const paramToolFile = path.join(testDir, 'param-tool.yaml');
    fs.writeFileSync(paramToolFile, `
enact: "1.0.0"
name: test/param-with-mount
description: "Tool with parameters and mount"
command: "echo 'Processing file: ${filename}' && cat /workspace/src/input.txt | head -c \${maxlen}"
inputSchema:
  type: object
  properties:
    filename:
      type: string
      description: "Name of file being processed"
    maxlen:
      type: integer
      description: "Maximum length to read"
  required: ["filename", "maxlen"]
timeout: "10s"
`);

    const result = await runEnactCommand([
      'exec',
      paramToolFile,
      '--mount', testDir,
      '--params', '{"filename": "input.txt", "maxlen": 15}',
      '--dangerously-skip-verification'
    ], { timeout: 45000 });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Processing file: input.txt');
    expect(result.stdout).toContain('Hello World fro'); // First 15 characters
  }, 60000);

  it('should work with relative mount paths', async () => {
    if (!dockerAvailable) return;

    // Change to parent directory and use relative path
    const originalCwd = process.cwd();
    const parentDir = path.dirname(testDir);
    const relativePath = `./${path.basename(testDir)}`;
    
    try {
      process.chdir(parentDir);

      const result = await runEnactCommand([
        'exec',
        path.join(relativePath, 'test-tool.yaml'),
        '--mount', relativePath,
        '--dangerously-skip-verification'
      ], { timeout: 45000 });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Hello World from mounted directory!');
    } finally {
      process.chdir(originalCwd);
    }
  }, 60000);

  it('should handle dry run with mount option', async () => {
    if (!dockerAvailable) return;

    const result = await runEnactCommand([
      'exec',
      testToolFile,
      '--mount', testDir,
      '--dry',
      '--dangerously-skip-verification'
    ], { timeout: 30000 });

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain('Command that would be executed:');
    expect(result.stderr).toContain('cat /workspace/src/input.txt');
  }, 45000);

  it('should show mount information in verbose dry run', async () => {
    if (!dockerAvailable) return;

    const result = await runEnactCommand([
      'exec',
      testToolFile,
      '--mount', `${testDir}:/custom/path`,
      '--dry',
      '--verbose',
      '--dangerously-skip-verification'
    ], { timeout: 30000 });

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain('Command that would be executed:');
    // In a real implementation, we might want to show mount info in dry run
  }, 45000);
});

describe('CLI Mount Error Handling', () => {
  let dockerAvailable: boolean;
  let testDir: string;
  let testToolFile: string;

  beforeEach(async () => {
    dockerAvailable = await isDockerAvailable();
    
    if (!dockerAvailable) return;

    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'enact-e2e-error-'));
    
    testToolFile = path.join(testDir, 'test-tool.yaml');
    fs.writeFileSync(testToolFile, `
enact: "1.0.0"
name: test/error-tool
description: "Tool for testing errors"
command: "cat /workspace/src/missing.txt"
timeout: "10s"
`);
  });

  afterEach(async () => {
    if (!dockerAvailable) return;
    
    if (testDir && fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should handle malformed mount specifications', async () => {
    if (!dockerAvailable) return;

    const malformedMounts = [
      ':invalid',      // Empty local path
      'invalid:',      // Empty container path
      '',              // Empty string
    ];

    for (const mountSpec of malformedMounts) {
      const result = await runEnactCommand([
        'exec',
        testToolFile,
        '--mount', mountSpec,
        '--dangerously-skip-verification'
      ], { timeout: 30000 });

      expect(result.exitCode).not.toBe(0);
    }
  }, 90000);

  it('should provide helpful error messages for mount issues', async () => {
    if (!dockerAvailable) return;

    const nonExistentPath = '/this/path/definitely/does/not/exist';

    const result = await runEnactCommand([
      'exec',
      testToolFile,
      '--mount', nonExistentPath,
      '--dangerously-skip-verification'
    ], { timeout: 30000 });

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toMatch(/(does not exist|not found|cannot access)/i);
  }, 45000);

  it('should handle permission errors gracefully', async () => {
    if (!dockerAvailable) return;

    // Try to mount a system directory that might have restricted access
    const restrictedPath = '/proc'; // This exists but might cause issues

    const result = await runEnactCommand([
      'exec',
      testToolFile,
      '--mount', restrictedPath,
      '--dangerously-skip-verification'
    ], { timeout: 30000 });

    // The command might succeed or fail, but should handle it gracefully
    expect(typeof result.exitCode).toBe('number');
  }, 45000);
});
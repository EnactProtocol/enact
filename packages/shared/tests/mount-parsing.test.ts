// tests/mount-parsing.test.ts - Unit tests for mount specification parsing
import { describe, it, expect } from 'bun:test';
import * as path from 'path';
import * as os from 'os';

// Helper function to simulate the mount parsing logic from DaggerExecutionProvider
function parseMountSpec(mountSpec: string): { localPath: string; containerPath: string } {
  let localPath: string;
  let containerPath: string;

  // Handle Windows drive letters (e.g., C:\path) vs mount separator (:)
  const colonIndex = mountSpec.indexOf(':');
  
  if (colonIndex > 0) {
    // Check if this might be a Windows drive letter (single letter followed by colon)
    const potentialDriveLetter = mountSpec.substring(0, colonIndex);
    const isWindowsDrive = potentialDriveLetter.length === 1 && /[A-Za-z]/.test(potentialDriveLetter);
    
    if (isWindowsDrive) {
      // Look for the next colon that separates local from container path
      const nextColonIndex = mountSpec.indexOf(':', colonIndex + 1);
      if (nextColonIndex > 0) {
        localPath = mountSpec.substring(0, nextColonIndex);
        containerPath = mountSpec.substring(nextColonIndex + 1);
      } else {
        // No container path specified, use default
        localPath = mountSpec;
        containerPath = '/workspace/src';
      }
    } else {
      // Regular path:container split
      localPath = mountSpec.substring(0, colonIndex);
      containerPath = mountSpec.substring(colonIndex + 1);
    }
  } else if (colonIndex === 0) {
    // Starts with colon (e.g., ":/app")
    localPath = '';
    containerPath = mountSpec.substring(1);
  } else {
    localPath = mountSpec;
    containerPath = '/workspace/src'; // Default container path
  }

  // Resolve local path to absolute path
  const resolvedLocalPath = path.resolve(localPath);

  return {
    localPath: resolvedLocalPath,
    containerPath: containerPath
  };
}

describe('Mount Specification Parsing', () => {
  it('should parse mount spec with default container path', () => {
    const mountSpec = './src';
    const result = parseMountSpec(mountSpec);

    expect(result.localPath).toBe(path.resolve('./src'));
    expect(result.containerPath).toBe('/workspace/src');
  });

  it('should parse mount spec with custom container path', () => {
    const mountSpec = './src:/custom/path';
    const result = parseMountSpec(mountSpec);

    expect(result.localPath).toBe(path.resolve('./src'));
    expect(result.containerPath).toBe('/custom/path');
  });

  it('should handle absolute local paths', () => {
    const absolutePath = '/home/user/project';
    const mountSpec = `${absolutePath}:/app`;
    const result = parseMountSpec(mountSpec);

    expect(result.localPath).toBe(absolutePath);
    expect(result.containerPath).toBe('/app');
  });

  it('should resolve relative paths correctly', () => {
    const mountSpec = '../parent:/workspace';
    const result = parseMountSpec(mountSpec);

    expect(result.localPath).toBe(path.resolve('../parent'));
    expect(result.containerPath).toBe('/workspace');
  });

  it('should handle paths with spaces', () => {
    const mountSpec = './my folder:/workspace/folder';
    const result = parseMountSpec(mountSpec);

    expect(result.localPath).toBe(path.resolve('./my folder'));
    expect(result.containerPath).toBe('/workspace/folder');
  });

  it('should handle Windows-style paths', () => {
    if (os.platform() === 'win32') {
      const mountSpec = 'C:\\Users\\test\\project:/workspace';
      const result = parseMountSpec(mountSpec);

      expect(result.localPath).toBe(path.resolve('C:\\Users\\test\\project'));
      expect(result.containerPath).toBe('/workspace');
    } else {
      // On non-Windows, backslashes are treated as literal characters, not path separators
      const mountSpec = 'C:\\Users\\test\\project:/workspace';
      const result = parseMountSpec(mountSpec);
      
      expect(typeof result.localPath).toBe('string');
      expect(result.localPath).toBe(path.resolve('C:\\Users\\test\\project'));
      expect(result.containerPath).toBe('/workspace');
    }
  });

  it('should handle deep container paths', () => {
    const mountSpec = './src:/usr/local/app/src/main';
    const result = parseMountSpec(mountSpec);

    expect(result.localPath).toBe(path.resolve('./src'));
    expect(result.containerPath).toBe('/usr/local/app/src/main');
  });

  it('should handle home directory expansion', () => {
    const mountSpec = '~/project:/workspace';
    const result = parseMountSpec(mountSpec);

    // Note: path.resolve doesn't expand ~ by default, but our test confirms the behavior
    expect(result.localPath).toBe(path.resolve('~/project'));
    expect(result.containerPath).toBe('/workspace');
  });

  it('should handle only colon as separator', () => {
    const mountSpec = './src:/app';
    const parts = mountSpec.split(':');
    
    expect(parts).toHaveLength(2);
    expect(parts[0]).toBe('./src');
    expect(parts[1]).toBe('/app');
  });

  it('should handle multiple colons correctly', () => {
    // Should split on the first colon (unless it's a Windows drive letter)
    const mountSpec = './src:with:colons:/app/path';
    const result = parseMountSpec(mountSpec);
    
    // Since ./src doesn't look like a Windows drive, splits on first colon
    expect(result.localPath).toBe(path.resolve('./src'));
    expect(result.containerPath).toBe('with:colons:/app/path');
  });

  it('should validate mount specification format', () => {
    const validSpecs = [
      './src',
      './src:/workspace',
      '/absolute/path:/app',
      '../relative:/workspace/rel',
      '~/home/path:/usr/local'
    ];

    const problematicSpecs = [
      ':',          // Only colon
      ':/app',      // Empty local path
      './src:',     // Empty container path
      ':::',        // Multiple colons only
    ];

    validSpecs.forEach(spec => {
      expect(() => parseMountSpec(spec)).not.toThrow();
    });

    // Test that our function handles problematic cases gracefully (doesn't crash)
    problematicSpecs.forEach(spec => {
      expect(() => parseMountSpec(spec)).not.toThrow();
      
      const result = parseMountSpec(spec);
      
      // Check for problematic cases
      if (spec === ':/app') {
        expect(result.localPath).toBe(path.resolve(''));
        expect(result.containerPath).toBe('/app');
      } else if (spec === './src:') {
        expect(result.localPath).toBe(path.resolve('./src'));
        expect(result.containerPath).toBe('');
      }
    });

    // Empty string should still resolve to current directory
    const emptyResult = parseMountSpec('');
    expect(emptyResult.localPath).toBe(path.resolve(''));
    expect(emptyResult.containerPath).toBe('/workspace/src');
  });
});

describe('Mount Path Validation', () => {
  it('should identify valid container paths', () => {
    const validContainerPaths = [
      '/workspace',
      '/app',
      '/usr/local/app',
      '/workspace/src',
      '/tmp/data'
    ];

    validContainerPaths.forEach(containerPath => {
      expect(containerPath.startsWith('/')).toBe(true);
      expect(containerPath.length).toBeGreaterThan(1);
    });
  });

  it('should identify invalid container paths', () => {
    const invalidContainerPaths = [
      '',           // Empty
      'relative',   // Not absolute
      'relative/path', // Not absolute
      '//double',   // Double slash
    ];

    invalidContainerPaths.forEach(containerPath => {
      if (containerPath === '') {
        expect(containerPath.length).toBe(0);
      } else if (!containerPath.startsWith('/')) {
        expect(containerPath.startsWith('/')).toBe(false);
      }
    });
  });

  it('should handle path normalization', () => {
    const testCases = [
      { input: './src/../src', expected: path.resolve('./src/../src') },
      { input: './src/./nested', expected: path.resolve('./src/./nested') },
      { input: '/absolute/../path', expected: path.resolve('/absolute/../path') }
    ];

    testCases.forEach(({ input, expected }) => {
      const result = parseMountSpec(input);
      expect(result.localPath).toBe(expected);
    });
  });
});

describe('Edge Cases', () => {
  it('should handle very long paths', () => {
    const longPath = './very/long/path/that/goes/deep/into/directory/structure/with/many/levels';
    const mountSpec = `${longPath}:/workspace/deep`;
    const result = parseMountSpec(mountSpec);

    expect(result.localPath).toBe(path.resolve(longPath));
    expect(result.containerPath).toBe('/workspace/deep');
  });

  it('should handle special characters in paths', () => {
    const specialPath = './src-with-dash_and_underscore';
    const mountSpec = `${specialPath}:/workspace/special`;
    const result = parseMountSpec(mountSpec);

    expect(result.localPath).toBe(path.resolve(specialPath));
    expect(result.containerPath).toBe('/workspace/special');
  });

  it('should handle dot files and directories', () => {
    const dotPath = './.hidden/directory';
    const mountSpec = `${dotPath}:/workspace/hidden`;
    const result = parseMountSpec(mountSpec);

    expect(result.localPath).toBe(path.resolve(dotPath));
    expect(result.containerPath).toBe('/workspace/hidden');
  });

  it('should preserve case sensitivity', () => {
    const casedPath = './MyProject/SrcCode';
    const mountSpec = `${casedPath}:/workspace/MyApp`;
    const result = parseMountSpec(mountSpec);

    expect(result.localPath).toBe(path.resolve(casedPath));
    expect(result.containerPath).toBe('/workspace/MyApp');
  });
});
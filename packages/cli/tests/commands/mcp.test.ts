import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { join } from 'path';
import { tmpdir } from 'os';
import { promises as fs } from 'fs';
import { handleMcpCommand } from '../../src/commands/mcp';

// Mock console methods to capture output
const mockConsole = {
  log: mock(() => {}),
  error: mock(() => {}),
  warn: mock(() => {})
};

// Mock process.exit to prevent actual exit
const mockExit = mock(() => {});

describe('MCP Command', () => {
  let testDir: string;
  let originalConsole: typeof console;
  let originalExit: typeof process.exit;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = join(tmpdir(), `enact-mcp-tests-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(testDir, { recursive: true });

    // Mock console and process.exit
    originalConsole = console;
    originalExit = process.exit;
    
    Object.assign(console, mockConsole);
    process.exit = mockExit as any;

    // Clear mocks
    mockConsole.log.mockClear();
    mockConsole.error.mockClear();
    mockConsole.warn.mockClear();
    mockExit.mockClear();
  });

  afterEach(async () => {
    // Restore original console and process.exit
    Object.assign(console, originalConsole);
    process.exit = originalExit;

    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('MCP Configuration Generation', () => {
    test('should generate correct Claude Desktop configuration without nested enact key', async () => {
      const configPath = join(testDir, 'claude_desktop_config.json');
      
      // Create mock client object
      const mockClient = {
        id: 'claude-desktop',
        name: 'Claude Desktop',
        configPath: configPath
      };

      // Mock the installMcpServer function by importing the module and testing it directly
      const { installMcpServer } = await import('../../src/commands/mcp');
      
      await (installMcpServer as any)(mockClient);

      // Read the generated config
      const configContent = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configContent);

      // Verify the structure is correct
      expect(config.mcpServers).toBeDefined();
      expect(config.mcpServers.enact).toBeDefined();
      expect(config.mcpServers.enact.command).toBe('npx');
      expect(config.mcpServers.enact.args).toEqual(['-y', '@enactprotocol/mcp-server']);
      
      // Verify there's no nested enact key
      expect(config.mcpServers.enact.enact).toBeUndefined();
    });

    test('should generate correct Claude Code configuration', async () => {
      const configPath = join(testDir, 'claude.json');
      
      const mockClient = {
        id: 'claude-code',
        name: 'Claude Code',
        configPath: configPath
      };

      const { installMcpServer } = await import('../../src/commands/mcp');
      await (installMcpServer as any)(mockClient);

      const configContent = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configContent);

      expect(config.mcpServers).toBeDefined();
      expect(config.mcpServers.enact).toBeDefined();
      expect(config.mcpServers.enact.command).toBe('npx');
      expect(config.mcpServers.enact.args).toEqual(['-y', '@enactprotocol/mcp-server']);
      expect(config.mcpServers.enact.enact).toBeUndefined();
    });

    test('should generate correct VS Code configuration', async () => {
      const configPath = join(testDir, 'settings.json');
      
      const mockClient = {
        id: 'vscode',
        name: 'VS Code MCP',
        configPath: configPath
      };

      const { installMcpServer } = await import('../../src/commands/mcp');
      await (installMcpServer as any)(mockClient);

      const configContent = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configContent);

      expect(config['mcp.servers']).toBeDefined();
      expect(config['mcp.servers'].enact).toBeDefined();
      expect(config['mcp.servers'].enact.command).toBe('npx');
      expect(config['mcp.servers'].enact.args).toEqual(['-y', '@enactprotocol/mcp-server']);
      expect(config['mcp.servers'].enact.enact).toBeUndefined();
    });

    test('should generate correct Gemini configuration', async () => {
      const configPath = join(testDir, 'settings.json');
      
      const mockClient = {
        id: 'gemini',
        name: 'Gemini',
        configPath: configPath
      };

      const { installMcpServer } = await import('../../src/commands/mcp');
      await (installMcpServer as any)(mockClient);

      const configContent = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configContent);

      expect(config.mcpServers).toBeDefined();
      expect(config.mcpServers.enact).toBeDefined();
      expect(config.mcpServers.enact.command).toBe('npx');
      expect(config.mcpServers.enact.args).toEqual(['-y', '@enactprotocol/mcp-server']);
      expect(config.mcpServers.enact.enact).toBeUndefined();
    });

    test('should merge with existing configuration correctly', async () => {
      const configPath = join(testDir, 'claude_desktop_config.json');
      
      // Create existing config with other MCP servers
      const existingConfig = {
        mcpServers: {
          'other-server': {
            command: 'node',
            args: ['other-server.js']
          }
        }
      };
      
      await fs.writeFile(configPath, JSON.stringify(existingConfig, null, 2));

      const mockClient = {
        id: 'claude-desktop',
        name: 'Claude Desktop',
        configPath: configPath
      };

      const { installMcpServer } = await import('../../src/commands/mcp');
      await (installMcpServer as any)(mockClient);

      const configContent = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configContent);

      // Verify both servers exist
      expect(config.mcpServers['other-server']).toBeDefined();
      expect(config.mcpServers.enact).toBeDefined();
      expect(config.mcpServers.enact.command).toBe('npx');
      expect(config.mcpServers.enact.args).toEqual(['-y', '@enactprotocol/mcp-server']);
      expect(config.mcpServers.enact.enact).toBeUndefined();
    });

    test('should handle malformed existing configuration', async () => {
      const configPath = join(testDir, 'claude_desktop_config.json');
      
      // Create malformed JSON
      await fs.writeFile(configPath, '{ invalid json }');

      const mockClient = {
        id: 'claude-desktop',
        name: 'Claude Desktop',
        configPath: configPath
      };

      const { installMcpServer } = await import('../../src/commands/mcp');
      await (installMcpServer as any)(mockClient);

      const configContent = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configContent);

      // Should create new valid config
      expect(config.mcpServers).toBeDefined();
      expect(config.mcpServers.enact).toBeDefined();
      expect(config.mcpServers.enact.enact).toBeUndefined();
    });
  });

  describe('Help Command', () => {
    test('should display help when --help flag is provided', async () => {
      await handleMcpCommand([], { help: true });
      
      expect(mockConsole.error).toHaveBeenCalled();
      const helpOutput = mockConsole.error.mock.calls[0][0];
      expect(helpOutput).toContain('Usage: enact mcp');
      expect(helpOutput).toContain('install');
      expect(helpOutput).toContain('list');
      expect(helpOutput).toContain('status');
    });

    test('should display help when no subcommand provided', async () => {
      await handleMcpCommand([], {});
      
      expect(mockConsole.error).toHaveBeenCalled();
      const helpOutput = mockConsole.error.mock.calls[0][0];
      expect(helpOutput).toContain('Usage: enact mcp');
    });
  });

  describe('Unknown Subcommand', () => {
    test('should handle unknown subcommands', async () => {
      await handleMcpCommand(['unknown'], {});
      
      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('Unknown MCP subcommand: unknown')
      );
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  describe('Client Detection', () => {
    test('should detect Claude Desktop when config file exists', async () => {
      const configPath = join(testDir, 'claude_desktop_config.json');
      await fs.writeFile(configPath, '{}');

      // Mock the platform-specific path resolution
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      
      // Mock homedir to return our test directory
      const originalHomedir = require('os').homedir;
      require('os').homedir = () => testDir;

      try {
        const { detectMcpClients } = await import('../../src/commands/mcp');
        const clients = await (detectMcpClients as any)();
        
        // Should find Claude Desktop
        const claudeDesktop = clients.find((c: any) => c.id === 'claude-desktop');
        expect(claudeDesktop).toBeDefined();
        expect(claudeDesktop.name).toBe('Claude Desktop');
      } finally {
        // Restore original values
        Object.defineProperty(process, 'platform', { value: originalPlatform });
        require('os').homedir = originalHomedir;
      }
    });

    test('should not detect clients when config files do not exist', async () => {
      // Mock the platform-specific path resolution to point to non-existent files
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      
      const originalHomedir = require('os').homedir;
      require('os').homedir = () => join(testDir, 'non-existent');

      try {
        const { detectMcpClients } = await import('../../src/commands/mcp');
        const clients = await (detectMcpClients as any)();
        
        expect(clients).toHaveLength(0);
      } finally {
        Object.defineProperty(process, 'platform', { value: originalPlatform });
        require('os').homedir = originalHomedir;
      }
    });
  });

  describe('Installation Status Checking', () => {
    test('should detect when MCP server is not installed', async () => {
      const configPath = join(testDir, 'claude_desktop_config.json');
      
      // Create config without enact server
      const config = {
        mcpServers: {
          'other-server': {
            command: 'node',
            args: ['other.js']
          }
        }
      };
      
      await fs.writeFile(configPath, JSON.stringify(config, null, 2));

      const mockClient = {
        id: 'claude-desktop',
        name: 'Claude Desktop',
        configPath: configPath
      };

      const { checkMcpServerInstalled } = await import('../../src/commands/mcp');
      const isInstalled = await (checkMcpServerInstalled as any)(mockClient);

      expect(isInstalled).toBe(false);
    });

    test('should detect when MCP server is installed', async () => {
      const configPath = join(testDir, 'claude_desktop_config.json');
      
      // Create config with enact server
      const config = {
        mcpServers: {
          enact: {
            command: 'npx',
            args: ['-y', '@enactprotocol/mcp-server']
          }
        }
      };
      
      await fs.writeFile(configPath, JSON.stringify(config, null, 2));

      const mockClient = {
        id: 'claude-desktop',
        name: 'Claude Desktop',
        configPath: configPath
      };

      const { checkMcpServerInstalled } = await import('../../src/commands/mcp');
      const isInstalled = await (checkMcpServerInstalled as any)(mockClient);

      expect(isInstalled).toBe(true);
    });

    test('should handle non-existent config file', async () => {
      const configPath = join(testDir, 'non-existent-config.json');

      const mockClient = {
        id: 'claude-desktop',
        name: 'Claude Desktop',
        configPath: configPath
      };

      const { checkMcpServerInstalled } = await import('../../src/commands/mcp');
      const isInstalled = await (checkMcpServerInstalled as any)(mockClient);

      expect(isInstalled).toBe(false);
    });

    test('should detect Gemini installation status correctly', async () => {
      const configPath = join(testDir, 'gemini_settings.json');
      
      // Test not installed
      const config = {
        mcpServers: {
          'other-server': {
            command: 'node',
            args: ['other.js']
          }
        }
      };
      
      await fs.writeFile(configPath, JSON.stringify(config, null, 2));

      const mockClient = {
        id: 'gemini',
        name: 'Gemini',
        configPath: configPath
      };

      const { checkMcpServerInstalled } = await import('../../src/commands/mcp');
      let isInstalled = await (checkMcpServerInstalled as any)(mockClient);
      expect(isInstalled).toBe(false);

      // Test installed
      config.mcpServers.enact = {
        command: 'npx',
        args: ['-y', '@enactprotocol/mcp-server']
      };
      
      await fs.writeFile(configPath, JSON.stringify(config, null, 2));
      isInstalled = await (checkMcpServerInstalled as any)(mockClient);
      expect(isInstalled).toBe(true);
    });
  });
});
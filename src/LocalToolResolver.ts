import { EnactCore } from "./core/EnactCore";
import { promises as fs } from 'fs';
import { join, resolve, basename } from 'path';
import * as yaml from 'yaml';
import logger from './exec/logger';

export interface LocalTool {
  name: string;
  path: string;
  definition: any;
  lastModified: Date;
  cached: boolean;
}

export interface ToolResolutionResult {
  tool: LocalTool | any;
  source: 'local' | 'registry' | 'cache';
  metadata?: any;
}

export class LocalToolResolver {
  private localToolsDir: string;
  private cacheDir: string;
  private toolCache = new Map<string, LocalTool>();
  private aliases = new Map<string, string>();
  private favorites = new Set<string>();
  
  constructor(
    private enactCore: EnactCore,
    localToolsDir: string = './tools',
    cacheDir: string = './.tool-cache'
  ) {
    this.localToolsDir = resolve(localToolsDir);
    this.cacheDir = resolve(cacheDir);
    this.loadConfiguration();
  }

  /**
   * Main resolution method - checks local first, then registry
   */
  async resolveTool(toolName: string): Promise<ToolResolutionResult | null> {
    // Check aliases first
    const resolvedName = this.aliases.get(toolName) || toolName;
    
    // 1. Check local directory first
    const localTool = await this.getLocalTool(resolvedName);
    if (localTool) {
      return {
        tool: localTool,
        source: 'local',
        metadata: { path: localTool.path }
      };
    }

    // 2. Check cache for registry tools
    const cachedTool = this.toolCache.get(resolvedName);
    if (cachedTool && !this.isCacheExpired(cachedTool)) {
      return {
        tool: cachedTool,
        source: 'cache',
        metadata: { cachedAt: cachedTool.lastModified }
      };
    }

    // 3. Fall back to registry
    try {
      const registryTool = await this.enactCore.getToolByName(resolvedName);
      if (registryTool) {
        // Cache the registry tool locally
        await this.cacheRegistryTool(resolvedName, registryTool);
        
        return {
          tool: registryTool,
          source: 'registry',
          metadata: { cached: true }
        };
      }
    } catch (error) {
      logger.debug(`Registry lookup failed for ${resolvedName}:`, error);
    }

    return null;
  }

  /**
   * Get tool from local directory
   */
  private async getLocalTool(toolName: string): Promise<LocalTool | null> {
    const possiblePaths = [
      join(this.localToolsDir, `${toolName}.yaml`),
      join(this.localToolsDir, `${toolName}.yml`),
      join(this.localToolsDir, toolName, 'tool.yaml'),
      join(this.localToolsDir, toolName, 'tool.yml'),
      join(this.localToolsDir, toolName, `${toolName}.yaml`),
      join(this.localToolsDir, toolName, `${toolName}.yml`)
    ];

    for (const toolPath of possiblePaths) {
      try {
        const stats = await fs.stat(toolPath);
        const content = await fs.readFile(toolPath, 'utf-8');
        const definition = yaml.parse(content);

        if (definition && (definition.name === toolName || definition.name === undefined)) {
          return {
            name: definition.name || toolName,
            path: toolPath,
            definition,
            lastModified: stats.mtime,
            cached: false
          };
        }
      } catch (error) {
        // File doesn't exist or can't be read, continue to next path
        continue;
      }
    }

    return null;
  }

  /**
   * Cache a registry tool locally for faster access
   */
  private async cacheRegistryTool(toolName: string, tool: any): Promise<void> {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
      
      const cachePath = join(this.cacheDir, `${toolName}.yaml`);
      const cacheData = {
        ...tool,
        _cached: true,
        _cachedAt: new Date().toISOString(),
        _source: 'registry'
      };

      await fs.writeFile(cachePath, yaml.stringify(cacheData));
      
      this.toolCache.set(toolName, {
        name: toolName,
        path: cachePath,
        definition: tool,
        lastModified: new Date(),
        cached: true
      });

      logger.debug(`Cached registry tool: ${toolName}`);
    } catch (error) {
      logger.warn(`Failed to cache tool ${toolName}:`, error);
    }
  }

  /**
   * Check if cached tool is expired (24 hours by default)
   */
  private isCacheExpired(tool: LocalTool, maxAge: number = 24 * 60 * 60 * 1000): boolean {
    return Date.now() - tool.lastModified.getTime() > maxAge;
  }

  /**
   * List all available tools from all sources
   */
  async listAllTools(): Promise<{
    local: LocalTool[];
    cached: LocalTool[];
    favorites: string[];
    aliases: Record<string, string>;
  }> {
    const localTools = await this.scanLocalTools();
    const cachedTools = Array.from(this.toolCache.values());

    return {
      local: localTools,
      cached: cachedTools,
      favorites: Array.from(this.favorites),
      aliases: Object.fromEntries(this.aliases)
    };
  }

  /**
   * Scan local tools directory
   */
  private async scanLocalTools(): Promise<LocalTool[]> {
    const tools: LocalTool[] = [];

    try {
      await fs.mkdir(this.localToolsDir, { recursive: true });
      const entries = await this.scanDirectory(this.localToolsDir);
      
      for (const entry of entries) {
        if (entry.endsWith('.yaml') || entry.endsWith('.yml')) {
          try {
            const content = await fs.readFile(entry, 'utf-8');
            const definition = yaml.parse(content);
            
            if (definition && (definition.name || definition.command)) {
              const stats = await fs.stat(entry);
              tools.push({
                name: definition.name || basename(entry, '.yaml').replace('.yml', ''),
                path: entry,
                definition,
                lastModified: stats.mtime,
                cached: false
              });
            }
          } catch (error) {
            logger.debug(`Skipping invalid tool file ${entry}:`, error);
          }
        }
      }
    } catch (error) {
      logger.warn(`Failed to scan local tools directory:`, error);
    }

    return tools;
  }

  /**
   * Recursively scan directory for tool files
   */
  private async scanDirectory(dir: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        
        if (entry.isDirectory()) {
          const subFiles = await this.scanDirectory(fullPath);
          files.push(...subFiles);
        } else if (entry.isFile()) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      logger.debug(`Cannot scan directory ${dir}:`, error);
    }

    return files;
  }

  /**
   * Add a tool to favorites for priority resolution
   */
  addToFavorites(toolName: string): void {
    this.favorites.add(toolName);
    this.saveConfiguration();
  }

  /**
   * Add an alias for a tool
   */
  addAlias(alias: string, toolName: string): void {
    this.aliases.set(alias, toolName);
    this.saveConfiguration();
  }

  /**
   * Get suggestions based on partial tool name
   */
  async getSuggestions(partial: string): Promise<string[]> {
    const allTools = await this.listAllTools();
    const suggestions = new Set<string>();

    // Add local tools
    allTools.local.forEach(tool => {
      if (tool.name.includes(partial)) {
        suggestions.add(tool.name);
      }
    });

    // Add favorites first
    this.favorites.forEach(fav => {
      if (fav.includes(partial)) {
        suggestions.add(fav);
      }
    });

    // Add aliases
    this.aliases.forEach((toolName, alias) => {
      if (alias.includes(partial) || toolName.includes(partial)) {
        suggestions.add(alias);
      }
    });

    return Array.from(suggestions).slice(0, 10); // Limit suggestions
  }

  /**
   * Clear expired cache entries
   */
  async cleanupCache(): Promise<number> {
    let cleaned = 0;
    
    for (const [toolName, tool] of this.toolCache.entries()) {
      if (this.isCacheExpired(tool)) {
        try {
          await fs.unlink(tool.path);
          this.toolCache.delete(toolName);
          cleaned++;
        } catch (error) {
          logger.debug(`Failed to clean cache for ${toolName}:`, error);
        }
      }
    }

    logger.info(`Cleaned ${cleaned} expired cache entries`);
    return cleaned;
  }

  /**
   * Load configuration from file
   */
  private loadConfiguration(): void {
    try {
      const configPath = join(this.localToolsDir, 'config.json');
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      
      if (config.aliases) {
        this.aliases = new Map(Object.entries(config.aliases));
      }
      
      if (config.favorites) {
        this.favorites = new Set(config.favorites);
      }
    } catch (error) {
      // Config file doesn't exist or is invalid, use defaults
      logger.debug('No tool configuration found, using defaults');
    }
  }

  /**
   * Save configuration to file
   */
  private saveConfiguration(): void {
    try {
      const configPath = join(this.localToolsDir, 'config.json');
      const config = {
        aliases: Object.fromEntries(this.aliases),
        favorites: Array.from(this.favorites),
        lastUpdated: new Date().toISOString()
      };
      
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    } catch (error) {
      logger.warn('Failed to save tool configuration:', error);
    }
  }

  /**
   * Initialize local tools directory with examples
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.localToolsDir, { recursive: true });
    await fs.mkdir(this.cacheDir, { recursive: true });

    // Create a sample local tool if directory is empty
    const tools = await this.scanLocalTools();
    if (tools.length === 0) {
      const sampleTool = {
        name: 'hello-world',
        description: 'A simple hello world tool',
        version: '1.0.0',
        command: 'echo "Hello, World!"',
        inputSchema: {
          properties: {
            message: {
              type: 'string',
              description: 'Custom message to display'
            }
          }
        }
      };

      const samplePath = join(this.localToolsDir, 'hello-world.yaml');
      await fs.writeFile(samplePath, yaml.stringify(sampleTool));
      logger.info(`Created sample tool at ${samplePath}`);
    }

    // Create README
    const readmePath = join(this.localToolsDir, 'README.md');
    const readme = `# Local Tools Directory

This directory contains your local Enact tools. Tools can be organized as:

## File Structure
- \`tool-name.yaml\` - Single tool file
- \`tool-name/tool.yaml\` - Tool in subdirectory
- \`tool-name/tool-name.yaml\` - Named tool in subdirectory

## Configuration
- \`config.json\` - Aliases and favorites configuration

## Cache
Registry tools are cached in \`.tool-cache/\` for faster access.

## Priority Order
1. Favorites (if name matches)
2. Local tools
3. Cached registry tools
4. Registry lookup

Use the MCP tools to manage this directory programmatically.
`;

    try {
      await fs.access(readmePath);
    } catch {
      await fs.writeFile(readmePath, readme);
    }
  }
}

export default LocalToolResolver;
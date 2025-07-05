// src/core/DaggerExecutionProvider.ts - Enhanced Dagger execution provider with hanging prevention
import { connect, Client, Container } from "@dagger.io/dagger";
import { ExecutionProvider, type EnactTool, type ExecutionEnvironment, type ExecutionResult } from "../types.js";
import logger from "../exec/logger.js";
import { parseTimeout } from "../utils/timeout.js";
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { spawn, spawnSync } from 'child_process';

export interface DaggerExecutionOptions {
  baseImage?: string;           // Default container image
  workdir?: string;             // Working directory in container
  enableNetwork?: boolean;      // Allow network access
  enableHostFS?: boolean;       // Allow mounting host filesystem
  maxMemory?: string;          // Memory limit (e.g., "512Mi", "2Gi")
  maxCPU?: string;             // CPU limit (e.g., "0.5", "2")
  cacheVolume?: string;        // Cache volume name for persistence
  useShell?: boolean;          // Use shell wrapper for complex commands
  engineTimeout?: number;      // Engine connection timeout (ms)
  maxRetries?: number;         // Max retries for failed operations
  enableEngineHealthCheck?: boolean; // Enable periodic engine health checks
}

interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

interface EngineHealthStatus {
  isHealthy: boolean;
  lastCheck: Date;
  consecutiveFailures: number;
}

export class DaggerExecutionProvider extends ExecutionProvider {
  private client: Client | null = null;
  private options: DaggerExecutionOptions;
  private tempDir: string;
  private connectionCleanup: (() => void) | null = null;
  private engineHealth: EngineHealthStatus;
  private abortController: AbortController | null = null;
  private activeSessions: Set<string> = new Set();
  private isShuttingDown = false;

  constructor(options: DaggerExecutionOptions = {}) {
    super();
    this.options = {
      baseImage: "node:20-slim",
      workdir: "/workspace",
      enableNetwork: true,
      enableHostFS: false,
      useShell: true,
      engineTimeout: 30000,     // 30 second engine timeout
      maxRetries: 3,            // Max 3 retries
      enableEngineHealthCheck: true,
      ...options
    };
    this.tempDir = '';
    this.engineHealth = {
      isHealthy: true,
      lastCheck: new Date(),
      consecutiveFailures: 0
    };
    
    // Register comprehensive cleanup handlers
    this.registerCleanupHandlers();
    
    // Start periodic health checks if enabled
    if (this.options.enableEngineHealthCheck) {
      this.startEngineHealthMonitoring();
    }
  }

  async setup(tool: EnactTool): Promise<boolean> {
    try {
      // Perform engine health check before setup
      if (!(await this.checkEngineHealth())) {
        logger.warn('🔧 Engine unhealthy, attempting reset...');
        await this.resetEngineContainer();
      }

      // Create a temporary directory for this execution
      this.tempDir = path.join('/tmp', `enact-${crypto.randomBytes(8).toString('hex')}`);
      await fs.mkdir(this.tempDir, { recursive: true });
      
      logger.info(`🐳 Dagger execution provider initialized for tool: ${tool.name}`);
      return true;
    } catch (error) {
      logger.error(`Failed to setup Dagger execution provider: ${error}`);
      return false;
    }
  }

  /**
   * Enhanced cleanup with comprehensive engine management and session tracking
   */
  async cleanup(): Promise<boolean> {
    this.isShuttingDown = true;
    
    try {
      // Cancel any active operations
      if (this.abortController) {
        this.abortController.abort();
      }

      // Wait for active sessions to complete (with timeout)
      await this.waitForActiveSessions(5000);

      // Clean up temporary directory
      if (this.tempDir) {
        await fs.rm(this.tempDir, { recursive: true, force: true });
      }
      
      // Enhanced engine cleanup with better detection and error handling
      await this.performEngineCleanup();
      
      // Reset client reference
      this.client = null;
      
      logger.info("🧹 Dagger execution provider cleaned up successfully");
      return true;
    } catch (error) {
      logger.error(`Failed to cleanup Dagger execution provider: ${error}`);
      return false;
    }
  }

  /**
   * Enhanced engine cleanup with better container detection
   */
  private async performEngineCleanup(): Promise<void> {
    try {
      logger.debug('🔍 Detecting Dagger engine containers...');
      
      // Get all Dagger engine containers (running and stopped)
      const containerListResult = spawnSync('docker', [
        'container', 'list', '--all',
        '--filter', 'name=^dagger-engine-*',
        '--format', '{{.Names}}'
      ], {
        encoding: 'utf8',
        timeout: 10000
      });

      if (containerListResult.error) {
        logger.warn('Could not list Docker containers, skipping engine cleanup');
        return;
      }

      const containerNames = containerListResult.stdout
        .trim()
        .split('\n')
        .filter(name => name.trim())
        .map(name => name.trim());

      if (containerNames.length === 0) {
        logger.debug('No Dagger engine containers found');
        return;
      }

      logger.info(`🔄 Found ${containerNames.length} Dagger engine container(s), cleaning up...`);

      // Force remove all engine containers
      for (const containerName of containerNames) {
        try {
          logger.debug(`Removing container: ${containerName}`);
          spawnSync('docker', ['container', 'rm', '-f', containerName], {
            timeout: 10000
          });
        } catch (e) {
          logger.debug(`Failed to remove container ${containerName}:`, e);
        }
      }

      // Optional: Clean up engine images if requested (more aggressive cleanup)
      if (process.env.DAGGER_AGGRESSIVE_CLEANUP === 'true') {
        logger.debug('🧹 Performing aggressive cleanup - removing engine images...');
        spawnSync('docker', [
          'rmi', '--force',
          ...(spawnSync('docker', ['images', '-q', '--filter', 'reference=registry.dagger.io/engine'], {
            encoding: 'utf8'
          }).stdout.trim().split('\n').filter(Boolean))
        ], { timeout: 15000 });
      }

      logger.info('✅ Dagger engine cleanup completed');
    } catch (error) {
      logger.debug('Engine cleanup failed (this is usually fine):', error);
    }
  }

  /**
   * Check engine health with comprehensive diagnostics
   */
  private async checkEngineHealth(): Promise<boolean> {
    try {
      // Check if Docker daemon is accessible
      const dockerCheck = spawnSync('docker', ['version'], {
        encoding: 'utf8',
        timeout: 5000
      });

      if (dockerCheck.error || dockerCheck.status !== 0) {
        logger.warn('Docker daemon not accessible');
        this.engineHealth.consecutiveFailures++;
        return false;
      }

      // Check for hanging engine containers
      const hangingContainers = spawnSync('docker', [
        'ps', '--filter', 'name=dagger-engine',
        '--filter', 'status=exited',
        '--format', '{{.Names}}'
      ], {
        encoding: 'utf8',
        timeout: 5000
      });

      if (hangingContainers.stdout.trim()) {
        logger.warn('Detected stopped Dagger engine containers');
        this.engineHealth.consecutiveFailures++;
        return false;
      }

      // Reset failure count on success
      this.engineHealth.consecutiveFailures = 0;
      this.engineHealth.isHealthy = true;
      this.engineHealth.lastCheck = new Date();
      return true;
    } catch (error) {
      logger.debug('Engine health check failed:', error);
      this.engineHealth.consecutiveFailures++;
      return false;
    }
  }

  /**
   * Reset engine container when health check fails
   */
  private async resetEngineContainer(): Promise<void> {
    logger.info('🔄 Resetting Dagger engine container...');
    
    try {
      // Stop and remove all engine containers
      await this.performEngineCleanup();
      
      // Wait a moment for cleanup to complete
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Engine will auto-restart on next connection
      this.engineHealth.isHealthy = true;
      this.engineHealth.consecutiveFailures = 0;
      
      logger.info('✅ Engine reset completed');
    } catch (error) {
      logger.error('Failed to reset engine container:', error);
      throw error;
    }
  }

  /**
   * Start periodic engine health monitoring
   */
  private startEngineHealthMonitoring(): void {
    // Check engine health every 60 seconds
    setInterval(async () => {
      if (this.isShuttingDown) return;
      
      const isHealthy = await this.checkEngineHealth();
      
      if (!isHealthy && this.engineHealth.consecutiveFailures >= 3) {
        logger.warn('🚨 Engine health degraded, triggering reset...');
        try {
          await this.resetEngineContainer();
        } catch (error) {
          logger.error('Failed to auto-reset engine:', error);
        }
      }
    }, 60000);
  }

  /**
   * Wait for active sessions to complete with timeout
   */
  private async waitForActiveSessions(timeoutMs: number): Promise<void> {
    if (this.activeSessions.size === 0) return;
    
    logger.info(`⏳ Waiting for ${this.activeSessions.size} active sessions to complete...`);
    
    const startTime = Date.now();
    while (this.activeSessions.size > 0 && (Date.now() - startTime) < timeoutMs) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (this.activeSessions.size > 0) {
      logger.warn(`⚠️ ${this.activeSessions.size} sessions did not complete within timeout`);
    }
  }

  async resolveEnvironmentVariables(envConfig: Record<string, any>, namespace?: string): Promise<Record<string, any>> {
    const resolved: Record<string, any> = {};
    
    for (const [key, config] of Object.entries(envConfig)) {
      if (typeof config === 'object' && config.source) {
        switch (config.source) {
          case 'env':
            resolved[key] = process.env[key] || config.default;
            break;
          case 'user':
            resolved[key] = config.default;
            break;
          default:
            resolved[key] = config.default;
        }
      } else {
        resolved[key] = config;
      }
    }
    
    return resolved;
  }

  async execute(tool: EnactTool, inputs: Record<string, any>, environment: ExecutionEnvironment): Promise<ExecutionResult> {
    const executionId = crypto.randomBytes(16).toString('hex');
    const startTime = new Date().toISOString();

    // Track this session
    this.activeSessions.add(executionId);

    try {
      logger.info(`🚀 Executing Enact tool "${tool.name}" in Dagger container`);
      logger.debug(`Tool command: ${tool.command}`);
      logger.debug(`Tool timeout: ${tool.timeout || 'default'}`);

      // Retry logic for handling transient failures
      let lastError: Error | null = null;
      for (let attempt = 1; attempt <= this.options.maxRetries!; attempt++) {
        try {
          // Check engine health before each attempt
          if (!(await this.checkEngineHealth())) {
            logger.warn(`Attempt ${attempt}: Engine unhealthy, resetting...`);
            await this.resetEngineContainer();
          }

          const result = await this.executeCommand(
            tool.command,
            inputs,
            environment,
            tool.timeout
          );

          logger.debug(`Command result: exitCode=${result.exitCode}, stdout length=${result.stdout?.length || 0}, stderr length=${result.stderr?.length || 0}`);

          const output = this.parseOutput(result.stdout, tool);

          return {
            success: result.exitCode === 0,
            output: output,
            error: result.exitCode !== 0 ? {
              message: result.stderr || 'Command failed',
              code: result.exitCode.toString(),
              details: {
                stdout: result.stdout,
                stderr: result.stderr,
                exitCode: result.exitCode,
                attempt
              }
            } : undefined,
            metadata: {
              executionId,
              toolName: tool.name,
              version: tool.version || '1.0.0',
              executedAt: startTime,
              environment: 'dagger',
              timeout: tool.timeout,
              command: tool.command
            }
          };

        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          logger.warn(`Attempt ${attempt}/${this.options.maxRetries} failed: ${lastError.message}`);
          
          if (attempt < this.options.maxRetries!) {
            // Wait before retry with exponential backoff
            const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
            logger.debug(`Waiting ${waitTime}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }
      }

      // All retries failed
      throw lastError || new Error('Unknown error during execution');

    } catch (error) {
      logger.error(`Execution failed for Enact tool ${tool.name}: ${error}`);
      
      // Enhanced error categorization
      const errorType = this.categorizeError(error);
      
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          code: errorType,
          details: {
            error,
            engineHealth: this.engineHealth,
            activeSessions: this.activeSessions.size
          }
        },
        metadata: {
          executionId,
          toolName: tool.name,
          version: tool.version || '1.0.0',
          executedAt: startTime,
          environment: 'dagger',
          timeout: tool.timeout,
          command: tool.command
        }
      };
    } finally {
      // Remove from active sessions
      this.activeSessions.delete(executionId);
    }
  }

  /**
   * Categorize errors for better handling
   */
  private categorizeError(error: unknown): string {
    if (!(error instanceof Error)) return 'UNKNOWN_ERROR';
    
    const message = error.message.toLowerCase();
    
    if (message.includes('timeout') || message.includes('timed out')) {
      return 'TIMEOUT';
    }
    if (message.includes('buildkit') || message.includes('failed to respond')) {
      return 'ENGINE_CONNECTION_ERROR';
    }
    if (message.includes('docker') || message.includes('container')) {
      return 'CONTAINER_ERROR';
    }
    if (message.includes('network') || message.includes('dns')) {
      return 'NETWORK_ERROR';
    }
    
    return 'EXECUTION_ERROR';
  }

  async executeCommand(
    command: string,
    inputs: Record<string, any>,
    environment: ExecutionEnvironment,
    timeout?: string,
    options?: {
      verbose?: boolean;
      showSpinner?: boolean;
      streamOutput?: boolean;
    }
  ): Promise<CommandResult> {
    const verbose = options?.verbose ?? false;
    const showSpinner = options?.showSpinner ?? false;

    // Create abort controller for this execution
    this.abortController = new AbortController();

    // Start spinner if requested
    let spinner: any = null;
    if (showSpinner) {
      try {
        const p = require('@clack/prompts');
        spinner = p.spinner();
        spinner.start('Executing Enact tool in container...');
      } catch (e) {
        console.log('Executing Enact tool in container...');
      }
    }

    try {
      // Substitute template variables in command (Enact Protocol style)
      const substitutedCommand = this.substituteCommandVariables(command, inputs);

      if (verbose) {
        try {
          const pc = require('picocolors');
          console.error(pc.cyan('\n🐳 Executing Enact command in Dagger container:'));
          console.error(pc.white(substitutedCommand));
          console.error(pc.gray(`Base image: ${this.options.baseImage}`));
        } catch (e) {
          console.error('\n🐳 Executing Enact command in Dagger container:');
          console.error(substitutedCommand);
          console.error(`Base image: ${this.options.baseImage}`);
        }
      }

      // Parse and apply timeout with engine timeout consideration
      const timeoutMs = timeout ? parseTimeout(timeout) : 30000;
      const effectiveTimeout = Math.max(timeoutMs, this.options.engineTimeout!);
      logger.debug(`Parsed timeout: ${effectiveTimeout}ms (command: ${timeoutMs}ms, engine: ${this.options.engineTimeout}ms)`);

      // Execute command with enhanced error handling and timeout management
      const result = await Promise.race([
        this.executeWithConnect(substitutedCommand, environment, inputs),
        this.createTimeoutPromise(effectiveTimeout)
      ]);

      if (spinner) {
        spinner.stop('✅ Enact tool execution completed');
      }

      return result;

    } catch (error) {
      if (spinner) {
        spinner.stop('❌ Enact tool execution failed');
      }

      // Enhanced timeout handling
      if (error instanceof Error && (error.message === 'TIMEOUT' || error.message.includes('timed out'))) {
        // Mark engine as potentially unhealthy after timeout
        this.engineHealth.consecutiveFailures++;
        throw new Error(`Command timed out after ${timeout || '30s'} - consider increasing timeout or checking engine health`);
      }

      // Handle connection errors specifically
      if (error instanceof Error && error.message.includes('buildkit failed to respond')) {
        this.engineHealth.consecutiveFailures++;
        throw new Error('Dagger engine connection failed - engine may need reset');
      }

      throw error;
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Execute command using Dagger connect with proper session management
   */
  private async executeWithConnect(
    command: string,
    environment: ExecutionEnvironment,
    inputs: Record<string, any>
  ): Promise<CommandResult> {
    return new Promise<CommandResult>((resolve, reject) => {
      // Setup abort handling
      const abortHandler = () => {
        reject(new Error('Execution aborted'));
      };
      
      if (this.abortController) {
        this.abortController.signal.addEventListener('abort', abortHandler);
      }

      connect(async (client: Client) => {
        try {
          logger.debug('🔗 Connected to Dagger client');
          const container = await this.setupContainer(client, environment, inputs);
          logger.debug('📦 Container setup complete');
          const commandResult = await this.executeInContainer(container, command);
          logger.debug('⚡ Command execution complete');
          
          // Remove abort handler on success
          if (this.abortController) {
            this.abortController.signal.removeEventListener('abort', abortHandler);
          }
          
          resolve(commandResult);
        } catch (error) {
          logger.error('❌ Error in Dagger execution:', error);
          
          // Remove abort handler on error
          if (this.abortController) {
            this.abortController.signal.removeEventListener('abort', abortHandler);
          }
          
          reject(error);
        }
      }).catch((error) => {
        logger.error('❌ Error in Dagger connect:', error);
        
        // Remove abort handler on connection error
        if (this.abortController) {
          this.abortController.signal.removeEventListener('abort', abortHandler);
        }
        
        reject(error);
      });
    });
  }

  /**
   * Enhanced container setup with better tool detection and installation
   */
  private async setupContainer(client: Client, environment: ExecutionEnvironment, inputs: Record<string, any>): Promise<Container> {
    logger.debug(`🚀 Setting up container with base image: ${this.options.baseImage}`);
    
    // Start with base container
    let container = client.container().from(this.options.baseImage!);
    logger.debug('📦 Base container created');

    // Set working directory
    container = container.withWorkdir(this.options.workdir!);
    logger.debug(`📁 Working directory set to: ${this.options.workdir}`);

    // Add environment variables from Enact tool env config
    for (const [key, value] of Object.entries(environment.vars)) {
      container = container.withEnvVariable(key, String(value));
    }
    logger.debug(`🌍 Added ${Object.keys(environment.vars).length} environment variables`);

    // Install common tools needed for Enact commands
    if (this.options.enableNetwork) {
      container = await this.installCommonTools(container);
      logger.debug('🔧 Common tools installed');
    } else {
      logger.debug('🔧 Skipping common tools installation (network disabled)');
    }

    // Create input files if needed (Enact Protocol supports file inputs)
    container = await this.prepareInputFiles(container, inputs);
    logger.debug('📄 Input files prepared');

    // Apply resource limits if specified
    if (environment.resources) {
      container = this.applyResourceLimits(container, environment.resources);
      logger.debug('💾 Resource limits applied');
    }

    logger.debug('✅ Container setup complete');
    return container;
  }

  /**
   * Install common tools that Enact commands might need
   * Enhanced with better error handling and timeout
   */
  private async installCommonTools(container: Container): Promise<Container> {
    logger.debug(`🔧 Installing common tools for base image: ${this.options.baseImage}`);
    
    try {
      // For node images, most tools are already available, so we can skip installation
      if (this.options.baseImage?.includes('node:')) {
        logger.debug('📦 Node.js image detected, skipping tool installation (most tools already available)');
        return container;
      }
      
      // Determine package manager based on base image
      const isAlpine = this.options.baseImage?.includes('alpine');
      const isDebian = this.options.baseImage?.includes('debian') || 
                       this.options.baseImage?.includes('ubuntu');

      if (isAlpine) {
        logger.debug('📦 Detected Alpine Linux, installing basic tools');
        // Alpine Linux uses apk package manager - with better timeout handling
        container = container.withExec([
          'sh', '-c', 
          'timeout 60 apk update --no-cache && timeout 60 apk add --no-cache curl wget git || echo "Package installation failed, continuing..."'
        ]);
      } else if (isDebian) {
        logger.debug('📦 Detected Debian/Ubuntu, installing basic tools');
        // Debian/Ubuntu uses apt-get - with better timeout and error handling
        container = container.withExec([
          'sh', '-c', 
          'timeout 60 apt-get update && timeout 60 apt-get install -y curl wget git && rm -rf /var/lib/apt/lists/* || echo "Package installation failed, continuing..."'
        ]);
      } else {
        logger.warn(`Unknown base image ${this.options.baseImage}, skipping tool installation`);
      }

      logger.debug('✅ Common tools installation complete');
      return container;
      
    } catch (error) {
      logger.warn(`⚠️ Tool installation failed, continuing without additional tools: ${error}`);
      return container;
    }
  }

  /**
   * Execute command in container with enhanced error handling
   */
  private async executeInContainer(container: Container, command: string): Promise<CommandResult> {
    logger.debug(`⚡ Executing command in container: ${command}`);
    
    try {
      let execContainer: Container;
      
      if (this.options.useShell) {
        logger.debug('🐚 Using shell wrapper for command execution');
        execContainer = container.withExec(['sh', '-c', command]);
      } else {
        logger.debug('📋 Using direct command execution');
        const commandParts = this.parseCommand(command);
        execContainer = container.withExec(commandParts);
      }

      logger.debug('📤 Getting stdout from container...');
      const stdout = await execContainer.stdout();
      logger.debug(`📥 Got stdout: ${stdout.length} characters`);
      
      let stderr = '';
      try {
        logger.debug('📤 Getting stderr from container...');
        stderr = await execContainer.stderr();
        logger.debug(`📥 Got stderr: ${stderr.length} characters`);
      } catch (e) {
        logger.debug('📥 stderr not available (this is normal for successful commands)');
      }

      logger.debug('✅ Command executed successfully');
      return {
        stdout,
        stderr,
        exitCode: 0
      };
      
    } catch (error) {
      logger.debug(`❌ Command execution failed: ${error}`);
      const errorMessage = error instanceof Error ? error.message : 'Command execution failed';
      const parsedError = this.parseExecutionError(errorMessage);
      
      return {
        stdout: parsedError.stdout || '',
        stderr: parsedError.stderr || errorMessage,
        exitCode: parsedError.exitCode || 1
      };
    }
  }

  /**
   * Enhanced execution error parsing
   */
  private parseExecutionError(errorMessage: string): Partial<CommandResult> {
    const result: Partial<CommandResult> = {};

    const exitCodeMatch = errorMessage.match(/exit code:?\s*(\d+)/);
    if (exitCodeMatch) {
      result.exitCode = parseInt(exitCodeMatch[1], 10);
    }

    const stdoutMatch = errorMessage.match(/(?:stdout|Stdout):\s*\n([\s\S]*?)(?:\n(?:stderr|Stderr):|$)/i);
    if (stdoutMatch) {
      result.stdout = stdoutMatch[1].trim();
    }

    const stderrMatch = errorMessage.match(/(?:stderr|Stderr):\s*\n([\s\S]*)$/i);
    if (stderrMatch) {
      result.stderr = stderrMatch[1].trim();
    }

    if (!result.stderr && !result.stdout) {
      result.stderr = errorMessage;
    }

    if (!result.exitCode) {
      result.exitCode = 1;
    }

    return result;
  }

  /**
   * Apply resource limits based on Enact tool specifications
   */
  private applyResourceLimits(container: Container, resources: any): Container {
    if (resources.memory) {
      logger.info(`Resource limit requested: memory=${resources.memory} (not yet supported by Dagger)`);
    }
    if (resources.cpu) {
      logger.info(`Resource limit requested: cpu=${resources.cpu} (not yet supported by Dagger)`);
    }
    return container;
  }

  /**
   * Substitute template variables in Enact commands with enhanced security
   */
  private substituteCommandVariables(command: string, inputs: Record<string, any>): string {
    let substitutedCommand = command;
    
    for (const [key, value] of Object.entries(inputs)) {
      const templateVar = `\${${key}}`;
      let substitutionValue: string;
      
      if (typeof value === 'string') {
        substitutionValue = this.escapeShellArg(value);
      } else if (typeof value === 'object') {
        substitutionValue = this.escapeShellArg(JSON.stringify(value));
      } else {
        substitutionValue = this.escapeShellArg(String(value));
      }
      
      substitutedCommand = substitutedCommand.replace(
        new RegExp(`\\$\\{${key}\\}`, 'g'), 
        substitutionValue
      );
    }
    
    return substitutedCommand;
  }

  /**
   * Enhanced shell argument escaping
   */
  private escapeShellArg(arg: string): string {
    // For maximum safety, use single quotes and escape any single quotes within
    return "'" + arg.replace(/'/g, "'\"'\"'") + "'";
  }

  /**
   * Prepare input files for Enact tools that expect file inputs
   */
  private async prepareInputFiles(container: Container, inputs: Record<string, any>): Promise<Container> {
    for (const [key, value] of Object.entries(inputs)) {
      if (typeof value === 'string' && this.looksLikeFileContent(key, value)) {
        const fileName = this.getInputFileName(key, value);
        const filePath = `${this.options.workdir}/${fileName}`;
        
        container = container.withNewFile(filePath, { contents: value });
        logger.debug(`📁 Added input file for Enact tool: ${filePath}`);
      }
    }
    
    return container;
  }

  /**
   * Heuristics to determine if input should be treated as file content
   */
  private looksLikeFileContent(key: string, value: string): boolean {
    const lowerKey = key.toLowerCase();
    return (
      lowerKey.includes('file') ||
      lowerKey.includes('content') ||
      lowerKey.includes('data') ||
      lowerKey.includes('source') ||
      lowerKey.includes('input') && value.length > 100 ||
      value.includes('\n') ||
      value.startsWith('data:') ||
      this.hasCommonFileExtensions(value)
    );
  }

  /**
   * Check if content looks like common file types
   */
  private hasCommonFileExtensions(value: string): boolean {
    const trimmed = value.trim();
    return (
      trimmed.startsWith('{') && trimmed.endsWith('}') ||
      trimmed.startsWith('<') && trimmed.includes('>') ||
      trimmed.startsWith('#') ||
      /^---\s*\n/.test(trimmed)
    );
  }

  /**
   * Generate appropriate filename for input content
   */
  private getInputFileName(key: string, value: string): string {
    const lowerKey = key.toLowerCase();
    const trimmedValue = value.trim();

    if (lowerKey.includes('markdown') || lowerKey.includes('md')) return `${key}.md`;
    if (lowerKey.includes('json')) return `${key}.json`;
    if (lowerKey.includes('yaml') || lowerKey.includes('yml')) return `${key}.yaml`;
    if (lowerKey.includes('html')) return `${key}.html`;
    if (lowerKey.includes('css')) return `${key}.css`;
    if (lowerKey.includes('js') || lowerKey.includes('javascript')) return `${key}.js`;
    if (lowerKey.includes('python') || lowerKey.includes('py')) return `${key}.py`;

    if (trimmedValue.startsWith('#')) return `${key}.md`;
    if (trimmedValue.startsWith('{') && trimmedValue.endsWith('}')) return `${key}.json`;
    if (/^---\s*\n/.test(trimmedValue)) return `${key}.yaml`;
    if (trimmedValue.includes('<html')) return `${key}.html`;
    
    if (trimmedValue.startsWith('data:')) {
      const mimeMatch = trimmedValue.match(/^data:([^;]+)/);
      if (mimeMatch) {
        const ext = this.getExtensionFromMimeType(mimeMatch[1]);
        return `${key}${ext}`;
      }
    }
    
    return `${key}.txt`;
  }

  /**
   * Map MIME types to file extensions
   */
  private getExtensionFromMimeType(mimeType: string): string {
    const mimeMap: Record<string, string> = {
      'text/plain': '.txt',
      'text/markdown': '.md',
      'text/html': '.html',
      'text/css': '.css',
      'application/json': '.json',
      'application/javascript': '.js',
      'text/javascript': '.js',
      'application/yaml': '.yaml',
      'text/yaml': '.yaml',
      'text/x-python': '.py',
      'application/x-python-code': '.py',
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/gif': '.gif',
      'image/svg+xml': '.svg'
    };
    
    return mimeMap[mimeType] || '.txt';
  }

  /**
   * Enhanced command parsing for non-shell execution
   */
  private parseCommand(command: string): string[] {
    const args: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';
    
    for (let i = 0; i < command.length; i++) {
      const char = command[i];
      
      if ((char === '"' || char === "'") && !inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar && inQuotes) {
        inQuotes = false;
        quoteChar = '';
      } else if (char === ' ' && !inQuotes) {
        if (current) {
          args.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }
    
    if (current) {
      args.push(current);
    }
    
    return args;
  }

  /**
   * Enhanced timeout promise with abort signal support
   */
  private createTimeoutPromise(timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('TIMEOUT'));
      }, timeoutMs);

      // Clear timeout if aborted
      if (this.abortController) {
        this.abortController.signal.addEventListener('abort', () => {
          clearTimeout(timeoutId);
          reject(new Error('ABORTED'));
        });
      }
    });
  }

  /**
   * Parse command output according to Enact tool output schema
   */
  private parseOutput(stdout: string, tool: EnactTool): any {
    if (!stdout.trim()) {
      return null;
    }

    if (tool.outputSchema) {
      try {
        const parsed = JSON.parse(stdout);
        // TODO: Validate against outputSchema if validation library is available
        return parsed;
      } catch {
        logger.warn(`Tool ${tool.name} has outputSchema but produced non-JSON output`);
        return stdout;
      }
    }

    try {
      return JSON.parse(stdout);
    } catch {
      return stdout;
    }
  }

  /**
   * Execute command with exec.ts style interface for backwards compatibility
   */
  async executeCommandExecStyle(
    command: string,
    timeout: string,
    verbose: boolean = false,
    envVars: Record<string, string> = {}
  ): Promise<void> {
    const environment: ExecutionEnvironment = {
      vars: envVars,
      resources: { timeout }
    };
    
    const result = await this.executeCommand(
      command,
      {},
      environment,
      timeout,
      {
        verbose,
        showSpinner: true,
        streamOutput: false
      }
    );
    
    if (result.exitCode !== 0) {
      throw new Error(`Command failed with exit code ${result.exitCode}: ${result.stderr}`);
    }
  }

  /**
   * Enhanced cleanup handlers with graceful shutdown
   */
  private registerCleanupHandlers(): void {
    const cleanup = () => {
      if (!this.isShuttingDown) {
        this.gracefulShutdown();
      }
    };

    // Register multiple signal handlers for comprehensive cleanup
    process.once('SIGTERM', cleanup);
    process.once('SIGINT', cleanup);
    process.once('SIGUSR2', cleanup); // For nodemon
    process.once('exit', cleanup);
    
    // Handle unhandled promise rejections
    process.once('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      cleanup();
    });

    // Handle uncaught exceptions
    process.once('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      cleanup();
    });
  }

  /**
   * Graceful shutdown with proper async cleanup
   */
  private async gracefulShutdown(): Promise<void> {
    this.isShuttingDown = true;
    
    try {
      logger.info('🔄 Starting graceful shutdown...');
      
      // Cancel any active operations
      if (this.abortController) {
        this.abortController.abort();
      }

      // Wait for active sessions with timeout
      await this.waitForActiveSessions(10000);

      // Perform comprehensive cleanup
      await this.cleanup();
      
      logger.info('✅ Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('❌ Error during graceful shutdown:', error);
      process.exit(1);
    }
  }

  /**
   * Enhanced force cleanup for synchronous exit handlers
   */
  private forceCleanup(): void {
    if (this.isShuttingDown) return;
    
    try {
      logger.info('🔄 Force cleaning up Dagger engines...');
      
      const result = spawnSync('docker', [
        'ps', '--all', '--filter', 'name=dagger-engine', 
        '--format', '{{.Names}}'
      ], {
        encoding: 'utf8',
        timeout: 5000
      });
      
      if (result.stdout) {
        const names = result.stdout.trim().split('\n').filter((n: string) => n.trim());
        if (names.length > 0) {
          logger.info(`Found ${names.length} engine containers, force removing...`);
          for (const name of names) {
            spawnSync('docker', ['rm', '-f', name.trim()], { timeout: 3000 });
          }
          logger.info('✅ Force cleanup completed');
        }
      }
    } catch (error) {
      logger.debug('Force cleanup failed (this is usually fine):', error);
    }
  }

  /**
   * Get current engine status for debugging
   */
  public getEngineStatus(): {
    health: EngineHealthStatus;
    activeSessions: number;
    isShuttingDown: boolean;
  } {
    return {
      health: { ...this.engineHealth },
      activeSessions: this.activeSessions.size,
      isShuttingDown: this.isShuttingDown
    };
  }

  /**
   * Manually trigger engine reset (for debugging/testing)
   */
  public async resetEngine(): Promise<void> {
    logger.info('🔄 Manual engine reset triggered...');
    await this.resetEngineContainer();
  }

  /**
   * Check if provider is ready for new executions
   */
  public isReady(): boolean {
    return !this.isShuttingDown && 
           this.engineHealth.isHealthy && 
           this.engineHealth.consecutiveFailures < 3;
  }
}

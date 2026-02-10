/**
 * Execution Router
 *
 * Config-driven backend selection for tool execution.
 * Selects the appropriate execution provider based on:
 *   - CLI flags (--local overrides everything)
 *   - trusted_scopes (matching scopes bypass containers)
 *   - default backend preference
 *   - fallback if default is unavailable
 */

import type { ExecutionBackend } from "@enactprotocol/shared";
import type { ExecutionProvider } from "@enactprotocol/shared";

/**
 * Configuration for execution routing
 */
export interface ExecutionRoutingConfig {
  /** Default execution backend */
  default?: ExecutionBackend | undefined;
  /** Fallback backend if default is unavailable */
  fallback?: ExecutionBackend | undefined;
  /** Package scopes that bypass container isolation (e.g., ["@my-org/*"]) */
  trusted_scopes?: string[] | undefined;
}

/**
 * Options passed when selecting a provider
 */
export interface ProviderSelectionOptions {
  /** Force local execution (--local flag) */
  forceLocal?: boolean | undefined;
  /** Force remote execution (--remote flag) */
  forceRemote?: boolean | undefined;
}

/**
 * Routes execution to the appropriate provider based on config and tool identity.
 */
export class ExecutionRouter {
  private providers = new Map<string, ExecutionProvider>();
  private config: ExecutionRoutingConfig;

  constructor(config: ExecutionRoutingConfig = {}) {
    this.config = config;
  }

  /**
   * Register an execution provider by name
   */
  registerProvider(name: string, provider: ExecutionProvider): void {
    this.providers.set(name, provider);
  }

  /**
   * Select the appropriate provider for a given tool
   */
  async selectProvider(
    toolName: string,
    options: ProviderSelectionOptions = {}
  ): Promise<ExecutionProvider> {
    // 1. CLI flag overrides
    if (options.forceLocal) {
      const local = this.providers.get("local");
      if (local) return local;
    }

    if (options.forceRemote) {
      const remote = this.providers.get("remote");
      if (remote && (await remote.isAvailable())) return remote;
    }

    // 2. Trusted scopes bypass containers
    if (this.isTrustedScope(toolName)) {
      const local = this.providers.get("local");
      if (local) return local;
    }

    // 3. Try the configured default backend
    const defaultBackend = this.config.default ?? "container";
    const defaultProvider = await this.resolveBackend(defaultBackend);
    if (defaultProvider) return defaultProvider;

    // 4. Try the configured fallback backend
    if (this.config.fallback) {
      const fallbackProvider = await this.resolveBackend(this.config.fallback);
      if (fallbackProvider) return fallbackProvider;
    }

    // 5. Last resort: local execution
    const local = this.providers.get("local");
    if (local) return local;

    throw new Error(
      "No execution provider available. Install Docker or configure a remote backend."
    );
  }

  /**
   * Check if a tool name matches any trusted scope pattern
   */
  private isTrustedScope(toolName: string): boolean {
    if (!this.config.trusted_scopes?.length) return false;

    for (const pattern of this.config.trusted_scopes) {
      if (pattern.endsWith("/*")) {
        // Wildcard: "@my-org/*" matches "@my-org/anything"
        const prefix = pattern.slice(0, -2);
        if (toolName.startsWith(`${prefix}/`)) return true;
      } else if (pattern === toolName) {
        return true;
      }
    }

    return false;
  }

  /**
   * Resolve a backend name to an available provider.
   * "container" is an alias that tries docker, then dagger.
   */
  private async resolveBackend(backend: ExecutionBackend): Promise<ExecutionProvider | null> {
    if (backend === "container") {
      // Try dagger first (full feature support), then docker as fallback
      for (const name of ["dagger", "docker"]) {
        const provider = this.providers.get(name);
        if (provider && (await provider.isAvailable())) return provider;
      }
      return null;
    }

    const provider = this.providers.get(backend);
    if (provider && (await provider.isAvailable())) return provider;
    return null;
  }
}

/**
 * Create an execution router with the given config
 */
export function createRouter(config: ExecutionRoutingConfig = {}): ExecutionRouter {
  return new ExecutionRouter(config);
}

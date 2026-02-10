/**
 * Remote Execution Provider
 *
 * Delegates tool execution to a remote endpoint.
 * Useful when no local container runtime is available.
 */

import type { Action, ActionsManifest, ToolManifest } from "@enactprotocol/shared";
import { applyDefaults, getEffectiveInputSchema, validateInputs } from "@enactprotocol/shared";
import type {
  EngineHealth,
  ExecutionErrorCode,
  ExecutionInput,
  ExecutionOptions,
  ExecutionProvider,
  ExecutionResult,
} from "@enactprotocol/shared";

/**
 * Configuration for the remote execution provider
 */
export interface RemoteProviderConfig {
  /** Remote execution endpoint (e.g., "https://run.enact.tools" or "http://localhost:3000") */
  endpoint: string;
  /** Authentication token */
  authToken?: string;
  /** Default timeout in milliseconds */
  defaultTimeout?: number;
}

/**
 * Provider that delegates execution to a remote server.
 */
export class RemoteExecutionProvider implements ExecutionProvider {
  readonly name = "remote";
  private endpoint: string;
  private authToken: string | undefined;
  private defaultTimeout: number;

  constructor(config: RemoteProviderConfig) {
    this.endpoint = config.endpoint.replace(/\/$/, "");
    this.authToken = config.authToken;
    this.defaultTimeout = config.defaultTimeout ?? 300000;
  }

  async initialize(): Promise<void> {
    // No initialization needed
  }

  async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${this.endpoint}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return res.ok;
    } catch {
      return false;
    }
  }

  async getHealth(): Promise<EngineHealth> {
    const available = await this.isAvailable();
    return {
      healthy: available,
      runtime: "docker",
      consecutiveFailures: available ? 0 : 1,
    };
  }

  async shutdown(): Promise<void> {
    // Nothing to clean up
  }

  async execute(
    manifest: ToolManifest,
    input: ExecutionInput,
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult> {
    return this.remoteExecute({
      type: "execute",
      manifest,
      input,
      options,
    });
  }

  async exec(
    manifest: ToolManifest,
    command: string,
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult> {
    return this.remoteExecute({
      type: "exec",
      manifest,
      command,
      input: { params: {} },
      options,
    });
  }

  async executeAction(
    manifest: ToolManifest,
    actionsManifest: ActionsManifest,
    actionName: string,
    action: Action,
    input: ExecutionInput,
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult> {
    const startTime = new Date();
    const executionId = `remote-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    // Validate inputs locally before sending to remote
    const effectiveSchema = getEffectiveInputSchema(action);
    const validation = validateInputs(input.params, effectiveSchema);
    if (!validation.valid) {
      const errorMessages = validation.errors.map((e) => `${e.path}: ${e.message}`);
      return this.createErrorResult(
        `${manifest.name}:${actionName}`,
        executionId,
        startTime,
        "VALIDATION_ERROR",
        `Input validation failed: ${errorMessages.join(", ")}`
      );
    }

    const params = applyDefaults(input.params, effectiveSchema);

    return this.remoteExecute({
      type: "executeAction",
      manifest,
      actionsManifest,
      actionName,
      action,
      input: { ...input, params },
      options,
    });
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async remoteExecute(payload: Record<string, unknown>): Promise<ExecutionResult> {
    const startTime = new Date();
    const executionId = `remote-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const toolName = (payload.manifest as ToolManifest)?.name ?? "unknown";

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (this.authToken) {
        headers.Authorization = `Bearer ${this.authToken}`;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.defaultTimeout);

      const response = await fetch(`${this.endpoint}/execute`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorBody = await response.text();
        return this.createErrorResult(
          toolName,
          executionId,
          startTime,
          "COMMAND_ERROR",
          `Remote execution failed (${response.status}): ${errorBody}`
        );
      }

      const result = (await response.json()) as ExecutionResult;

      // Ensure metadata has correct timing from our perspective
      const endTime = new Date();
      if (result.metadata) {
        result.metadata.startTime = startTime;
        result.metadata.endTime = endTime;
        result.metadata.durationMs = endTime.getTime() - startTime.getTime();
      }

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const code: ExecutionErrorCode = message.includes("abort") ? "TIMEOUT" : "COMMAND_ERROR";

      return this.createErrorResult(toolName, executionId, startTime, code, message);
    }
  }

  private createErrorResult(
    toolName: string,
    executionId: string,
    startTime: Date,
    code: ExecutionErrorCode,
    message: string
  ): ExecutionResult {
    const endTime = new Date();
    return {
      success: false,
      output: { stdout: "", stderr: message, exitCode: 1 },
      metadata: {
        toolName,
        containerImage: "remote",
        startTime,
        endTime,
        durationMs: endTime.getTime() - startTime.getTime(),
        cached: false,
        executionId,
      },
      error: { code, message },
    };
  }
}

/**
 * Create a remote execution provider
 */
export function createRemoteProvider(config: RemoteProviderConfig): RemoteExecutionProvider {
  return new RemoteExecutionProvider(config);
}

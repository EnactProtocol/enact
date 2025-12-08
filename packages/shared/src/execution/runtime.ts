/**
 * Container runtime detection
 *
 * Auto-detects available container runtimes (docker, podman, nerdctl)
 * and provides runtime status monitoring.
 */

import { spawnSync } from "node:child_process";
import type { ContainerRuntime, RuntimeDetection, RuntimeStatus } from "./types";

/**
 * Order of preference for container runtime detection
 */
const RUNTIME_PREFERENCE: ContainerRuntime[] = ["docker", "podman", "nerdctl"];

/**
 * Runtime-specific version commands
 */
const VERSION_COMMANDS: Record<ContainerRuntime, string[]> = {
  docker: ["docker", "--version"],
  podman: ["podman", "--version"],
  nerdctl: ["nerdctl", "--version"],
};

/**
 * Cached detection result
 */
let cachedDetection: RuntimeDetection | null = null;
let cachedDetectionTime = 0;
const CACHE_TTL_MS = 60000; // 1 minute

/**
 * Check if a command is available in PATH
 */
function commandExists(command: string): boolean {
  try {
    const result = spawnSync("which", [command], {
      encoding: "utf-8",
      timeout: 5000,
    });
    return result.status === 0 && result.stdout.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Get the version of a container runtime
 */
function getRuntimeVersion(runtime: ContainerRuntime): string | undefined {
  try {
    const versionCmd = VERSION_COMMANDS[runtime];
    const cmd = versionCmd[0];
    if (!cmd) return undefined;
    const args = versionCmd.slice(1);
    const result = spawnSync(cmd, args, {
      encoding: "utf-8",
      timeout: 5000,
    });

    if (result.status === 0) {
      // Parse version from output
      // Docker: "Docker version 24.0.6, build ed223bc"
      // Podman: "podman version 4.5.1"
      // nerdctl: "nerdctl version 1.5.0"
      const match = result.stdout.match(/(\d+\.\d+\.\d+)/);
      return match?.[1];
    }
  } catch {
    // Ignore errors
  }
  return undefined;
}

/**
 * Get the path to a runtime binary
 */
function getRuntimePath(runtime: ContainerRuntime): string | undefined {
  try {
    const result = spawnSync("which", [runtime], {
      encoding: "utf-8",
      timeout: 5000,
    });
    if (result.status === 0) {
      return result.stdout.trim();
    }
  } catch {
    // Ignore errors
  }
  return undefined;
}

/**
 * Detect available container runtime
 *
 * Checks for docker, podman, and nerdctl in order of preference.
 * Results are cached for 1 minute.
 *
 * @returns Detection result with runtime info or error
 */
export function detectRuntime(): RuntimeDetection {
  // Return cached result if still valid
  const now = Date.now();
  if (cachedDetection && now - cachedDetectionTime < CACHE_TTL_MS) {
    return cachedDetection;
  }

  for (const runtime of RUNTIME_PREFERENCE) {
    if (commandExists(runtime)) {
      const version = getRuntimeVersion(runtime);
      const path = getRuntimePath(runtime);

      const result: RuntimeDetection = {
        found: true,
        runtime,
      };
      if (path) result.path = path;
      if (version) result.version = version;

      cachedDetection = result;
      cachedDetectionTime = now;
      return result;
    }
  }

  const notFoundResult: RuntimeDetection = {
    found: false,
    error: getInstallInstructions(),
  };
  cachedDetection = notFoundResult;
  cachedDetectionTime = now;
  return notFoundResult;
}

/**
 * Get helpful installation instructions when no runtime is found
 */
function getInstallInstructions(): string {
  const platform = process.platform;

  if (platform === "darwin") {
    return (
      "No container runtime found. Install Docker Desktop:\n" +
      "  brew install --cask docker\n" +
      "Or install Podman:\n" +
      "  brew install podman"
    );
  }

  if (platform === "linux") {
    return (
      "No container runtime found. Install Docker:\n" +
      "  curl -fsSL https://get.docker.com | sh\n" +
      "Or install Podman:\n" +
      "  sudo apt install podman  # Debian/Ubuntu\n" +
      "  sudo dnf install podman  # Fedora/RHEL"
    );
  }

  if (platform === "win32") {
    return (
      "No container runtime found. Install Docker Desktop:\n" +
      "  winget install Docker.DockerDesktop\n" +
      "Or download from: https://www.docker.com/products/docker-desktop"
    );
  }

  return "No container runtime found. Please install Docker, Podman, or nerdctl.";
}

/**
 * Clear the cached detection result
 * Useful after installing a runtime
 */
export function clearRuntimeCache(): void {
  cachedDetection = null;
  cachedDetectionTime = 0;
}

/**
 * Force detection of a specific runtime
 *
 * @param runtime - The runtime to check
 * @returns Whether the runtime is available
 */
export function isRuntimeAvailable(runtime: ContainerRuntime): boolean {
  return commandExists(runtime);
}

/**
 * Get all available runtimes
 *
 * @returns Array of available runtimes
 */
export function getAvailableRuntimes(): ContainerRuntime[] {
  return RUNTIME_PREFERENCE.filter((runtime) => commandExists(runtime));
}

/**
 * Runtime status tracker for health monitoring
 */
export class RuntimeStatusTracker {
  private status: RuntimeStatus;
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;

  constructor(runtime: ContainerRuntime) {
    this.status = {
      available: true,
      runtime,
      engineHealthy: true,
      lastHealthCheck: new Date(),
      failureCount: 0,
    };
  }

  /**
   * Record a successful operation
   */
  recordSuccess(): void {
    this.status.failureCount = 0;
    this.status.engineHealthy = true;
    this.status.lastHealthCheck = new Date();
  }

  /**
   * Record a failed operation
   *
   * @returns Whether the engine should be reset (3+ consecutive failures)
   */
  recordFailure(): boolean {
    this.status.failureCount++;
    this.status.lastHealthCheck = new Date();

    if (this.status.failureCount >= 3) {
      this.status.engineHealthy = false;
      return true; // Engine needs reset
    }

    return false;
  }

  /**
   * Get current status
   */
  getStatus(): RuntimeStatus {
    return { ...this.status };
  }

  /**
   * Check if engine needs reset
   */
  needsReset(): boolean {
    return this.status.failureCount >= 3;
  }

  /**
   * Reset failure count after engine restart
   */
  resetFailureCount(): void {
    this.status.failureCount = 0;
    this.status.engineHealthy = true;
  }

  /**
   * Start periodic health checks
   *
   * @param intervalMs - Check interval in milliseconds (default: 60000)
   * @param onUnhealthy - Callback when engine becomes unhealthy
   */
  startHealthChecks(intervalMs = 60000, onUnhealthy?: (status: RuntimeStatus) => void): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(() => {
      const detection = detectRuntime();
      this.status.available = detection.found;
      this.status.lastHealthCheck = new Date();

      if (!detection.found || !this.status.engineHealthy) {
        onUnhealthy?.(this.status);
      }
    }, intervalMs);
  }

  /**
   * Stop periodic health checks
   */
  stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
}

/**
 * Create a runtime status tracker for the detected runtime
 *
 * @returns Status tracker or null if no runtime found
 */
export function createRuntimeTracker(): RuntimeStatusTracker | null {
  const detection = detectRuntime();
  if (!detection.found || !detection.runtime) {
    return null;
  }
  return new RuntimeStatusTracker(detection.runtime);
}

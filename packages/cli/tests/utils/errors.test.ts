/**
 * Tests for error handling utilities
 */

import { describe, expect, test } from "bun:test";
import {
  AuthError,
  CliError,
  ConfigError,
  ContainerError,
  EXIT_AUTH_ERROR,
  EXIT_CONFIG,
  EXIT_CONTAINER_ERROR,
  EXIT_EXECUTION_ERROR,
  EXIT_FAILURE,
  EXIT_MANIFEST_ERROR,
  EXIT_NETWORK_ERROR,
  EXIT_NOINPUT,
  EXIT_NOPERM,
  EXIT_REGISTRY_ERROR,
  EXIT_TIMEOUT,
  EXIT_TOOL_NOT_FOUND,
  EXIT_TRUST_ERROR,
  EXIT_USAGE,
  EXIT_VALIDATION_ERROR,
  ErrorMessages,
  ExecutionError,
  FileNotFoundError,
  ManifestError,
  NetworkError,
  PermissionError,
  RegistryError,
  TimeoutError,
  ToolNotFoundError,
  TrustError,
  UsageError,
  ValidationError,
  categorizeError,
} from "../../src/utils";

describe("error classes", () => {
  describe("CliError", () => {
    test("creates error with default exit code", () => {
      const err = new CliError("test message");
      expect(err.message).toBe("test message");
      expect(err.exitCode).toBe(EXIT_FAILURE);
      expect(err.suggestion).toBeUndefined();
    });

    test("creates error with custom exit code", () => {
      const err = new CliError("test", 42);
      expect(err.exitCode).toBe(42);
    });

    test("creates error with suggestion", () => {
      const err = new CliError("test", 1, "Try this instead");
      expect(err.suggestion).toBe("Try this instead");
    });
  });

  describe("ToolNotFoundError", () => {
    test("creates error with correct exit code", () => {
      const err = new ToolNotFoundError("my-tool");
      expect(err.message).toBe("Tool not found: my-tool");
      expect(err.exitCode).toBe(EXIT_TOOL_NOT_FOUND);
      expect(err.suggestion).toContain("owner/namespace/tool");
    });

    test("includes reason when provided", () => {
      const err = new ToolNotFoundError("my-tool", {
        reason: "Manifest validation failed",
      });
      expect(err.message).toContain("Tool not found: my-tool");
      expect(err.message).toContain("Manifest validation failed");
    });

    test("includes searched locations when provided", () => {
      const err = new ToolNotFoundError("my-tool", {
        searchedLocations: ["/path/to/tools", "/other/path"],
      });
      expect(err.message).toContain("Searched locations:");
      expect(err.message).toContain("/path/to/tools");
      expect(err.message).toContain("/other/path");
    });

    test("provides different suggestion when localOnly is true", () => {
      const err = new ToolNotFoundError("my-tool", { localOnly: true });
      expect(err.suggestion).toContain("Remove --local flag");
      expect(err.suggestion).not.toContain("owner/namespace/tool");
    });

    test("handles all options together", () => {
      const err = new ToolNotFoundError("my-tool", {
        reason: "No manifest found",
        searchedLocations: ["/a", "/b"],
        localOnly: true,
      });
      expect(err.message).toContain("my-tool");
      expect(err.message).toContain("No manifest found");
      expect(err.message).toContain("/a");
      expect(err.message).toContain("/b");
      expect(err.suggestion).toContain("Remove --local flag");
    });
  });

  describe("ManifestError", () => {
    test("creates error without path", () => {
      const err = new ManifestError("Invalid manifest");
      expect(err.message).toBe("Invalid manifest");
      expect(err.exitCode).toBe(EXIT_MANIFEST_ERROR);
    });

    test("creates error with path", () => {
      const err = new ManifestError("Invalid manifest", "/path/to/dir");
      expect(err.message).toBe("Invalid manifest in /path/to/dir");
    });
  });

  describe("ValidationError", () => {
    test("creates error without field", () => {
      const err = new ValidationError("must be a string");
      expect(err.message).toBe("must be a string");
      expect(err.exitCode).toBe(EXIT_VALIDATION_ERROR);
    });

    test("creates error with field", () => {
      const err = new ValidationError("must be a string", "name");
      expect(err.message).toBe("Invalid name: must be a string");
    });
  });

  describe("AuthError", () => {
    test("creates error with auth suggestion", () => {
      const err = new AuthError("Not authenticated");
      expect(err.exitCode).toBe(EXIT_AUTH_ERROR);
      expect(err.suggestion).toContain("enact auth login");
    });
  });

  describe("NetworkError", () => {
    test("creates error with network suggestion", () => {
      const err = new NetworkError("Connection refused");
      expect(err.exitCode).toBe(EXIT_NETWORK_ERROR);
      expect(err.suggestion).toContain("network connection");
    });
  });

  describe("RegistryError", () => {
    test("creates error with registry suggestion", () => {
      const err = new RegistryError("Registry unavailable");
      expect(err.exitCode).toBe(EXIT_REGISTRY_ERROR);
      expect(err.suggestion).toContain("temporarily unavailable");
    });
  });

  describe("TrustError", () => {
    test("creates error with trust suggestion", () => {
      const err = new TrustError("Verification failed");
      expect(err.exitCode).toBe(EXIT_TRUST_ERROR);
      expect(err.suggestion).toContain("enact trust check");
    });
  });

  describe("TimeoutError", () => {
    test("creates error with timeout details", () => {
      const err = new TimeoutError("Download", 30000);
      expect(err.message).toBe("Download timed out after 30s");
      expect(err.exitCode).toBe(EXIT_TIMEOUT);
      expect(err.suggestion).toContain("--timeout");
    });
  });

  describe("ExecutionError", () => {
    test("creates error with stderr", () => {
      const err = new ExecutionError("Tool failed", "Error: something went wrong");
      expect(err.exitCode).toBe(EXIT_EXECUTION_ERROR);
      expect(err.stderr).toBe("Error: something went wrong");
    });
  });

  describe("ContainerError", () => {
    test("creates error with container suggestion", () => {
      const err = new ContainerError("Docker not found");
      expect(err.exitCode).toBe(EXIT_CONTAINER_ERROR);
      expect(err.suggestion).toContain("Docker");
    });
  });

  describe("FileNotFoundError", () => {
    test("creates error with file path", () => {
      const err = new FileNotFoundError("/path/to/file");
      expect(err.message).toBe("File not found: /path/to/file");
      expect(err.exitCode).toBe(EXIT_NOINPUT);
    });
  });

  describe("PermissionError", () => {
    test("creates error with path", () => {
      const err = new PermissionError("/etc/passwd");
      expect(err.message).toBe("Permission denied: /etc/passwd");
      expect(err.exitCode).toBe(EXIT_NOPERM);
    });
  });

  describe("ConfigError", () => {
    test("creates error with config suggestion", () => {
      const err = new ConfigError("Invalid config");
      expect(err.exitCode).toBe(EXIT_CONFIG);
      expect(err.suggestion).toContain("enact config list");
    });
  });

  describe("UsageError", () => {
    test("creates error with usage exit code", () => {
      const err = new UsageError("Missing argument");
      expect(err.exitCode).toBe(EXIT_USAGE);
    });
  });
});

describe("categorizeError", () => {
  test("returns CliError as-is", () => {
    const original = new ToolNotFoundError("test");
    const result = categorizeError(original);
    expect(result).toBe(original);
  });

  test("categorizes network errors", () => {
    const err = new Error("ECONNREFUSED");
    const result = categorizeError(err);
    expect(result).toBeInstanceOf(NetworkError);
  });

  test("categorizes permission errors", () => {
    const err = new Error("EACCES: permission denied");
    const result = categorizeError(err);
    expect(result).toBeInstanceOf(PermissionError);
  });

  test("categorizes file not found errors", () => {
    const err = new Error("ENOENT: no such file or directory");
    const result = categorizeError(err);
    expect(result).toBeInstanceOf(FileNotFoundError);
  });

  test("categorizes timeout errors", () => {
    const err = new Error("Request timed out");
    const result = categorizeError(err);
    expect(result).toBeInstanceOf(TimeoutError);
  });

  test("categorizes auth errors", () => {
    const err = new Error("401 Unauthorized");
    const result = categorizeError(err);
    expect(result).toBeInstanceOf(AuthError);
  });

  test("returns generic CliError for unknown errors", () => {
    const err = new Error("Unknown error");
    const result = categorizeError(err);
    expect(result).toBeInstanceOf(CliError);
    expect(result.message).toBe("Unknown error");
  });

  test("handles non-Error objects", () => {
    const result = categorizeError("string error");
    expect(result).toBeInstanceOf(CliError);
    expect(result.message).toBe("string error");
  });
});

describe("ErrorMessages", () => {
  describe("toolNotFound", () => {
    test("returns structured error info", () => {
      const info = ErrorMessages.toolNotFound("my-tool");
      expect(info.message).toContain("my-tool");
      expect(info.suggestions).toHaveLength(3);
      expect(info.suggestions.some((s) => s.includes("search"))).toBe(true);
    });
  });

  describe("notAuthenticated", () => {
    test("returns structured error info", () => {
      const info = ErrorMessages.notAuthenticated();
      expect(info.message).toContain("not authenticated");
      expect(info.suggestions.some((s) => s.includes("login"))).toBe(true);
    });
  });

  describe("manifestNotFound", () => {
    test("returns structured error info", () => {
      const info = ErrorMessages.manifestNotFound("/my/dir");
      expect(info.message).toContain("/my/dir");
      expect(info.suggestions.some((s) => s.includes("init"))).toBe(true);
    });
  });

  describe("invalidManifest", () => {
    test("returns structured error info with errors", () => {
      const errors = ["name is required", "version must be valid semver"];
      const info = ErrorMessages.invalidManifest(errors);
      expect(info.message).toBe("Invalid manifest");
      expect(info.suggestions.some((s) => s.includes("name is required"))).toBe(true);
    });
  });

  describe("registryUnavailable", () => {
    test("returns structured error info", () => {
      const info = ErrorMessages.registryUnavailable();
      expect(info.message).toContain("unavailable");
      expect(info.suggestions.some((s) => s.includes("internet"))).toBe(true);
    });
  });

  describe("containerRuntimeNotFound", () => {
    test("returns structured error info", () => {
      const info = ErrorMessages.containerRuntimeNotFound();
      expect(info.message).toContain("container runtime");
      expect(info.suggestions.some((s) => s.includes("Docker"))).toBe(true);
    });
  });

  describe("trustVerificationFailed", () => {
    test("returns structured error info", () => {
      const info = ErrorMessages.trustVerificationFailed("my-tool");
      expect(info.message).toContain("my-tool");
      expect(info.suggestions.some((s) => s.includes("enact trust"))).toBe(true);
    });
  });

  describe("executionFailed", () => {
    test("returns structured error info", () => {
      const info = ErrorMessages.executionFailed("my-tool", 1);
      expect(info.message).toContain("my-tool");
      expect(info.message).toContain("exit code 1");
      expect(info.suggestions.some((s) => s.includes("--verbose"))).toBe(true);
    });
  });
});

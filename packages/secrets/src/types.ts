/**
 * Type definitions for secrets and environment management
 */

// ============================================================================
// Constants
// ============================================================================

/** Keyring service name for all Enact secrets */
export const KEYRING_SERVICE = "enact-cli";

// ============================================================================
// Secret Types
// ============================================================================

/**
 * Result of secret resolution with namespace information
 */
export interface SecretResolution {
  /** The namespace where the secret was found */
  namespace: string;
  /** The secret value */
  value: string;
  /** The secret key */
  key: string;
  /** Whether the secret was found */
  found: true;
}

/**
 * Result when secret is not found
 */
export interface SecretNotFound {
  /** The secret key that was looked for */
  key: string;
  /** Whether the secret was found */
  found: false;
  /** Namespaces that were searched */
  searchedNamespaces: string[];
}

/**
 * Result of secret resolution (found or not found)
 */
export type SecretResolutionResult = SecretResolution | SecretNotFound;

/**
 * Metadata about a stored secret
 */
export interface SecretMetadata {
  /** Secret key name */
  key: string;
  /** Namespace where it's stored */
  namespace: string;
  /** When it was created/last modified (if available) */
  modified?: Date;
}

/**
 * Trace entry for debugging secret resolution
 */
export interface SecretTraceEntry {
  /** Namespace that was checked */
  namespace: string;
  /** Account string used for lookup */
  account: string;
  /** Whether secret was found at this namespace */
  found: boolean;
}

/**
 * Full trace of secret resolution
 */
export interface SecretTrace {
  /** Secret key being resolved */
  key: string;
  /** Tool path used for resolution */
  toolPath: string;
  /** Each namespace checked in order */
  entries: SecretTraceEntry[];
  /** Final result */
  result: SecretResolutionResult;
}

// ============================================================================
// Environment Variable Types
// ============================================================================

/**
 * Scope where environment variables can be stored
 */
export type EnvScope = "global" | "local" | "default";

/**
 * Location where environment variables can be stored (files only)
 */
export type EnvFileLocation = "global" | "local";

/**
 * An environment variable with its value and source
 */
export interface EnvironmentVariable {
  /** Variable key */
  key: string;
  /** Variable value */
  value: string;
  /** Where it was resolved from */
  source: EnvScope;
}

/**
 * Result of environment variable resolution
 */
export interface EnvResolution {
  /** Variable key */
  key: string;
  /** Resolved value */
  value: string;
  /** Source of the value */
  source: EnvScope;
  /** File path if from a file */
  filePath?: string;
}

/**
 * Parsed .env file content
 */
export interface ParsedEnvFile {
  /** Key-value pairs */
  vars: Record<string, string>;
  /** Preserved lines (for writing back with comments) */
  lines: EnvFileLine[];
}

/**
 * A line in an .env file (for preserving format)
 */
export interface EnvFileLine {
  /** Type of line */
  type: "comment" | "empty" | "variable";
  /** Original line content */
  raw: string;
  /** Variable key (if type is 'variable') */
  key?: string;
  /** Variable value (if type is 'variable') */
  value?: string;
}

// ============================================================================
// Dagger Secret URI Types
// ============================================================================

/**
 * Supported Dagger secret URI schemes
 */
export type DaggerSecretScheme = "env" | "file" | "cmd" | "op" | "vault";

/**
 * Parsed Dagger secret URI
 */
export interface DaggerSecretUri {
  /** The URI scheme */
  scheme: DaggerSecretScheme;
  /** The URI value (without scheme://) */
  value: string;
  /** Original full URI */
  original: string;
}

/**
 * Options for getting a secret object
 */
export interface GetSecretOptions {
  /** Override URI to use instead of keyring */
  overrideUri?: string;
  /** Whether to trace resolution */
  trace?: boolean;
}

/**
 * Result from getSecretObject
 */
export interface SecretObject {
  /** The secret name */
  name: string;
  /** The secret value */
  value: string;
  /** Source of the secret */
  source: "keyring" | "override";
  /** Namespace if from keyring */
  namespace?: string;
  /** Override URI if used */
  overrideUri?: string;
}

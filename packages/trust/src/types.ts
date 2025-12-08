/**
 * Type definitions for security operations
 */

// ============================================================================
// Hash Types
// ============================================================================

/**
 * Supported hash algorithms
 */
export type HashAlgorithm = "sha256" | "sha512";

/**
 * Result of a hash operation
 */
export interface HashResult {
  /** The hash algorithm used */
  algorithm: HashAlgorithm;
  /** The hash digest in hexadecimal format */
  digest: string;
}

/**
 * Options for file hashing operations
 */
export interface FileHashOptions {
  /** Hash algorithm to use (default: sha256) */
  algorithm?: HashAlgorithm;
  /** Progress callback for large files */
  onProgress?: (bytesRead: number, totalBytes: number) => void;
}

// ============================================================================
// Key Management Types
// ============================================================================

/**
 * Supported key types
 */
export type KeyType = "rsa" | "ed25519" | "ecdsa";

/**
 * Key format for storage
 */
export type KeyFormat = "pem" | "der" | "jwk";

/**
 * A cryptographic key pair
 */
export interface KeyPair {
  /** Public key */
  publicKey: string;
  /** Private key (encrypted or plain) */
  privateKey: string;
  /** Key type */
  type: KeyType;
  /** Key format */
  format: KeyFormat;
}

/**
 * Options for key generation
 */
export interface KeyGenerationOptions {
  /** Key type to generate */
  type: KeyType;
  /** Output format */
  format?: KeyFormat;
  /** RSA key size in bits (only for RSA keys) */
  modulusLength?: number;
  /** Passphrase for encrypting private key */
  passphrase?: string;
}

// ============================================================================
// Placeholder for other types
// ============================================================================

export type SecurityConfig = Record<string, unknown>;

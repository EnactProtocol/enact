/**
 * Key management utilities for cryptographic operations
 */

import { generateKeyPairSync } from "node:crypto";
import type { KeyGenerationOptions, KeyPair, KeyType } from "./types";

/**
 * Generate a new cryptographic key pair
 *
 * @param options - Key generation options
 * @returns Generated key pair with public and private keys
 *
 * @example
 * ```ts
 * // Generate RSA key pair
 * const rsaKeys = generateKeyPair({
 *   type: "rsa",
 *   modulusLength: 2048
 * });
 *
 * // Generate Ed25519 key pair
 * const ed25519Keys = generateKeyPair({
 *   type: "ed25519"
 * });
 * ```
 */
export function generateKeyPair(options: KeyGenerationOptions): KeyPair {
  const { type, format = "pem", modulusLength = 2048, passphrase } = options;

  const keyPairOptions = getKeyPairOptions(type, modulusLength, format, passphrase);
  const nodeKeyType = getNodeKeyType(type);

  // TypeScript has very strict overloads for generateKeyPairSync
  // We use any here as we've validated the types through our own KeyType
  // biome-ignore lint/suspicious/noExplicitAny: Node.js crypto API has complex overloads
  const { publicKey, privateKey } = generateKeyPairSync(nodeKeyType as any, keyPairOptions as any);

  return {
    publicKey: publicKey.toString(),
    privateKey: privateKey.toString(),
    type,
    format,
  };
}

/**
 * Convert our KeyType to Node.js crypto key type
 */
function getNodeKeyType(type: KeyType): "rsa" | "ed25519" | "ec" {
  switch (type) {
    case "rsa":
      return "rsa";
    case "ed25519":
      return "ed25519";
    case "ecdsa":
      return "ec";
  }
}

/**
 * Get key pair generation options for Node.js crypto
 */
function getKeyPairOptions(
  type: KeyType,
  modulusLength: number,
  format: "pem" | "der" | "jwk",
  passphrase?: string
): Parameters<typeof generateKeyPairSync>[1] {
  const baseOptions: Record<string, unknown> = {
    publicKeyEncoding: {
      type: "spki",
      format,
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format,
      ...(passphrase && {
        cipher: "aes-256-cbc",
        passphrase,
      }),
    },
  };

  // Add type-specific options
  if (type === "rsa") {
    return {
      ...baseOptions,
      modulusLength,
    };
  }

  if (type === "ecdsa") {
    return {
      ...baseOptions,
      namedCurve: "prime256v1", // Also known as secp256r1 or P-256
    };
  }

  // Ed25519 doesn't need additional options
  return baseOptions;
}

/**
 * Validate a PEM-formatted key
 *
 * @param key - The key to validate (public or private)
 * @param expectedType - Expected key type (public or private)
 * @returns True if key is valid PEM format
 */
export function isValidPEMKey(
  key: string,
  expectedType: "public" | "private" = "private"
): boolean {
  if (expectedType === "public") {
    return key.includes("-----BEGIN PUBLIC KEY-----") && key.includes("-----END PUBLIC KEY-----");
  }

  return (
    (key.includes("-----BEGIN PRIVATE KEY-----") && key.includes("-----END PRIVATE KEY-----")) ||
    (key.includes("-----BEGIN ENCRYPTED PRIVATE KEY-----") &&
      key.includes("-----END ENCRYPTED PRIVATE KEY-----"))
  );
}

/**
 * Parse key type from a PEM key string
 *
 * @param key - PEM-formatted key string
 * @returns Detected key type or undefined if cannot be determined
 */
export function getKeyTypeFromPEM(key: string): KeyType | undefined {
  // Check if it's a valid PEM key first
  if (!isValidPEMKey(key, "private") && !isValidPEMKey(key, "public")) {
    return undefined;
  }

  // Check for explicit algorithm markers
  if (key.includes("RSA")) {
    return "rsa";
  }

  // Length-based heuristic (RSA keys are much longer)
  // RSA 2048: ~1700 chars, RSA 4096: ~3200 chars
  // Ed25519: ~120 chars
  // ECDSA P-256: ~200-300 chars
  if (key.length > 1000) {
    return "rsa";
  }

  if (key.length < 200) {
    return "ed25519";
  }

  // ECDSA falls somewhere in between
  return "ecdsa";
}

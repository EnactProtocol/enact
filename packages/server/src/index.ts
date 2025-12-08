/**
 * @enactprotocol/server - Registry server implementation
 *
 * Supabase-based backend for the Enact registry with:
 * - OAuth authentication (GitHub, Google, Microsoft)
 * - Tool publishing and versioning
 * - Attestation verification via Sigstore
 * - Trust configuration
 * - R2/S3 storage for bundles
 */

export const VERSION = "0.1.0";

// Re-export types
export * from "./types.js";

// Re-export utilities
export * from "./utils/index.js";

// Re-export storage
export * from "./storage/index.js";

// Re-export handlers
export * from "./handlers/index.js";

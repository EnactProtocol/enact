/**
 * @enactprotocol/api - Registry API client for Enact tools (v2)
 *
 * This package provides HTTP client functionality for interacting with
 * the Enact registry v2, including:
 * - OAuth authentication
 * - Tool search and discovery
 * - Bundle download with yank handling
 * - Tool publishing (multipart upload)
 * - Attestation management
 * - Trust configuration
 *
 * @packageDocumentation
 */

export const VERSION = "0.2.0";

// =============================================================================
// Types
// =============================================================================

export * from "./types";

// =============================================================================
// Client
// =============================================================================

export { EnactApiClient, createApiClient } from "./client";
export type { ApiClientOptions } from "./client";

// =============================================================================
// Search
// =============================================================================

export { searchTools } from "./search";
export type { SearchOptions, SearchResult, SearchResponse } from "./search";

// =============================================================================
// Download
// =============================================================================

export { downloadBundle, getToolInfo, getToolVersion, getAttestations } from "./download";
export type { DownloadOptions, DownloadResult, ToolInfo, ToolVersionInfo } from "./download";

// =============================================================================
// Publish
// =============================================================================

export {
  publishTool,
  createBundle,
  submitAttestation,
  yankVersion,
  unyankVersion,
  deleteTool,
} from "./publish";
export type {
  PublishOptions,
  PublishResult,
  BundleInfo,
  SubmitAttestationOptions,
  AttestationResult,
  ToolVisibility,
} from "./publish";

// =============================================================================
// Auth (v2 OAuth)
// =============================================================================

export {
  initiateLogin,
  exchangeCodeForToken,
  refreshAccessToken,
  getCurrentUser,
  authenticate,
  logout,
  getAuthStatus,
  getUserProfile,
  submitFeedback,
} from "./auth";
export type { AuthResult, AuthStatus } from "./auth";

// =============================================================================
// Attestations (v2)
// =============================================================================

export {
  getAttestations as getAttestationList,
  submitAttestation as submitAttestationToRegistry,
  revokeAttestation,
  hasAttestation,
  getAttestationBundle,
  verifyAttestationLocally,
  verifyAllAttestations,
  hasTrustedAttestation,
} from "./attestations";
export type { AttestationListResponse, VerifiedAuditor } from "./attestations";

// =============================================================================
// Trust (v2)
// =============================================================================

export {
  getUserTrust,
  updateMyTrust,
  addTrustedAuditor,
  removeTrustedAuditor,
  userTrustsAuditor,
  getMyTrustedAuditors,
} from "./trust";

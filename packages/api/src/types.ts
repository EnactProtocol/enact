/**
 * TypeScript types for Enact Registry API v2
 * Based on docs/API.md and docs/REGISTRY-SPEC.md specification
 */

/**
 * API error response
 */
export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown> | undefined;
  };
}

/**
 * OAuth provider types
 */
export type OAuthProvider = "github" | "google" | "microsoft";

/**
 * Author/user information from API
 */
export interface ApiAuthor {
  username: string;
  avatar_url?: string | undefined;
}

/**
 * Version metadata object (v2)
 */
export interface VersionMetadata {
  /** Version string (e.g., "1.2.0") */
  version: string;
  /** Publication timestamp */
  published_at: string;
  /** Download count for this version */
  downloads: number;
  /** SHA-256 hash of bundle */
  bundle_hash: string;
  /** Bundle size in bytes */
  bundle_size?: number | undefined;
  /** Whether this version is yanked */
  yanked: boolean;
  /** Attestation summary (optional) */
  attestation_summary?:
    | {
        auditor_count: number;
      }
    | undefined;
}

/**
 * Tool visibility levels
 */
export type ToolVisibility = "public" | "private" | "unlisted";

/**
 * Tool search result item
 */
export interface ToolSearchResult {
  /** Tool name (e.g., "alice/utils/greeter") */
  name: string;
  /** Tool description */
  description: string;
  /** Tool tags */
  tags: string[];
  /** Latest published version */
  version: string;
  /** Tool author */
  author: ApiAuthor;
  /** Total downloads */
  downloads: number;
  /** Tool visibility (only included for owner's own tools) */
  visibility?: ToolVisibility | undefined;
  /** Trust status */
  trust_status?:
    | {
        auditor_count: number;
      }
    | undefined;
}

/**
 * Tool metadata from GET /tools/{name}
 */
export interface ToolMetadata {
  /** Tool name */
  name: string;
  /** Tool description */
  description: string;
  /** Tool tags */
  tags: string[];
  /** SPDX license identifier */
  license: string;
  /** Tool author */
  author: ApiAuthor;
  /** Repository URL */
  repository?: string | undefined;
  /** Homepage URL */
  homepage?: string | undefined;
  /** Tool visibility: public, private, or unlisted */
  visibility?: ToolVisibility | undefined;
  /** Creation timestamp */
  created_at: string;
  /** Last update timestamp */
  updated_at: string;
  /** Latest version */
  latest_version: string;
  /** Version list (paginated) */
  versions: VersionMetadata[];
  /** Total number of versions */
  versions_total: number;
  /** Total downloads across all versions */
  total_downloads: number;
}

/**
 * Bundle information
 */
export interface BundleInfo {
  /** SHA-256 hash */
  hash: string;
  /** Size in bytes */
  size: number;
  /** Download URL */
  download_url: string;
}

/**
 * Tool version details from GET /tools/{name}/versions/{version}
 */
export interface ToolVersionDetails {
  /** Tool name */
  name: string;
  /** Version */
  version: string;
  /** Tool description */
  description: string;
  /** SPDX license identifier */
  license: string;
  /** Whether this version is yanked */
  yanked: boolean;
  /** Yank reason (if yanked) */
  yank_reason?: string | undefined;
  /** Replacement version (if yanked) */
  yank_replacement?: string | undefined;
  /** When it was yanked */
  yanked_at?: string | undefined;
  /** Full manifest object (parsed from enact.md frontmatter) */
  manifest: Record<string, unknown>;
  /** The raw enact.md file content (frontmatter + markdown documentation) */
  rawManifest?: string | undefined;
  /** Bundle information */
  bundle: BundleInfo;
  /** List of attestations */
  attestations: Attestation[];
  /** Who published this version */
  published_by: ApiAuthor;
  /** Publication timestamp */
  published_at: string;
  /** Download count for this version */
  downloads: number;
}

/**
 * Single attestation record (v2 - auditor-only)
 */
export interface Attestation {
  /** Auditor email (from Sigstore certificate) */
  auditor: string;
  /** OAuth provider used for attestation */
  auditor_provider: string;
  /** Signing timestamp */
  signed_at: string;
  /** Rekor transparency log ID */
  rekor_log_id: string;
  /** Rekor transparency log index */
  rekor_log_index?: number | undefined;
  /** Verification status */
  verification?:
    | {
        verified: boolean;
        verified_at: string;
        rekor_verified: boolean;
        certificate_verified: boolean;
        signature_verified: boolean;
      }
    | undefined;
}

/**
 * Feedback aggregates from GET /tools/{name}/feedback
 */
export interface FeedbackAggregates {
  /** Average rating (1-5) */
  rating: number;
  /** Number of ratings */
  rating_count: number;
  /** Total downloads */
  downloads: number;
}

/**
 * User profile from GET /users/{username}
 */
export interface UserProfile {
  /** Username */
  username: string;
  /** Display name */
  display_name?: string | undefined;
  /** Avatar URL */
  avatar_url?: string | undefined;
  /** Account creation date */
  created_at: string;
  /** Number of tools published */
  tools_count?: number | undefined;
}

/**
 * Current user info from GET /auth/me (v2)
 */
export interface CurrentUser {
  /** User ID */
  id: string;
  /** Username */
  username: string;
  /** Email address */
  email: string;
  /** Namespaces the user owns */
  namespaces: string[];
  /** Account creation date */
  created_at: string;
}

/**
 * OAuth login request
 */
export interface OAuthLoginRequest {
  /** OAuth provider */
  provider: OAuthProvider;
  /** Redirect URI for callback */
  redirect_uri: string;
}

/**
 * OAuth login response
 */
export interface OAuthLoginResponse {
  /** Authorization URL to redirect user to */
  auth_url: string;
}

/**
 * OAuth callback request
 */
export interface OAuthCallbackRequest {
  /** OAuth provider */
  provider: OAuthProvider;
  /** Authorization code from OAuth provider */
  code: string;
}

/**
 * OAuth token response
 */
export interface OAuthTokenResponse {
  /** Access token (JWT) */
  access_token: string;
  /** Refresh token */
  refresh_token: string;
  /** Token expiration in seconds */
  expires_in: number;
  /** User information */
  user: {
    id: string;
    username: string;
    email: string;
  };
}

/**
 * Refresh token request
 */
export interface RefreshTokenRequest {
  /** Refresh token */
  refresh_token: string;
}

/**
 * Refresh token response
 */
export interface RefreshTokenResponse {
  /** New access token */
  access_token: string;
  /** Token expiration in seconds */
  expires_in: number;
}

/**
 * Publish response from POST /tools/{name} (v2 - single POST)
 */
export interface PublishResponse {
  /** Tool name */
  name: string;
  /** Published version */
  version: string;
  /** Bundle hash */
  bundle_hash: string;
  /** Bundle size */
  bundle_size: number;
  /** Download URL */
  download_url: string;
  /** Publication timestamp */
  published_at: string;
}

/**
 * Yank version request
 */
export interface YankVersionRequest {
  /** Reason for yanking */
  reason?: string | undefined;
  /** Replacement version to recommend */
  replacement_version?: string | undefined;
}

/**
 * Yank version response
 */
export interface YankVersionResponse {
  /** Whether version is yanked */
  yanked: true;
  /** Version that was yanked */
  version: string;
  /** Reason for yanking */
  reason?: string | undefined;
  /** Replacement version */
  replacement_version?: string | undefined;
  /** When it was yanked */
  yanked_at: string;
  /** Informational message */
  message?: string | undefined;
}

/**
 * Unyank version response
 */
export interface UnyankVersionResponse {
  /** Whether version is yanked */
  yanked: false;
  /** Version that was unyanked */
  version: string;
  /** When it was unyanked */
  unyanked_at: string;
}

/**
 * Submit attestation response (v2)
 */
export interface AttestationResponse {
  /** Auditor email */
  auditor: string;
  /** OAuth provider */
  auditor_provider: string;
  /** Signing timestamp */
  signed_at: string;
  /** Rekor log ID */
  rekor_log_id: string;
  /** Rekor log index */
  rekor_log_index?: number | undefined;
  /** Verification result */
  verification: {
    verified: boolean;
    verified_at: string;
    rekor_verified: boolean;
    certificate_verified: boolean;
    signature_verified: boolean;
  };
}

/**
 * Revoke attestation response
 */
export interface RevokeAttestationResponse {
  /** Auditor email */
  auditor: string;
  /** Whether revocation succeeded */
  revoked: true;
  /** When it was revoked */
  revoked_at: string;
}

/**
 * Trusted auditor entry
 */
export interface TrustedAuditor {
  /** Auditor identity (email) */
  identity: string;
  /** When they were added to trust list */
  added_at: string;
}

/**
 * User trust configuration
 */
export interface UserTrustConfig {
  /** Username */
  username: string;
  /** List of trusted auditors */
  trusted_auditors: TrustedAuditor[];
}

/**
 * Update trust configuration request
 */
export interface UpdateTrustConfigRequest {
  /** Array of auditor emails to trust */
  trusted_auditors: string[];
}

/**
 * Update trust configuration response
 */
export interface UpdateTrustConfigResponse {
  /** Updated list of trusted auditors */
  trusted_auditors: TrustedAuditor[];
  /** When the config was updated */
  updated_at: string;
}

/**
 * Rate limit info from response headers
 */
export interface RateLimitInfo {
  /** Max requests per window */
  limit: number;
  /** Remaining requests */
  remaining: number;
  /** Unix timestamp when limit resets */
  reset: number;
}

/**
 * HTTP error codes from API v2
 */
export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VERSION_YANKED"
  | "BUNDLE_TOO_LARGE"
  | "VALIDATION_ERROR"
  | "ATTESTATION_VERIFICATION_FAILED"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

/**
 * HTTP status codes
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  REDIRECT: 302,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  GONE: 410,
  PAYLOAD_TOO_LARGE: 413,
  VALIDATION_ERROR: 422,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
} as const;

/**
 * Enact Constants
 *
 * Centralized configuration for Enact URLs and identifiers.
 * This ensures consistency across all packages.
 *
 * Note: Attestation type constants (ENACT_TOOL_TYPE, ENACT_AUDIT_TYPE, etc.)
 * are defined in @enactprotocol/trust and re-exported here for convenience.
 */

// Re-export attestation constants from trust package
export {
  ENACT_BASE_URL,
  ENACT_TOOL_TYPE,
  ENACT_AUDIT_TYPE,
  ENACT_BUILD_TYPE,
  INTOTO_STATEMENT_TYPE,
  SLSA_PROVENANCE_TYPE,
} from "@enactprotocol/trust";

// ============================================================================
// Runtime URLs (can be overridden by environment)
// ============================================================================

/**
 * The Enact API base URL (Supabase Edge Functions)
 * Override with ENACT_API_URL environment variable
 */
import { ENACT_BASE_URL as BASE_URL } from "@enactprotocol/trust";
export const ENACT_API_URL = process.env.ENACT_API_URL || `${BASE_URL}/api`;

/**
 * The Enact web application URL
 * Override with ENACT_WEB_URL environment variable
 */
export const ENACT_WEB_URL = process.env.ENACT_WEB_URL || BASE_URL;

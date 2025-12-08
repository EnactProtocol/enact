/**
 * Trust configuration management (v2)
 * Functions for managing user trust settings
 */

import type { EnactApiClient } from "./client";
import type { UpdateTrustConfigRequest, UpdateTrustConfigResponse, UserTrustConfig } from "./types";

/**
 * Get a user's trust configuration (v2)
 *
 * This is public information - anyone can see which auditors a user trusts.
 *
 * @param client - API client instance
 * @param username - Username to look up
 * @returns User's trust configuration
 *
 * @example
 * ```ts
 * const trustConfig = await getUserTrust(client, "alice");
 * console.log(`Alice trusts ${trustConfig.trusted_auditors.length} auditors`);
 * ```
 */
export async function getUserTrust(
  client: EnactApiClient,
  username: string
): Promise<UserTrustConfig> {
  const response = await client.get<UserTrustConfig>(`/users/${username}/trust`);
  return response.data;
}

/**
 * Update current user's trust configuration (v2)
 *
 * Replace the entire list of trusted auditors.
 *
 * @param client - API client instance (must be authenticated)
 * @param trustedAuditors - Array of auditor emails to trust
 * @returns Updated trust configuration
 *
 * @example
 * ```ts
 * const updated = await updateMyTrust(client, [
 *   "security@example.com",
 *   "bob@github.com",
 *   "audit-team@company.com"
 * ]);
 * console.log(`Now trusting ${updated.trusted_auditors.length} auditors`);
 * ```
 */
export async function updateMyTrust(
  client: EnactApiClient,
  trustedAuditors: string[]
): Promise<{
  trustedAuditors: Array<{
    identity: string;
    addedAt: Date;
  }>;
  updatedAt: Date;
}> {
  const response = await client.put<UpdateTrustConfigResponse>("/users/me/trust", {
    trusted_auditors: trustedAuditors,
  } as UpdateTrustConfigRequest);

  return {
    trustedAuditors: response.data.trusted_auditors.map((ta) => ({
      identity: ta.identity,
      addedAt: new Date(ta.added_at),
    })),
    updatedAt: new Date(response.data.updated_at),
  };
}

/**
 * Add an auditor to the current user's trust list
 *
 * This is a convenience wrapper that fetches current trust config,
 * adds the auditor if not already present, and updates.
 *
 * @param client - API client instance (must be authenticated)
 * @param auditorEmail - Auditor email to trust
 * @returns Updated trust configuration
 *
 * @example
 * ```ts
 * await addTrustedAuditor(client, "new-auditor@example.com");
 * ```
 */
export async function addTrustedAuditor(
  client: EnactApiClient,
  auditorEmail: string
): Promise<{
  trustedAuditors: Array<{
    identity: string;
    addedAt: Date;
  }>;
  updatedAt: Date;
}> {
  // First get current user to know their username
  const currentUser = await client.get<{ username: string }>("/auth/me");
  const username = currentUser.data.username;

  // Get current trust config
  const currentTrust = await getUserTrust(client, username);

  // Add new auditor if not already present
  const currentAuditors = currentTrust.trusted_auditors.map((ta) => ta.identity);
  if (!currentAuditors.includes(auditorEmail)) {
    currentAuditors.push(auditorEmail);
  }

  // Update trust config
  return updateMyTrust(client, currentAuditors);
}

/**
 * Remove an auditor from the current user's trust list
 *
 * This is a convenience wrapper that fetches current trust config,
 * removes the auditor if present, and updates.
 *
 * @param client - API client instance (must be authenticated)
 * @param auditorEmail - Auditor email to remove
 * @returns Updated trust configuration
 *
 * @example
 * ```ts
 * await removeTrustedAuditor(client, "old-auditor@example.com");
 * ```
 */
export async function removeTrustedAuditor(
  client: EnactApiClient,
  auditorEmail: string
): Promise<{
  trustedAuditors: Array<{
    identity: string;
    addedAt: Date;
  }>;
  updatedAt: Date;
}> {
  // First get current user to know their username
  const currentUser = await client.get<{ username: string }>("/auth/me");
  const username = currentUser.data.username;

  // Get current trust config
  const currentTrust = await getUserTrust(client, username);

  // Remove auditor
  const updatedAuditors = currentTrust.trusted_auditors
    .map((ta) => ta.identity)
    .filter((email) => email !== auditorEmail);

  // Update trust config
  return updateMyTrust(client, updatedAuditors);
}

/**
 * Check if a user trusts a specific auditor
 *
 * @param client - API client instance
 * @param username - Username to check
 * @param auditorEmail - Auditor email to check
 * @returns True if the user trusts this auditor
 *
 * @example
 * ```ts
 * const trusts = await userTrustsAuditor(client, "alice", "security@example.com");
 * if (trusts) {
 *   console.log("Alice trusts this auditor");
 * }
 * ```
 */
export async function userTrustsAuditor(
  client: EnactApiClient,
  username: string,
  auditorEmail: string
): Promise<boolean> {
  const trustConfig = await getUserTrust(client, username);
  return trustConfig.trusted_auditors.some((ta) => ta.identity === auditorEmail);
}

/**
 * Get list of auditors trusted by the current user
 *
 * @param client - API client instance (must be authenticated)
 * @returns Array of trusted auditor emails
 *
 * @example
 * ```ts
 * const auditors = await getMyTrustedAuditors(client);
 * console.log(`You trust: ${auditors.join(", ")}`);
 * ```
 */
export async function getMyTrustedAuditors(client: EnactApiClient): Promise<string[]> {
  // First get current user to know their username
  const currentUser = await client.get<{ username: string }>("/auth/me");
  const username = currentUser.data.username;

  // Get trust config
  const trustConfig = await getUserTrust(client, username);

  return trustConfig.trusted_auditors.map((ta) => ta.identity);
}

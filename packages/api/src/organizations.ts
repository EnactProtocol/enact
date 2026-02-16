/**
 * Organization API client methods.
 * Manages org creation, membership, and listing via the registry API.
 */

import type { OrgInfo, OrgMember, OrgRole } from "@enactprotocol/shared";
import type { EnactApiClient } from "./client";

/**
 * Options for creating an organization
 */
export interface CreateOrgOptions {
  name: string;
  displayName?: string | undefined;
  description?: string | undefined;
}

/**
 * Options for adding an org member
 */
export interface AddOrgMemberOptions {
  username: string;
  role?: OrgRole | undefined;
}

/**
 * Create a new organization
 */
export async function createOrg(
  client: EnactApiClient,
  options: CreateOrgOptions
): Promise<OrgInfo> {
  const { data } = await client.post<OrgInfo>("/orgs", {
    name: options.name,
    display_name: options.displayName,
    description: options.description,
  });
  return data;
}

/**
 * Get organization info
 */
export async function getOrg(client: EnactApiClient, orgName: string): Promise<OrgInfo> {
  const { data } = await client.get<OrgInfo>(`/orgs/${orgName}`);
  return data;
}

/**
 * List organization members
 */
export async function listOrgMembers(
  client: EnactApiClient,
  orgName: string
): Promise<OrgMember[]> {
  const { data } = await client.get<{ members: OrgMember[] }>(`/orgs/${orgName}/members`);
  return data.members;
}

/**
 * Add a member to an organization
 */
export async function addOrgMember(
  client: EnactApiClient,
  orgName: string,
  options: AddOrgMemberOptions
): Promise<void> {
  await client.post(`/orgs/${orgName}/members`, {
    username: options.username,
    role: options.role ?? "member",
  });
}

/**
 * Remove a member from an organization
 */
export async function removeOrgMember(
  client: EnactApiClient,
  orgName: string,
  username: string
): Promise<void> {
  await client.delete(`/orgs/${orgName}/members/${username}`);
}

/**
 * Update a member's role in an organization
 */
export async function updateOrgMemberRole(
  client: EnactApiClient,
  orgName: string,
  username: string,
  role: OrgRole
): Promise<void> {
  await client.patch(`/orgs/${orgName}/members/${username}`, { role });
}

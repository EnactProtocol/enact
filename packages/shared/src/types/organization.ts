/**
 * Organization types for org-scoped tool namespaces.
 *
 * Organizations allow businesses to reserve @org scopes (e.g., @anthropic/tool-name)
 * and manage team publishing permissions.
 */

/**
 * Organization membership roles.
 * - owner: Full control (manage org, members, tools, delete org)
 * - admin: Publish tools + manage members
 * - member: Publish tools only
 */
export type OrgRole = "owner" | "admin" | "member";

/**
 * Organization entity
 */
export interface Organization {
  id: string;
  /** Org name without @ prefix (e.g., "anthropic") */
  name: string;
  display_name: string | null;
  description: string | null;
  avatar_url: string | null;
  created_by: string;
  created_at: string;
}

/**
 * Organization member
 */
export interface OrgMember {
  org_id: string;
  user_id: string;
  username: string;
  role: OrgRole;
  added_at: string;
  added_by: string | null;
}

/**
 * Full org info with counts (for API responses)
 */
export interface OrgInfo extends Organization {
  member_count: number;
  tool_count: number;
}

/**
 * Check if a tool name is org-scoped (starts with @)
 */
export function isOrgScoped(name: string): boolean {
  return name.startsWith("@");
}

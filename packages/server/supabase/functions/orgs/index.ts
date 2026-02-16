/**
 * Organizations Edge Function
 * Handles org creation, membership, and listing.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { Database } from "../../../src/types.ts";
import {
  jsonResponse,
  createdResponse,
  corsPreflightResponse,
  addCorsHeaders,
} from "../../../src/utils/response.ts";
import { Errors } from "../../../src/utils/errors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return corsPreflightResponse();
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authHeader = req.headers.get("Authorization");
    const isDev = Deno.env.get("ENACT_DEV_MODE") === "true";

    const useServiceRole = isDev && supabaseServiceKey;
    const supabaseKey = useServiceRole ? supabaseServiceKey : supabaseAnonKey;

    const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
      global: {
        headers: useServiceRole ? {} : (authHeader ? { Authorization: authHeader } : {}),
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });

    // POST /orgs -> create org
    if (pathParts.length === 1 && pathParts[0] === "orgs" && req.method === "POST") {
      return addCorsHeaders(await handleCreateOrg(supabase, req, isDev));
    }

    // GET /orgs/:name -> get org info
    if (pathParts.length === 2 && pathParts[0] === "orgs" && req.method === "GET") {
      return addCorsHeaders(await handleGetOrg(supabase, pathParts[1]));
    }

    // GET /orgs/:name/members -> list members
    if (pathParts.length === 3 && pathParts[2] === "members" && req.method === "GET") {
      return addCorsHeaders(await handleListMembers(supabase, pathParts[1]));
    }

    // POST /orgs/:name/members -> add member
    if (pathParts.length === 3 && pathParts[2] === "members" && req.method === "POST") {
      return addCorsHeaders(await handleAddMember(supabase, req, pathParts[1], isDev));
    }

    // DELETE /orgs/:name/members/:username -> remove member
    if (pathParts.length === 4 && pathParts[2] === "members" && req.method === "DELETE") {
      return addCorsHeaders(await handleRemoveMember(supabase, pathParts[1], pathParts[3], isDev));
    }

    // PATCH /orgs/:name/members/:username -> update role
    if (pathParts.length === 4 && pathParts[2] === "members" && req.method === "PATCH") {
      return addCorsHeaders(await handleUpdateRole(supabase, req, pathParts[1], pathParts[3], isDev));
    }

    // GET /orgs/:name/tools -> list org tools
    if (pathParts.length === 3 && pathParts[2] === "tools" && req.method === "GET") {
      return addCorsHeaders(await handleListOrgTools(supabase, pathParts[1]));
    }

    return addCorsHeaders(Errors.notFound("Route not found"));
  } catch (error) {
    console.error("[Orgs] Error:", error);
    return addCorsHeaders(Errors.internal(error instanceof Error ? error.message : "Unknown error"));
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getAuthenticatedUser(supabase: any, isDev: boolean): Promise<{ id: string; username: string } | null> {
  if (isDev) {
    return { id: "00000000-0000-0000-0000-000000000000", username: "dev" };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  return { id: user.id, username: profile.username };
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function handleCreateOrg(supabase: any, req: Request, isDev: boolean) {
  const user = await getAuthenticatedUser(supabase, isDev);
  if (!user) return Errors.unauthorized();

  const body = await req.json();
  const name = body.name?.toLowerCase()?.trim();

  if (!name || !/^[a-z0-9_-]+$/.test(name)) {
    return Errors.validation(
      "Organization name must contain only lowercase letters, numbers, hyphens, and underscores."
    );
  }

  // Check collision with username
  const { data: existingUser } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", name)
    .single();

  if (existingUser) {
    return jsonResponse({ error: { code: "CONFLICT", message: `Name "${name}" is already taken by a user.` } }, 409);
  }

  // Check existing org
  const { data: existingOrg } = await supabase
    .from("organizations")
    .select("id")
    .eq("name", name)
    .single();

  if (existingOrg) {
    return jsonResponse({ error: { code: "CONFLICT", message: `Organization "${name}" already exists.` } }, 409);
  }

  // Create org
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({
      name,
      display_name: body.display_name ?? null,
      description: body.description ?? null,
      created_by: user.id,
    })
    .select()
    .single();

  if (orgError) return Errors.internal(orgError.message);

  // Add creator as owner
  const { error: memberError } = await supabase
    .from("org_members")
    .insert({
      org_id: org.id,
      user_id: user.id,
      role: "owner",
      added_by: user.id,
    });

  if (memberError) {
    console.error("[Orgs] Failed to add creator as owner:", memberError);
  }

  return createdResponse({
    id: org.id,
    name: org.name,
    display_name: org.display_name,
    description: org.description,
    created_by: user.id,
    created_at: org.created_at,
    member_count: 1,
    tool_count: 0,
  });
}

async function handleGetOrg(supabase: any, orgName: string) {
  const { data: org, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("name", orgName)
    .single();

  if (error || !org) return Errors.orgNotFound(orgName);

  const { count: memberCount } = await supabase
    .from("org_members")
    .select("*", { count: "exact", head: true })
    .eq("org_id", org.id);

  const { count: toolCount } = await supabase
    .from("tools")
    .select("*", { count: "exact", head: true })
    .eq("org_id", org.id);

  return jsonResponse({
    id: org.id,
    name: org.name,
    display_name: org.display_name,
    description: org.description,
    avatar_url: org.avatar_url,
    created_by: org.created_by,
    created_at: org.created_at,
    member_count: memberCount ?? 0,
    tool_count: toolCount ?? 0,
  });
}

async function handleListMembers(supabase: any, orgName: string) {
  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("name", orgName)
    .single();

  if (!org) return Errors.orgNotFound(orgName);

  const { data: members } = await supabase
    .from("org_members")
    .select("user_id, role, added_at, profiles(username, display_name, avatar_url)")
    .eq("org_id", org.id)
    .order("added_at", { ascending: true });

  return jsonResponse({
    members: (members ?? []).map((m: any) => ({
      user_id: m.user_id,
      username: m.profiles?.username,
      display_name: m.profiles?.display_name,
      avatar_url: m.profiles?.avatar_url,
      role: m.role,
      added_at: m.added_at,
    })),
  });
}

async function handleAddMember(supabase: any, req: Request, orgName: string, isDev: boolean) {
  const user = await getAuthenticatedUser(supabase, isDev);
  if (!user) return Errors.unauthorized();

  const body = await req.json();

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("name", orgName)
    .single();

  if (!org) return Errors.orgNotFound(orgName);

  // Check requester is owner or admin
  const { data: requesterMembership } = await supabase
    .from("org_members")
    .select("role")
    .eq("org_id", org.id)
    .eq("user_id", user.id)
    .single();

  if (!requesterMembership || !["owner", "admin"].includes(requesterMembership.role)) {
    return Errors.orgPermissionDenied(orgName, "add members");
  }

  // Find target user
  const { data: targetUser } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", body.username)
    .single();

  if (!targetUser) return Errors.notFound(`User "${body.username}" not found`);

  const role = body.role ?? "member";
  if (!["owner", "admin", "member"].includes(role)) {
    return Errors.validation("Role must be owner, admin, or member");
  }

  const { error: insertError } = await supabase
    .from("org_members")
    .insert({
      org_id: org.id,
      user_id: targetUser.id,
      role,
      added_by: user.id,
    });

  if (insertError) {
    if (insertError.code === "23505") {
      return jsonResponse(
        { error: { code: "CONFLICT", message: `User "${body.username}" is already a member` } },
        409
      );
    }
    return Errors.internal(insertError.message);
  }

  return createdResponse({ username: body.username, role, org: orgName });
}

async function handleRemoveMember(supabase: any, orgName: string, targetUsername: string, isDev: boolean) {
  const user = await getAuthenticatedUser(supabase, isDev);
  if (!user) return Errors.unauthorized();

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("name", orgName)
    .single();

  if (!org) return Errors.orgNotFound(orgName);

  const { data: targetUser } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", targetUsername)
    .single();

  if (!targetUser) return Errors.notFound(`User "${targetUsername}" not found`);

  // Check permission: owner or self
  const isSelf = targetUser.id === user.id;
  if (!isSelf) {
    const { data: requesterMembership } = await supabase
      .from("org_members")
      .select("role")
      .eq("org_id", org.id)
      .eq("user_id", user.id)
      .single();

    if (!requesterMembership || requesterMembership.role !== "owner") {
      return Errors.orgPermissionDenied(orgName, "remove members");
    }
  }

  await supabase
    .from("org_members")
    .delete()
    .eq("org_id", org.id)
    .eq("user_id", targetUser.id);

  return jsonResponse({ removed: targetUsername, org: orgName });
}

async function handleUpdateRole(supabase: any, req: Request, orgName: string, targetUsername: string, isDev: boolean) {
  const user = await getAuthenticatedUser(supabase, isDev);
  if (!user) return Errors.unauthorized();

  const body = await req.json();

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("name", orgName)
    .single();

  if (!org) return Errors.orgNotFound(orgName);

  // Only owners can change roles
  const { data: requesterMembership } = await supabase
    .from("org_members")
    .select("role")
    .eq("org_id", org.id)
    .eq("user_id", user.id)
    .single();

  if (!requesterMembership || requesterMembership.role !== "owner") {
    return Errors.orgPermissionDenied(orgName, "change member roles");
  }

  const { data: targetUser } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", targetUsername)
    .single();

  if (!targetUser) return Errors.notFound(`User "${targetUsername}" not found`);

  const role = body.role;
  if (!role || !["owner", "admin", "member"].includes(role)) {
    return Errors.validation("Role must be owner, admin, or member");
  }

  await supabase
    .from("org_members")
    .update({ role })
    .eq("org_id", org.id)
    .eq("user_id", targetUser.id);

  return jsonResponse({ username: targetUsername, role, org: orgName });
}

async function handleListOrgTools(supabase: any, orgName: string) {
  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("name", orgName)
    .single();

  if (!org) return Errors.orgNotFound(orgName);

  const { data: tools } = await supabase
    .from("tools")
    .select("name, description, tags, total_downloads, visibility")
    .eq("org_id", org.id)
    .eq("visibility", "public")
    .order("total_downloads", { ascending: false });

  return jsonResponse({
    tools: (tools ?? []).map((t: any) => ({
      name: t.name,
      description: t.description,
      tags: t.tags ?? [],
      downloads: t.total_downloads,
      visibility: t.visibility,
    })),
  });
}

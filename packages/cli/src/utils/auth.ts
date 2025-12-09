/**
 * Auth utilities shared across commands
 */

import { getSecret } from "@enactprotocol/secrets";

/** Namespace for storing auth tokens in keyring */
const AUTH_NAMESPACE = "enact:auth";
const ACCESS_TOKEN_KEY = "access_token";

/** Supabase configuration */
const SUPABASE_URL = process.env.SUPABASE_URL || "https://siikwkfgsmouioodghho.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpaWt3a2Znc21vdWlvb2RnaGhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2MTkzMzksImV4cCI6MjA4MDE5NTMzOX0.kxnx6-IPFhmGx6rzNx36vbyhFMFZKP_jFqaDbKnJ_E0";

/**
 * Get the current authenticated username
 * Returns null if not authenticated or username cannot be determined
 */
export async function getCurrentUsername(): Promise<string | null> {
  const token = await getSecret(AUTH_NAMESPACE, ACCESS_TOKEN_KEY);
  if (!token) {
    return null;
  }

  try {
    // Get user info from Supabase
    const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
      },
    });

    if (!userResponse.ok) {
      return null;
    }

    const user = (await userResponse.json()) as {
      id: string;
      email?: string;
      user_metadata?: {
        user_name?: string;
        username?: string;
        full_name?: string;
      };
    };

    // Get profile from database for definitive username
    const profileResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=username`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: SUPABASE_ANON_KEY,
        },
      }
    );

    if (profileResponse.ok) {
      const profiles = (await profileResponse.json()) as Array<{ username: string }>;
      if (profiles[0]?.username) {
        return profiles[0].username;
      }
    }

    // Fall back to user metadata
    return (
      user.user_metadata?.username ||
      user.user_metadata?.user_name ||
      user.email?.split("@")[0] ||
      null
    );
  } catch {
    return null;
  }
}

/**
 * Extract namespace from a tool name
 * e.g., "alice/utils/greeter" -> "alice"
 */
export function extractNamespace(toolName: string): string {
  const parts = toolName.split("/");
  return parts[0] ?? "";
}

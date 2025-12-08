/**
 * Authentication handlers
 *
 * Note: Authentication is primarily handled by Supabase Auth.
 * These are helper functions for the Edge Functions.
 */

// Placeholder for auth helpers
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice(7);
}

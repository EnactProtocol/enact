import { useAuth } from "@/contexts/AuthContext";
import { EnactApiClient } from "@/lib/api-client";
import { API_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
import { useMemo } from "react";

/**
 * Hook to get an API client with the current user's auth token.
 * Uses the session access token when logged in, falls back to anon key.
 */
export function useApiClient(): EnactApiClient {
  const { session } = useAuth();

  return useMemo(() => {
    const authToken = session?.access_token || SUPABASE_ANON_KEY;
    return new EnactApiClient({
      baseUrl: API_URL,
      authToken,
    });
  }, [session?.access_token]);
}

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

/**
 * Hook to get an API client along with the auth loading state.
 * Use this when you need to wait for auth to be ready before fetching.
 */
export function useApiClientWithAuth(): { client: EnactApiClient; isAuthLoading: boolean } {
  const { session, loading } = useAuth();

  const client = useMemo(() => {
    const authToken = session?.access_token || SUPABASE_ANON_KEY;
    return new EnactApiClient({
      baseUrl: API_URL,
      authToken,
    });
  }, [session?.access_token]);

  return { client, isAuthLoading: loading };
}

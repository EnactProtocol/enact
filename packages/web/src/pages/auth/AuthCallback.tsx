import { Loader2, Terminal } from "lucide-react";
import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";

/**
 * OAuth callback handler for web login (not CLI auth)
 * Handles the redirect from Supabase OAuth providers
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      // Supabase handles the session from URL automatically
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.error("Auth callback error:", error);
        navigate("/login?error=auth_failed");
        return;
      }

      if (!session?.user) {
        navigate("/login?error=no_session");
        return;
      }

      // Check if user has a profile (username)
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", session.user.id)
        .maybeSingle();

      // Get redirect URL from state or default to home
      const redirectTo = searchParams.get("redirect") || "/";

      if (!profile) {
        // User needs to choose a username first
        navigate(`/auth/choose-username?redirect=${encodeURIComponent(redirectTo)}`);
      } else {
        navigate(redirectTo);
      }
    };

    handleCallback();
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <Terminal className="w-10 h-10 text-gray-900" />
        </div>
        <Loader2 className="w-6 h-6 animate-spin text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600">Completing sign in...</p>
      </div>
    </div>
  );
}

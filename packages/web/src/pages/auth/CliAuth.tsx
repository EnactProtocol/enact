import { Github, Terminal } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SUPABASE_URL, supabase } from "../../lib/supabase";

type Provider = "github" | "google";

export default function CliAuth() {
  const [searchParams] = useSearchParams();
  const cliPort = searchParams.get("port") || "8118";
  const [loading, setLoading] = useState<Provider | "existing" | null>("existing");
  const [error, setError] = useState<string | null>(null);

  // Check for existing session on mount
  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session) {
          // Check if user has a profile (username)
          const { data: profile } = await supabase
            .from("profiles")
            .select("username")
            .eq("id", session.user.id)
            .maybeSingle();

          if (!profile) {
            // User needs to choose a username first
            // Store CLI port for after username selection
            sessionStorage.setItem("cli_port", cliPort);
            window.location.href = `/auth/choose-username?redirect=${encodeURIComponent(`/auth/cli?port=${cliPort}`)}`;
            return;
          }

          // User is already logged in with username, send tokens to CLI
          sessionStorage.setItem("cli_port", cliPort);

          const response = await fetch(`http://localhost:${cliPort}/callback`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              access_token: session.access_token,
              refresh_token: session.refresh_token,
              user: {
                ...session.user,
                // Include profile username
                user_metadata: {
                  ...session.user.user_metadata,
                  username: profile.username,
                },
              },
            }),
          });

          if (!response.ok) {
            throw new Error("Failed to send tokens to CLI");
          }

          // Redirect to success page
          window.location.href = "/auth/cli/success";
          return;
        }
      } catch (err) {
        console.error("Error checking session:", err);
        setError(err instanceof Error ? err.message : "Failed to connect to CLI");
      }

      // No existing session or error, show login options
      setLoading(null);
    };

    checkExistingSession();
  }, [cliPort]);

  const handleAuth = (provider: Provider) => {
    setLoading(provider);
    setError(null);

    // Store port in session storage for callback
    sessionStorage.setItem("cli_port", cliPort);

    // Redirect to Supabase OAuth
    const callbackUrl = `${window.location.origin}/auth/cli/callback`;
    const authUrl = `${SUPABASE_URL}/auth/v1/authorize?provider=${provider}&redirect_to=${encodeURIComponent(
      callbackUrl
    )}`;

    window.location.href = authUrl;
  };

  // Show loading while checking for existing session
  if (loading === "existing") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <div className="w-full max-w-md text-center">
          <div className="p-8 border border-gray-200 rounded-[2rem] bg-white shadow-[0_4px_24px_0_rgba(0,0,0,0.02),0_4px_32px_0_rgba(0,0,0,0.02)]">
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gray-100 flex items-center justify-center">
              <Terminal className="w-8 h-8 text-gray-600" />
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Connecting to CLI</h1>
            <p className="text-gray-500 mb-6">Checking authentication...</p>
            <div className="flex justify-center">
              <div className="w-6 h-6 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-md">
        {/* Hero text */}
        <h2 className="text-center text-gray-900 font-bold text-3xl md:text-4xl select-none leading-tight mb-2">
          CLI Authentication
        </h2>
        <h3 className="text-center text-gray-500 font-normal text-base mb-8">
          Sign in to connect your Enact CLI
        </h3>

        {/* Login card */}
        <div className="p-7 text-center border border-gray-200 rounded-[2rem] flex flex-col bg-white shadow-[0_4px_24px_0_rgba(0,0,0,0.02),0_4px_32px_0_rgba(0,0,0,0.02),0_2px_64px_0_rgba(0,0,0,0.01),0_16px_32px_0_rgba(0,0,0,0.01)] space-y-4">
          {/* Error message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-3">
            {/* Google button */}
            <button
              type="button"
              onClick={() => handleAuth("google")}
              disabled={loading !== null}
              className="w-full h-11 flex items-center justify-center gap-2 px-5 bg-white text-gray-700 border border-gray-200 rounded-xl font-medium hover:bg-gray-50 hover:border-gray-300 transition-all duration-100 active:scale-[0.985] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading === "google" ? (
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  role="img"
                  aria-labelledby="google-title-cli"
                >
                  <title id="google-title-cli">Google</title>
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              )}
              Continue with Google
            </button>

            {/* GitHub button */}
            <button
              type="button"
              onClick={() => handleAuth("github")}
              disabled={loading !== null}
              className="w-full h-11 flex items-center justify-center gap-2 px-5 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-all duration-100 active:scale-[0.985] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading === "github" ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Github className="w-4 h-4" />
              )}
              Continue with GitHub
            </button>
          </div>

          {/* Info */}
          <div className="pt-4 border-t border-gray-100">
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <Terminal className="w-4 h-4" />
              <span>Connecting to CLI on port {cliPort}</span>
            </div>
          </div>
        </div>

        {/* Security note */}
        <p className="mt-6 text-center text-xs text-gray-400">
          After signing in, your credentials will be securely sent to your local CLI.
        </p>
      </div>
    </div>
  );
}

import { Github, Terminal } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

export default function Login() {
  const { signInWithGitHub, signInWithGoogle, user } = useAuth();
  const [loading, setLoading] = useState<"github" | "google" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/";

  // If already logged in, redirect
  if (user) {
    navigate(redirectTo);
    return null;
  }

  const handleGitHubLogin = async () => {
    setLoading("github");
    setError(null);
    try {
      await signInWithGitHub();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign in");
      setLoading(null);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading("google");
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign in");
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="mx-auto flex w-full grow flex-col justify-center max-w-3xl lg:max-w-[80rem]">
        <main className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Left side - Login form */}
          <div className="flex items-center w-full py-6 min-h-[89vh]">
            <div className="flex flex-col h-full w-full items-center justify-between">
              <div />

              <div className="w-full max-w-md">
                {/* Hero text */}
                <h2 className="text-center text-gray-900 font-bold mt-12 text-4xl md:text-5xl lg:text-[3.5rem] select-none leading-tight">
                  Trust.
                  <br />
                  Verified.
                </h2>
                <h3 className="flex flex-col gap-1 items-center text-center text-gray-600 font-normal mt-4 text-base md:text-lg leading-snug">
                  The secure tool registry for AI agents
                </h3>

                {/* Login card */}
                <div className="mt-8 mx-auto p-7 max-w-md min-w-[320px] text-center border border-gray-200 rounded-[2rem] flex flex-col bg-white shadow-[0_4px_24px_0_rgba(0,0,0,0.02),0_4px_32px_0_rgba(0,0,0,0.02),0_2px_64px_0_rgba(0,0,0,0.01),0_16px_32px_0_rgba(0,0,0,0.01)] space-y-2">
                  <div className="flex flex-col gap-5">
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
                        onClick={handleGoogleLogin}
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
                            aria-labelledby="google-title"
                          >
                            <title id="google-title">Google</title>
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
                        onClick={handleGitHubLogin}
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
                  </div>

                  {/* Terms */}
                  <div className="pt-4">
                    <p className="text-xs text-gray-400 leading-relaxed">
                      By continuing, you agree to our{" "}
                      <Link
                        to="/terms"
                        className="underline underline-offset-2 hover:text-gray-600 transition-colors"
                      >
                        Terms of Service
                      </Link>{" "}
                      and{" "}
                      <Link
                        to="/privacy"
                        className="underline underline-offset-2 hover:text-gray-600 transition-colors"
                      >
                        Privacy Policy
                      </Link>
                    </p>
                  </div>
                </div>
              </div>

              {/* Back to home */}
              <div className="mt-14">
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <Terminal className="w-4 h-4" />
                  Back to Enact
                </Link>
              </div>
            </div>
          </div>

          {/* Right side - Visual */}
          <div className="hidden lg:flex justify-center items-center w-full">
            <div className="flex rounded-2xl w-full h-[85vh] min-h-[500px] justify-center items-center overflow-hidden mb-8 bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200">
              <div className="relative w-full h-full flex flex-col items-center justify-center p-12">
                {/* Abstract visual */}
                <div className="relative">
                  <div className="w-32 h-32 rounded-3xl bg-brand-blue/10 rotate-12 absolute -top-4 -left-4" />
                  <div className="w-32 h-32 rounded-3xl bg-brand-green/20 -rotate-6 absolute top-8 left-8" />
                  <Terminal className="w-24 h-24 text-gray-800 relative z-10" strokeWidth={1} />
                </div>

                <div className="mt-12 text-center max-w-sm">
                  <h3 className="text-xl font-semibold text-gray-800 mb-3">
                    Secure Tool Discovery
                  </h3>
                  <p className="text-gray-500 leading-relaxed">
                    Browse, verify, and install tools with cryptographic attestations. Every tool is
                    signed and verified through the transparency log.
                  </p>
                </div>

                {/* Feature badges */}
                <div className="flex flex-wrap gap-2 mt-8 justify-center">
                  <span className="px-3 py-1.5 bg-white border border-gray-200 rounded-full text-sm text-gray-600 shadow-sm">
                    Signed Packages
                  </span>
                  <span className="px-3 py-1.5 bg-white border border-gray-200 rounded-full text-sm text-gray-600 shadow-sm">
                    Verified Authors
                  </span>
                  <span className="px-3 py-1.5 bg-white border border-gray-200 rounded-full text-sm text-gray-600 shadow-sm">
                    Audit Trail
                  </span>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

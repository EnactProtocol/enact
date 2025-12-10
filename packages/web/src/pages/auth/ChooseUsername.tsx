import { AlertCircle, CheckCircle2, Loader2, Terminal, User } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

export default function ChooseUsername() {
  const { user, profile, createProfile, checkUsernameAvailable, loading } = useAuth();
  const [username, setUsername] = useState("");
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/";

  // Redirect if not logged in or already has profile
  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    } else if (profile) {
      navigate(redirectTo);
    }
  }, [user, profile, loading, navigate, redirectTo]);

  // Suggest username from GitHub username or email
  useEffect(() => {
    if (user?.user_metadata) {
      const suggestedUsername =
        user.user_metadata.user_name ||
        user.user_metadata.preferred_username ||
        user.email?.split("@")[0] ||
        "";

      if (suggestedUsername) {
        // Normalize: lowercase, replace invalid chars with hyphens
        const normalized = suggestedUsername
          .toLowerCase()
          .replace(/[^a-z0-9_-]/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 39);
        setUsername(normalized);
      }
    }
  }, [user]);

  // Debounced username availability check
  const checkAvailability = useCallback(
    async (value: string) => {
      if (value.length < 3) {
        setAvailable(null);
        return;
      }

      setChecking(true);
      try {
        const isAvailable = await checkUsernameAvailable(value);
        setAvailable(isAvailable);
      } finally {
        setChecking(false);
      }
    },
    [checkUsernameAvailable]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (username.length >= 3) {
        checkAvailability(username);
      } else {
        setAvailable(null);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [username, checkAvailability]);

  const validateUsername = (value: string): string | null => {
    if (value.length < 3) {
      return "Username must be at least 3 characters";
    }
    if (value.length > 39) {
      return "Username must be 39 characters or less";
    }
    if (!/^[a-z0-9_-]+$/.test(value)) {
      return "Username can only contain lowercase letters, numbers, hyphens, and underscores";
    }
    if (/^[-_]|[-_]$/.test(value)) {
      return "Username cannot start or end with a hyphen or underscore";
    }
    return null;
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "");
    setUsername(value);
    setError(null);
    setAvailable(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validationError = validateUsername(username);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!available) {
      setError("Please choose an available username");
      return;
    }

    setSubmitting(true);
    try {
      await createProfile(username);
      navigate(redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create profile");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2">
            <Terminal className="w-8 h-8 text-gray-900" />
            <span className="text-2xl font-semibold text-gray-900">enact</span>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <User className="w-8 h-8 text-gray-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Choose your username</h1>
            <p className="text-gray-600 mt-2">This will be your unique identifier on Enact</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username field */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <div className="relative">
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={handleUsernameChange}
                  placeholder="your-username"
                  className={`w-full px-4 py-3 pr-10 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                    error
                      ? "border-red-300 focus:ring-red-200 focus:border-red-400"
                      : available === true
                        ? "border-green-300 focus:ring-green-200 focus:border-green-400"
                        : available === false
                          ? "border-red-300 focus:ring-red-200 focus:border-red-400"
                          : "border-gray-300 focus:ring-gray-200 focus:border-gray-400"
                  }`}
                  autoComplete="off"
                  spellCheck={false}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {checking ? (
                    <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                  ) : available === true ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : available === false ? (
                    <AlertCircle className="w-5 h-5 text-red-500" />
                  ) : null}
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                3-39 characters. Letters, numbers, hyphens, and underscores only.
              </p>
              {available === false && !error && (
                <p className="text-xs text-red-600 mt-1">This username is already taken</p>
              )}
            </div>

            {/* Error message */}
            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={submitting || checking || !username || available !== true}
              className="w-full bg-gray-900 text-white py-3 px-4 rounded-lg font-medium hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating profile...
                </>
              ) : (
                "Continue"
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-500 mt-6">Signed in as {user?.email}</p>
      </div>
    </div>
  );
}

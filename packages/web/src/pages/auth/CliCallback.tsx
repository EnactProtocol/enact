import { CheckCircle, Terminal, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function CliCallback() {
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the session from the URL hash
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error || !session) {
          throw new Error(error?.message || "No session found");
        }

        // Get the CLI port from session storage
        const cliPort = sessionStorage.getItem("cli_port") || "8118";

        // Check if user has a profile (username)
        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", session.user.id)
          .maybeSingle();

        if (!profile) {
          // User needs to choose a username first
          window.location.href = `/auth/choose-username?redirect=${encodeURIComponent(`/auth/cli?port=${cliPort}`)}`;
          return;
        }

        // Send tokens to CLI's local server
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

        setStatus("success");
        sessionStorage.removeItem("cli_port");

        // Redirect to success page after a brief delay
        setTimeout(() => {
          window.location.href = "/auth/cli/success";
        }, 1500);
      } catch (err) {
        console.error("Auth callback error:", err);
        setStatus("error");
        setErrorMessage(err instanceof Error ? err.message : "Authentication failed");
      }
    };

    handleCallback();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-md">
        <div className="p-8 text-center border border-gray-200 rounded-[2rem] bg-white shadow-[0_4px_24px_0_rgba(0,0,0,0.02),0_4px_32px_0_rgba(0,0,0,0.02),0_2px_64px_0_rgba(0,0,0,0.01),0_16px_32px_0_rgba(0,0,0,0.01)]">
          {status === "processing" && (
            <div>
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gray-100 flex items-center justify-center">
                <Terminal className="w-8 h-8 text-gray-600" />
              </div>
              <h1 className="text-xl font-semibold text-gray-900 mb-2">
                Completing Authentication
              </h1>
              <p className="text-gray-500 mb-6">Sending credentials to CLI...</p>
              <div className="flex justify-center">
                <div className="w-6 h-6 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
              </div>
            </div>
          )}

          {status === "success" && (
            <div>
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h1 className="text-xl font-semibold text-gray-900 mb-2">
                Authentication Successful!
              </h1>
              <p className="text-gray-500">
                You can now close this window and return to your terminal.
              </p>
            </div>
          )}

          {status === "error" && (
            <div>
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-red-100 flex items-center justify-center">
                <XCircle className="w-8 h-8 text-red-600" />
              </div>
              <h1 className="text-xl font-semibold text-gray-900 mb-2">Authentication Failed</h1>
              <p className="text-gray-500 mb-4">{errorMessage}</p>
              <p className="text-sm text-gray-400">
                Please make sure your CLI is running and try again.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

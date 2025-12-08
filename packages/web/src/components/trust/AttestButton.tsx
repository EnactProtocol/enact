import { useAuth } from "@/contexts/AuthContext";
import { Shield, Terminal, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import CopyButton from "../ui/CopyButton";

interface AttestButtonProps {
  toolName: string;
  version: string;
}

export default function AttestButton({ toolName, version }: AttestButtonProps) {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);

  const signCommand = `enact sign ${toolName}@${version}`;

  const handleClick = () => {
    setShowModal(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors"
      >
        <Shield className="w-4 h-4" />
        Attest Tool
      </button>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
            onKeyDown={(e) => e.key === "Escape" && setShowModal(false)}
          />

          {/* Modal content */}
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Shield className="w-5 h-5 text-gray-700" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">Attest Tool</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              {!user ? (
                <>
                  <p className="text-gray-600">
                    Sign in to attest this tool. Attestations provide cryptographic proof that you
                    have reviewed and trust this tool.
                  </p>
                  <Link
                    to="/login"
                    className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
                  >
                    Sign in to attest
                  </Link>
                </>
              ) : (
                <>
                  <div className="space-y-3">
                    <p className="text-gray-600">
                      Attest <span className="font-semibold text-gray-900">{toolName}</span> version{" "}
                      <span className="font-mono text-gray-900">{version}</span> to indicate you've
                      reviewed and trust this tool.
                    </p>

                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm text-amber-800">
                        <strong>What is an attestation?</strong>
                        <br />
                        An attestation is a cryptographic signature that proves you reviewed this
                        tool. It uses Sigstore for keyless signing and is permanently recorded in
                        the Rekor transparency log.
                      </p>
                    </div>
                  </div>

                  <div className="pt-2">
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      Run this command in your terminal:
                    </p>
                    <div className="flex items-center gap-2 bg-gray-900 text-gray-100 p-3 rounded-lg font-mono text-sm">
                      <Terminal className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <code className="flex-1 overflow-x-auto">{signCommand}</code>
                      <CopyButton text={signCommand} className="flex-shrink-0" />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      This will open your browser for Sigstore authentication.
                    </p>
                  </div>

                  {/* Future: Web-based signing */}
                  {/* 
                  <div className="pt-4 border-t border-gray-100">
                    <button
                      type="button"
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-green text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                    >
                      <Shield className="w-4 h-4" />
                      Sign with {session?.user?.email}
                    </button>
                  </div>
                  */}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
              <p className="text-xs text-gray-500 text-center">
                Attestations are publicly visible and cannot be removed.{" "}
                <a
                  href="https://www.sigstore.dev/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-700 hover:underline"
                >
                  Learn more about Sigstore
                </a>
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

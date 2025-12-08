/**
 * Attestations handlers
 *
 * Utilities for attestation processing and verification
 */

/**
 * Extract auditor email from Sigstore bundle certificate
 */
export function extractAuditorEmail(bundle: Record<string, unknown>): string | null {
  try {
    // Extract from certificate's Subject Alternative Name (SAN)
    // biome-ignore lint/suspicious/noExplicitAny: Sigstore bundle structure is complex and varies
    const verificationMaterial = bundle.verificationMaterial as any;
    if (!verificationMaterial?.certificate) {
      return null;
    }

    // Try to get email from certificate extensions
    const extensions = verificationMaterial.certificate.extensions;
    if (Array.isArray(extensions)) {
      for (const ext of extensions) {
        // Look for email in SAN extension
        if (ext.value && typeof ext.value === "string") {
          const emailMatch = ext.value.match(/[\w.-]+@[\w.-]+\.\w+/);
          if (emailMatch) {
            return emailMatch[0];
          }
        }
      }
    }

    return null;
  } catch (error) {
    console.error("Error extracting auditor email:", error);
    return null;
  }
}

/**
 * Detect OAuth provider from certificate issuer
 */
export function detectProvider(bundle: Record<string, unknown>): string {
  try {
    // biome-ignore lint/suspicious/noExplicitAny: Sigstore bundle structure varies by provider
    const verificationMaterial = bundle.verificationMaterial as any;
    const issuer = verificationMaterial?.certificate?.issuer;

    if (!issuer || typeof issuer !== "string") {
      return "unknown";
    }

    const issuerLower = issuer.toLowerCase();

    if (issuerLower.includes("github")) return "github";
    if (issuerLower.includes("google") || issuerLower.includes("accounts.google")) return "google";
    if (issuerLower.includes("microsoft") || issuerLower.includes("login.microsoft"))
      return "microsoft";
    if (issuerLower.includes("gitlab")) return "gitlab";

    return "unknown";
  } catch (error) {
    console.error("Error detecting provider:", error);
    return "unknown";
  }
}

/**
 * Convert bundle hash string to Uint8Array for verification
 */
export function bundleHashToBytes(hash: string): Uint8Array {
  // Remove "sha256:" prefix if present
  const hashStr = hash.startsWith("sha256:") ? hash.slice(7) : hash;

  // Convert hex string to bytes
  const bytes = new Uint8Array(hashStr.length / 2);
  for (let i = 0; i < hashStr.length; i += 2) {
    bytes[i / 2] = Number.parseInt(hashStr.slice(i, i + 2), 16);
  }

  return bytes;
}

/**
 * Utility functions for API package
 * Copied from @enactprotocol/shared to avoid circular browser dependency
 */

/**
 * Convert OIDC issuer URL to provider name
 */
function issuerToProvider(issuer: string): string | undefined {
  if (issuer.includes("github.com")) return "github";
  if (issuer.includes("accounts.google.com")) return "google";
  if (issuer.includes("login.microsoftonline.com")) return "microsoft";
  if (issuer.includes("gitlab.com")) return "gitlab";
  return undefined;
}

/**
 * Convert OIDC identity to provider:identity format
 * @param email - Email from Sigstore certificate
 * @param issuer - OIDC issuer URL (optional, improves accuracy)
 * @param username - Provider username if known (optional)
 * @returns Identity in provider:identity format (e.g., github:keithagroves)
 */
export function emailToProviderIdentity(email: string, issuer?: string, username?: string): string {
  // If we have a username and can determine the provider, use that
  if (username && issuer) {
    const provider = issuerToProvider(issuer);
    if (provider) {
      return `${provider}:${username}`;
    }
  }

  // Determine provider from issuer URL if available
  if (issuer) {
    const provider = issuerToProvider(issuer);
    if (provider) {
      // Try to extract username from email for GitHub
      if (provider === "github" && email.endsWith("@users.noreply.github.com")) {
        // GitHub noreply format: "123456+username@users.noreply.github.com"
        // or just "username@users.noreply.github.com"
        const localPart = email.replace("@users.noreply.github.com", "");
        const plusIndex = localPart.indexOf("+");
        const extractedUsername = plusIndex >= 0 ? localPart.slice(plusIndex + 1) : localPart;
        return `github:${extractedUsername}`;
      }
      // Use email as the identity since we don't have username
      return `${provider}:${email}`;
    }
  }

  // Common OIDC providers and their email domains (fallback)
  const providerMap: Record<string, string> = {
    "@users.noreply.github.com": "github",
    "@github.com": "github",
    "@gmail.com": "google",
    "@googlemail.com": "google",
    "@outlook.com": "microsoft",
    "@hotmail.com": "microsoft",
    "@live.com": "microsoft",
  };

  // Try to match provider by email domain
  for (const [domain, provider] of Object.entries(providerMap)) {
    if (email.endsWith(domain)) {
      let extractedUsername = email.substring(0, email.length - domain.length);
      // Handle GitHub noreply format: "123456+username@users.noreply.github.com"
      if (provider === "github" && domain === "@users.noreply.github.com") {
        const plusIndex = extractedUsername.indexOf("+");
        if (plusIndex >= 0) {
          extractedUsername = extractedUsername.slice(plusIndex + 1);
        }
      }
      return `${provider}:${extractedUsername}`;
    }
  }

  // If no match, check for GitHub workflow identity
  // Format: https://github.com/{org}/{workflow}
  if (email.startsWith("https://github.com/")) {
    const path = email.replace("https://github.com/", "");
    return `github:${path}`;
  }

  // Fall back to email as-is
  return email;
}

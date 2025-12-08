/**
 * OAuth Identity Provider
 *
 * Provides interactive OIDC authentication for keyless signing.
 * Opens a browser for the user to authenticate with their identity provider
 * (GitHub, Google, Microsoft) and returns an OIDC token that can be used
 * with Fulcio to obtain a signing certificate.
 */

import open from "open";
import { initializeOAuthClient } from "./client";
import { CallbackServer } from "./server";

/** Default Sigstore OAuth issuer */
export const SIGSTORE_OAUTH_ISSUER = "https://oauth2.sigstore.dev/auth";

/** Default Sigstore OAuth client ID */
export const SIGSTORE_CLIENT_ID = "sigstore";

export interface OAuthIdentityProviderOptions {
  /** OIDC issuer URL (default: Sigstore public instance) */
  issuer?: string;
  /** OAuth client ID (default: "sigstore") */
  clientID?: string;
  /** OAuth client secret (optional, not needed for public clients) */
  clientSecret?: string;
  /** Redirect URL (optional, auto-generated if not provided) */
  redirectURL?: string;
}

/**
 * IdentityProvider interface - matches sigstore's expected interface
 */
export interface IdentityProvider {
  getToken: () => Promise<string>;
}

/**
 * OAuthIdentityProvider implements interactive browser-based OAuth flow
 * to obtain an OIDC token for keyless signing.
 */
export class OAuthIdentityProvider implements IdentityProvider {
  private server: CallbackServer;
  private issuer: string;
  private clientID: string;
  private clientSecret: string | undefined;

  constructor(options: OAuthIdentityProviderOptions = {}) {
    this.issuer = options.issuer ?? SIGSTORE_OAUTH_ISSUER;
    this.clientID = options.clientID ?? SIGSTORE_CLIENT_ID;
    this.clientSecret = options.clientSecret;

    let serverOpts: { hostname: string; port: number };
    if (options.redirectURL) {
      const url = new URL(options.redirectURL);
      serverOpts = { hostname: url.hostname, port: Number(url.port) };
    } else {
      // Use random port on localhost
      serverOpts = { hostname: "localhost", port: 0 };
    }

    this.server = new CallbackServer(serverOpts);
  }

  /**
   * Get an OIDC token by performing interactive OAuth flow.
   * Opens a browser for the user to authenticate.
   */
  public async getToken(): Promise<string> {
    // Start server to receive OAuth callback
    const serverURL = await this.server.start();

    // Initialize OAuth client with discovered configuration
    const client = await initializeOAuthClient({
      issuer: this.issuer,
      redirectURL: serverURL,
      clientID: this.clientID,
      clientSecret: this.clientSecret,
    });

    // Open browser to OAuth login page
    await open(client.authorizationUrl);

    if (!this.server.callback) {
      throw new Error("callback server not started");
    }

    // Wait for callback and exchange auth code for ID token
    return this.server.callback.then((callbackURL) => client.getIDToken(callbackURL));
  }
}

// Re-export for convenience
export { CallbackServer } from "./server";
export { OAuthClient, initializeOAuthClient } from "./client";

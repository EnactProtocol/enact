/**
 * OAuth Client
 *
 * Wrapper around openid-client for PKCE-based OAuth flow with Sigstore.
 */

import { type BaseClient, Issuer, generators } from "openid-client";

interface OAuthClientOptions {
  issuer: string;
  redirectURL: string;
  clientID: string;
  clientSecret: string | undefined;
}

/**
 * Initialize an OAuth client by discovering the issuer's configuration
 */
export async function initializeOAuthClient(options: OAuthClientOptions): Promise<OAuthClient> {
  const issuer = await Issuer.discover(options.issuer);

  const client = new issuer.Client(
    options.clientSecret
      ? {
          client_id: options.clientID,
          client_secret: options.clientSecret,
          token_endpoint_auth_method: "client_secret_basic" as const,
        }
      : {
          client_id: options.clientID,
          token_endpoint_auth_method: "none" as const,
        }
  );

  return new OAuthClient(client, options.redirectURL);
}

/**
 * OAuthClient wraps an openid-client Client instance to maintain
 * state for the PKCE authorization flow.
 */
export class OAuthClient {
  private client: BaseClient;
  private redirectURL: string;
  private verifier: string;
  private nonce: string;
  private state: string;

  constructor(client: BaseClient, redirectURL: string) {
    this.client = client;
    this.redirectURL = redirectURL;
    this.verifier = generators.codeVerifier(32);
    this.nonce = generators.nonce(32);
    this.state = generators.state(16);
  }

  /**
   * Get the authorization URL to redirect the user to
   */
  get authorizationUrl(): string {
    return this.client.authorizationUrl({
      scope: "openid email",
      redirect_uri: this.redirectURL,
      code_challenge: generators.codeChallenge(this.verifier),
      code_challenge_method: "S256",
      state: this.state,
      nonce: this.nonce,
    });
  }

  /**
   * Exchange the callback URL for an ID token
   */
  public async getIDToken(callbackURL: string): Promise<string> {
    const params = this.client.callbackParams(callbackURL);
    const tokenSet = await this.client.callback(this.redirectURL, params, {
      response_type: "code",
      code_verifier: this.verifier,
      state: this.state,
      nonce: this.nonce,
    });

    if (!tokenSet.id_token) {
      throw new Error("No ID token received from OAuth provider");
    }

    return tokenSet.id_token;
  }
}

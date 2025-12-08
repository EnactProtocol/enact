/**
 * Authentication functionality (v2)
 * Handles OAuth-based authentication for the Enact registry
 */

import type { EnactApiClient } from "./client";
import type {
  CurrentUser,
  OAuthCallbackRequest,
  OAuthLoginRequest,
  OAuthLoginResponse,
  OAuthProvider,
  OAuthTokenResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
} from "./types";

/**
 * Authentication result
 */
export interface AuthResult {
  /** Whether authentication succeeded */
  success: boolean;
  /** Authentication token (if successful) */
  token?: string | undefined;
  /** Current user info (if successful) */
  user?: AuthUser | undefined;
  /** Error message (if failed) */
  error?: string | undefined;
}

/**
 * Authenticated user info
 */
export interface AuthUser {
  /** Username */
  username: string;
  /** Email address */
  email: string;
  /** Namespaces owned */
  namespaces: string[];
}

/**
 * Authentication status
 */
export interface AuthStatus {
  /** Whether currently authenticated */
  authenticated: boolean;
  /** Current user (if authenticated) */
  user?: AuthUser | undefined;
  /** Token expiration time (if available) */
  expiresAt?: Date | undefined;
}

/**
 * Initiate OAuth login (v2)
 *
 * @param client - API client instance
 * @param provider - OAuth provider (github, google, microsoft)
 * @param redirectUri - Callback URL (usually http://localhost:PORT/callback)
 * @returns Authorization URL to redirect user to
 *
 * @example
 * ```ts
 * const result = await initiateLogin(client, "github", "http://localhost:9876/callback");
 * console.log(`Visit: ${result.authUrl}`);
 * ```
 */
export async function initiateLogin(
  client: EnactApiClient,
  provider: OAuthProvider,
  redirectUri: string
): Promise<OAuthLoginResponse> {
  const response = await client.post<OAuthLoginResponse>("/auth/login", {
    provider,
    redirect_uri: redirectUri,
  } as OAuthLoginRequest);

  return response.data;
}

/**
 * Exchange OAuth code for tokens (v2)
 *
 * @param client - API client instance
 * @param provider - OAuth provider used
 * @param code - Authorization code from OAuth callback
 * @returns Token response with access token, refresh token, and user info
 *
 * @example
 * ```ts
 * const tokens = await exchangeCodeForToken(client, "github", "auth_code_123");
 * client.setAuthToken(tokens.access_token);
 * console.log(`Logged in as ${tokens.user.username}`);
 * ```
 */
export async function exchangeCodeForToken(
  client: EnactApiClient,
  provider: OAuthProvider,
  code: string
): Promise<OAuthTokenResponse> {
  const response = await client.post<OAuthTokenResponse>("/auth/callback", {
    provider,
    code,
  } as OAuthCallbackRequest);

  return response.data;
}

/**
 * Refresh an expired access token (v2)
 *
 * @param client - API client instance
 * @param refreshToken - Refresh token obtained during login
 * @returns New access token and expiration
 *
 * @example
 * ```ts
 * const newToken = await refreshAccessToken(client, storedRefreshToken);
 * client.setAuthToken(newToken.access_token);
 * ```
 */
export async function refreshAccessToken(
  client: EnactApiClient,
  refreshToken: string
): Promise<RefreshTokenResponse> {
  const response = await client.post<RefreshTokenResponse>("/auth/refresh", {
    refresh_token: refreshToken,
  } as RefreshTokenRequest);

  return response.data;
}

/**
 * Authenticate with the Enact registry (v2 OAuth flow)
 *
 * This is a convenience wrapper that initiates an OAuth flow:
 * 1. Opens a browser for authentication
 * 2. User logs in via their provider (GitHub, Google, etc.)
 * 3. Receives a token from the registry
 *
 * Note: The actual OAuth callback handling requires a local HTTP server,
 * which should be implemented in the CLI package.
 *
 * @param client - API client instance
 * @returns Authentication result
 *
 * @example
 * ```ts
 * const result = await authenticate(client);
 * if (result.success) {
 *   client.setAuthToken(result.token);
 *   console.log(`Logged in as ${result.user.username}`);
 * }
 * ```
 */
export async function authenticate(_client: EnactApiClient): Promise<AuthResult> {
  // This is a placeholder for the full OAuth flow
  // The actual implementation should be in the CLI package
  // which can start a local server and open a browser
  //
  // Typical flow:
  // 1. const loginResponse = await initiateLogin(client, "github", redirectUri);
  // 2. Open browser to loginResponse.auth_url
  // 3. Start local server on redirectUri to receive callback
  // 4. Extract code from callback
  // 5. const tokens = await exchangeCodeForToken(client, "github", code);
  // 6. Return { success: true, token: tokens.access_token, user: {...} }

  throw new Error(
    "authenticate() must be implemented in the CLI package. " +
      "Use initiateLogin() and exchangeCodeForToken() for OAuth flow."
  );
}

/**
 * Log out by clearing the authentication token
 *
 * @param client - API client instance
 */
export function logout(client: EnactApiClient): void {
  client.setAuthToken(undefined);
}

/**
 * Get current user info (v2)
 *
 * @param client - API client instance (must be authenticated)
 * @returns Current user info
 *
 * @example
 * ```ts
 * const user = await getCurrentUser(client);
 * console.log(`Logged in as ${user.username}`);
 * ```
 */
export async function getCurrentUser(client: EnactApiClient): Promise<CurrentUser> {
  const response = await client.get<CurrentUser>("/auth/me");
  return response.data;
}

/**
 * Get current authentication status (v2)
 *
 * @param client - API client instance
 * @returns Current auth status
 *
 * @example
 * ```ts
 * const status = await getAuthStatus(client);
 * if (status.authenticated) {
 *   console.log(`Logged in as ${status.user.username}`);
 * }
 * ```
 */
export async function getAuthStatus(client: EnactApiClient): Promise<AuthStatus> {
  if (!client.isAuthenticated()) {
    return { authenticated: false };
  }

  try {
    const user = await getCurrentUser(client);
    return {
      authenticated: true,
      user: {
        username: user.username,
        email: user.email,
        namespaces: user.namespaces,
      },
    };
  } catch {
    // Token might be invalid/expired
    return { authenticated: false };
  }
}

/**
 * Get user profile by username (v2)
 *
 * @param client - API client instance
 * @param username - Username to look up
 * @returns User profile info
 */
export async function getUserProfile(
  client: EnactApiClient,
  username: string
): Promise<{
  username: string;
  displayName?: string | undefined;
  avatarUrl?: string | undefined;
  createdAt: Date;
  toolsCount?: number | undefined;
}> {
  const response = await client.get<{
    username: string;
    display_name?: string | undefined;
    avatar_url?: string | undefined;
    created_at: string;
    tools_count?: number | undefined;
  }>(`/users/${username}`);

  return {
    username: response.data.username,
    displayName: response.data.display_name,
    avatarUrl: response.data.avatar_url,
    createdAt: new Date(response.data.created_at),
    toolsCount: response.data.tools_count,
  };
}

/**
 * Submit feedback for a tool
 *
 * @param client - API client instance (must be authenticated)
 * @param name - Tool name
 * @param rating - Rating (1-5)
 * @param version - Version being rated
 * @param comment - Optional comment
 */
export async function submitFeedback(
  client: EnactApiClient,
  name: string,
  rating: number,
  version: string,
  comment?: string
): Promise<void> {
  await client.post(`/tools/${name}/feedback`, {
    rating,
    version,
    comment,
  });
}

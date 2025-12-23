/**
 * enact auth command
 *
 * Manage authentication for the Enact registry.
 * Implements OAuth 2.0 flow with GitHub, Google, or Microsoft.
 */

import { createServer } from "node:http";
import { URL } from "node:url";
import {
  createApiClient,
  exchangeCodeForToken,
  getCurrentUser,
  initiateLogin,
  logout,
  refreshAccessToken,
} from "@enactprotocol/api";
import type { OAuthProvider } from "@enactprotocol/api";
import { deleteSecret, getSecret, setSecret } from "@enactprotocol/secrets";
import type { Command } from "commander";
import type { CommandContext, GlobalOptions } from "../../types";
import {
  AuthError,
  dim,
  handleError,
  header,
  info,
  json,
  keyValue,
  newline,
  success,
  warning,
} from "../../utils";

/** Namespace for storing auth tokens in keyring */
const AUTH_NAMESPACE = "enact:auth";

/** Token keys in keyring */
const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const TOKEN_EXPIRY_KEY = "token_expiry";
const AUTH_METHOD_KEY = "auth_method"; // 'supabase' or 'legacy'

/** Supabase configuration (matches web app - defaults to local Supabase) */
const SUPABASE_URL = process.env.SUPABASE_URL || "https://siikwkfgsmouioodghho.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpaWt3a2Znc21vdWlvb2RnaGhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2MTkzMzksImV4cCI6MjA4MDE5NTMzOX0.kxnx6-IPFhmGx6rzNx36vbyhFMFZKP_jFqaDbKnJ_E0";

interface AuthOptions extends GlobalOptions {
  provider?: OAuthProvider;
  web?: boolean;
}

/** Default callback port for OAuth */
const DEFAULT_CALLBACK_PORT = 9876;

/** Default port for web-based auth */
const WEB_AUTH_PORT = 8118;

/** Web app URL for authentication - imported from shared constants */
import { ENACT_WEB_URL } from "@enactprotocol/shared";
const WEB_APP_URL = ENACT_WEB_URL;

/**
 * Get stored access token from keyring
 */
async function getStoredToken(): Promise<string | null> {
  return await getSecret(AUTH_NAMESPACE, ACCESS_TOKEN_KEY);
}

/**
 * Get stored refresh token from keyring
 */
async function getStoredRefreshToken(): Promise<string | null> {
  return await getSecret(AUTH_NAMESPACE, REFRESH_TOKEN_KEY);
}

/**
 * Store tokens in keyring
 */
async function storeTokens(
  accessToken: string,
  refreshToken: string,
  expiresIn: number,
  authMethod: "supabase" | "legacy" = "supabase"
): Promise<void> {
  await setSecret(AUTH_NAMESPACE, ACCESS_TOKEN_KEY, accessToken);
  await setSecret(AUTH_NAMESPACE, REFRESH_TOKEN_KEY, refreshToken);
  await setSecret(AUTH_NAMESPACE, AUTH_METHOD_KEY, authMethod);

  // Store expiry as ISO timestamp
  const expiryTime = new Date(Date.now() + expiresIn * 1000).toISOString();
  await setSecret(AUTH_NAMESPACE, TOKEN_EXPIRY_KEY, expiryTime);
}

/**
 * Clear stored tokens from keyring
 */
async function clearStoredTokens(): Promise<void> {
  await deleteSecret(AUTH_NAMESPACE, ACCESS_TOKEN_KEY);
  await deleteSecret(AUTH_NAMESPACE, REFRESH_TOKEN_KEY);
  await deleteSecret(AUTH_NAMESPACE, TOKEN_EXPIRY_KEY);
  await deleteSecret(AUTH_NAMESPACE, AUTH_METHOD_KEY);
}

/**
 * Refresh Supabase token using the refresh token
 */
async function refreshSupabaseToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
} | null> {
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
    };
  } catch {
    return null;
  }
}

/**
 * Get a valid access token, refreshing if necessary
 * Exported so other commands can use the user's JWT for private tool access
 */
export async function getValidToken(): Promise<string | null> {
  const accessToken = await getStoredToken();
  if (!accessToken) {
    return null;
  }

  // Check if token is expired using stored expiry or JWT exp claim
  const expiryStr = await getSecret(AUTH_NAMESPACE, TOKEN_EXPIRY_KEY);
  let isExpiredOrExpiring = false;

  if (expiryStr) {
    const expiry = new Date(expiryStr);
    isExpiredOrExpiring = expiry.getTime() - Date.now() < 60000; // Less than 1 minute left
  } else {
    // No stored expiry - check JWT exp claim directly
    try {
      const [, payloadBase64] = accessToken.split(".");
      if (payloadBase64) {
        const payload = JSON.parse(Buffer.from(payloadBase64, "base64").toString());
        if (payload.exp) {
          isExpiredOrExpiring = payload.exp * 1000 - Date.now() < 60000;
        }
      }
    } catch {
      // Can't parse JWT, assume it might be expired
      isExpiredOrExpiring = true;
    }
  }

  if (isExpiredOrExpiring) {
    // Try to refresh
    const refreshToken = await getStoredRefreshToken();
    if (refreshToken) {
      const authMethod = await getSecret(AUTH_NAMESPACE, AUTH_METHOD_KEY);

      if (authMethod === "supabase") {
        // Use Supabase refresh
        const result = await refreshSupabaseToken(refreshToken);
        if (result) {
          await storeTokens(
            result.access_token,
            result.refresh_token,
            result.expires_in,
            "supabase"
          );
          return result.access_token;
        }
      } else {
        // Use legacy API refresh
        try {
          const client = createApiClient();
          const result = await refreshAccessToken(client, refreshToken);
          await storeTokens(result.access_token, refreshToken, result.expires_in, "legacy");
          return result.access_token;
        } catch {
          // Refresh failed
        }
      }
    }

    // Refresh failed or no refresh token, need to re-authenticate
    await clearStoredTokens();
    return null;
  }

  return accessToken;
}

/**
 * Open a URL in the default browser
 */
async function openBrowser(url: string): Promise<void> {
  const { exec } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execAsync = promisify(exec);

  const platform = process.platform;

  try {
    if (platform === "darwin") {
      await execAsync(`open "${url}"`);
    } else if (platform === "win32") {
      await execAsync(`start "" "${url}"`);
    } else {
      // Linux
      await execAsync(`xdg-open "${url}"`);
    }
  } catch (err) {
    throw new Error(
      `Failed to open browser: ${err instanceof Error ? err.message : "Unknown error"}`
    );
  }
}

/**
 * Start a local HTTP server to receive the OAuth callback
 */
async function waitForCallback(port: number): Promise<{ code: string; state: string | undefined }> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", `http://localhost:${port}`);

      if (url.pathname === "/callback") {
        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");
        const errorDescription = url.searchParams.get("error_description");
        const state = url.searchParams.get("state") ?? undefined;

        // Send response to browser
        res.writeHead(200, { "Content-Type": "text/html" });

        if (error) {
          res.end(`
            <!DOCTYPE html>
            <html>
              <head><title>Authentication Failed</title></head>
              <body style="font-family: system-ui; padding: 40px; text-align: center;">
                <h1>❌ Authentication Failed</h1>
                <p>${errorDescription ?? error}</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `);
          server.close();
          reject(new Error(errorDescription ?? error));
          return;
        }

        if (!code) {
          res.end(`
            <!DOCTYPE html>
            <html>
              <head><title>Authentication Failed</title></head>
              <body style="font-family: system-ui; padding: 40px; text-align: center;">
                <h1>❌ Authentication Failed</h1>
                <p>No authorization code received.</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `);
          server.close();
          reject(new Error("No authorization code received"));
          return;
        }

        res.end(`
          <!DOCTYPE html>
          <html>
            <head><title>Authentication Successful</title></head>
            <body style="font-family: system-ui; padding: 40px; text-align: center;">
              <h1>✅ Authentication Successful</h1>
              <p>You are now logged in to the Enact registry.</p>
              <p>You can close this window and return to your terminal.</p>
            </body>
          </html>
        `);

        server.close();
        resolve({ code, state: state ?? undefined });
      } else {
        res.writeHead(404);
        res.end("Not found");
      }
    });

    server.listen(port, "127.0.0.1", () => {
      // Server is ready
    });

    // Timeout after 5 minutes
    setTimeout(
      () => {
        server.close();
        reject(new Error("Authentication timed out. Please try again."));
      },
      5 * 60 * 1000
    );
  });
}

/**
 * Wait for web-based auth callback (receives tokens from web app)
 */
async function waitForWebCallback(port: number): Promise<{
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email?: string;
    user_metadata?: {
      username?: string;
      user_name?: string;
      full_name?: string;
      avatar_url?: string;
    };
  };
}> {
  return new Promise((resolve, reject) => {
    const state = { timeoutId: undefined as ReturnType<typeof setTimeout> | undefined };

    const server = createServer(async (req, res) => {
      // Enable CORS for the web app
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      // Disable keep-alive to allow server to close immediately
      res.setHeader("Connection", "close");

      if (req.method === "OPTIONS") {
        res.writeHead(200);
        res.end();
        return;
      }

      if (req.method === "POST" && req.url === "/callback") {
        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });

        req.on("end", () => {
          try {
            const data = JSON.parse(body);

            if (!data.access_token || !data.refresh_token) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Missing tokens" }));
              return;
            }

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true }));

            // Clear timeout and close server
            if (state.timeoutId) clearTimeout(state.timeoutId);
            server.close();
            server.closeAllConnections?.();

            resolve({
              accessToken: data.access_token,
              refreshToken: data.refresh_token,
              user: data.user,
            });
          } catch {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Invalid JSON" }));
          }
        });
      } else {
        res.writeHead(404);
        res.end("Not found");
      }
    });

    server.listen(port, "127.0.0.1", () => {
      // Server is ready
    });

    // Timeout after 5 minutes
    state.timeoutId = setTimeout(
      () => {
        server.close();
        server.closeAllConnections?.();
        reject(new Error("Authentication timed out. Please try again."));
      },
      5 * 60 * 1000
    );
  });
}

/**
 * Auth login handler (web-based flow via enact.dev)
 */
async function webLoginHandler(options: AuthOptions, _ctx: CommandContext): Promise<void> {
  // Check for existing valid token
  const existingToken = await getValidToken();
  if (existingToken) {
    const client = createApiClient();
    client.setAuthToken(existingToken);
    try {
      const user = await getCurrentUser(client);
      warning(`Already logged in as ${user.username}`);
      info("Use 'enact auth logout' to sign out first");
      return;
    } catch {
      // Token invalid, continue with login
      await clearStoredTokens();
    }
  }

  const port = WEB_AUTH_PORT;
  const authUrl = `${WEB_APP_URL}/auth/cli?port=${port}`;

  info("Authenticating via web browser...");
  newline();

  try {
    // 1. Start local callback server
    const callbackPromise = waitForWebCallback(port);

    // 2. Open browser for authentication
    info("Opening browser for authentication...");
    dim("If the browser doesn't open, visit:");
    dim(authUrl);
    newline();

    await openBrowser(authUrl);

    // 3. Wait for callback with tokens
    info("Waiting for authentication...");
    const { accessToken, refreshToken, user } = await callbackPromise;

    // 4. Store tokens securely in keyring (default 1 hour expiry for Supabase tokens)
    await storeTokens(accessToken, refreshToken, 604800, "supabase");

    // Get username from profile (set by CliCallback) or fall back to OAuth metadata
    const username =
      user.user_metadata?.username ||
      user.user_metadata?.user_name ||
      user.user_metadata?.full_name ||
      user.email?.split("@")[0] ||
      "user";
    const email = user.email || "";

    if (options.json) {
      json({
        success: true,
        username,
        email,
      });
      return;
    }

    newline();
    success(`Logged in as ${username}`);
    if (email) {
      keyValue("Email", email);
    }
  } catch (err) {
    throw new AuthError(err instanceof Error ? err.message : "Authentication failed");
  }
}

/**
 * Auth login handler
 */
async function loginHandler(options: AuthOptions, _ctx: CommandContext): Promise<void> {
  // Use web-based flow if --web flag is set (now the default)
  if (options.web !== false) {
    return webLoginHandler(options, _ctx);
  }

  // Legacy API-based OAuth flow
  const client = createApiClient();

  // Check for existing valid token
  const existingToken = await getValidToken();
  if (existingToken) {
    client.setAuthToken(existingToken);
    try {
      const user = await getCurrentUser(client);
      warning(`Already logged in as ${user.username}`);
      info("Use 'enact auth logout' to sign out first");
      return;
    } catch {
      // Token invalid, continue with login
      await clearStoredTokens();
    }
  }

  const provider: OAuthProvider = options.provider ?? "github";
  const port = DEFAULT_CALLBACK_PORT;
  const redirectUri = `http://localhost:${port}/callback`;

  info(`Authenticating with ${provider}...`);
  newline();

  try {
    // 1. Initiate OAuth flow
    const loginResponse = await initiateLogin(client, provider, redirectUri);

    // 2. Start local callback server
    const callbackPromise = waitForCallback(port);

    // 3. Open browser for authentication
    info("Opening browser for authentication...");
    dim("If the browser doesn't open, visit:");
    dim(loginResponse.auth_url);
    newline();

    await openBrowser(loginResponse.auth_url);

    // 4. Wait for callback
    info("Waiting for authentication...");
    const { code } = await callbackPromise;

    // 5. Exchange code for tokens
    const tokenResponse = await exchangeCodeForToken(client, provider, code);

    // 6. Store tokens securely in keyring
    await storeTokens(
      tokenResponse.access_token,
      tokenResponse.refresh_token,
      tokenResponse.expires_in,
      "legacy"
    );

    // 7. Update client with new token
    client.setAuthToken(tokenResponse.access_token);

    if (options.json) {
      json({
        success: true,
        username: tokenResponse.user.username,
        email: tokenResponse.user.email,
      });
      return;
    }

    newline();
    success(`Logged in as ${tokenResponse.user.username}`);
    keyValue("Email", tokenResponse.user.email);
  } catch (err) {
    throw new AuthError(err instanceof Error ? err.message : "Authentication failed");
  }
}

/**
 * Auth logout handler
 */
async function logoutHandler(options: AuthOptions, _ctx: CommandContext): Promise<void> {
  const client = createApiClient();

  // Check for stored token
  const token = await getStoredToken();
  if (!token) {
    info("Not currently logged in");
    return;
  }

  // Get username before clearing
  let username: string | undefined;
  try {
    client.setAuthToken(token);
    const user = await getCurrentUser(client);
    username = user.username;
  } catch {
    // Token might be invalid, but we still want to clear it
  }

  // Clear stored tokens
  await clearStoredTokens();
  logout(client);

  if (options.json) {
    json({ success: true, message: "Logged out" });
    return;
  }

  success(`Logged out${username ? ` (was ${username})` : ""}`);
}

/**
 * Get Supabase user from access token
 */
async function getSupabaseUser(accessToken: string): Promise<{
  id: string;
  email?: string;
  user_metadata?: {
    user_name?: string;
    username?: string;
    full_name?: string;
    avatar_url?: string;
  };
} | null> {
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: SUPABASE_ANON_KEY,
      },
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as {
      id: string;
      email?: string;
      user_metadata?: {
        user_name?: string;
        username?: string;
        full_name?: string;
        avatar_url?: string;
      };
    };
  } catch {
    return null;
  }
}

/**
 * Get user profile from Supabase database
 */
async function getSupabaseProfile(
  accessToken: string,
  userId: string
): Promise<{
  username: string;
  display_name?: string;
  avatar_url?: string;
} | null> {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=username,display_name,avatar_url`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: SUPABASE_ANON_KEY,
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as Array<{
      username: string;
      display_name?: string;
      avatar_url?: string;
    }>;

    return data[0] || null;
  } catch {
    return null;
  }
}

/**
 * Auth status handler
 */
async function statusHandler(options: AuthOptions, _ctx: CommandContext): Promise<void> {
  // Try to get a valid token
  const token = await getValidToken();

  if (!token) {
    if (options.json) {
      json({ authenticated: false });
      return;
    }

    header("Authentication Status");
    newline();
    warning("Not authenticated");
    newline();
    dim("Run 'enact auth login' to authenticate");
    return;
  }

  const authMethod = await getSecret(AUTH_NAMESPACE, AUTH_METHOD_KEY);
  const expiryStr = await getSecret(AUTH_NAMESPACE, TOKEN_EXPIRY_KEY);

  if (authMethod === "supabase") {
    // Get user info from Supabase
    const user = await getSupabaseUser(token);

    if (!user) {
      await clearStoredTokens();
      if (options.json) {
        json({ authenticated: false });
        return;
      }
      header("Authentication Status");
      newline();
      warning("Not authenticated (token invalid)");
      newline();
      dim("Run 'enact auth login' to authenticate");
      return;
    }

    // Try to get profile username from database, fall back to user_metadata
    const profile = await getSupabaseProfile(token, user.id);
    const username =
      profile?.username ||
      user.user_metadata?.username ||
      user.user_metadata?.user_name ||
      user.user_metadata?.full_name ||
      user.email?.split("@")[0] ||
      "user";

    if (options.json) {
      json({
        authenticated: true,
        user: {
          username,
          email: user.email,
        },
        expiresAt: expiryStr ?? undefined,
      });
      return;
    }

    header("Authentication Status");
    newline();
    success("Authenticated");
    keyValue("Username", username);
    if (user.email) {
      keyValue("Email", user.email);
    }
    if (expiryStr) {
      keyValue("Token Expires", new Date(expiryStr).toISOString());
    }
    return;
  }

  // Legacy API-based auth
  const client = createApiClient();
  client.setAuthToken(token);

  try {
    const user = await getCurrentUser(client);

    if (options.json) {
      json({
        authenticated: true,
        user: {
          username: user.username,
          email: user.email,
          namespaces: user.namespaces,
        },
        expiresAt: expiryStr ?? undefined,
      });
      return;
    }

    header("Authentication Status");
    newline();
    success("Authenticated");
    keyValue("Username", user.username);
    keyValue("Email", user.email);
    if (user.namespaces.length > 0) {
      keyValue("Namespaces", user.namespaces.join(", "));
    }
    if (expiryStr) {
      keyValue("Token Expires", new Date(expiryStr).toISOString());
    }
  } catch {
    // Token invalid
    await clearStoredTokens();

    if (options.json) {
      json({ authenticated: false });
      return;
    }

    header("Authentication Status");
    newline();
    warning("Not authenticated (token expired)");
    newline();
    dim("Run 'enact auth login' to authenticate");
  }
}

/**
 * Auth whoami handler (alias for status)
 */
async function whoamiHandler(options: AuthOptions, _ctx: CommandContext): Promise<void> {
  const token = await getValidToken();
  if (!token) {
    throw new AuthError("Not logged in");
  }

  const authMethod = await getSecret(AUTH_NAMESPACE, AUTH_METHOD_KEY);

  if (authMethod === "supabase") {
    const user = await getSupabaseUser(token);
    if (!user) {
      await clearStoredTokens();
      throw new AuthError("Not logged in (token expired)");
    }

    // Try to get profile username from database, fall back to user_metadata
    const profile = await getSupabaseProfile(token, user.id);
    const username =
      profile?.username ||
      user.user_metadata?.username ||
      user.user_metadata?.user_name ||
      user.user_metadata?.full_name ||
      user.email?.split("@")[0] ||
      "user";

    if (options.json) {
      json({
        username,
        email: user.email,
      });
      return;
    }

    console.log(username);
    return;
  }

  // Legacy API-based auth
  const client = createApiClient();
  client.setAuthToken(token);

  try {
    const user = await getCurrentUser(client);

    if (options.json) {
      json({
        username: user.username,
        email: user.email,
        namespaces: user.namespaces,
      });
      return;
    }

    console.log(user.username);
  } catch {
    await clearStoredTokens();
    throw new AuthError("Not logged in (token expired)");
  }
}

/**
 * Configure the auth command
 */
export function configureAuthCommand(program: Command): void {
  const auth = program.command("auth").description("Manage registry authentication");

  auth
    .command("login")
    .description("Authenticate with the Enact registry")
    .option(
      "-p, --provider <provider>",
      "OAuth provider for API mode (github, google, microsoft)",
      "github"
    )
    .option("--web", "Use web-based authentication (default)", true)
    .option("--no-web", "Use direct API-based OAuth (legacy)")
    .option("-v, --verbose", "Show detailed output")
    .option("--json", "Output as JSON")
    .action(async (options: AuthOptions) => {
      const ctx: CommandContext = {
        cwd: process.cwd(),
        options,
        isCI: Boolean(process.env.CI),
        isInteractive: process.stdout.isTTY ?? false,
      };

      try {
        await loginHandler(options, ctx);
      } catch (err) {
        handleError(err, options.verbose ? { verbose: true } : undefined);
      }
    });

  auth
    .command("logout")
    .description("Sign out from the Enact registry")
    .option("--json", "Output as JSON")
    .action(async (options: AuthOptions) => {
      const ctx: CommandContext = {
        cwd: process.cwd(),
        options,
        isCI: Boolean(process.env.CI),
        isInteractive: process.stdout.isTTY ?? false,
      };

      try {
        await logoutHandler(options, ctx);
      } catch (err) {
        handleError(err);
      }
    });

  auth
    .command("status")
    .description("Show current authentication status")
    .option("--json", "Output as JSON")
    .action(async (options: AuthOptions) => {
      const ctx: CommandContext = {
        cwd: process.cwd(),
        options,
        isCI: Boolean(process.env.CI),
        isInteractive: process.stdout.isTTY ?? false,
      };

      try {
        await statusHandler(options, ctx);
      } catch (err) {
        handleError(err);
      }
    });

  auth
    .command("whoami")
    .description("Print the current username")
    .option("--json", "Output as JSON")
    .action(async (options: AuthOptions) => {
      const ctx: CommandContext = {
        cwd: process.cwd(),
        options,
        isCI: Boolean(process.env.CI),
        isInteractive: process.stdout.isTTY ?? false,
      };

      try {
        await whoamiHandler(options, ctx);
      } catch (err) {
        handleError(err);
      }
    });
}

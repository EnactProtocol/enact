// src/commands/auth.ts - Refactored to use the consolidated API client
import {
	intro,
	outro,
	text,
	select,
	confirm,
	spinner,
	note,
} from "@clack/prompts";
import pc from "picocolors";
import { existsSync } from "fs";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
import { createServer } from "http";
import { parse } from "url";
import { randomBytes, createHash } from "crypto";
import { exec } from "child_process";
import { promisify } from "util";
import { enactApi, EnactApiError } from "@enactprotocol/shared/api";

const execAsync = promisify(exec);

interface AuthOptions {
	help?: boolean;
	server?: string;
	port?: number;
}

// Configuration file setup
const CONFIG_DIR = join(homedir(), ".enact");
const AUTH_FILE = join(CONFIG_DIR, "auth.json");
const DEFAULT_SERVER = "https://enact.tools";

export async function handleAuthCommand(
	args: string[],
	options: AuthOptions,
): Promise<void> {
	if (options.help || !args[0]) {
		console.error(`
Usage: enact auth <subcommand> [options]

Manages authentication for enact CLI.

Subcommands:
  login               Start OAuth login flow
  logout              Remove stored authentication
  status              Show current authentication status
  token               Show current token (if authenticated)

Options:
  --help, -h          Show this help message
  --server <url>      Specify the enact server URL (default: ${DEFAULT_SERVER})
  --port <number>     Local callback port for OAuth (default: 8080)
`);
		return;
	}

	const subCommand = args[0];
	const serverUrl = options.server || DEFAULT_SERVER;
	const callbackPort = options.port || 8080;

	// Initialize auth config if it doesn't exist
	await ensureAuthConfig();

	intro(pc.bgBlue(pc.white(" Enact Authentication ")));

	switch (subCommand) {
		case "login": {
			await handleLogin(serverUrl, callbackPort);
			break;
		}

		case "logout": {
			await handleLogout();
			break;
		}

		case "status": {
			await handleStatus();
			break;
		}

		case "token": {
			await handleShowToken();
			break;
		}

		default:
			outro(pc.red(`✗ Unknown auth subcommand "${subCommand}"`));
			return;
	}
}

async function handleLogin(
	serverUrl: string,
	callbackPort: number,
): Promise<void> {
	try {
		// Check if already authenticated
		const currentAuth = await readAuthConfig();
		if (
			currentAuth.token &&
			currentAuth.expiresAt &&
			new Date(currentAuth.expiresAt) > new Date()
		) {
			const useExisting = await confirm({
				message: "You are already authenticated. Continue with new login?",
			});

			if (!useExisting) {
				outro(pc.yellow("Login cancelled"));
				return;
			}
		}

		// Generate PKCE challenge
		const codeVerifier = generateCodeVerifier();
		const codeChallenge = generateCodeChallenge(codeVerifier);
		const state = generateState();
		const redirectUri = `http://localhost:${callbackPort}/callback`;

		// Use the API client to generate OAuth URL
		const authUrl = enactApi.generateOAuthUrl({
			clientId: "enact-cli",
			redirectUri,
			scope: "publish read write",
			state,
			codeChallenge,
			codeChallengeMethod: "S256",
		});

		// Start local callback server for fallback
		const s = spinner();
		s.start("Starting OAuth flow...");

		// Try to start callback server, but don't fail if port is busy
		let server = null;
		try {
			server = await startCallbackServerWithFallback(
				callbackPort,
				serverUrl,
				codeVerifier,
				state,
			);
			s.stop("OAuth server started");
		} catch (error) {
			s.stop("OAuth server could not start, using manual mode");
			server = null;
		}

		// Open browser
		note(`Opening browser to: ${authUrl}`, "OAuth Login");

		try {
			await openBrowser(authUrl);
		} catch (error) {
			note(
				`Please open this URL in your browser: ${authUrl}`,
				"Manual Browser Open Required",
			);
		}

		if (server) {
			note("Waiting for authorization callback...", "Automatic Mode");
			note(
				"The browser will redirect back to complete authentication automatically.",
				"",
			);

			// Wait for the callback server to complete
			await new Promise((resolve, reject) => {
				server.on("authComplete", resolve);
				server.on("authError", reject);

				// Timeout after 5 minutes
				setTimeout(
					() => {
						server.close();
						reject(new Error("Authentication timeout"));
					},
					5 * 60 * 1000,
				);
			});
		} else {
			// Manual code entry mode
			note(
				"After authorizing in the browser, you will see an authorization code.",
				"Manual Mode",
			);
			note("Copy that code and paste it below.", "");

			const authCode = await text({
				message: "Enter the authorization code from the browser:",
				placeholder: "Paste the authorization code here...",
				validate: (value) => {
					if (!value || value.length < 10) {
						return "Please enter a valid authorization code";
					}
				},
			});

			if (typeof authCode === "symbol") {
				outro(pc.yellow("Login cancelled"));
				return;
			}

			// Exchange the manual code for token using API client
			await exchangeCodeForToken(
				authCode,
				redirectUri,
				codeVerifier,
				serverUrl,
			);
		}

		outro(pc.green("✓ Successfully authenticated with Enact!"));
	} catch (error) {
		outro(pc.red(`✗ Login failed: ${(error as Error).message}`));
	} finally {
		process.exit(0);
	}
}

async function startCallbackServerWithFallback(
	port: number,
	serverUrl: string,
	codeVerifier: string,
	state: string,
): Promise<any> {
	const redirectUri = `http://localhost:${port}/callback`;

	return new Promise((resolve, reject) => {
		const server = createServer(async (req, res) => {
			const parsedUrl = parse(req.url || "", true);

			if (parsedUrl.pathname === "/callback") {
				const {
					code,
					state: returnedState,
					error,
					error_description,
				} = parsedUrl.query;

				// Set CORS headers
				res.setHeader("Access-Control-Allow-Origin", "*");
				res.setHeader("Content-Type", "text/html");

				if (error) {
					const errorMsg = error_description || error;
					res.writeHead(400);
					res.end(`
            <html>
              <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: red;">❌ Authentication Failed</h1>
                <p><strong>Error:</strong> ${errorMsg}</p>
                <p>You can close this window and try again in your terminal.</p>
              </body>
            </html>
          `);
					server.emit("authError", new Error(`OAuth error: ${errorMsg}`));
					return;
				}

				if (returnedState !== state) {
					res.writeHead(400);
					res.end(`
            <html>
              <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: red;">❌ Security Error</h1>
                <p>Invalid state parameter. Please try again.</p>
                <p>You can close this window and restart authentication in your terminal.</p>
              </body>
            </html>
          `);
					server.emit("authError", new Error("Invalid state parameter"));
					return;
				}

				if (!code) {
					res.writeHead(400);
					res.end(`
            <html>
              <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: red;">❌ No Authorization Code</h1>
                <p>No authorization code received. Please try again.</p>
                <p>You can close this window and restart authentication in your terminal.</p>
              </body>
            </html>
          `);
					server.emit("authError", new Error("No authorization code received"));
					return;
				}

				try {
					await exchangeCodeForToken(
						code as string,
						redirectUri,
						codeVerifier,
						serverUrl,
					);

					res.writeHead(200);
					res.end(`
            <html>
              <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: green;">✅ Authentication Successful!</h1>
                <p>You have successfully authenticated with Enact.</p>
                <p>You can close this window and return to your terminal.</p>
                <script>
                  setTimeout(() => window.close(), 3000);
                </script>
              </body>
            </html>
          `);

					server.close();
					server.emit("authComplete");
				} catch (error) {
					console.error("Token exchange error:", error);
					res.writeHead(500);
					res.end(`
            <html>
              <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: red;">❌ Authentication Failed</h1>
                <p><strong>Error:</strong> ${(error as Error).message}</p>
                <p>You can close this window and check your terminal for more details.</p>
              </body>
            </html>
          `);
					server.emit("authError", error);
				}
			} else {
				res.writeHead(404);
				res.end(`
          <html>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h1>Enact CLI OAuth Callback</h1>
              <p>This is the OAuth callback endpoint for the Enact CLI.</p>
              <p>If you're seeing this, something went wrong with the OAuth flow.</p>
            </body>
          </html>
        `);
			}
		});

		server.listen(port, "localhost", () => {
			console.error(
				`OAuth callback server listening on http://localhost:${port}`,
			);
			resolve(server);
		});

		server.on("error", (error: Error) => {
			if ((error as any).code === "EADDRINUSE") {
				reject(new Error(`Port ${port} is already in use`));
			} else {
				reject(error);
			}
		});
	});
}

async function exchangeCodeForToken(
	code: string,
	redirectUri: string,
	codeVerifier: string,
	serverUrl: string,
): Promise<void> {
	console.error(`Exchanging code for token...`);
	console.error("Exchange params:", {
		code: code.substring(0, 8) + "...",
		redirectUri,
		codeVerifier: codeVerifier.substring(0, 8) + "...",
	});

	try {
		// Use the API client to exchange OAuth code for token
		const tokenData = await enactApi.exchangeOAuthCode({
			grant_type: "authorization_code",
			code: code,
			redirect_uri: redirectUri,
			client_id: "enact-cli",
			code_verifier: codeVerifier,
		});

		// Store the token with the server URL for future reference
		const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
		await writeAuthConfig({
			token: tokenData.access_token,
			tokenType: tokenData.token_type || "Bearer",
			expiresAt: expiresAt.toISOString(),
			scope: tokenData.scope,
			server: serverUrl, // Store which server this token is associated with
		});

		console.error("✓ Token stored successfully");
	} catch (error: unknown) {
		if (error instanceof EnactApiError) {
			throw new Error(`Token exchange failed: ${error.message}`);
		}
		throw error;
	}
}

async function handleLogout(): Promise<void> {
	const currentAuth = await readAuthConfig();

	if (!currentAuth.token) {
		note("Not currently authenticated", "Status");
		outro("");
		return;
	}

	const shouldLogout = await confirm({
		message: "Are you sure you want to logout?",
	});

	if (!shouldLogout) {
		outro(pc.yellow("Logout cancelled"));
		return;
	}

	const s = spinner();
	s.start("Logging out...");

	// Clear stored authentication
	await writeAuthConfig({});

	s.stop("Logged out successfully");
	outro(pc.green("✓ You have been logged out"));
}

async function handleStatus(): Promise<void> {
	const currentAuth = await readAuthConfig();

	if (!currentAuth.token) {
		note("Not authenticated", "Status");
		outro(pc.yellow('Run "enact auth login" to authenticate'));
		return;
	}

	const isExpired =
		currentAuth.expiresAt && new Date(currentAuth.expiresAt) <= new Date();

	if (isExpired) {
		note("Token has expired", "Status");
		outro(pc.yellow('Run "enact auth login" to re-authenticate'));
		return;
	}

	const expiresIn = currentAuth.expiresAt
		? Math.round(
				(new Date(currentAuth.expiresAt).getTime() - Date.now()) /
					1000 /
					60 /
					60,
			)
		: "unknown";

	note(
		`Authenticated\nExpires: ${currentAuth.expiresAt || "unknown"}\nExpires in: ${expiresIn} hours`,
		"Status",
	);
	outro(pc.green("✓ Authentication valid"));
}

async function handleShowToken(): Promise<void> {
	const currentAuth = await readAuthConfig();

	if (!currentAuth.token) {
		note("Not authenticated", "Status");
		outro(pc.yellow('Run "enact auth login" to authenticate'));
		return;
	}

	const isExpired =
		currentAuth.expiresAt && new Date(currentAuth.expiresAt) <= new Date();

	if (isExpired) {
		note("Token has expired", "Status");
		outro(pc.yellow('Run "enact auth login" to re-authenticate'));
		return;
	}

	// Mask the token for security (show first 8 and last 4 characters)
	const maskedToken =
		currentAuth.token.length > 12
			? `${currentAuth.token.slice(0, 8)}...${currentAuth.token.slice(-4)}`
			: currentAuth.token;

	note(`Token: ${maskedToken}`, "Current Token");

	const showFull = await confirm({
		message: "Show full token? (This will be visible in your terminal)",
	});

	if (showFull) {
		note(currentAuth.token, "Full Token");
	}

	outro("");
}

// Helper functions
function generateCodeVerifier(): string {
	return randomBytes(32).toString("base64url");
}

function generateCodeChallenge(verifier: string): string {
	return createHash("sha256").update(verifier).digest("base64url");
}

function generateState(): string {
	return randomBytes(16).toString("hex");
}

async function openBrowser(url: string): Promise<void> {
	const platform = process.platform;

	let command: string;
	if (platform === "darwin") {
		command = `open "${url}"`;
	} else if (platform === "win32") {
		command = `start "" "${url}"`;
	} else {
		command = `xdg-open "${url}"`;
	}

	await execAsync(command);
}

// Auth config management
async function ensureAuthConfig() {
	if (!existsSync(CONFIG_DIR)) {
		await mkdir(CONFIG_DIR, { recursive: true });
	}

	if (!existsSync(AUTH_FILE)) {
		await writeAuthConfig({});
	}
}

async function readAuthConfig() {
	try {
		const text = await readFile(AUTH_FILE, "utf8");
		return JSON.parse(text);
	} catch (e) {
		return {};
	}
}

async function writeAuthConfig(config: any): Promise<void> {
	await writeFile(AUTH_FILE, JSON.stringify(config, null, 2), "utf8");
}

// Export function to get current token (for use in other commands)
export async function getCurrentToken(): Promise<string | null> {
	try {
		const auth = await readAuthConfig();

		if (!auth.token) {
			return null;
		}

		// Check if token is expired
		if (auth.expiresAt && new Date(auth.expiresAt) <= new Date()) {
			return null;
		}

		return auth.token;
	} catch (error) {
		return null;
	}
}

// Export function to get auth headers (for use in other commands)
export async function getAuthHeaders(): Promise<Record<string, string>> {
	const token = await getCurrentToken();

	if (!token) {
		throw new Error(
			'Not authenticated. Run "enact auth login" to authenticate.',
		);
	}

	return {
		"Content-Type": "application/json",
		"X-API-Key": `${token}`,
	};
}

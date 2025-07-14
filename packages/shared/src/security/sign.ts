// enact-signer.ts - Critical field signing for focused security validation

import * as crypto from "crypto";
import { parse, stringify } from "yaml";
import * as fs from "fs";
import * as path from "path";

/**
 * Crea	// Use canonical JSON creation with only critical fields
	const canonicalJson = createCanonicalToolJson(toolForSigning);

	console.error("=== SIGNING DEBUG (CRITICAL FIELDS ONLY) ===");
	console.error("Tool for signing:", JSON.stringify(toolForSigning, null, 2));
	console.error("Critical-fields-only canonical JSON:", canonicalJson);
	console.error("Canonical JSON length:", canonicalJson.length);
	console.error("==========================================");ical tool definition with ONLY critical security fields
 * This signs only the fields that are critical for security and tool identity
 */
function createCanonicalToolDefinition(
	tool: Record<string, unknown>,
): Record<string, unknown> {
	const canonical: Record<string, unknown> = {};

	// CRITICAL SECURITY FIELDS ONLY - these fields are signed to prevent tampering
	const criticalFields = [
		"enact",        // Protocol version security
		"name",         // Identity - prevents tool impersonation  
		"description",  // What the tool claims to do
		"command",      // The actual execution payload
		"from",         // Container image - critical for security
		"env",          // Environment variables
		"timeout",      // Prevents DoS attacks
		"inputSchema",  // Defines the attack surface
		"annotations",  // Security behavior hints
		"version",      // Tool version for compatibility
	];

	// Add only critical fields in the specific order
	for (const field of criticalFields) {
		if (tool[field] !== undefined) {
			canonical[field] = tool[field];
		}
	}

	return canonical;
}

/**
 * Create canonical tool JSON with ONLY critical security fields
 * This focuses the signature on security-critical fields only
 */
function createCanonicalToolJson(toolData: any): string {
	// Only include critical security fields in the canonical representation
	const toolRecord: Record<string, unknown> = {
		// Core identity and security fields
		enact: toolData.enact || toolData.protocol_version || "1.0.0",
		name: toolData.name,
		description: toolData.description,
		command: toolData.command,
		
		// Security-critical optional fields (only if present)
		...(toolData.from && { from: toolData.from }),
		...(toolData.env && { env: toolData.env }),
		...(toolData.env_vars && { env: toolData.env_vars }), // Handle both formats
		...(toolData.timeout && { timeout: toolData.timeout }),
		...(toolData.inputSchema && { inputSchema: toolData.inputSchema }),
		...(toolData.input_schema && { inputSchema: toolData.input_schema }), // Handle both formats
		...(toolData.annotations && { annotations: toolData.annotations }),
		...(toolData.version && { version: toolData.version }),
	};

	// Use the canonical function that only includes critical fields
	const canonical = createCanonicalToolDefinition(toolRecord);

	// Return deterministic JSON with sorted keys for consistent signatures
	return JSON.stringify(canonical, Object.keys(canonical).sort());
}

// Updated interfaces for new protocol
interface SignatureData {
	algorithm: string;
	type: string;
	signer: string;
	created: string;
	value: string;
	role?: string;
}

interface EnactTool {
	name: string;
	description: string;
	command: string;
	timeout?: string;
	tags?: string[];
	version?: string;
	enact?: string;
	protocol_version?: string;
	input_schema?: any; // Use underscore version
	output_schema?: any; // Use underscore version
	annotations?: any;
	env_vars?: Record<string, any>; // Use underscore version (not env)
	examples?: any;
	resources?: any;
	raw_content?: string;
	// New multi-signature format: public key -> signature data
	signatures?: Record<string, SignatureData>;
	[key: string]: any;
}

// Verification policies
interface VerificationPolicy {
	requireRoles?: string[]; // Require signatures with specific roles
	minimumSignatures?: number; // Minimum number of valid signatures
	trustedSigners?: string[]; // Only accept signatures from these signers
	allowedAlgorithms?: string[]; // Allowed signature algorithms
}

const DEFAULT_POLICY: VerificationPolicy = {
	minimumSignatures: 1,
	allowedAlgorithms: ["sha256"],
};

// Default directory for trusted keys
const TRUSTED_KEYS_DIR = path.join(
	process.env.HOME || ".",
	".enact",
	"trusted-keys",
);

/**
 * Get all trusted public keys mapped by their base64 representation
 * @returns Map of base64 public key -> PEM content
 */
export function getTrustedPublicKeysMap(): Map<string, string> {
	const trustedKeys = new Map<string, string>();

	// Load keys from the filesystem
	if (fs.existsSync(TRUSTED_KEYS_DIR)) {
		try {
			const files = fs.readdirSync(TRUSTED_KEYS_DIR);

			for (const file of files) {
				if (file.endsWith(".pem")) {
					const keyPath = path.join(TRUSTED_KEYS_DIR, file);
					const pemContent = fs.readFileSync(keyPath, "utf8");

					// Convert PEM to base64 for map key
					const base64Key = pemToBase64(pemContent);
					trustedKeys.set(base64Key, pemContent);
				}
			}
		} catch (error) {
			console.error(`Error reading trusted keys: ${(error as Error).message}`);
		}
	}

	return trustedKeys;
}

/**
 * Convert PEM public key to base64 format for use as map key
 */
function pemToBase64(pem: string): string {
	return pem
		.replace(/-----BEGIN PUBLIC KEY-----/, "")
		.replace(/-----END PUBLIC KEY-----/, "")
		.replace(/\s/g, "");
}

/**
 * Convert base64 key back to PEM format
 */
function base64ToPem(base64: string): string {
	return `-----BEGIN PUBLIC KEY-----\n${base64.match(/.{1,64}/g)?.join("\n")}\n-----END PUBLIC KEY-----`;
}

/**
 * Sign an Enact tool and add to the signatures map
 * Signs only critical security fields for focused and reliable validation
 */
export async function signTool(
	toolPath: string,
	privateKeyPath: string,
	publicKeyPath: string,
	signerInfo: { id: string; role?: string },
	outputPath?: string,
): Promise<string> {
	// Read files
	const toolYaml = fs.readFileSync(toolPath, "utf8");
	const privateKey = fs.readFileSync(privateKeyPath, "utf8");
	const publicKeyPem = fs.readFileSync(publicKeyPath, "utf8");

	// Parse the YAML
	const tool = parse(toolYaml) as EnactTool;

	// Create a copy for signing (without signatures)
	const toolForSigning: EnactTool = { ...tool };
	delete toolForSigning.signatures;

	// Use EXACT same canonical JSON creation as webapp
	const canonicalJson = createCanonicalToolJson(toolForSigning);

	console.error("=== SIGNING DEBUG (WEBAPP COMPATIBLE) ===");
	console.error("Tool for signing:", JSON.stringify(toolForSigning, null, 2));
	console.error("Canonical JSON (webapp format):", canonicalJson);
	console.error("Canonical JSON length:", canonicalJson.length);
	console.error("==========================================");

	// Normalize the tool for hashing (convert to canonical field names)
	const normalizedToolForSigning = normalizeToolForSigning(toolForSigning);

	// Create tool hash exactly like webapp (SHA-256 hash of canonical JSON)
	const toolHashBytes = await hashTool(normalizedToolForSigning);

	// Sign using Web Crypto API to match webapp exactly
	const { webcrypto } = await import("node:crypto");

	// Import the private key for Web Crypto API
	const privateKeyData = crypto
		.createPrivateKey({
			key: privateKey,
			format: "pem",
			type: "pkcs8",
		})
		.export({ format: "der", type: "pkcs8" });

	const privateKeyObj = await webcrypto.subtle.importKey(
		"pkcs8",
		privateKeyData,
		{ name: "ECDSA", namedCurve: "P-256" },
		false,
		["sign"],
	);

	// Sign the hash bytes using Web Crypto API (produces IEEE P1363 format)
	const signatureArrayBuffer = await webcrypto.subtle.sign(
		{ name: "ECDSA", hash: { name: "SHA-256" } },
		privateKeyObj,
		toolHashBytes,
	);

	const signature = new Uint8Array(signatureArrayBuffer);
	const signatureB64 = Buffer.from(signature).toString("base64");

	console.error("Generated signature (Web Crypto API):", signatureB64);
	console.error(
		"Signature length:",
		signature.length,
		"bytes (should be 64 for P-256)",
	);

	// Convert public key to base64 for map key
	const publicKeyBase64 = pemToBase64(publicKeyPem);

	// Initialize signatures object if it doesn't exist
	if (!tool.signatures) {
		tool.signatures = {};
	}

	// Add signature to the map using public key as key
	tool.signatures[publicKeyBase64] = {
		algorithm: "sha256",
		type: "ecdsa-p256",
		signer: signerInfo.id,
		created: new Date().toISOString(),
		value: signatureB64,
		...(signerInfo.role && { role: signerInfo.role }),
	};

	// Convert back to YAML
	const signedToolYaml = stringify(tool);

	// Write to output file if specified
	if (outputPath) {
		fs.writeFileSync(outputPath, signedToolYaml);
	}

	return signedToolYaml;
}

/**
 * Normalize tool object to contain only critical security fields for signing
 * Maps between different field name formats and extracts only security-critical fields
 */
function normalizeToolForSigning(tool: Record<string, unknown>): Record<string, unknown> {
	const normalized: Record<string, unknown> = {};
	
	// Core required fields
	normalized.enact = tool.enact || tool.protocol_version || "1.0.0";
	normalized.name = tool.name;
	normalized.description = tool.description;
	normalized.command = tool.command;
	
	// Optional critical security fields (only include if present)
	if (tool.from) normalized.from = tool.from;
	if (tool.version) normalized.version = tool.version;
	if (tool.timeout) normalized.timeout = tool.timeout;
	if (tool.annotations) normalized.annotations = tool.annotations;
	
	// Handle environment variables (both formats)
	if (tool.env) {
		normalized.env = tool.env;
	} else if (tool.env_vars) {
		normalized.env = tool.env_vars;
	}
	
	// Handle input schema (both formats)
	if (tool.inputSchema) {
		normalized.inputSchema = tool.inputSchema;
	} else if (tool.input_schema) {
		normalized.inputSchema = tool.input_schema;
	}
	
	return normalized;
}

/**
 * Hash tool data for signing - only includes critical security fields
 * Creates a deterministic hash of only the security-critical fields
 */
async function hashTool(tool: Record<string, unknown>): Promise<Uint8Array> {
	// Create canonical representation with only critical fields
	const canonical = createCanonicalToolDefinition(tool);

	// Remove signature and signatures to avoid circular dependency
	const { signature, signatures, ...toolForSigning } = canonical;

	// Create deterministic JSON with sorted keys for consistent hashing
	const canonicalJson = JSON.stringify(
		toolForSigning,
		Object.keys(toolForSigning).sort(),
	);

	console.error("🔍 Critical-fields-only canonical JSON for hashing:", canonicalJson);
	console.error("🔍 Canonical JSON length:", canonicalJson.length);

	// Hash the canonical JSON
	const encoder = new TextEncoder();
	const data = encoder.encode(canonicalJson);

	// Use Web Crypto API for hashing to match webapp exactly
	const { webcrypto } = await import("node:crypto");
	const hashBuffer = await webcrypto.subtle.digest("SHA-256", data);

	const hashBytes = new Uint8Array(hashBuffer);
	console.error(
		"🔍 SHA-256 hash length:",
		hashBytes.length,
		"bytes (should be 32)",
	);

	return hashBytes;
}

/**
 * Verify tool signature using critical security fields only
 * This verifies signatures against only the security-critical fields
 */
export async function verifyToolSignature(
	toolObject: Record<string, unknown>,
	signatureB64: string,
	publicKeyObj: CryptoKey,
): Promise<boolean> {
	try {
		// Normalize the tool to match signing format (handle EnactTool vs canonical format)
		const normalizedTool = normalizeToolForSigning(toolObject);
		
		// Hash the tool (same process as signing) - critical fields only
		const toolHash = await hashTool(normalizedTool);

		// Convert Base64 signature to bytes 
		const signatureBytes = new Uint8Array(
			atob(signatureB64)
				.split("")
				.map((char) => char.charCodeAt(0)),
		);

		console.error(
			"🔍 Tool hash byte length:",
			toolHash.length,
			"(should be 32 for SHA-256)",
		);
		console.error(
			"🔍 Signature bytes length:",
			signatureBytes.length,
			"(should be 64 for P-256)",
		);

		// Use Web Crypto API for verification
		const { webcrypto } = await import("node:crypto");
		const isValid = await webcrypto.subtle.verify(
			{ name: "ECDSA", hash: { name: "SHA-256" } },
			publicKeyObj,
			signatureBytes,
			toolHash,
		);

		console.error("🎯 Web Crypto API verification result:", isValid);
		return isValid;
	} catch (error) {
		console.error("❌ Verification error:", error);
		return false;
	}
}

/**
 * Verify an Enact tool with embedded signatures against trusted keys
 * Only verifies signatures against critical security fields for focused validation
 */
export async function verifyTool(
	toolYaml: string | EnactTool,
	policy: VerificationPolicy = DEFAULT_POLICY,
): Promise<{
	isValid: boolean;
	message: string;
	validSignatures: number;
	totalSignatures: number;
	verifiedSigners: Array<{ signer: string; role?: string; keyId: string }>;
	errors: string[];
}> {
	const errors: string[] = [];
	const verifiedSigners: Array<{
		signer: string;
		role?: string;
		keyId: string;
	}> = [];

	try {
		// Get trusted public keys
		const trustedKeys = getTrustedPublicKeysMap();
		if (trustedKeys.size === 0) {
			return {
				isValid: false,
				message: "No trusted public keys available",
				validSignatures: 0,
				totalSignatures: 0,
				verifiedSigners: [],
				errors: ["No trusted keys configured"],
			};
		}

		if (process.env.DEBUG) {
			console.error("Trusted keys available:");
			for (const [key, pem] of trustedKeys.entries()) {
				console.error(`  Key: ${key.substring(0, 20)}...`);
			}
		}

		// Parse the tool if it's YAML string
		const tool: EnactTool =
			typeof toolYaml === "string" ? parse(toolYaml) : toolYaml;

		// Check if tool has signatures
		if (!tool.signatures || Object.keys(tool.signatures).length === 0) {
			return {
				isValid: false,
				message: "No signatures found in the tool",
				validSignatures: 0,
				totalSignatures: 0,
				verifiedSigners: [],
				errors: ["No signatures found"],
			};
		}

		const totalSignatures = Object.keys(tool.signatures).length;

		// Create canonical JSON for verification (without signatures)
		const toolForVerification: EnactTool = { ...tool };
		delete toolForVerification.signatures;

		// Normalize the tool to match signing format (handle EnactTool vs canonical format)
		const normalizedToolForVerification = normalizeToolForSigning(toolForVerification);

		// Use EXACT same canonical JSON creation as webapp
		const toolHashBytes = await hashTool(normalizedToolForVerification);

		// Debug output for verification
		if (process.env.NODE_ENV === "development" || process.env.DEBUG) {
			console.error("=== VERIFICATION DEBUG (CRITICAL FIELDS ONLY) ===");
			console.error(
				"Original tool signature field:",
				Object.keys(tool.signatures || {}),
			);
			console.error(
				"Tool before removing signatures:",
				JSON.stringify(tool, null, 2),
			);
			console.error(
				"Tool for verification:",
				JSON.stringify(toolForVerification, null, 2),
			);
			console.error(
				"Tool hash bytes length:",
				toolHashBytes.length,
				"(should be 32 for SHA-256)",
			);
			console.error("==============================================");
		}

		// Verify each signature
		let validSignatures = 0;

		for (const [publicKeyBase64, signatureData] of Object.entries(
			tool.signatures,
		)) {
			try {
				// Check if algorithm is allowed
				if (
					policy.allowedAlgorithms &&
					!policy.allowedAlgorithms.includes(signatureData.algorithm)
				) {
					errors.push(
						`Signature by ${signatureData.signer}: unsupported algorithm ${signatureData.algorithm}`,
					);
					continue;
				}

				// Check if signer is trusted (if policy specifies trusted signers)
				if (
					policy.trustedSigners &&
					!policy.trustedSigners.includes(signatureData.signer)
				) {
					errors.push(
						`Signature by ${signatureData.signer}: signer not in trusted list`,
					);
					continue;
				}

				// Check if we have this public key in our trusted keys
				const publicKeyPem = trustedKeys.get(publicKeyBase64);
				if (!publicKeyPem) {
					// Try to reconstruct PEM from base64 if not found directly
					const reconstructedPem = base64ToPem(publicKeyBase64);
					if (!trustedKeys.has(pemToBase64(reconstructedPem))) {
						errors.push(
							`Signature by ${signatureData.signer}: public key not trusted`,
						);
						continue;
					}
				}

				if (process.env.DEBUG) {
					console.error("Looking for public key:", publicKeyBase64);
					console.error("Key found in trusted keys:", !!publicKeyPem);
				}

				// Verify the signature using Web Crypto API (webapp compatible)
				let isValid = false;
				try {
					const publicKeyToUse = publicKeyPem || base64ToPem(publicKeyBase64);

					if (process.env.DEBUG) {
						console.error("Signature base64:", signatureData.value);
						console.error(
							"Signature buffer length (should be 64):",
							Buffer.from(signatureData.value, "base64").length,
						);
						console.error("Public key base64:", publicKeyBase64);
					}

					if (signatureData.type === "ecdsa-p256") {
						// Use Web Crypto API for critical fields verification
						const { webcrypto } = await import("node:crypto");

						// Import the public key (convert PEM to raw key data like webapp)
						const publicKeyData = crypto
							.createPublicKey({
								key: publicKeyToUse,
								format: "pem",
								type: "spki",
							})
							.export({ format: "der", type: "spki" });

						const publicKeyObj = await webcrypto.subtle.importKey(
							"spki",
							publicKeyData,
							{ name: "ECDSA", namedCurve: "P-256" },
							false,
							["verify"],
						);

						// Use the centralized verification function (critical fields only)
						isValid = await verifyToolSignature(
							normalizedToolForVerification,
							signatureData.value,
							publicKeyObj,
						);

						if (process.env.DEBUG) {
							console.error(
								"Web Crypto API verification result (critical fields):",
								isValid,
							);
						}
					} else {
						// Fallback for other signature types
						const verify = crypto.createVerify("SHA256");
						const canonicalJson = createCanonicalToolJson(normalizedToolForVerification);
						verify.update(canonicalJson, "utf8");
						const signature = Buffer.from(signatureData.value, "base64");
						isValid = verify.verify(publicKeyToUse, signature);
					}
				} catch (verifyError) {
					errors.push(
						`Signature by ${signatureData.signer}: verification error - ${(verifyError as Error).message}`,
					);
					continue;
				}

				if (isValid) {
					validSignatures++;
					verifiedSigners.push({
						signer: signatureData.signer,
						role: signatureData.role,
						keyId: publicKeyBase64.substring(0, 8), // First 8 chars as key ID
					});
				} else {
					errors.push(
						`Signature by ${signatureData.signer}: cryptographic verification failed`,
					);
				}
			} catch (error) {
				errors.push(
					`Signature by ${signatureData.signer}: verification error - ${(error as Error).message}`,
				);
			}
		}

		// Apply policy checks
		const policyErrors: string[] = [];

		// Check minimum signatures
		if (
			policy.minimumSignatures &&
			validSignatures < policy.minimumSignatures
		) {
			policyErrors.push(
				`Policy requires ${policy.minimumSignatures} signatures, but only ${validSignatures} valid`,
			);
		}

		// Check required roles
		if (policy.requireRoles && policy.requireRoles.length > 0) {
			const verifiedRoles = verifiedSigners.map((s) => s.role).filter(Boolean);
			const missingRoles = policy.requireRoles.filter(
				(role) => !verifiedRoles.includes(role),
			);
			if (missingRoles.length > 0) {
				policyErrors.push(`Policy requires roles: ${missingRoles.join(", ")}`);
			}
		}

		const isValid = policyErrors.length === 0 && validSignatures > 0;
		const allErrors = [...errors, ...policyErrors];

		let message: string;
		if (isValid) {
			message = `Tool "${tool.name}" verified with ${validSignatures}/${totalSignatures} valid signatures`;
			if (verifiedSigners.length > 0) {
				const signerInfo = verifiedSigners
					.map((s) => `${s.signer}${s.role ? ` (${s.role})` : ""}`)
					.join(", ");
				message += ` from: ${signerInfo}`;
			}
		} else {
			message = `Tool "${tool.name}" verification failed: ${allErrors[0] || "Unknown error"}`;
		}

		return {
			isValid,
			message,
			validSignatures,
			totalSignatures,
			verifiedSigners,
			errors: allErrors,
		};
	} catch (error) {
		return {
			isValid: false,
			message: `Verification error: ${(error as Error).message}`,
			validSignatures: 0,
			totalSignatures: 0,
			verifiedSigners: [],
			errors: [(error as Error).message],
		};
	}
}

/**
 * Check if a tool should be executed based on verification policy
 * @param tool Tool to check
 * @param policy Verification policy
 * @returns Whether execution should proceed
 */
export async function shouldExecuteTool(
	tool: EnactTool,
	policy: VerificationPolicy = DEFAULT_POLICY,
): Promise<{ allowed: boolean; reason: string }> {
	const verification = await verifyTool(tool, policy);

	if (verification.isValid) {
		return {
			allowed: true,
			reason: `Verified: ${verification.message}`,
		};
	} else {
		return {
			allowed: false,
			reason: `Verification failed: ${verification.message}`,
		};
	}
}

/**
 * Generate a new ECC key pair
 */
export function generateKeyPair(
	outputDir: string,
	prefix = "enact",
): { privateKeyPath: string; publicKeyPath: string } {
	if (!fs.existsSync(outputDir)) {
		fs.mkdirSync(outputDir, { recursive: true });
	}

	const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", {
		namedCurve: "prime256v1",
		publicKeyEncoding: { type: "spki", format: "pem" },
		privateKeyEncoding: { type: "pkcs8", format: "pem" },
	});

	const privateKeyPath = path.join(outputDir, `${prefix}-private.pem`);
	const publicKeyPath = path.join(outputDir, `${prefix}-public.pem`);

	fs.writeFileSync(privateKeyPath, privateKey);
	fs.writeFileSync(publicKeyPath, publicKey);

	return { privateKeyPath, publicKeyPath };
}

/**
 * Add a public key to trusted keys
 */
export function addTrustedKey(keyPath: string, keyName?: string): string {
	if (!fs.existsSync(TRUSTED_KEYS_DIR)) {
		fs.mkdirSync(TRUSTED_KEYS_DIR, { recursive: true });
	}

	const keyContent = fs.readFileSync(keyPath, "utf8");
	const fileName = keyName || `trusted-key-${Date.now()}.pem`;
	const trustedKeyPath = path.join(TRUSTED_KEYS_DIR, fileName);

	fs.writeFileSync(trustedKeyPath, keyContent);
	return trustedKeyPath;
}

/**
 * List all trusted keys with their base64 representations
 */
export function listTrustedKeys(): Array<{
	id: string;
	filename: string;
	base64Key: string;
	fingerprint: string;
}> {
	const keyInfo: Array<{
		id: string;
		filename: string;
		base64Key: string;
		fingerprint: string;
	}> = [];

	if (fs.existsSync(TRUSTED_KEYS_DIR)) {
		try {
			const files = fs.readdirSync(TRUSTED_KEYS_DIR);

			for (const file of files) {
				if (file.endsWith(".pem")) {
					const keyPath = path.join(TRUSTED_KEYS_DIR, file);
					const keyContent = fs.readFileSync(keyPath, "utf8");
					const base64Key = pemToBase64(keyContent);

					const fingerprint = crypto
						.createHash("sha256")
						.update(keyContent)
						.digest("hex")
						.substring(0, 16);

					keyInfo.push({
						id: base64Key.substring(0, 8),
						filename: file,
						base64Key,
						fingerprint,
					});
				}
			}
		} catch (error) {
			console.error(`Error reading trusted keys: ${(error as Error).message}`);
		}
	}

	return keyInfo;
}

// Export verification policies for use in CLI/MCP server
export const VERIFICATION_POLICIES = {
	// Permissive: any valid signature from trusted key
	PERMISSIVE: {
		minimumSignatures: 1,
		allowedAlgorithms: ["sha256"],
	} as VerificationPolicy,

	// Strict: require author + reviewer signatures
	ENTERPRISE: {
		minimumSignatures: 2,
		requireRoles: ["author", "reviewer"],
		allowedAlgorithms: ["sha256"],
	} as VerificationPolicy,

	// Maximum security: require author + reviewer + approver
	PARANOID: {
		minimumSignatures: 3,
		requireRoles: ["author", "reviewer", "approver"],
		allowedAlgorithms: ["sha256"],
	} as VerificationPolicy,
};

// Export types for use in other modules
export type { EnactTool, VerificationPolicy, SignatureData };

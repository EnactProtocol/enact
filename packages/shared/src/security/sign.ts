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

	// Core required fields - only add if not empty
	if (tool.name && !isEmpty(tool.name)) {
		canonical.name = tool.name;
	}
	if (tool.description && !isEmpty(tool.description)) {
		canonical.description = tool.description;
	}
	if (tool.command && !isEmpty(tool.command)) {
		canonical.command = tool.command;
	}
	
	// Protocol version mapping: protocol_version OR enact → enact
	const enactValue = tool.enact || tool.protocol_version;
	if (enactValue && !isEmpty(enactValue)) {
		canonical.enact = enactValue;
	}
	
	// Tool version
	if (tool.version && !isEmpty(tool.version)) {
		canonical.version = tool.version;
	}
	
	// Container/execution environment
	if (tool.from && !isEmpty(tool.from)) {
		canonical.from = tool.from;
	}
	
	// Execution timeout
	if (tool.timeout && !isEmpty(tool.timeout)) {
		canonical.timeout = tool.timeout;
	}
	
	// Input schema mapping: input_schema OR inputSchema → inputSchema
	const inputSchemaValue = tool.input_schema || tool.inputSchema;
	if (inputSchemaValue && !isEmpty(inputSchemaValue)) {
		canonical.inputSchema = inputSchemaValue;
	}
	
	// Environment variables mapping: env_vars OR env → env
	const envValue = tool.env_vars || tool.env;
	if (envValue && !isEmpty(envValue)) {
		canonical.env = envValue;
	}
	
	// Execution metadata/annotations
	if (tool.annotations && !isEmpty(tool.annotations)) {
		canonical.annotations = tool.annotations;
	}

	return canonical;
}

/**
 * Check if a value is empty (null, undefined, empty object, empty array, empty string)
 */
function isEmpty(value: unknown): boolean {
	if (value === null || value === undefined || value === '') {
		return true;
	}
	if (typeof value === 'object' && value !== null) {
		if (Array.isArray(value)) {
			return value.length === 0;
		}
		return Object.keys(value).length === 0;
	}
	return false;
}

/**
 * Recursively sort all object keys alphabetically for deterministic JSON
 */
function deepSortKeys(obj: any): any {
	if (obj === null || typeof obj !== 'object') {
		return obj;
	}
	
	if (Array.isArray(obj)) {
		return obj.map(deepSortKeys);
	}
	
	const sortedObj: Record<string, unknown> = {};
	const keys = Object.keys(obj).sort();
	for (const key of keys) {
		sortedObj[key] = deepSortKeys(obj[key]);
	}
	return sortedObj;
}

/**
 * Create canonical tool JSON exactly matching frontend implementation
 * Uses two-phase approach: canonical creation + extra cleaning + individual value sorting
 */
function createCanonicalToolJson(toolData: any): string {
	// Step 1: Create canonical representation with field filtering (same as createCanonicalToolDefinition)
	const canonical = createCanonicalToolDefinition(toolData);
	
	// Step 2: Extra cleaning step - remove any remaining empty objects
	const cleanedCanonical: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(canonical)) {
		if (!isEmpty(value)) {
			cleanedCanonical[key] = deepSortKeys(value); // Sort individual values
		}
	}
	
	// Step 3: Create deterministic JSON
	return JSON.stringify(cleanedCanonical);
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
	// Array-based signature format
	signatures?: Array<SignatureData>;
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
	// Use same Base64 encoding as frontend spec: btoa(String.fromCharCode(...))
	const signatureB64 = btoa(String.fromCharCode(...signature));

	console.error("Generated signature (Web Crypto API):", signatureB64);
	console.error(
		"Signature length:",
		signature.length,
		"bytes (should be 64 for P-256)",
	);

	// Initialize signatures array if it doesn't exist
	if (!tool.signatures) {
		tool.signatures = [];
	}

	// Add signature to the array
	tool.signatures.push({
		signer: signerInfo.id,
		algorithm: "sha256",
		type: "ecdsa-p256",
		value: signatureB64,
		created: new Date().toISOString(),
		...(signerInfo.role && { role: signerInfo.role }),
	});

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

	// Deep sort all keys recursively for deterministic JSON (same as createCanonicalToolJson)
	const deeplySorted = deepSortKeys(toolForSigning);
	const canonicalJson = JSON.stringify(deeplySorted);

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
	console.error("🔍 TRACE: verifyTool() called in sign.ts");
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
		if (!tool.signatures || tool.signatures.length === 0) {
			return {
				isValid: false,
				message: "No signatures found in the tool",
				validSignatures: 0,
				totalSignatures: 0,
				verifiedSigners: [],
				errors: ["No signatures found"],
			};
		}

		const totalSignatures = tool.signatures.length;

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
				"Original tool signature count:",
				tool.signatures?.length || 0,
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

		console.error("🔍 TRACE: Processing signatures:", tool.signatures.length);
		for (const signatureData of tool.signatures) {
			console.error(`🔍 TRACE: Processing signature from ${signatureData.signer}, type: ${signatureData.type}, algorithm: ${signatureData.algorithm}`);
			try {
				// Check if algorithm is allowed
				console.error(`🔍 TRACE: Checking algorithm ${signatureData.algorithm} against allowed:`, policy.allowedAlgorithms);
				const hasAllowedAlgorithms = !!policy.allowedAlgorithms;
				const algorithmAllowed = policy.allowedAlgorithms?.includes(signatureData.algorithm);
				console.error(`🔍 TRACE: hasAllowedAlgorithms: ${hasAllowedAlgorithms}, algorithmAllowed: ${algorithmAllowed}`);
				if (
					policy.allowedAlgorithms &&
					!policy.allowedAlgorithms.includes(signatureData.algorithm)
				) {
					console.error(`🔍 TRACE: Algorithm ${signatureData.algorithm} not allowed!`);
					errors.push(
						`Signature by ${signatureData.signer}: unsupported algorithm ${signatureData.algorithm}`,
					);
					continue;
				}
				console.error(`🔍 TRACE: Algorithm ${signatureData.algorithm} is allowed, continuing...`);

				// Handle enhanced secp256k1 signatures with @enactprotocol/security FIRST
				if (signatureData.type === "ecdsa-secp256k1" && signatureData.algorithm === "secp256k1") {
					console.error("🔍 TRACE: Using @enactprotocol/security for secp256k1 verification");
					// Use @enactprotocol/security for enhanced secp256k1 verification
					try {
						const { SigningService } = await import("@enactprotocol/security");
						
						// Create signature object for verification (secp256k1 may not need publicKey)
						const signature = {
							signature: signatureData.value,
							algorithm: signatureData.algorithm,
							timestamp: new Date(signatureData.created).getTime(),
							publicKey: signatureData.signer, // Use signer as publicKey for secp256k1
						};
						
						// Verify using @enactprotocol/security with Enact defaults
						// Use the original tool without legacy normalization to match signing
						console.error("🔍 TRACE: Tool keys for verification:", Object.keys(tool).join(", "));
						const isValid = SigningService.verifyDocument(tool, signature, {
							useEnactDefaults: true,
						});
						
						console.error("🔍 TRACE: @enactprotocol/security verification result:", isValid);
						
						// For secp256k1 signatures, we trust @enactprotocol/security verification
						// and don't require legacy trusted keys check
						if (isValid) {
							console.error("🔍 TRACE: secp256k1 signature verified successfully!");
							verifiedSigners.push({
								signer: signatureData.signer,
								role: signatureData.role,
								keyId: signatureData.signer.substring(0, 8), // Use signer ID as key ID
							});
							validSignatures++;
							continue; // Skip the legacy trusted keys check
						} else {
							console.error("🔍 TRACE: secp256k1 signature verification failed");
							errors.push(
								`Signature by ${signatureData.signer}: @enactprotocol/security verification failed`,
							);
							continue;
						}
					} catch (securityError) {
						console.error("🔍 TRACE: @enactprotocol/security error:", (securityError as Error).message);
						errors.push(
							`Signature by ${signatureData.signer}: @enactprotocol/security verification error - ${(securityError as Error).message}`,
						);
						continue;
					}
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

				// For ecdsa-p256 signatures, we need to find the public key from trusted keys
				// Since we don't have the public key embedded in array format, 
				// we'll need to match by signer ID or try all trusted keys
				let publicKeyPem: string | undefined;
				let publicKeyBase64: string | undefined;
				
				// Try to find trusted key by checking all keys
				// This is a temporary approach - in production you'd want a signer->key mapping
				for (const [keyBase64, keyPem] of trustedKeys.entries()) {
					// For now, we'll try each trusted key to see if verification works
					// In practice, you'd have a mapping from signer ID to public key
					publicKeyBase64 = keyBase64;
					publicKeyPem = keyPem;
					break; // For now, just use the first trusted key
				}
				
				if (!publicKeyPem) {
					errors.push(
						`Signature by ${signatureData.signer}: no trusted public key found`,
					);
					continue;
				}

				if (process.env.DEBUG) {
					console.error("Looking for public key:", publicKeyBase64);
					console.error("Key found in trusted keys:", !!publicKeyPem);
				}

				// Verify the signature using Web Crypto API (webapp compatible)
				let isValid = false;
				try {
					const publicKeyToUse = publicKeyPem || base64ToPem(publicKeyBase64!);

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
						keyId: publicKeyBase64?.substring(0, 8) || signatureData.signer.substring(0, 8), // First 8 chars as key ID
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
		allowedAlgorithms: ["sha256", "secp256k1"], // Support both legacy and enhanced algorithms
	} as VerificationPolicy,

	// Strict: require author + reviewer signatures
	ENTERPRISE: {
		minimumSignatures: 2,
		requireRoles: ["author", "reviewer"],
		allowedAlgorithms: ["sha256", "secp256k1"], // Support both legacy and enhanced algorithms
	} as VerificationPolicy,

	// Maximum security: require author + reviewer + approver
	PARANOID: {
		minimumSignatures: 3,
		requireRoles: ["author", "reviewer", "approver"],
		allowedAlgorithms: ["sha256", "secp256k1"], // Support both legacy and enhanced algorithms
	} as VerificationPolicy,
};

// Export types for use in other modules
export type { EnactTool, VerificationPolicy, SignatureData };

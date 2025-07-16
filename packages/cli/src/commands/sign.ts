// src/commands/sign.ts - Handle signing and verification operations with @enactprotocol/security
import * as p from "@clack/prompts";
import pc from "picocolors";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import {
	SigningService,
	CryptoUtils,
	type EnactDocument,
} from "@enactprotocol/security";
import {
	getTrustedPublicKeysMap,
	signTool,
} from "../../../shared/src/security/sign.js";

// Type for signature data
interface SignatureData {
	algorithm: string;
	type: string;
	signer: string;
	created: string;
	value: string;
	role?: string;
}

export interface SignOptions {
	help?: boolean;
	policy?: string;
	privateKey?: string;
	role?: string;
	signer?: string;
	verbose?: boolean;
}

// Persistent key storage functions for ~/.enact/trusted-keys
const getTrustedKeysDir = (): string => {
	const homeDir = os.homedir();
	const enactDir = path.join(homeDir, ".enact");
	const keysDir = path.join(enactDir, "trusted-keys");
	
	// Ensure directories exist
	if (!fs.existsSync(enactDir)) {
		fs.mkdirSync(enactDir, { recursive: true });
	}
	if (!fs.existsSync(keysDir)) {
		fs.mkdirSync(keysDir, { recursive: true });
	}
	
	return keysDir;
};

const generateAndStoreKeyPair = (keyName: string): { privateKey: string; publicKey: string } => {
	// Generate key pair using CryptoUtils
	const keyPair = CryptoUtils.generateKeyPair();
	const { privateKey, publicKey } = keyPair;
	
	// Store to ~/.enact/trusted-keys
	const keysDir = getTrustedKeysDir();
	const privateKeyPath = path.join(keysDir, `${keyName}-private.pem`);
	const publicKeyPath = path.join(keysDir, `${keyName}-public.pem`);
	
	// Convert to PEM format
	const privateKeyPem = `-----BEGIN PRIVATE KEY-----\n${Buffer.from(privateKey, 'hex').toString('base64')}\n-----END PRIVATE KEY-----\n`;
	const publicKeyPem = `-----BEGIN PUBLIC KEY-----\n${Buffer.from(publicKey, 'hex').toString('base64')}\n-----END PUBLIC KEY-----\n`;
	
	// Write to disk
	fs.writeFileSync(privateKeyPath, privateKeyPem);
	fs.writeFileSync(publicKeyPath, publicKeyPem);
	
	return { privateKey, publicKey };
};

const listStoredKeys = (): string[] => {
	const keysDir = getTrustedKeysDir();
	if (!fs.existsSync(keysDir)) {
		return [];
	}
	
	const files = fs.readdirSync(keysDir);
	const keyNames = new Set<string>();
	
	// Extract key names from private/public key files
	for (const file of files) {
		if (file.endsWith('-private.pem')) {
			keyNames.add(file.replace('-private.pem', ''));
		} else if (file.endsWith('-public.pem')) {
			keyNames.add(file.replace('-public.pem', ''));
		} else if (file.endsWith('.pem') && !file.includes('-')) {
			// Legacy format - assume public key
			keyNames.add(file.replace('.pem', ''));
		}
	}
	
	return Array.from(keyNames).sort();
};

const loadStoredKey = (keyName: string): { privateKey: string; publicKey: string } | null => {
	const keysDir = getTrustedKeysDir();
	const privateKeyPath = path.join(keysDir, `${keyName}-private.pem`);
	const publicKeyPath = path.join(keysDir, `${keyName}-public.pem`);
	
	// Check if both files exist
	if (!fs.existsSync(privateKeyPath) || !fs.existsSync(publicKeyPath)) {
		return null;
	}
	
	try {
		const privateKeyPem = fs.readFileSync(privateKeyPath, 'utf8');
		const publicKeyPem = fs.readFileSync(publicKeyPath, 'utf8');
		
		// Extract hex from PEM format
		const privateKeyHex = Buffer.from(
			privateKeyPem.replace(/-----BEGIN PRIVATE KEY-----\n?/, '')
						 .replace(/\n?-----END PRIVATE KEY-----\n?/, '')
						 .replace(/\n/g, ''),
			'base64'
		).toString('hex');
		
		const publicKeyHex = Buffer.from(
			publicKeyPem.replace(/-----BEGIN PUBLIC KEY-----\n?/, '')
					   .replace(/\n?-----END PUBLIC KEY-----\n?/, '')
					   .replace(/\n/g, ''),
			'base64'
		).toString('hex');
		
		return { privateKey: privateKeyHex, publicKey: publicKeyHex };
	} catch (error) {
		console.error(`Error loading key ${keyName}:`, error);
		return null;
	}
};

const removeStoredKey = (keyName: string): void => {
	const keysDir = getTrustedKeysDir();
	const privateKeyPath = path.join(keysDir, `${keyName}-private.pem`);
	const publicKeyPath = path.join(keysDir, `${keyName}-public.pem`);
	
	if (fs.existsSync(privateKeyPath)) {
		fs.unlinkSync(privateKeyPath);
	}
	if (fs.existsSync(publicKeyPath)) {
		fs.unlinkSync(publicKeyPath);
	}
};

/**
 * Handle the sign command using @enactprotocol/security verification enforcer
 */
export async function handleSignCommand(
	args: string[],
	options: SignOptions,
): Promise<void> {
	if (options.help) {
		console.error(`
Usage: enact sign <subcommand> [options]

Enhanced tool signing and verification using @enactprotocol/security

Subcommands:
  sign <tool-path>               Sign a tool with security verification enforcer
  verify <tool-path>             Verify tool signatures
  keygen [name]                  Generate new cryptographic key pair
  list-keys                      List stored keys

Options:
  --help, -h          Show this help message
  --private-key <path> Path to private key for signing
  --role <role>       Role for signature: author, reviewer, approver
  --signer <name>     Signer identifier (defaults to system username)
  --verbose, -v       Show detailed information

Features:
  - Field-specific signing with Enact Protocol defaults
  - Cross-platform compatibility (backend/frontend)
  - Enhanced cryptographic security with secp256k1
  - Deterministic signing for consistent results

Examples:
  enact sign sign my-tool.yaml
  enact sign verify my-tool.yaml
  enact sign keygen my-signing-key
  enact sign list-keys
`);
		return;
	}

	const subcommand = args[0];

	if (!subcommand) {
		p.intro(pc.bgBlue(pc.white(" Enhanced Enact Tool Signing ")));

		const action = await p.select({
			message: "What would you like to do?",
			options: [
				{ value: "sign", label: "✍️ Sign a tool (enhanced security)" },
				{ value: "verify", label: "🔍 Verify tool signatures" },
				{ value: "keygen", label: "🔑 Generate new key pair" },
				{ value: "list-keys", label: "📋 List stored keys" },
				{ value: "help", label: "❓ Show help" },
			],
		});

		if (action === null) {
			p.outro(pc.yellow("Operation cancelled"));
			return;
		}

		if (action === "help") {
			await handleSignCommand(["help"], { help: true });
			return;
		}

		if (action === "sign") {
			await handleEnhancedSignCommand([], options);
			return;
		}

		if (action === "verify") {
			await handleEnhancedVerifyCommand([], options);
			return;
		}

		if (action === "keygen") {
			await handleKeygenCommand([], options);
			return;
		}

		if (action === "list-keys") {
			await handleListStoredKeysCommand([], options);
			return;
		}

		return;
	}

	// Route to appropriate subcommand
	switch (subcommand.toLowerCase()) {
		case "sign":
			await handleEnhancedSignCommand(args.slice(1), options);
			break;

		case "verify":
			await handleEnhancedVerifyCommand(args.slice(1), options);
			break;

		case "keygen":
			await handleKeygenCommand(args.slice(1), options);
			break;

		case "list-keys":
			await handleListStoredKeysCommand(args.slice(1), options);
			break;

		default:
			console.error(pc.red(`Unknown subcommand: ${subcommand}`));
			console.error(
				pc.yellow('Use "enact sign --help" for available commands'),
			);
			process.exit(1);
	}
}

/**
 * Handle enhanced signing using @enactprotocol/security
 */
async function handleEnhancedSignCommand(
	args: string[],
	options: SignOptions,
): Promise<void> {
	let toolPath = args[0];
	let keyName: string;

	if (!toolPath) {
		p.intro(pc.bgMagenta(pc.white(" Enhanced Tool Signing ")));

		toolPath = (await p.text({
			message: "Enter path to tool YAML file:",
			placeholder: "./my-tool.yaml",
			validate: (value) => {
				if (!value.trim()) return "Please enter a file path";
				if (!fs.existsSync(value.trim())) return "File does not exist";
				return undefined;
			},
		})) as string;

		if (!toolPath) {
			p.outro(pc.yellow("Signing cancelled"));
			return;
		}
	}

	try {
		// List available keys
		const keyIds = listStoredKeys();
		
		if (keyIds.length === 0) {
			console.error(pc.yellow("\n⚠️ No keys found. Generate a key first:"));
			console.error(pc.cyan("  enact sign keygen my-signing-key"));
			return;
		}

		// Select key for signing
		if (keyIds.length === 1) {
			keyName = keyIds[0];
			console.error(pc.cyan(`Using key: ${keyName}`));
		} else {
			// Auto-select the most recent key (last in list) to avoid interactive prompts
			keyName = keyIds[keyIds.length - 1];
			console.error(pc.cyan(`Auto-selecting most recent key: ${keyName}`));
		}

		if (!keyName) {
			p.outro(pc.yellow("Signing cancelled"));
			return;
		}

		// Load and parse the tool
		const spinner = p.spinner();
		spinner.start("Loading tool definition...");

		const toolYaml = fs.readFileSync(toolPath, "utf8");
		const tool: EnactDocument = parseYaml(toolYaml);

		spinner.message("Signing with enhanced security...");

		// Get the private key
		const storedKeyPair = loadStoredKey(keyName);
		if (!storedKeyPair) {
			spinner.stop("Key not found");
			console.error(pc.red(`❌ Key not found: ${keyName}`));
			return;
		}

		// Sign using @enactprotocol/security with Enact defaults
		const signature = SigningService.signDocument(tool, storedKeyPair.privateKey, {
			useEnactDefaults: true, // Use Enact Protocol security-critical fields
		});

		spinner.stop("Signing completed");

		// Add signature to tool (using the new format)
		const signedTool = {
			...tool,
			signatures: {
				...tool.signatures,
				[signature.publicKey]: {
					algorithm: signature.algorithm,
					type: "ecdsa-secp256k1",
					signer: options.signer || os.userInfo().username,
					created: new Date(signature.timestamp).toISOString(),
					value: signature.signature,
					...(options.role && { role: options.role }),
				},
			},
		};

		// Write back to file
		const signedYaml = stringifyYaml(signedTool);
		fs.writeFileSync(toolPath, signedYaml);

		console.error(pc.green("\n✅ Tool signed successfully with enhanced security!"));
		console.error(pc.cyan("\n📋 Signature Details:"));
		console.error(`Tool: ${toolPath}`);
		console.error(`Key: ${keyName}`);
		console.error(`Algorithm: ${signature.algorithm}`);
		console.error(`Public Key: ${signature.publicKey.substring(0, 16)}...`);
		console.error(`Signer: ${options.signer || os.userInfo().username}`);
		if (options.role) console.error(`Role: ${options.role}`);

		if (options.verbose) {
			console.error(pc.cyan("\n🔐 Enhanced Security Features:"));
			console.error("  ✓ Field-specific signing (Enact Protocol defaults)");
			console.error("  ✓ Cross-platform compatibility");
			console.error("  ✓ Deterministic signing");
			console.error("  ✓ secp256k1 ECDSA cryptography");
			
			const signedFields = SigningService.getSignedFields({ useEnactDefaults: true });
			console.error(`\n📋 Signed fields: ${signedFields.join(", ")}`);
		}

		p.outro(pc.green("Enhanced signature added to tool"));
	} catch (error) {
		console.error(
			pc.red(`\n❌ Error signing tool: ${(error as Error).message}`),
		);
		process.exit(1);
	}
}

/**
 * Handle the list-keys subcommand
 */
async function handleListKeysCommand(
	_args: string[],
	options: SignOptions,
): Promise<void> {
	p.intro(pc.bgCyan(pc.white(" Trusted Public Keys ")));

	try {
		const trustedKeys = getTrustedPublicKeysMap();

		if (trustedKeys.size === 0) {
			console.error(pc.yellow("\n📭 No trusted keys found"));
			console.error(pc.dim("Add trusted keys to: ~/.enact/trusted-keys/"));
			return;
		}

		console.error(pc.cyan(`\n🔑 Found ${trustedKeys.size} trusted key(s):\n`));

		let keyIndex = 1;
		for (const [base64Key, pemContent] of trustedKeys.entries()) {
			const keyId = base64Key.substring(0, 16); // First 16 chars as key ID
			const shortKey = `${base64Key.substring(0, 32)}...`;

			console.error(`${keyIndex}. Key ID: ${pc.green(keyId)}`);
			console.error(`   Preview: ${pc.dim(shortKey)}`);

			if (options.verbose) {
				console.error(`   Full PEM:\n${pc.dim(pemContent)}`);
			}

			console.error(""); // Empty line for spacing
			keyIndex++;
		}

		if (!options.verbose) {
			console.error(pc.dim("Use --verbose to see full PEM content"));
		}

		// Show trusted keys directory
		const trustedKeysDir = path.join(
			process.env.HOME || ".",
			".enact",
			"trusted-keys",
		);
		console.error(pc.cyan(`📁 Trusted keys directory: ${trustedKeysDir}`));

		p.outro(pc.green(`Listed ${trustedKeys.size} trusted keys`));
	} catch (error) {
		console.error(
			pc.red(`\n❌ Error listing keys: ${(error as Error).message}`),
		);
		process.exit(1);
	}
}

/**
 * Handle the sign subcommand
 */
async function handleSignToolCommand(
	args: string[],
	options: SignOptions,
): Promise<void> {
	let toolPath = args[0];
	let privateKeyPath = options.privateKey;
	let role = options.role;
	let signerName = options.signer;

	if (!toolPath) {
		p.intro(pc.bgMagenta(pc.white(" Sign Tool ")));

		toolPath = (await p.text({
			message: "Enter path to tool YAML file:",
			placeholder: "./my-tool.yaml",
			validate: (value) => {
				if (!value.trim()) return "Please enter a file path";
				if (!fs.existsSync(value.trim())) return "File does not exist";
				return undefined;
			},
		})) as string;

		if (!toolPath) {
			p.outro(pc.yellow("Signing cancelled"));
			return;
		}
	}

	if (!privateKeyPath) {
		privateKeyPath = (await p.text({
			message: "Enter path to private key PEM file:",
			placeholder: "~/.enact/private.pem",
			validate: (value) => {
				if (!value.trim()) return "Please enter a private key path";
				const expandedPath = value.replace(/^~/, process.env.HOME || "");
				if (!fs.existsSync(expandedPath))
					return "Private key file does not exist";
				return undefined;
			},
		})) as string;

		if (!privateKeyPath) {
			p.outro(pc.yellow("Signing cancelled"));
			return;
		}
	}

	// Get corresponding public key path
	const expandedPrivateKeyPath = privateKeyPath.replace(
		/^~/,
		process.env.HOME || "",
	);
	const publicKeyPath = expandedPrivateKeyPath
		.replace(/private\.pem$/, "public.pem")
		.replace(/-private\.pem$/, "-public.pem");

	if (!fs.existsSync(publicKeyPath)) {
		console.error(pc.red(`\n❌ Public key not found at: ${publicKeyPath}`));
		console.error(pc.yellow("Expected public key file alongside private key"));
		return;
	}

	if (!role) {
		role = (await p.select({
			message: "Select your role for this signature:",
			options: [
				{ value: "author", label: "Author - Original creator of the tool" },
				{ value: "reviewer", label: "Reviewer - Code reviewer/auditor" },
				{
					value: "approver",
					label: "Approver - Final approver for production use",
				},
			],
		})) as string;
	}

	if (!signerName) {
		const defaultSigner = os.userInfo().username;
		signerName = (await p.text({
			message: "Enter your signer identifier:",
			placeholder: defaultSigner,
			initialValue: defaultSigner,
		})) as string;

		if (!signerName) {
			signerName = defaultSigner;
		}
	}

	try {
		const spinner = p.spinner();
		spinner.start("Signing tool...");

		// Call signTool with correct parameters and write back to file
		const signedYaml = await signTool(
			toolPath,
			expandedPrivateKeyPath,
			publicKeyPath,
			{ id: signerName, role: role },
			toolPath, // Write back to the original file
		);

		spinner.stop("Tool signed successfully");

		console.error(pc.green("\n✅ Tool signed successfully!"));
		console.error(pc.cyan("\n📋 Signature Details:"));
		console.error(`Tool: ${toolPath}`);
		console.error(`Signer: ${signerName}`);
		console.error(`Role: ${role}`);
		console.error(`Private key: ${expandedPrivateKeyPath}`);
		console.error(`Public key: ${publicKeyPath}`);

		if (options.verbose) {
			console.error(pc.cyan("\n📄 Signed YAML preview:"));
			const lines = signedYaml.split("\n");
			const previewLines = lines.slice(0, 10).join("\n");
			console.error(pc.dim(previewLines + (lines.length > 10 ? "\n..." : "")));
		}

		p.outro(pc.green("Tool signature added to YAML file"));
	} catch (error) {
		console.error(
			pc.red(`\n❌ Error signing tool: ${(error as Error).message}`),
		);
		process.exit(1);
	}
}

/**
 * Handle enhanced verification using @enactprotocol/security
 */
async function handleEnhancedVerifyCommand(
	args: string[],
	options: SignOptions,
): Promise<void> {
	let toolPath = args[0];

	if (!toolPath) {
		p.intro(pc.bgGreen(pc.white(" Enhanced Tool Verification ")));

		toolPath = (await p.text({
			message: "Enter path to tool YAML file:",
			placeholder: "./my-tool.yaml",
			validate: (value) => {
				if (!value.trim()) return "Please enter a file path";
				if (!fs.existsSync(value.trim())) return "File does not exist";
				return undefined;
			},
		})) as string;

		if (!toolPath) {
			p.outro(pc.yellow("Verification cancelled"));
			return;
		}
	}

	try {
		const spinner = p.spinner();
		spinner.start("Loading tool definition...");

		const toolYaml = fs.readFileSync(toolPath, "utf8");
		const tool: EnactDocument = parseYaml(toolYaml);

		if (!tool.signatures || Object.keys(tool.signatures).length === 0) {
			spinner.stop("No signatures found");
			console.error(pc.yellow("\n⚠️ No signatures found in tool"));
			p.outro(pc.red("Verification failed - tool is not signed"));
			return;
		}

		spinner.message("Verifying signatures with enhanced security...");

		let validSignatures = 0;
		const totalSignatures = Object.keys(tool.signatures).length;
		const verificationResults = [];

		// Verify each signature using @enactprotocol/security
		for (const [publicKey, signatureData] of Object.entries(tool.signatures)) {
			try {
				const sigData = signatureData as SignatureData;
				const signature = {
					signature: sigData.value,
					publicKey: publicKey,
					algorithm: sigData.algorithm,
					timestamp: new Date(sigData.created).getTime(),
				};

				const isValid = SigningService.verifyDocument(tool, signature, {
					useEnactDefaults: true, // Use same field selection as signing
				});

				if (isValid) {
					validSignatures++;
				}

				verificationResults.push({
					publicKey: publicKey.substring(0, 16),
					signer: sigData.signer,
					role: sigData.role,
					created: sigData.created,
					valid: isValid,
				});
			} catch (error) {
				const sigData = signatureData as SignatureData;
				verificationResults.push({
					publicKey: publicKey.substring(0, 16),
					signer: sigData.signer,
					role: sigData.role,
					created: sigData.created,
					valid: false,
					error: (error as Error).message,
				});
			}
		}

		spinner.stop("Verification completed");

		// Display results
		const allValid = validSignatures === totalSignatures && validSignatures > 0;
		
		if (allValid) {
			console.error(pc.green(`\n✅ ENHANCED VERIFICATION PASSED`));
		} else {
			console.error(pc.red(`\n❌ ENHANCED VERIFICATION FAILED`));
		}

		console.error(pc.cyan(`\n📊 Signature Summary:`));
		console.error(`Valid signatures: ${validSignatures}/${totalSignatures}`);

		console.error(pc.cyan("\n📋 Signature Details:"));
		verificationResults.forEach((result, index) => {
			const status = result.valid ? pc.green("✓") : pc.red("✗");
			console.error(`${index + 1}. ${status} ${result.signer}${result.role ? ` (${result.role})` : ""}`);
			console.error(`   Key: ${result.publicKey}... | Created: ${result.created}`);
			if (result.error) {
				console.error(pc.red(`   Error: ${result.error}`));
			}
		});

		if (options.verbose) {
			console.error(pc.cyan("\n🔐 Enhanced Security Features:"));
			console.error("  ✓ Field-specific verification (Enact Protocol defaults)");
			console.error("  ✓ Cross-platform compatibility");
			console.error("  ✓ secp256k1 ECDSA cryptography");
			
			const verifiedFields = SigningService.getSignedFields({ useEnactDefaults: true });
			console.error(`\n📋 Verified fields: ${verifiedFields.join(", ")}`);
		}

		if (allValid) {
			p.outro(pc.green("Enhanced verification passed"));
		} else {
			p.outro(pc.red("Enhanced verification failed"));
			process.exit(1);
		}
	} catch (error) {
		console.error(
			pc.red(`\n❌ Error verifying tool: ${(error as Error).message}`),
		);
		process.exit(1);
	}
}

/**
 * Handle key generation using @enactprotocol/security
 */
async function handleKeygenCommand(
	args: string[],
	options: SignOptions,
): Promise<void> {
	let keyName = args[0];

	if (!keyName) {
		p.intro(pc.bgYellow(pc.black(" Generate Cryptographic Keys ")));

		keyName = (await p.text({
			message: "Enter name for the new key:",
			placeholder: "my-signing-key",
			validate: (value) => {
				if (!value.trim()) return "Please enter a key name";
				if (listStoredKeys().includes(value.trim())) {
					return "Key with this name already exists";
				}
				return undefined;
			},
		})) as string;

		if (!keyName) {
			p.outro(pc.yellow("Key generation cancelled"));
			return;
		}
	}

	try {
		const spinner = p.spinner();
		spinner.start("Generating cryptographic key pair...");

		// Generate key pair using @enactprotocol/security with persistent storage
		const keyPair = generateAndStoreKeyPair(keyName);

		spinner.stop("Key pair generated successfully");

		console.error(pc.green("\n✅ Cryptographic key pair generated!"));
		console.error(pc.cyan("\n📋 Key Details:"));
		console.error(`Name: ${keyName}`);
		console.error(`Algorithm: secp256k1`);
		console.error(`Public Key: ${keyPair.publicKey.substring(0, 32)}...`);

		if (options.verbose) {
			console.error(pc.cyan("\n🔐 Security Features:"));
			console.error("  ✓ secp256k1 ECDSA algorithm");
			console.error("  ✓ Cryptographically secure random generation");
			console.error("  ✓ Cross-platform compatibility");
			console.error("  ✓ Secure key storage");
		}

		console.error(pc.cyan("\n💡 Usage:"));
		console.error(`  enact sign sign <tool.yaml> # Will use key: ${keyName}`);
		console.error(`  enact sign verify <tool.yaml> # Verify signatures`);

		p.outro(pc.green("Key pair ready for signing"));
	} catch (error) {
		console.error(
			pc.red(`\n❌ Error generating keys: ${(error as Error).message}`),
		);
		process.exit(1);
	}
}

/**
 * Handle listing stored keys using @enactprotocol/security
 */
async function handleListStoredKeysCommand(
	_args: string[],
	options: SignOptions,
): Promise<void> {
	p.intro(pc.bgCyan(pc.white(" Stored Cryptographic Keys ")));

	try {
		const keyIds = listStoredKeys();

		if (keyIds.length === 0) {
			console.error(pc.yellow("\n📭 No keys found"));
			console.error(pc.dim("Generate a key: enact sign keygen <name>"));
			return;
		}

		console.error(pc.cyan(`\n🔑 Found ${keyIds.length} stored key(s):\n`));

		keyIds.forEach((keyId, index) => {
			try {
				const storedKeyPair = loadStoredKey(keyId);
				if (storedKeyPair) {
					console.error(`${index + 1}. ${pc.green(keyId)}`);
					console.error(`   Public Key: ${storedKeyPair.publicKey.substring(0, 32)}...`);
					
					if (options.verbose) {
						console.error(`   Full Public Key: ${storedKeyPair.publicKey}`);
					}
				}
			} catch (error) {
				console.error(`${index + 1}. ${pc.red(keyId)} (error: ${(error as Error).message})`);
			}
			console.error(""); // Empty line for spacing
		});

		if (!options.verbose) {
			console.error(pc.dim("Use --verbose to see full public keys"));
		}

		console.error(pc.cyan("💡 Usage:"));
		console.error("  Keys are automatically selected when signing");
		console.error("  Use 'enact sign sign <tool.yaml>' to sign with these keys");

		p.outro(pc.green(`Listed ${keyIds.length} stored keys`));
	} catch (error) {
		console.error(
			pc.red(`\n❌ Error listing keys: ${(error as Error).message}`),
		);
		process.exit(1);
	}
}

// src/commands/sign.ts - Handle signing and verification operations
import * as p from "@clack/prompts";
import pc from "picocolors";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
	verifyTool,
	VERIFICATION_POLICIES,
	getTrustedPublicKeysMap,
	signTool,
} from "@enactprotocol/shared/security";

export interface SignOptions {
	help?: boolean;
	policy?: string;
	privateKey?: string;
	role?: string;
	signer?: string;
	verbose?: boolean;
}

/**
 * Handle the sign command for tool signing and verification
 */
export async function handleSignCommand(
	args: string[],
	options: SignOptions,
): Promise<void> {
	if (options.help) {
		console.error(`
Usage: enact sign <subcommand> [options]

Manage tool signatures and verification.

Subcommands:
  verify <tool-path> [policy]    Verify tool signatures
  list-keys                      List trusted public keys
  sign <tool-path>               Sign a tool (requires private key)

Options:
  --help, -h          Show this help message
  --policy <policy>   Verification policy: permissive, enterprise, paranoid
  --private-key <path> Path to private key for signing
  --role <role>       Role for signature: author, reviewer, approver
  --signer <name>     Signer identifier (defaults to system username)
  --verbose, -v       Show detailed information

Verification Policies:
  permissive          Require 1+ valid signatures from trusted keys (default)
  enterprise          Require author + reviewer signatures  
  paranoid            Require author + reviewer + approver signatures

Examples:
  enact sign verify my-tool.yaml
  enact sign verify my-tool.yaml enterprise
  enact sign list-keys
  enact sign sign my-tool.yaml --private-key ~/.enact/private.pem --role author
`);
		return;
	}

	const subcommand = args[0];

	if (!subcommand) {
		p.intro(pc.bgBlue(pc.white(" Enact Tool Signing ")));

		const action = await p.select({
			message: "What would you like to do?",
			options: [
				{ value: "verify", label: "🔍 Verify tool signatures" },
				{ value: "list-keys", label: "🔑 List trusted keys" },
				{ value: "sign", label: "✍️ Sign a tool" },
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

		if (action === "verify") {
			await handleVerifyCommand([], options);
			return;
		}

		if (action === "list-keys") {
			await handleListKeysCommand([], options);
			return;
		}

		if (action === "sign") {
			await handleSignToolCommand([], options);
			return;
		}

		return;
	}

	// Route to appropriate subcommand
	switch (subcommand.toLowerCase()) {
		case "verify":
			await handleVerifyCommand(args.slice(1), options);
			break;

		case "list-keys":
			await handleListKeysCommand(args.slice(1), options);
			break;

		case "sign":
			await handleSignToolCommand(args.slice(1), options);
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
 * Handle the verify subcommand
 */
async function handleVerifyCommand(
	args: string[],
	options: SignOptions,
): Promise<void> {
	let toolPath = args[0];
	let policyName = args[1] || options.policy || "permissive";

	if (!toolPath) {
		p.intro(pc.bgGreen(pc.white(" Verify Tool Signatures ")));

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

		policyName = (await p.select({
			message: "Select verification policy:",
			options: [
				{
					value: "permissive",
					label: "Permissive - Require 1+ valid signatures (default)",
				},
				{
					value: "enterprise",
					label: "Enterprise - Require author + reviewer signatures",
				},
				{
					value: "paranoid",
					label: "Paranoid - Require author + reviewer + approver signatures",
				},
			],
		})) as string;
	}

	const policyKey =
		policyName.toUpperCase() as keyof typeof VERIFICATION_POLICIES;
	const policy =
		VERIFICATION_POLICIES[policyKey] || VERIFICATION_POLICIES.PERMISSIVE;

	if (options.verbose) {
		console.error(pc.cyan("\n📋 Verification Details:"));
		console.error(`Tool: ${toolPath}`);
		console.error(`Policy: ${policyName}`);
		if (policy.minimumSignatures)
			console.error(`Minimum signatures: ${policy.minimumSignatures}`);
		if (policy.requireRoles)
			console.error(`Required roles: ${policy.requireRoles.join(", ")}`);
	}

	try {
		const spinner = p.spinner();
		spinner.start("Verifying tool signatures...");

		const toolYaml = fs.readFileSync(toolPath, "utf8");
		const result = await verifyTool(toolYaml, policy);

		spinner.stop("Verification completed");

		// Display results
		if (result.isValid) {
			console.error(pc.green(`\n✅ VERIFICATION PASSED`));
			console.error(pc.green(`${result.message}`));
		} else {
			console.error(pc.red(`\n❌ VERIFICATION FAILED`));
			console.error(pc.red(`${result.message}`));
		}

		console.error(pc.cyan(`\n📊 Signature Summary:`));
		console.error(
			`Valid signatures: ${result.validSignatures}/${result.totalSignatures}`,
		);

		if (result.verifiedSigners.length > 0) {
			console.error(pc.cyan("\n🔒 Verified signers:"));
			result.verifiedSigners.forEach((signer) => {
				console.error(
					`  - ${signer.signer}${signer.role ? ` (${signer.role})` : ""} [${signer.keyId}]`,
				);
			});
		}

		if (result.errors.length > 0) {
			console.error(pc.yellow("\n⚠️ Issues found:"));
			result.errors.forEach((error) => console.error(`  - ${error}`));
		}

		if (!result.isValid) {
			p.outro(pc.red("Tool verification failed"));
			process.exit(1);
		} else {
			p.outro(pc.green("Tool verification passed"));
		}
	} catch (error) {
		console.error(
			pc.red(`\n❌ Error verifying tool: ${(error as Error).message}`),
		);
		process.exit(1);
	}
}

/**
 * Handle the list-keys subcommand
 */
async function handleListKeysCommand(
	args: string[],
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
			const shortKey = base64Key.substring(0, 32) + "...";

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

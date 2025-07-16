// tests/commands/sign-cli.test.ts - CLI integration tests for enhanced sign command
import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll, mock, spyOn } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { handleSignCommand, type SignOptions } from "../../src/commands/sign";
import {
	SigningService,
	CryptoUtils,
	KeyManager,
	type EnactDocument,
} from "@enactprotocol/security";

// Mock console methods to capture output
const mockConsoleError = mock();
const mockConsoleLog = mock();

// Test helper functions
const createTempDir = () => {
	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "enact-cli-test-"));
	return tempDir;
};

const createTestTool = (name = "test/cli-tool"): EnactDocument => ({
	enact: "1.0.0",
	name,
	description: "Test tool for CLI integration testing",
	command: "echo 'CLI test: ${message}'",
	version: "1.0.0",
	timeout: "30s",
	annotations: {
		readOnlyHint: true,
		destructiveHint: false,
	},
	inputSchema: {
		type: "object",
		properties: {
			message: {
				type: "string",
				description: "Message to display",
			},
		},
		required: ["message"],
	},
});

const writeToolToFile = (tool: EnactDocument, filePath: string) => {
	const toolYaml = stringifyYaml(tool);
	fs.writeFileSync(filePath, toolYaml);
	return toolYaml;
};

describe("Enhanced Sign Command CLI Integration", () => {
	let tempDir: string;
	let testToolPath: string;
	let testTool: EnactDocument;
	let originalConsoleError: typeof console.error;
	let originalConsoleLog: typeof console.log;
	let originalProcessExit: typeof process.exit;

	beforeAll(() => {
		// Set up temporary directory for tests
		tempDir = createTempDir();
		testToolPath = path.join(tempDir, "test-tool.yaml");
		testTool = createTestTool();
		writeToolToFile(testTool, testToolPath);

		// Mock console and process.exit
		originalConsoleError = console.error;
		originalConsoleLog = console.log;
		originalProcessExit = process.exit;

		console.error = mockConsoleError;
		console.log = mockConsoleLog;
		process.exit = mock(() => {}) as any;
	});

	afterAll(() => {
		// Restore original functions
		console.error = originalConsoleError;
		console.log = originalConsoleLog;
		process.exit = originalProcessExit;

		// Clean up temporary directory
		if (fs.existsSync(tempDir)) {
			fs.rmSync(tempDir, { recursive: true, force: true });
		}
	});

	beforeEach(() => {
		// Reset mocks before each test
		mockConsoleError.mockClear();
		mockConsoleLog.mockClear();
		(process.exit as any).mockClear();
	});

	describe("Help Command", () => {
		test("should display help information", async () => {
			await handleSignCommand([], { help: true });

			// Should display help text
			expect(mockConsoleError).toHaveBeenCalled();
			const helpText = mockConsoleError.mock.calls.join(" ");
			expect(helpText).toContain("Enhanced tool signing and verification");
			expect(helpText).toContain("@enactprotocol/security");
			expect(helpText).toContain("sign <tool-path>");
			expect(helpText).toContain("verify <tool-path>");
			expect(helpText).toContain("keygen [name]");
			expect(helpText).toContain("list-keys");
		});

		test("should display feature information in help", async () => {
			await handleSignCommand([], { help: true });

			const helpText = mockConsoleError.mock.calls.join(" ");
			expect(helpText).toContain("Field-specific signing");
			expect(helpText).toContain("Cross-platform compatibility");
			expect(helpText).toContain("Enhanced cryptographic security");
			expect(helpText).toContain("secp256k1");
		});
	});

	describe("Key Generation Command", () => {
		test("should generate key when provided as argument", async () => {
			const keyName = "test-cli-keygen";
			
			await handleSignCommand(["keygen", keyName], {});

			// Should display success message
			expect(mockConsoleError).toHaveBeenCalledWith(
				expect.stringContaining("✅ Cryptographic key pair generated!")
			);
			expect(mockConsoleError).toHaveBeenCalledWith(
				expect.stringContaining(`Name: ${keyName}`)
			);
			expect(mockConsoleError).toHaveBeenCalledWith(
				expect.stringContaining("Algorithm: secp256k1")
			);

			// Verify key was actually generated
			const storedKey = KeyManager.getKey(keyName);
			expect(storedKey).toBeDefined();
			expect(storedKey?.privateKey).toBeDefined();
			expect(storedKey?.publicKey).toBeDefined();

			// Clean up
			KeyManager.removeKey(keyName);
		});

		test("should display verbose information when requested", async () => {
			const keyName = "test-cli-keygen-verbose";
			
			await handleSignCommand(["keygen", keyName], { verbose: true });

			// Should display verbose security features
			expect(mockConsoleError).toHaveBeenCalledWith(
				expect.stringContaining("🔐 Security Features:")
			);
			expect(mockConsoleError).toHaveBeenCalledWith(
				expect.stringContaining("secp256k1 ECDSA algorithm")
			);
			expect(mockConsoleError).toHaveBeenCalledWith(
				expect.stringContaining("Cryptographically secure random generation")
			);
			expect(mockConsoleError).toHaveBeenCalledWith(
				expect.stringContaining("Cross-platform compatibility")
			);

			// Clean up
			KeyManager.removeKey(keyName);
		});

		test("should handle errors gracefully during key generation", async () => {
			// Mock KeyManager.generateAndStoreKey to throw an error
			const originalGenerateAndStoreKey = KeyManager.generateAndStoreKey;
			KeyManager.generateAndStoreKey = mock(() => {
				throw new Error("Key generation failed");
			});

			await handleSignCommand(["keygen", "test-error-key"], {});

			// Should display error message
			expect(mockConsoleError).toHaveBeenCalledWith(
				expect.stringContaining("❌ Error generating keys")
			);
			expect(process.exit).toHaveBeenCalledWith(1);

			// Restore original function
			KeyManager.generateAndStoreKey = originalGenerateAndStoreKey;
		});
	});

	describe("Key Listing Command", () => {
		test("should list stored keys", async () => {
			const keyName1 = "test-list-1";
			const keyName2 = "test-list-2";

			// Clear any existing keys first
			const existingKeys = KeyManager.listKeys();
			existingKeys.forEach(key => KeyManager.removeKey(key));

			// Generate test keys
			KeyManager.generateAndStoreKey(keyName1);
			KeyManager.generateAndStoreKey(keyName2);

			await handleSignCommand(["list-keys"], {});

			// Should display key information (check for any call with key count or key names)
			const errorCalls = mockConsoleError.mock.calls.flat().join(" ");
			expect(errorCalls).toContain("2");
			expect(errorCalls).toContain(keyName1);
			expect(errorCalls).toContain(keyName2);

			// Clean up
			KeyManager.removeKey(keyName1);
			KeyManager.removeKey(keyName2);
		});

		test("should display verbose key information when requested", async () => {
			const keyName = "test-list-verbose";
			KeyManager.generateAndStoreKey(keyName);

			await handleSignCommand(["list-keys"], { verbose: true });

			// Should display full public key in verbose mode
			expect(mockConsoleError).toHaveBeenCalledWith(
				expect.stringContaining("Full Public Key:")
			);

			// Clean up
			KeyManager.removeKey(keyName);
		});

		test("should handle no keys gracefully", async () => {
			// Clear all keys first
			const keys = KeyManager.listKeys();
			keys.forEach(key => KeyManager.removeKey(key));

			await handleSignCommand(["list-keys"], {});

			// Should display no keys message
			expect(mockConsoleError).toHaveBeenCalledWith(
				expect.stringContaining("📭 No keys found")
			);
			expect(mockConsoleError).toHaveBeenCalledWith(
				expect.stringContaining("Generate a key: enact sign keygen <name>")
			);
		});
	});

	describe("Enhanced Signing Command", () => {
		test("should sign a tool file", async () => {
			const keyName = "test-sign-cli";
			KeyManager.generateAndStoreKey(keyName);

			await handleSignCommand(["sign", testToolPath], { signer: "test-user", role: "author" });

			// Should display success message
			expect(mockConsoleError).toHaveBeenCalledWith(
				expect.stringContaining("✅ Tool signed successfully with enhanced security!")
			);
			expect(mockConsoleError).toHaveBeenCalledWith(
				expect.stringContaining(`Tool: ${testToolPath}`)
			);
			expect(mockConsoleError).toHaveBeenCalledWith(
				expect.stringContaining(`Key: ${keyName}`)
			);
			expect(mockConsoleError).toHaveBeenCalledWith(
				expect.stringContaining("Signer: test-user")
			);
			expect(mockConsoleError).toHaveBeenCalledWith(
				expect.stringContaining("Role: author")
			);

			// Verify the file was actually signed
			const signedToolYaml = fs.readFileSync(testToolPath, "utf8");
			const signedTool = parseYaml(signedToolYaml);
			expect(signedTool.signatures).toBeDefined();
			expect(Object.keys(signedTool.signatures)).toHaveLength(1);

			// Clean up
			KeyManager.removeKey(keyName);
			// Restore original tool file
			writeToolToFile(testTool, testToolPath);
		});

		test("should display verbose signing information when requested", async () => {
			const keyName = "test-sign-verbose";
			KeyManager.generateAndStoreKey(keyName);

			await handleSignCommand(["sign", testToolPath], { verbose: true, signer: "test-user" });

			// Should display enhanced security features
			expect(mockConsoleError).toHaveBeenCalledWith(
				expect.stringContaining("🔐 Enhanced Security Features:")
			);
			expect(mockConsoleError).toHaveBeenCalledWith(
				expect.stringContaining("Field-specific signing")
			);
			expect(mockConsoleError).toHaveBeenCalledWith(
				expect.stringContaining("secp256k1 ECDSA cryptography")
			);
			expect(mockConsoleError).toHaveBeenCalledWith(
				expect.stringContaining("Signed fields:")
			);

			// Clean up
			KeyManager.removeKey(keyName);
			writeToolToFile(testTool, testToolPath);
		});

		test("should handle signing when no keys are available", async () => {
			// Clear all keys
			const keys = KeyManager.listKeys();
			keys.forEach(key => KeyManager.removeKey(key));

			await handleSignCommand(["sign", testToolPath], {});

			// Should display warning about no keys
			expect(mockConsoleError).toHaveBeenCalledWith(
				expect.stringContaining("⚠️ No keys found")
			);
			expect(mockConsoleError).toHaveBeenCalledWith(
				expect.stringContaining("enact sign keygen my-signing-key")
			);
		});

		test("should handle non-existent file gracefully", async () => {
			const keyName = "test-sign-nofile";
			KeyManager.generateAndStoreKey(keyName);
			const nonExistentFile = path.join(tempDir, "non-existent.yaml");

			await handleSignCommand(["sign", nonExistentFile], {});

			// Should display error about file not found
			expect(mockConsoleError).toHaveBeenCalledWith(
				expect.stringContaining("❌ Error signing tool")
			);
			expect(process.exit).toHaveBeenCalledWith(1);

			// Clean up
			KeyManager.removeKey(keyName);
		});
	});

	describe("Enhanced Verification Command", () => {
		test("should verify a signed tool", async () => {
			const keyName = "test-verify-cli";
			const keyPair = KeyManager.generateAndStoreKey(keyName);

			// First sign the tool
			const signature = SigningService.signDocument(testTool, keyPair.privateKey, {
				useEnactDefaults: true,
			});

			const signedTool = {
				...testTool,
				signatures: {
					[signature.publicKey]: {
						algorithm: signature.algorithm,
						type: "ecdsa-secp256k1",
						signer: "test-user",
						created: new Date(signature.timestamp).toISOString(),
						value: signature.signature,
						role: "author",
					},
				},
			};

			const signedToolPath = path.join(tempDir, "signed-test-tool.yaml");
			writeToolToFile(signedTool, signedToolPath);

			await handleSignCommand(["verify", signedToolPath], {});

			// Should display verification success
			expect(mockConsoleError).toHaveBeenCalledWith(
				expect.stringContaining("✅ ENHANCED VERIFICATION PASSED")
			);
			expect(mockConsoleError).toHaveBeenCalledWith(
				expect.stringContaining("📊 Signature Summary:")
			);
			expect(mockConsoleError).toHaveBeenCalledWith(
				expect.stringContaining("Valid signatures: 1/1")
			);

			// Clean up
			KeyManager.removeKey(keyName);
			fs.unlinkSync(signedToolPath);
		});

		test("should display verbose verification information when requested", async () => {
			const keyName = "test-verify-verbose";
			const keyPair = KeyManager.generateAndStoreKey(keyName);

			// Sign the tool
			const signature = SigningService.signDocument(testTool, keyPair.privateKey, {
				useEnactDefaults: true,
			});

			const signedTool = {
				...testTool,
				signatures: {
					[signature.publicKey]: {
						algorithm: signature.algorithm,
						type: "ecdsa-secp256k1",
						signer: "test-user",
						created: new Date(signature.timestamp).toISOString(),
						value: signature.signature,
						role: "author",
					},
				},
			};

			const signedToolPath = path.join(tempDir, "signed-verbose-tool.yaml");
			writeToolToFile(signedTool, signedToolPath);

			await handleSignCommand(["verify", signedToolPath], { verbose: true });

			// Should display enhanced security features
			expect(mockConsoleError).toHaveBeenCalledWith(
				expect.stringContaining("🔐 Enhanced Security Features:")
			);
			expect(mockConsoleError).toHaveBeenCalledWith(
				expect.stringContaining("Field-specific verification")
			);
			expect(mockConsoleError).toHaveBeenCalledWith(
				expect.stringContaining("Verified fields:")
			);

			// Clean up
			KeyManager.removeKey(keyName);
			fs.unlinkSync(signedToolPath);
		});

		test("should handle unsigned tools gracefully", async () => {
			await handleSignCommand(["verify", testToolPath], {});

			// Should display warning about no signatures
			const errorCalls = mockConsoleError.mock.calls.flat().join(" ");
			expect(errorCalls).toContain("No signatures found");
			// The actual message is from the enhanced UI component
		});

		test("should handle verification failure", async () => {
			// Create a tool with invalid signature
			const invalidSignedTool = {
				...testTool,
				signatures: {
					"invalid-public-key": {
						algorithm: "secp256k1",
						type: "ecdsa-secp256k1",
						signer: "test-user",
						created: new Date().toISOString(),
						value: "invalid-signature-value",
						role: "author",
					},
				},
			};

			const invalidToolPath = path.join(tempDir, "invalid-signed-tool.yaml");
			writeToolToFile(invalidSignedTool, invalidToolPath);

			await handleSignCommand(["verify", invalidToolPath], {});

			// Should display verification failure
			expect(mockConsoleError).toHaveBeenCalledWith(
				expect.stringContaining("❌ ENHANCED VERIFICATION FAILED")
			);
			expect(mockConsoleError).toHaveBeenCalledWith(
				expect.stringContaining("Valid signatures: 0/1")
			);
			expect(process.exit).toHaveBeenCalledWith(1);

			// Clean up
			fs.unlinkSync(invalidToolPath);
		});
	});

	describe("Unknown Subcommand", () => {
		test("should handle unknown subcommands gracefully", async () => {
			await handleSignCommand(["unknown-command"], {});

			// Should display error message
			expect(mockConsoleError).toHaveBeenCalledWith(
				expect.stringContaining("Unknown subcommand: unknown-command")
			);
			expect(mockConsoleError).toHaveBeenCalledWith(
				expect.stringContaining('Use "enact sign --help"')
			);
			expect(process.exit).toHaveBeenCalledWith(1);
		});
	});

	describe("Error Handling", () => {
		test("should handle file system errors gracefully", async () => {
			const keyName = "test-fs-error";
			KeyManager.generateAndStoreKey(keyName);

			// Try to sign a directory instead of a file
			const dirPath = path.join(tempDir, "test-dir");
			fs.mkdirSync(dirPath);

			await handleSignCommand(["sign", dirPath], {});

			// Should handle the error gracefully
			expect(mockConsoleError).toHaveBeenCalledWith(
				expect.stringContaining("❌ Error signing tool")
			);
			expect(process.exit).toHaveBeenCalledWith(1);

			// Clean up
			KeyManager.removeKey(keyName);
			fs.rmSync(dirPath, { recursive: true });
		});

		test("should handle key management errors gracefully", async () => {
			// Generate a key first so we have something to fail on
			const keyName = "test-error-key";
			KeyManager.generateAndStoreKey(keyName);
			
			// Mock KeyManager.getKey to throw an error after the key exists
			const originalGetKey = KeyManager.getKey;
			KeyManager.getKey = mock(() => {
				throw new Error("Key retrieval failed");
			});

			await handleSignCommand(["sign", testToolPath], {});

			// Should handle the error gracefully
			const errorCalls = mockConsoleError.mock.calls.flat().join(" ");
			expect(errorCalls).toContain("Error signing tool");
			expect(process.exit).toHaveBeenCalledWith(1);

			// Restore original function and clean up
			KeyManager.getKey = originalGetKey;
			KeyManager.removeKey(keyName);
		});
	});
});
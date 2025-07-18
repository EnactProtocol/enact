// tests/core/EnactCore.verifyTool.test.ts - Tests for verifyTool method
import { describe, test, expect, beforeEach, mock, spyOn } from "bun:test";
import { EnactCore } from "../../src/core/EnactCore.js";
import { CryptoUtils, KeyManager, SigningService } from "@enactprotocol/security";
import logger from "../../src/exec/logger.js";
import type { EnactTool } from "../../src/types.js";

// Mock the logger
const mockLoggerInfo = mock(() => {});
const mockLoggerWarn = mock(() => {});
const mockLoggerError = mock(() => {});

// Mock security functions
const mockVerifyDocument = mock(() => true);
const mockGetAllTrustedPublicKeys = mock(() => ["trusted-key-1", "trusted-key-2"]);
const mockHash = mock(() => "mock-hash");
const mockVerify = mock(() => true);
const mockGetCanonicalDocument = mock(() => ({ command: "echo 'test'" }));

describe("EnactCore.verifyTool", () => {
	let enactCore: EnactCore;
	let mockTool: EnactTool;

	beforeEach(() => {
		// Reset all mocks
		mockLoggerInfo.mockClear();
		mockLoggerWarn.mockClear();
		mockLoggerError.mockClear();
		mockVerifyDocument.mockClear();
		mockGetAllTrustedPublicKeys.mockClear();
		mockHash.mockClear();
		mockVerify.mockClear();
		mockGetCanonicalDocument.mockClear();

		// Setup core
		enactCore = new EnactCore({
			executionProvider: "direct",
		});

		// Setup default mock tool with signatures
		mockTool = {
			name: "test/tool",
			description: "Test tool",
			command: "echo 'test'",
			timeout: "30s",
			signatures: [{
				signer: "test-signer-key",
				algorithm: "sha256",
				type: "ecdsa-p256",
				value: "test-signature-value",
				created: "2024-01-01T00:00:00.000Z",
				role: "author",
			}],
		};

		// Mock logger methods
		spyOn(logger, "info").mockImplementation(mockLoggerInfo);
		spyOn(logger, "warn").mockImplementation(mockLoggerWarn);
		spyOn(logger, "error").mockImplementation(mockLoggerError);

		// Mock security library functions
		spyOn(SigningService, "verifyDocument").mockImplementation(mockVerifyDocument);
		spyOn(KeyManager, "getAllTrustedPublicKeys").mockImplementation(mockGetAllTrustedPublicKeys);
		spyOn(CryptoUtils, "hash").mockImplementation(mockHash);
		spyOn(CryptoUtils, "verify").mockImplementation(mockVerify);
		spyOn(SigningService, "getCanonicalDocument").mockImplementation(mockGetCanonicalDocument);

		// Mock console.log to avoid spam during tests
		spyOn(console, "log").mockImplementation(() => {});
	});

	test("should skip verification when dangerouslySkipVerification is true", async () => {
		// Act
		await (enactCore as any).verifyTool(mockTool, true);

		// Assert
		expect(mockLoggerWarn).toHaveBeenCalledWith(
			"Skipping signature verification for tool: test/tool"
		);
		expect(mockVerifyDocument).not.toHaveBeenCalled();
	});

	test("should throw error when tool has no signatures", async () => {
		// Arrange
		const toolWithoutSignatures = {
			...mockTool,
			signatures: [],
		};

		// Act & Assert
		await expect((enactCore as any).verifyTool(toolWithoutSignatures, false))
			.rejects.toThrow("Signature verification failed: Tool test/tool does not have any signatures");
	});

	test("should throw error when tool has undefined signatures", async () => {
		// Arrange
		const toolWithoutSignatures = {
			...mockTool,
			signatures: undefined,
		};

		// Act & Assert
		await expect((enactCore as any).verifyTool(toolWithoutSignatures, false))
			.rejects.toThrow("Signature verification failed: Tool test/tool does not have any signatures");
	});

	test("should successfully verify tool with valid signature", async () => {
		// Arrange
		mockVerifyDocument.mockReturnValue(true);
		mockGetAllTrustedPublicKeys.mockReturnValue(["test-signer-key", "other-key"]);
		mockVerify.mockReturnValue(true);

		// Act
		await (enactCore as any).verifyTool(mockTool, false);

		// Assert
		expect(mockLoggerInfo).toHaveBeenCalledWith(
			"Tool test/tool signature verification passed"
		);
		expect(mockVerifyDocument).toHaveBeenCalledWith(
			{ command: "echo 'test'" },
			{
				signature: "test-signature-value",
				publicKey: "test-signer-key",
				algorithm: "sha256",
				timestamp: new Date("2024-01-01T00:00:00.000Z").getTime(),
			},
			{ includeFields: ['command'] }
		);
	});

	test("should throw error when signature verification fails", async () => {
		// Arrange
		mockVerifyDocument.mockReturnValue(false);

		// Act & Assert
		await expect((enactCore as any).verifyTool(mockTool, false))
			.rejects.toThrow("Signature verification failed: Tool test/tool has invalid signatures");

		expect(mockLoggerError).toHaveBeenCalledWith(
			expect.stringContaining("Signature verification failed for tool test/tool:"),
			expect.any(Error)
		);
	});

	test("should handle signature verification exception", async () => {
		// Arrange
		const verificationError = new Error("Crypto error");
		mockVerifyDocument.mockImplementation(() => {
			throw verificationError;
		});

		// Act & Assert
		await expect((enactCore as any).verifyTool(mockTool, false))
			.rejects.toThrow("Signature verification failed: Crypto error");

		expect(mockLoggerError).toHaveBeenCalledWith(
			expect.stringContaining("Signature verification failed for tool test/tool:"),
			verificationError
		);
	});

	test("should use first signature when multiple signatures present", async () => {
		// Arrange
		const toolWithMultipleSignatures = {
			...mockTool,
			signatures: [
				{
					signer: "first-signer",
					algorithm: "sha256",
					type: "ecdsa-p256",
					value: "first-signature",
					created: "2024-01-01T00:00:00.000Z",
					role: "author",
				},
				{
					signer: "second-signer",
					algorithm: "sha256",
					type: "ecdsa-p256",
					value: "second-signature",
					created: "2024-01-02T00:00:00.000Z",
					role: "reviewer",
				},
			],
		};

		mockVerifyDocument.mockReturnValue(true);

		// Act
		await (enactCore as any).verifyTool(toolWithMultipleSignatures, false);

		// Assert
		expect(mockVerifyDocument).toHaveBeenCalledWith(
			{ command: "echo 'test'" },
			{
				signature: "first-signature",
				publicKey: "first-signer",
				algorithm: "sha256",
				timestamp: new Date("2024-01-01T00:00:00.000Z").getTime(),
			},
			{ includeFields: ['command'] }
		);
	});

	test("should call all verification steps in correct order", async () => {
		// Arrange
		mockVerifyDocument.mockReturnValue(true);

		// Act
		await (enactCore as any).verifyTool(mockTool, false);

		// Assert
		// Verify the security functions were called in the expected order
		expect(mockGetCanonicalDocument).toHaveBeenCalledWith(
			{ command: "echo 'test'" },
			{ includeFields: ['command'] }
		);
		expect(mockHash).toHaveBeenCalledWith('{"command":"echo \'test\'"}');
		expect(mockVerify).toHaveBeenCalledWith(
			"test-signer-key",
			"mock-hash",
			"test-signature-value"
		);
		expect(mockGetAllTrustedPublicKeys).toHaveBeenCalled();
		expect(mockVerifyDocument).toHaveBeenCalled();
	});

	test("should log debug information during verification", async () => {
		// Arrange
		mockVerifyDocument.mockReturnValue(true);
		mockGetAllTrustedPublicKeys.mockReturnValue(["trusted-key"]);
		mockVerify.mockReturnValue(true);

		// Act
		await (enactCore as any).verifyTool(mockTool, false);

		// Assert
		expect(console.log).toHaveBeenCalledWith("Direct crypto verification result:", true);
		expect(console.log).toHaveBeenCalledWith("Trusted keys:", ["trusted-key"]);
		expect(console.log).toHaveBeenCalledWith("Is our public key trusted?", false); // test-signer-key not in trusted keys
		expect(console.log).toHaveBeenCalledWith("Final verification result:", true);
	});

	test("should handle tool with complex command correctly", async () => {
		// Arrange
		const complexTool = {
			...mockTool,
			command: "docker run --rm -v $(pwd):/workspace alpine:latest sh -c 'echo ${input}'",
		};
		
		mockGetCanonicalDocument.mockReturnValue({ 
			command: "docker run --rm -v $(pwd):/workspace alpine:latest sh -c 'echo ${input}'" 
		});
		mockVerifyDocument.mockReturnValue(true);

		// Act
		await (enactCore as any).verifyTool(complexTool, false);

		// Assert
		expect(mockGetCanonicalDocument).toHaveBeenCalledWith(
			{ command: "docker run --rm -v $(pwd):/workspace alpine:latest sh -c 'echo ${input}'" },
			{ includeFields: ['command'] }
		);
		expect(mockLoggerInfo).toHaveBeenCalledWith(
			"Tool test/tool signature verification passed"
		);
	});
});
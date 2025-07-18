// tests/core/EnactCore.verification.integration.test.ts - Integration tests for verification flow
import { describe, test, expect, beforeEach, mock, spyOn } from "bun:test";
import { EnactCore } from "../../src/core/EnactCore.js";
import { SecurityConfigManager } from "@enactprotocol/security";
import logger from "../../src/exec/logger.js";
import type { EnactTool, ToolExecuteOptions } from "../../src/types.js";

// Mock logger to avoid noise
const mockLogger = {
	info: mock(() => {}),
	warn: mock(() => {}),
	error: mock(() => {}),
	debug: mock(() => {}),
};

describe("EnactCore - Verification Integration Tests", () => {
	let enactCore: EnactCore;

	beforeEach(() => {
		// Reset all mocks
		Object.values(mockLogger).forEach(mock => mock.mockClear());

		// Setup core with direct execution provider
		enactCore = new EnactCore({
			executionProvider: "direct",
		});

		// Mock the execution provider to avoid actual execution
		(enactCore as any).executionProvider = {
			execute: mock(() => Promise.resolve({
				success: true,
				output: "mocked execution result",
				metadata: {
					executionId: "test-exec-id",
					toolName: "test-tool",
					executedAt: new Date().toISOString(),
					environment: "test",
				},
			})),
		};

		// Mock all logger methods
		spyOn(logger, "info").mockImplementation(mockLogger.info);
		spyOn(logger, "warn").mockImplementation(mockLogger.warn);
		spyOn(logger, "error").mockImplementation(mockLogger.error);
		spyOn(logger, "debug").mockImplementation(mockLogger.debug);

		// Mock console.log to avoid debug spam
		spyOn(console, "log").mockImplementation(() => {});
	});

	describe("Local Files with Security Config", () => {
		test("should execute local file without verification when allowLocalUnsigned=true", async () => {
			// Arrange
			spyOn(SecurityConfigManager, "loadConfig").mockReturnValue({
				allowLocalUnsigned: true,
				requireSignedTools: false,
				trustedKeys: [],
			});

			const localTool: EnactTool = {
				name: "local/test-tool",
				description: "A local test tool",
				command: "echo 'Hello from local tool'",
			};

			const options: ToolExecuteOptions = {
				isLocalFile: true,
			};

			// Act
			const result = await enactCore.executeTool(localTool, { input: "test" }, options);

			// Assert
			expect(result.success).toBe(true);
			expect(mockLogger.warn).toHaveBeenCalledWith(
				"Executing local file without signature verification: local/test-tool (you can disallow in your security config)"
			);
		});

		test("should require verification for local file when allowLocalUnsigned=false", async () => {
			// Arrange
			spyOn(SecurityConfigManager, "loadConfig").mockReturnValue({
				allowLocalUnsigned: false,
				requireSignedTools: true,
				trustedKeys: [],
			});

			const localToolWithoutSignatures: EnactTool = {
				name: "local/unsigned-tool",
				description: "An unsigned local tool",
				command: "echo 'This should fail'",
			};

			const options: ToolExecuteOptions = {
				isLocalFile: true,
			};

			// Act
			const result = await enactCore.executeTool(localToolWithoutSignatures, {}, options);

			// Assert
			expect(result.success).toBe(false);
			expect(result.error?.message).toContain("Signature verification failed");
			expect(mockLogger.warn).not.toHaveBeenCalledWith(
				expect.stringContaining("Executing local file without signature verification")
			);
		});
	});

	describe("Remote Tools Verification", () => {
		test("should always require verification for remote tools regardless of allowLocalUnsigned", async () => {
			// Arrange
			spyOn(SecurityConfigManager, "loadConfig").mockReturnValue({
				allowLocalUnsigned: true, // This should not affect remote tools
				requireSignedTools: true,
				trustedKeys: [],
			});

			const remoteTool: EnactTool = {
				name: "remote/unsigned-tool",
				description: "An unsigned remote tool",
				command: "echo 'This should fail verification'",
			};

			const options: ToolExecuteOptions = {
				isLocalFile: false,
			};

			// Act
			const result = await enactCore.executeTool(remoteTool, {}, options);

			// Assert
			expect(result.success).toBe(false);
			expect(result.error?.message).toContain("Signature verification failed");
			expect(mockLogger.warn).not.toHaveBeenCalledWith(
				expect.stringContaining("Executing local file without signature verification")
			);
		});

		test("should succeed for remote tool with valid signatures", async () => {
			// Arrange
			spyOn(SecurityConfigManager, "loadConfig").mockReturnValue({
				allowLocalUnsigned: true,
				requireSignedTools: true,
				trustedKeys: ["trusted-signer-key"],
			});

			// Mock verification to pass
			spyOn(enactCore as any, "verifyTool").mockImplementation(() => Promise.resolve());

			const signedRemoteTool: EnactTool = {
				name: "remote/signed-tool",
				description: "A properly signed remote tool",
				command: "echo 'This should succeed'",
				signatures: [{
					signer: "trusted-signer-key",
					algorithm: "sha256",
					type: "ecdsa-p256",
					value: "valid-signature",
					created: new Date().toISOString(),
					role: "author",
				}],
			};

			const options: ToolExecuteOptions = {
				isLocalFile: false,
			};

			// Act
			const result = await enactCore.executeTool(signedRemoteTool, {}, options);

			// Assert
			expect(result.success).toBe(true);
			expect((enactCore as any).verifyTool).toHaveBeenCalledWith(signedRemoteTool, false);
		});
	});

	describe("Dangerous Skip Verification", () => {
		test("should override all other settings when dangerouslySkipVerification=true", async () => {
			// Arrange
			spyOn(SecurityConfigManager, "loadConfig").mockReturnValue({
				allowLocalUnsigned: false,
				requireSignedTools: true,
				trustedKeys: [],
			});

			const unsignedTool: EnactTool = {
				name: "dangerous/unsigned-tool",
				description: "Tool executed with dangerous skip",
				command: "echo 'This should work despite no signatures'",
			};

			const options: ToolExecuteOptions = {
				isLocalFile: false,
				dangerouslySkipVerification: true,
			};

			// Act
			const result = await enactCore.executeTool(unsignedTool, {}, options);

			// Assert
			expect(result.success).toBe(true);
			expect(mockLogger.warn).toHaveBeenCalledWith(
				"Skipping signature verification for tool: dangerous/unsigned-tool because of dangerouslySkipVerification option"
			);
		});
	});

	describe("Complex Scenarios", () => {
		test("should handle local file with dangerous skip and allowLocalUnsigned=false", async () => {
			// Arrange
			spyOn(SecurityConfigManager, "loadConfig").mockReturnValue({
				allowLocalUnsigned: false,
				requireSignedTools: true,
				trustedKeys: [],
			});

			const localTool: EnactTool = {
				name: "local/tool-with-dangerous-skip",
				description: "Local tool with dangerous skip override",
				command: "echo 'Should work due to dangerous skip'",
			};

			const options: ToolExecuteOptions = {
				isLocalFile: true,
				dangerouslySkipVerification: true,
			};

			// Act
			const result = await enactCore.executeTool(localTool, {}, options);

			// Assert
			expect(result.success).toBe(true);
			// Both warnings should appear
			expect(mockLogger.warn).toHaveBeenCalledWith(
				"Skipping signature verification for tool: local/tool-with-dangerous-skip because of dangerouslySkipVerification option"
			);
			// Local file warning should NOT appear because allowLocalUnsigned=false
			expect(mockLogger.warn).not.toHaveBeenCalledWith(
				expect.stringContaining("Executing local file without signature verification")
			);
		});

		test("should handle local file with allowLocalUnsigned=true and dangerous skip", async () => {
			// Arrange
			spyOn(SecurityConfigManager, "loadConfig").mockReturnValue({
				allowLocalUnsigned: true,
				requireSignedTools: true,
				trustedKeys: [],
			});

			const localTool: EnactTool = {
				name: "local/tool-both-skips",
				description: "Local tool with both skip conditions",
				command: "echo 'Should work for multiple reasons'",
			};

			const options: ToolExecuteOptions = {
				isLocalFile: true,
				dangerouslySkipVerification: true,
			};

			// Act
			const result = await enactCore.executeTool(localTool, {}, options);

			// Assert
			expect(result.success).toBe(true);
			// Both warnings should appear
			expect(mockLogger.warn).toHaveBeenCalledWith(
				"Executing local file without signature verification: local/tool-both-skips (you can disallow in your security config)"
			);
			expect(mockLogger.warn).toHaveBeenCalledWith(
				"Skipping signature verification for tool: local/tool-both-skips because of dangerouslySkipVerification option"
			);
		});
	});

	describe("Error Handling", () => {
		test("should return execution error when validation fails", async () => {
			// Arrange
			spyOn(SecurityConfigManager, "loadConfig").mockReturnValue({
				allowLocalUnsigned: true,
				requireSignedTools: false,
				trustedKeys: [],
			});

			// Mock validation to fail
			const validateModule = await import("../../src/exec/validate.js");
			spyOn(validateModule, "validateToolStructure").mockImplementation(() => {
				throw new Error("Invalid tool structure");
			});

			const invalidTool: EnactTool = {
				name: "invalid/tool",
				description: "Tool with invalid structure",
				command: "echo 'test'",
			};

			const options: ToolExecuteOptions = {
				isLocalFile: true,
			};

			// Act
			const result = await enactCore.executeTool(invalidTool, {}, options);

			// Assert
			expect(result.success).toBe(false);
			expect(result.error?.message).toBe("Invalid tool structure");
			expect(result.error?.code).toBe("EXECUTION_ERROR");
		});

		test("should include proper metadata in error responses", async () => {
			// Arrange
			spyOn(SecurityConfigManager, "loadConfig").mockReturnValue({
				allowLocalUnsigned: false,
				requireSignedTools: true,
				trustedKeys: [],
			});

			const unsignedTool: EnactTool = {
				name: "error/unsigned-tool",
				description: "Tool that will fail verification",
				command: "echo 'This will fail'",
			};

			const options: ToolExecuteOptions = {
				isLocalFile: false,
			};

			// Act
			const result = await enactCore.executeTool(unsignedTool, {}, options);

			// Assert
			expect(result.success).toBe(false);
			expect(result.metadata).toEqual({
				executionId: expect.stringMatching(/^exec_\d+_[a-z0-9]+$/),
				toolName: "error/unsigned-tool",
				executedAt: expect.any(String),
				environment: "direct",
			});
		});
	});
});
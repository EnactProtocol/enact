// tests/core/EnactCore.executeTool.test.ts - Tests for ExecuteTool verification logic
import { describe, test, expect, beforeEach, mock, spyOn } from "bun:test";
import { EnactCore } from "../../src/core/EnactCore.js";
import { SecurityConfigManager } from "@enactprotocol/security";
import logger from "../../src/exec/logger.js";
import type { EnactTool, ToolExecuteOptions } from "../../src/types.js";

// Mock the logger to capture log messages
const mockLoggerInfo = mock(() => {});
const mockLoggerWarn = mock(() => {});
const mockLoggerError = mock(() => {});

// Mock SecurityConfigManager
const mockLoadConfig = mock(() => ({
	allowLocalUnsigned: true,
	requireSignedTools: true,
	trustedKeys: [],
}));

// Mock execution provider to avoid actual execution
const mockExecute = mock(() => Promise.resolve({
	success: true,
	output: "test output",
	metadata: {
		executionId: "test-id",
		toolName: "test-tool",
		executedAt: new Date().toISOString(),
		environment: "test",
	},
}));

describe("EnactCore.executeTool - Verification Logic", () => {
	let enactCore: EnactCore;
	let mockTool: EnactTool;

	beforeEach(() => {
		// Reset all mocks
		mockLoggerInfo.mockClear();
		mockLoggerWarn.mockClear();
		mockLoggerError.mockClear();
		mockLoadConfig.mockClear();
		mockExecute.mockClear();

		// Setup core with direct execution to avoid Dagger complexity
		enactCore = new EnactCore({
			executionProvider: "direct",
		});

		// Mock the execution provider
		(enactCore as any).executionProvider = {
			execute: mockExecute,
		};

		// Setup default mock tool
		mockTool = {
			name: "test/tool",
			description: "Test tool",
			command: "echo 'test'",
			timeout: "30s",
			signatures: [{
				signer: "test-signer",
				algorithm: "sha256",
				type: "ecdsa-p256",
				value: "test-signature",
				created: new Date().toISOString(),
				role: "author",
			}],
		};

		// Mock logger methods
		spyOn(logger, "info").mockImplementation(mockLoggerInfo);
		spyOn(logger, "warn").mockImplementation(mockLoggerWarn);
		spyOn(logger, "error").mockImplementation(mockLoggerError);

		// Mock SecurityConfigManager
		spyOn(SecurityConfigManager, "loadConfig").mockImplementation(mockLoadConfig);

		// Mock verifyTool to avoid actual signature verification
		const mockVerifyTool = mock(() => Promise.resolve());
		spyOn(enactCore as any, "verifyTool").mockImplementation(mockVerifyTool);
	});

	test("should skip verification for local files when allowLocalUnsigned is true", async () => {
		// Arrange
		mockLoadConfig.mockReturnValue({
			allowLocalUnsigned: true,
			requireSignedTools: true,
			trustedKeys: [],
		});

		const options: ToolExecuteOptions = {
			isLocalFile: true,
		};

		// Act
		const result = await enactCore.executeTool(mockTool, {}, options);

		// Assert
		expect(result.success).toBe(true);
		expect(mockLoggerWarn).toHaveBeenCalledWith(
			expect.stringContaining("Executing local file without signature verification: test/tool")
		);
		expect((enactCore as any).verifyTool).toHaveBeenCalledWith(mockTool, true);
	});

	test("should require verification for local files when allowLocalUnsigned is false", async () => {
		// Arrange
		mockLoadConfig.mockReturnValue({
			allowLocalUnsigned: false,
			requireSignedTools: true,
			trustedKeys: [],
		});

		const options: ToolExecuteOptions = {
			isLocalFile: true,
		};

		// Act
		const result = await enactCore.executeTool(mockTool, {}, options);

		// Assert
		expect(result.success).toBe(true);
		expect(mockLoggerWarn).not.toHaveBeenCalledWith(
			expect.stringContaining("Executing local file without signature verification")
		);
		
		
		// When isLocalFile=true but allowLocalUnsigned=false, skipVerification should be false
		expect((enactCore as any).verifyTool).toHaveBeenCalledWith(mockTool, false);
	});

	test("should skip verification when dangerouslySkipVerification is true", async () => {
		// Arrange
		mockLoadConfig.mockReturnValue({
			allowLocalUnsigned: false,
			requireSignedTools: true,
			trustedKeys: [],
		});

		const options: ToolExecuteOptions = {
			dangerouslySkipVerification: true,
		};

		// Act
		const result = await enactCore.executeTool(mockTool, {}, options);

		// Assert
		expect(result.success).toBe(true);
		expect(mockLoggerWarn).toHaveBeenCalledWith(
			expect.stringContaining("Skipping signature verification for tool: test/tool because of dangerouslySkipVerification option")
		);
		expect((enactCore as any).verifyTool).toHaveBeenCalledWith(mockTool, true);
	});

	test("should skip verification for local file with dangerouslySkipVerification (both true)", async () => {
		// Arrange
		mockLoadConfig.mockReturnValue({
			allowLocalUnsigned: true,
			requireSignedTools: true,
			trustedKeys: [],
		});

		const options: ToolExecuteOptions = {
			isLocalFile: true,
			dangerouslySkipVerification: true,
		};

		// Act
		const result = await enactCore.executeTool(mockTool, {}, options);

		// Assert
		expect(result.success).toBe(true);
		expect(mockLoggerWarn).toHaveBeenCalledWith(
			expect.stringContaining("Executing local file without signature verification: test/tool")
		);
		expect(mockLoggerWarn).toHaveBeenCalledWith(
			expect.stringContaining("Skipping signature verification for tool: test/tool because of dangerouslySkipVerification option")
		);
		expect((enactCore as any).verifyTool).toHaveBeenCalledWith(mockTool, true);
	});

	test("should require verification for remote tools by default", async () => {
		// Arrange
		mockLoadConfig.mockReturnValue({
			allowLocalUnsigned: true,
			requireSignedTools: true,
			trustedKeys: [],
		});

		const options: ToolExecuteOptions = {
			isLocalFile: false, // Remote tool
		};

		// Act
		const result = await enactCore.executeTool(mockTool, {}, options);

		// Assert
		expect(result.success).toBe(true);
		expect(mockLoggerWarn).not.toHaveBeenCalledWith(
			expect.stringContaining("Executing local file without signature verification")
		);
		expect(mockLoggerWarn).not.toHaveBeenCalledWith(
			expect.stringContaining("Skipping signature verification")
		);
		// Remote tools should always require verification (skipVerification = false)
		expect((enactCore as any).verifyTool).toHaveBeenCalledWith(mockTool, false);
	});

	test("should handle verification failure gracefully", async () => {
		// Arrange
		const verificationError = new Error("Signature verification failed");
		(enactCore as any).verifyTool.mockImplementation(() => {
			throw verificationError;
		});

		mockLoadConfig.mockReturnValue({
			allowLocalUnsigned: false,
			requireSignedTools: true,
			trustedKeys: [],
		});

		const options: ToolExecuteOptions = {
			isLocalFile: false,
		};

		// Act
		const result = await enactCore.executeTool(mockTool, {}, options);

		// Assert
		expect(result.success).toBe(false);
		expect(result.error?.message).toBe("Signature verification failed");
		expect(result.error?.code).toBe("EXECUTION_ERROR");
	});

	test("should log warning with security config message for local files", async () => {
		// Arrange
		mockLoadConfig.mockReturnValue({
			allowLocalUnsigned: true,
			requireSignedTools: true,
			trustedKeys: [],
		});

		const options: ToolExecuteOptions = {
			isLocalFile: true,
		};

		// Act
		await enactCore.executeTool(mockTool, {}, options);

		// Assert
		expect(mockLoggerWarn).toHaveBeenCalledWith(
			"Executing local file without signature verification: test/tool (you can disallow in your security config)"
		);
	});

	test("should not log local file warning when allowLocalUnsigned is false", async () => {
		// Arrange
		mockLoadConfig.mockReturnValue({
			allowLocalUnsigned: false,
			requireSignedTools: true,
			trustedKeys: [],
		});

		const options: ToolExecuteOptions = {
			isLocalFile: true,
		};

		// Act
		await enactCore.executeTool(mockTool, {}, options);

		// Assert
		expect(mockLoggerWarn).not.toHaveBeenCalledWith(
			expect.stringContaining("Executing local file without signature verification")
		);
	});

	test("should properly combine local file and dangerous skip flags", async () => {
		// Arrange - allowLocalUnsigned false, but dangerouslySkipVerification true
		mockLoadConfig.mockReturnValue({
			allowLocalUnsigned: false,
			requireSignedTools: true,
			trustedKeys: [],
		});

		const options: ToolExecuteOptions = {
			isLocalFile: true,
			dangerouslySkipVerification: true,
		};

		// Act
		await enactCore.executeTool(mockTool, {}, options);

		// Assert
		// Should skip because of dangerouslySkipVerification, not because of local file
		expect(mockLoggerWarn).not.toHaveBeenCalledWith(
			expect.stringContaining("Executing local file without signature verification")
		);
		expect(mockLoggerWarn).toHaveBeenCalledWith(
			expect.stringContaining("Skipping signature verification for tool: test/tool because of dangerouslySkipVerification option")
		);
		expect((enactCore as any).verifyTool).toHaveBeenCalledWith(mockTool, true);
	});

	test("should call SecurityConfigManager.loadConfig once per execution", async () => {
		// Arrange
		const options: ToolExecuteOptions = {
			isLocalFile: true,
		};

		// Act
		await enactCore.executeTool(mockTool, {}, options);

		// Assert
		expect(mockLoadConfig).toHaveBeenCalledTimes(1);
	});

	test("should pass all validation steps before verification", async () => {
		// Arrange
		const mockValidateToolStructure = mock(() => {});
		const mockValidateInputs = mock(() => ({}));
		
		// Mock validation functions
		const validateModule = await import("../../src/exec/validate.js");
		spyOn(validateModule, "validateToolStructure").mockImplementation(mockValidateToolStructure);
		spyOn(validateModule, "validateInputs").mockImplementation(mockValidateInputs);

		const options: ToolExecuteOptions = {
			isLocalFile: false,
		};

		// Act
		await enactCore.executeTool(mockTool, { input: "test" }, options);

		// Assert
		expect(mockValidateToolStructure).toHaveBeenCalledWith(mockTool);
		expect(mockValidateInputs).toHaveBeenCalledWith(mockTool, { input: "test" });
		expect((enactCore as any).verifyTool).toHaveBeenCalled();
	});

	test("should include execution metadata in successful result", async () => {
		// Arrange
		const options: ToolExecuteOptions = {
			isLocalFile: true,
		};

		// Act
		const result = await enactCore.executeTool(mockTool, {}, options);

		// Assert
		expect(result.success).toBe(true);
		expect(result.metadata).toEqual({
			executionId: "test-id",
			toolName: "test-tool",
			executedAt: expect.any(String),
			environment: "test",
		});
	});
});
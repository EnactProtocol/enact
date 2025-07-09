// tests/centralized-verification.test.ts - Test centralized signature verification
import { 
	enforceSignatureVerification, 
	getSecurityPolicy,
	type VerificationEnforcementOptions 
} from "../src/security/verification-enforcer";
import type { EnactTool } from "../src/types";

describe("Centralized Signature Verification", () => {
	const mockTool: EnactTool = {
		name: "test/tool",
		description: "Test tool",
		command: "echo 'test'",
		signatures: {
			"test-signature": {
				signer: "test-signer",
				algorithm: "sha256",
				type: "ecdsa-p256",
				value: "test-signature-value",
				created: new Date().toISOString(),
				role: "author",
			},
		},
	};

	const mockUnsignedTool: EnactTool = {
		name: "test/unsigned-tool",
		description: "Test unsigned tool",
		command: "echo 'test'",
	};

	describe("getSecurityPolicy", () => {
		it("should return local file policy for local files", () => {
			const policy = getSecurityPolicy({ isLocalFile: true });
			
			expect(policy.allowSkipVerification).toBe(true);
			expect(policy.allowUnsigned).toBe(true);
			expect(policy.requireInteractiveConfirmation).toBe(false);
			expect(policy.defaultVerificationPolicy).toBe("permissive");
		});

		it("should return strict policy for registry tools", () => {
			const policy = getSecurityPolicy({ isLocalFile: false });
			
			expect(policy.allowSkipVerification).toBe(false);
			expect(policy.allowUnsigned).toBe(false);
			expect(policy.requireInteractiveConfirmation).toBe(false);
		});

		it("should enable interactive confirmation when requested", () => {
			const policy = getSecurityPolicy({ 
				isLocalFile: false, 
				interactive: true 
			});
			
			expect(policy.requireInteractiveConfirmation).toBe(true);
		});

		it("should use custom verification policy", () => {
			const policy = getSecurityPolicy({ 
				isLocalFile: false, 
				verifyPolicy: "enterprise" 
			});
			
			expect(policy.defaultVerificationPolicy).toBe("enterprise");
		});
	});

	describe("enforceSignatureVerification", () => {
		describe("Local files", () => {
			it("should allow skipping verification for local files", async () => {
				const result = await enforceSignatureVerification(mockTool, {
					skipVerification: true,
					isLocalFile: true,
				});

				expect(result.allowed).toBe(true);
				expect(result.reason).toContain("skipped");
			});

			it("should allow unsigned tools for local files", async () => {
				const result = await enforceSignatureVerification(mockUnsignedTool, {
					isLocalFile: true,
				});

				expect(result.allowed).toBe(true);
				expect(result.reason).toContain("Unsigned tool allowed");
			});
		});

		describe("Registry tools", () => {
			it("should not allow skipping verification for registry tools", async () => {
				const result = await enforceSignatureVerification(mockTool, {
					skipVerification: true,
					isLocalFile: false,
				});

				// Should not skip because policy doesn't allow it
				expect(result.allowed).toBe(false);
			});

			it("should not allow unsigned tools for registry tools", async () => {
				const result = await enforceSignatureVerification(mockUnsignedTool, {
					isLocalFile: false,
				});

				expect(result.allowed).toBe(false);
				expect(result.reason).toContain("no signatures");
			});
		});

		describe("Consistency across components", () => {
			const testCases = [
				{
					name: "CLI local file execution",
					options: { isLocalFile: true, interactive: true },
					tool: mockUnsignedTool,
					expectedAllowed: true,
				},
				{
					name: "CLI registry tool execution",
					options: { isLocalFile: false, interactive: true },
					tool: mockUnsignedTool,
					expectedAllowed: false,
				},
				{
					name: "MCP server local file execution",
					options: { isLocalFile: true, skipVerification: true },
					tool: mockUnsignedTool,
					expectedAllowed: true,
				},
				{
					name: "MCP server registry tool execution",
					options: { isLocalFile: false, skipVerification: false },
					tool: mockUnsignedTool,
					expectedAllowed: false,
				},
				{
					name: "Core direct execution",
					options: { isLocalFile: false },
					tool: mockUnsignedTool,
					expectedAllowed: false,
				},
			];

			testCases.forEach(({ name, options, tool, expectedAllowed }) => {
				it(`should be consistent for ${name}`, async () => {
					const result = await enforceSignatureVerification(tool, options);
					expect(result.allowed).toBe(expectedAllowed);
				});
			});
		});

		describe("Security policy enforcement", () => {
			it("should enforce minimum signatures for enterprise policy", async () => {
				const result = await enforceSignatureVerification(mockTool, {
					verifyPolicy: "enterprise",
					isLocalFile: false,
				});

				// This would fail in real implementation due to missing reviewer signature
				// But shows the policy is being applied
				expect(result.allowed).toBe(false);
				expect(result.reason).toContain("verification");
			});

			it("should provide detailed error information", async () => {
				const result = await enforceSignatureVerification(mockUnsignedTool, {
					isLocalFile: false,
				});

				expect(result.allowed).toBe(false);
				expect(result.error).toBeDefined();
				expect(result.error?.code).toBe("NO_SIGNATURES_FOUND");
				expect(result.error?.details).toBeDefined();
			});
		});
	});

	describe("Component integration", () => {
		it("should use same verification logic for CLI and MCP server", async () => {
			const cliOptions: VerificationEnforcementOptions = {
				isLocalFile: false,
				interactive: true,
				verifyPolicy: "permissive",
			};

			const mcpOptions: VerificationEnforcementOptions = {
				isLocalFile: false,
				interactive: false,
				verifyPolicy: "permissive",
			};

			const cliResult = await enforceSignatureVerification(mockUnsignedTool, cliOptions);
			const mcpResult = await enforceSignatureVerification(mockUnsignedTool, mcpOptions);

			// Both should have same verification outcome
			expect(cliResult.allowed).toBe(mcpResult.allowed);
			expect(cliResult.reason).toBe(mcpResult.reason);
		});

		it("should handle force flag consistently", async () => {
			const options: VerificationEnforcementOptions = {
				force: true,
				isLocalFile: false,
			};

			const result = await enforceSignatureVerification(mockUnsignedTool, options);

			// Force flag should not override security policy for unsigned tools
			expect(result.allowed).toBe(false);
		});
	});
});
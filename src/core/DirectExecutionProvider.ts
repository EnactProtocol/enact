// src/core/DirectExecutionProvider.ts - Direct execution provider that doesn't use external CLI
import { spawn } from "child_process";
import {
	ExecutionProvider,
	type EnactTool,
	type ExecutionEnvironment,
	type ExecutionResult,
} from "../types.js";
import logger from "../exec/logger.js";
import { parseTimeout } from "../utils/timeout.js";

export class DirectExecutionProvider extends ExecutionProvider {
	async resolveEnvironmentVariables(
		envConfig: Record<string, any>,
		namespace?: string,
	): Promise<Record<string, any>> {
		const resolved: Record<string, any> = {};

		for (const [key, config] of Object.entries(envConfig)) {
			if (typeof config === "object" && config.source) {
				// Handle different sources
				switch (config.source) {
					case "env":
						resolved[key] = process.env[key] || config.default;
						break;
					case "user":
						// Could get from user config file
						resolved[key] = config.default;
						break;
					default:
						resolved[key] = config.default;
				}
			} else {
				// Direct value
				resolved[key] = config;
			}
		}

		return resolved;
	}

	async executeCommand(
		command: string,
		inputs: Record<string, any>,
		environment: ExecutionEnvironment,
		timeout?: string,
		options?: {
			verbose?: boolean;
			showSpinner?: boolean;
			streamOutput?: boolean;
		},
	): Promise<{ stdout: string; stderr: string; exitCode: number }> {
		return new Promise((resolve, reject) => {
			let stdout = "";
			let stderr = "";

			// UI Setup
			const verbose = options?.verbose ?? false;
			const showSpinner = options?.showSpinner ?? false;
			const streamOutput = options?.streamOutput ?? true;

			let spinner: any = null;

			if (showSpinner) {
				// Dynamic import to avoid dependency issues when not needed
				try {
					const p = require("@clack/prompts");
					spinner = p.spinner();
					spinner.start("Executing tool...");
				} catch (e) {
					// Fallback if @clack/prompts not available
					console.log("Executing tool...");
				}
			}

			if (verbose) {
				try {
					const pc = require("picocolors");
					console.error(pc.cyan("\n🚀 Executing command:"));
					console.error(pc.white(command));
				} catch (e) {
					console.error("\n🚀 Executing command:");
					console.error(command);
				}
			}

			// Substitute template variables in command with input values
			let substitutedCommand = command;
			for (const [key, value] of Object.entries(inputs)) {
				const templateVar = `\${${key}}`;
				// Handle different value types
				let substitutionValue: string;
				if (typeof value === "string") {
					substitutionValue = value;
				} else if (typeof value === "object") {
					substitutionValue = JSON.stringify(value);
				} else {
					substitutionValue = String(value);
				}
				substitutedCommand = substitutedCommand.replace(
					new RegExp(`\\$\\{${key}\\}`, "g"),
					substitutionValue,
				);
			}

			// Prepare environment
			const env = {
				...process.env,
				...environment.vars,
			};

			// Parse command and arguments properly handling quoted strings
			const commandParts = this.parseCommand(substitutedCommand);
			const cmd = commandParts[0];
			const args = commandParts.slice(1);

			logger.info(`Executing command: ${command}`);

			try {
				const proc = spawn(cmd, args, {
					env,
					stdio: ["pipe", "pipe", "pipe"],
					// Create a new process group for better cleanup of child processes
					detached: process.platform !== "win32",
				});

				// Cleanup function to ensure process and children are properly terminated
				let isCleanedUp = false;
				let cleanupTimer: ReturnType<typeof setTimeout> | null = null;

				const cleanup = () => {
					if (isCleanedUp) return;
					isCleanedUp = true;

					// Clear any pending cleanup timer
					if (cleanupTimer) {
						clearTimeout(cleanupTimer);
						cleanupTimer = null;
					}

					if (proc && !proc.killed) {
						try {
							logger.debug(`Cleaning up process PID: ${proc.pid}`);
							// For Dagger and other tools that may spawn child processes
							if (process.platform === "win32") {
								proc.kill("SIGKILL");
							} else {
								// Try graceful termination first
								proc.kill("SIGTERM");
								// Set a cleanup timer for force kill if needed
								cleanupTimer = setTimeout(() => {							if (!proc.killed && !isCleanedUp) {
								logger.debug(
									`Force killing process PID: ${proc.pid}`,
								);
								try {
									proc.kill("SIGKILL");
								} catch (killError) {
									// Process might already be dead, ignore
									logger.debug(
										`Force kill error (likely harmless): ${killError}`,
									);
								}
							}
									cleanupTimer = null;
								}, 1000); // Reduced from 2000ms to 1000ms
							}
						} catch (killError) {
							// Process might already be dead, ignore
							logger.debug(
								`Process cleanup error (likely harmless): ${killError}`,
							);
						}
					}
				};

				// Collect stdout and stream it in real-time
				proc.stdout.on("data", (data: Buffer) => {
					const chunk = data.toString();
					stdout += chunk;
					// Stream stdout to console in real-time if enabled
					if (streamOutput) {
						process.stdout.write(chunk);
					}
				});

				// Collect stderr and stream it in real-time
				proc.stderr.on("data", (data: Buffer) => {
					const chunk = data.toString();
					stderr += chunk;
					// Stream stderr to console in real-time if enabled
					if (streamOutput) {
						process.stderr.write(chunk);
					}
				});
				// Handle process completion with more robust cleanup
				proc.on("close", (code: number) => {
					logger.debug(
						`Process closed with code: ${code}, PID: ${proc.pid}`,
					);
					// Force cleanup any remaining resources
					cleanup();

					// Handle spinner cleanup and success/error messaging
					if (spinner) {
						spinner.stop("Execution completed");
					}

					if (code === 0) {
						if (showSpinner || verbose) {
							try {
								const pc = require("picocolors");
								console.error(pc.green("\n✅ Tool executed successfully"));
								if (stdout.trim() && !streamOutput) {
									console.error(pc.cyan("\n📤 Output:"));
									console.error(stdout.trim());
								}
							} catch (e) {
								console.error("\n✅ Tool executed successfully");
								if (stdout.trim() && !streamOutput) {
									console.error("\n📤 Output:");
									console.error(stdout.trim());
								}
							}
						}
					} else {
						if (showSpinner || verbose) {
							try {
								const pc = require("picocolors");
								console.error(
									pc.red(`\n❌ Tool execution failed (exit code: ${code})`),
								);
								if (stderr.trim() && !streamOutput) {
									console.error(pc.red("\n📤 Error output:"));
									console.error(stderr.trim());
								}
								if (stdout.trim() && !streamOutput) {
									console.error(pc.yellow("\n📤 Standard output:"));
									console.error(stdout.trim());
								}
							} catch (e) {
								console.error(
									`\n❌ Tool execution failed (exit code: ${code})`,
								);
								if (stderr.trim() && !streamOutput) {
									console.error("\n📤 Error output:");
									console.error(stderr.trim());
								}
								if (stdout.trim() && !streamOutput) {
									console.error("\n📤 Standard output:");
									console.error(stdout.trim());
								}
							}
						}
					}

					resolve({
						stdout: stdout.trim(),
						stderr: stderr.trim(),
						exitCode: code || 0,
					});
				});

				// Handle process errors
				proc.on("error", (error: Error) => {
					cleanup();
					if (spinner) {
						spinner.stop("Execution failed");
					}

					if (showSpinner || verbose) {
						try {
							const pc = require("picocolors");
							console.error(
								pc.red(`\n❌ Failed to execute command: ${error.message}`),
							);
						} catch (e) {
							console.error(`\n❌ Failed to execute command: ${error.message}`);
						}
					}

					reject(new Error(`Command execution error: ${error.message}`));
				});

				// Set timeout if specified
				if (timeout) {
					const timeoutMs = parseTimeout(timeout);
					setTimeout(() => {
						cleanup();
						if (spinner) {
							spinner.stop("Execution failed");
						}
						reject(new Error(`Command timed out after ${timeout}`));
					}, timeoutMs);
				}
			} catch (spawnError) {
				reject(new Error(`Failed to spawn command: ${spawnError}`));
			}
		});
	}

	/**
	 * Execute command with exec.ts compatible interface
	 * This method provides the same interface as the exec.ts executeCommand function
	 */
	async executeCommandExecStyle(
		command: string,
		timeout: string,
		verbose: boolean = false,
		envVars: Record<string, string> = {},
	): Promise<void> {
		const environment: ExecutionEnvironment = {
			vars: envVars,
			resources: { timeout },
		};

		const result = await this.executeCommand(
			command,
			{}, // No template substitution needed for this interface
			environment,
			timeout,
			{
				verbose,
				showSpinner: true,
				streamOutput: false, // Don't stream since exec.ts shows output at the end
			},
		);

		if (result.exitCode !== 0) {
			throw new Error(`Command failed with exit code ${result.exitCode}`);
		}
	}

	async setup(tool: EnactTool): Promise<boolean> {
		// No special setup needed for direct execution
		logger.debug(`Setting up direct execution for tool: ${tool.name}`);
		return true;
	}

	async execute(
		tool: EnactTool,
		inputs: Record<string, any>,
		environment: ExecutionEnvironment,
	): Promise<ExecutionResult> {
		const executionId = this.generateExecutionId();
		const timeout = tool.timeout || environment.resources?.timeout;

		// Substitute template variables in command with input values
		let substitutedCommand = tool.command;
		for (const [key, value] of Object.entries(inputs)) {
			const templateVar = `\${${key}}`;
			// Handle different value types
			let substitutionValue: string;
			if (typeof value === "string") {
				substitutionValue = value;
			} else if (typeof value === "object") {
				substitutionValue = JSON.stringify(value);
			} else {
				substitutionValue = String(value);
			}
			substitutedCommand = substitutedCommand.replace(
				new RegExp(`\\$\\{${key}\\}`, "g"),
				substitutionValue,
			);
		}

		try {
			// Execute the command
			const result = await this.executeCommand(
				substitutedCommand,
				inputs,
				environment,
				timeout,
			);

			// Parse output
			let parsedOutput: any;
			try {
				// Try to parse as JSON first
				parsedOutput = JSON.parse(result.stdout);
			} catch {
				// If not JSON, return structured output
				parsedOutput = {
					stdout: result.stdout,
					stderr: result.stderr,
				};
			}

			return {
				success: result.exitCode === 0,
				output: parsedOutput,
				...(result.exitCode !== 0 && {
					error: {
						message: `Command failed with exit code ${result.exitCode}`,
						code: "COMMAND_FAILED",
						details: {
							stdout: result.stdout,
							stderr: result.stderr,
							command: substitutedCommand, // Show the substituted command
							exitCode: result.exitCode,
						},
					},
				}),
				metadata: {
					executionId,
					toolName: tool.name,
					version: tool.version,
					executedAt: new Date().toISOString(),
					environment: "direct",
					timeout,
					command: substitutedCommand, // Show the substituted command in metadata
				},
			};
		} catch (error) {
			return {
				success: false,
				error: {
					message: (error as Error).message,
					code: "EXECUTION_ERROR",
					details: error,
				},
				metadata: {
					executionId,
					toolName: tool.name,
					version: tool.version,
					executedAt: new Date().toISOString(),
					environment: "direct",
				},
			};
		}
	}

	async cleanup(): Promise<boolean> {
		// No cleanup needed for direct execution
		return true;
	}

	private generateExecutionId(): string {
		return `exec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
	}

	private parseCommand(command: string): string[] {
		const parts: string[] = [];
		let current = "";
		let inQuotes = false;
		let quoteChar = "";
		let i = 0;

		while (i < command.length) {
			const char = command[i];

			if (!inQuotes && (char === '"' || char === "'")) {
				// Start of quoted section
				inQuotes = true;
				quoteChar = char;
			} else if (inQuotes && char === quoteChar) {
				// End of quoted section
				inQuotes = false;
				quoteChar = "";
			} else if (!inQuotes && char === " ") {
				// Space outside quotes - end current part
				if (current.length > 0) {
					parts.push(current);
					current = "";
				}
				// Skip whitespace
				while (i + 1 < command.length && command[i + 1] === " ") {
					i++;
				}
			} else {
				// Regular character or space inside quotes
				current += char;
			}

			i++;
		}

		// Add the last part if it exists
		if (current.length > 0) {
			parts.push(current);
		}

		return parts;
	}
}

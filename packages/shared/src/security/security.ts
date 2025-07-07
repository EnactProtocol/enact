// src/security/security.ts - Simplified security module for CLI core
import logger from "../exec/logger";
import type { EnactTool } from "../types";

/**
 * Verify the signature of an Enact tool before execution
 * @param tool The tool to verify
 * @returns Boolean indicating validity
 */

/**
 * Verify that a command is safe to execute
 * @param command The command to verify
 * @param tool The tool containing the command
 * @returns Object with safety status and warnings
 */
export function verifyCommandSafety(
	command: string,
	tool: EnactTool,
): {
	isSafe: boolean;
	warnings: string[];
	blocked?: string[];
} {
	const warnings: string[] = [];
	const blocked: string[] = [];

	// Dangerous command patterns that should be blocked
	const dangerousPatterns = [
		/rm\s+-rf\s+\//, // rm -rf /
		/rm\s+-rf\s+\*/, // rm -rf *
		/>\s*\/dev\/sd[a-z]/, // Writing to disk devices
		/dd\s+if=.*of=\/dev/, // Direct disk writing
		/mkfs/, // Format filesystem
		/fdisk/, // Disk partitioning
		/passwd/, // Password changes
		/sudo\s+passwd/, // Password changes with sudo
		/chmod\s+777/, // Overly permissive permissions
		/curl.*\|\s*sh/, // Piping curl to shell
		/wget.*\|\s*sh/, // Piping wget to shell
		/exec\s+sh/, // Executing shell
		/\/etc\/passwd/, // Accessing password file
		/\/etc\/shadow/, // Accessing shadow file
	];

	// Check for dangerous patterns
	for (const pattern of dangerousPatterns) {
		if (pattern.test(command)) {
			blocked.push(
				`Potentially dangerous command pattern detected: ${pattern.source}`,
			);
		}
	}

	// Warning patterns that are suspicious but not necessarily blocked
	const warningPatterns = [
		/sudo\s+/, // Sudo usage
		/su\s+/, // User switching
		/systemctl/, // System service control
		/service\s+/, // Service control
		/mount/, // Mounting filesystems
		/umount/, // Unmounting filesystems
		/iptables/, // Firewall rules
		/crontab/, // Cron job management
	];

	// Check for warning patterns
	for (const pattern of warningPatterns) {
		if (pattern.test(command)) {
			warnings.push(
				`Potentially privileged operation detected: ${pattern.source}`,
			);
		}
	}

	// Check for version pinning (security best practice)
	if (command.includes("npx ") && !command.match(/npx\s+[^@#\s]+[@#]/)) {
		if (!command.includes("github:")) {
			warnings.push(
				"NPX package not version-pinned - consider using @version or github:org/repo#commit",
			);
		}
	}

	if (
		command.includes("uvx ") &&
		!command.includes("git+") &&
		!command.includes("@")
	) {
		warnings.push(
			"UVX package not version-pinned - consider using @version or git+ URL",
		);
	}

	if (
		command.includes("docker run") &&
		!command.match(/:[^@\s]+(@sha256:|:\w)/)
	) {
		warnings.push(
			"Docker image not version-pinned - consider using specific tags or digests",
		);
	}

	// Check for network access patterns
	if (tool.annotations?.openWorldHint !== true) {
		const networkPatterns = [
			/curl\s+/, // HTTP requests
			/wget\s+/, // HTTP requests
			/http[s]?:\/\//, // HTTP URLs
			/ftp:\/\//, // FTP URLs
			/ssh\s+/, // SSH connections
			/scp\s+/, // SCP transfers
			/rsync.*::/, // Rsync over network
		];

		for (const pattern of networkPatterns) {
			if (pattern.test(command)) {
				warnings.push(
					"Network access detected but openWorldHint not set to true",
				);
				break;
			}
		}
	}

	// Check for destructive operations
	if (tool.annotations?.destructiveHint !== true) {
		const destructivePatterns = [
			/rm\s+/, // File removal
			/rmdir\s+/, // Directory removal
			/mv\s+.*\s+\/dev\//, // Moving to device files
			/>\s*[^&]/, // File redirection (overwriting)
			/tee\s+/, // Writing to files
		];

		for (const pattern of destructivePatterns) {
			if (pattern.test(command)) {
				warnings.push(
					"Potentially destructive operation detected but destructiveHint not set to true",
				);
				break;
			}
		}
	}

	return {
		isSafe: blocked.length === 0,
		warnings,
		...(blocked.length > 0 && { blocked }),
	};
}

/**
 * Sanitize environment variables to prevent injection attacks
 * @param envVars Environment variables to sanitize
 * @returns Sanitized environment variables
 */
export function sanitizeEnvironmentVariables(
	envVars: Record<string, any>,
): Record<string, string> {
	const sanitized: Record<string, string> = {};

	for (const [key, value] of Object.entries(envVars)) {
		// Validate environment variable name
		if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
			logger.warn(`Invalid environment variable name: ${key}`);
			continue;
		}

		// Convert value to string and sanitize
		const strValue = String(value);

		// Check for potentially dangerous characters
		if (strValue.includes("\n") || strValue.includes("\r")) {
			logger.warn(`Environment variable ${key} contains newline characters`);
		}

		if (strValue.includes("$(") || strValue.includes("`")) {
			logger.warn(
				`Environment variable ${key} contains command substitution patterns`,
			);
		}

		sanitized[key] = strValue;
	}

	return sanitized;
}

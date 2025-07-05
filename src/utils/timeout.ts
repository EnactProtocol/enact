// src/utils/timeout.ts - Shared timeout parsing utility

/**
 * Parse timeout string to milliseconds
 * Supports formats like "30s", "5m", "2h"
 */
export function parseTimeout(timeout: string): number {
	const match = timeout.match(/^(\d+)([smh])$/);
	if (!match) {
		return 30000; // Default 30 seconds
	}

	const value = parseInt(match[1]);
	const unit = match[2];

	switch (unit) {
		case "s":
			return value * 1000;
		case "m":
			return value * 60 * 1000;
		case "h":
			return value * 60 * 60 * 1000;
		default:
			return 30000; // Default fallback
	}
}

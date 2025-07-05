// src/utils/logger.ts
import pc from "picocolors";

export enum LogLevel {
	DEBUG = 0,
	INFO = 1,
	SUCCESS = 2,
	WARN = 3,
	ERROR = 4,
}

// Default log level
let currentLogLevel = LogLevel.INFO;

/**
 * Sets the current log level
 */
export function setLogLevel(level: LogLevel): void {
	currentLogLevel = level;
}

/**
 * Debug log - only shown when log level is DEBUG
 */
export function debug(message: string): void {
	if (currentLogLevel <= LogLevel.DEBUG) {
		console.error(pc.dim(`🔍 ${message}`));
	}
}

/**
 * Info log - general information
 */
export function info(message: string): void {
	if (currentLogLevel <= LogLevel.INFO) {
		console.error(pc.blue(`ℹ️ ${message}`));
	}
}

/**
 * Success log - operation completed successfully
 */
export function success(message: string): void {
	if (currentLogLevel <= LogLevel.SUCCESS) {
		console.error(pc.green(`✓ ${message}`));
	}
}

/**
 * Warning log - non-critical issues
 */
export function warn(message: string): void {
	if (currentLogLevel <= LogLevel.WARN) {
		console.error(pc.yellow(`⚠️ ${message}`));
	}
}

/**
 * Error log - critical issues
 */
export function error(message: string, details?: any): void {
	if (currentLogLevel <= LogLevel.ERROR) {
		console.error(pc.red(`✗ Error: ${message}`));

		if (details && currentLogLevel === LogLevel.DEBUG) {
			console.error(pc.dim("Details:"));
			console.error(details);
		}
	}
}

/**
 * Table log - display tabular data
 */
export function table(data: any[], columns?: string[]): void {
	if (currentLogLevel <= LogLevel.INFO) {
		if (columns) {
			console.table(data, columns);
		} else {
			console.table(data);
		}
	}
}

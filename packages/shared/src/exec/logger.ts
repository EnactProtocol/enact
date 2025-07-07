import pino from "pino";

// Determine if the environment is silent (e.g., CI, testing, or specific env var)
const isSilentMode =
	() =>
		process.env.CI === "true" ||
		process.env.NODE_ENV === "test" ||
		process.env.ENACT_SILENT === "true" ||
		process.env.ENACT_SKIP_INTERACTIVE === "true";

// Base logger configuration
const logger = pino({
	level: process.env.LOG_LEVEL || "info",
	// In tests, we don't want the pretty transport, as it adds noise.
	// The output is captured anyway.
	...(process.env.NODE_ENV !== "test" && {
		transport: {
			target: "pino-pretty",
			options: {
				colorize: true,
				ignore: "pid,hostname",
				translateTime: "SYS:standard",
			},
		},
	}),
});

// Wrapper to dynamically check silent mode on each call
const wrappedLogger = {
	info: (...args: Parameters<typeof logger.info>) => {
		if (!isSilentMode()) {
			logger.info(...args);
		}
	},
	warn: (...args: Parameters<typeof logger.warn>) => {
		if (!isSilentMode()) {
			logger.warn(...args);
		}
	},
	error: (...args: Parameters<typeof logger.error>) => {
		// The silent tests expect errors to be silent too.
		if (!isSilentMode()) {
			logger.error(...args);
		}
	},
	debug: (...args: Parameters<typeof logger.debug>) => {
		if (!isSilentMode() && (process.env.DEBUG || process.env.VERBOSE)) {
			logger.debug(...args);
		}
	},
	// Expose a way to check if client logging is enabled (for MCP)
	clientLoggingEnabled: () => !process.env.ENACT_MCP_CLIENT,
	isLevelEnabled: (level: string) => {
		if (isSilentMode()) {
			return false;
		}
		return logger.isLevelEnabled(level);
	},
	// Keep original pino instance available if needed
	pino: logger,
};

export default wrappedLogger;

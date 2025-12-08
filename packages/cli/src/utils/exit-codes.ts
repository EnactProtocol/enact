/**
 * Exit codes for CLI commands
 *
 * Standardized exit codes following Unix conventions:
 * - 0: Success
 * - 1: General error
 * - 2: Misuse of shell command (invalid args)
 * - 64-78: BSD sysexits.h codes
 * - 128+: Signal-based exits
 *
 * @see https://www.freebsd.org/cgi/man.cgi?query=sysexits
 */

/** Success - command completed successfully */
export const EXIT_SUCCESS = 0;

/** General error - unspecified failure */
export const EXIT_FAILURE = 1;

/** Usage error - invalid command line arguments */
export const EXIT_USAGE = 2;

/** Data error - input data was incorrect */
export const EXIT_DATAERR = 65;

/** No input - input file did not exist or was not readable */
export const EXIT_NOINPUT = 66;

/** No user - user does not exist */
export const EXIT_NOUSER = 67;

/** No host - host does not exist */
export const EXIT_NOHOST = 68;

/** Service unavailable - a required service is unavailable */
export const EXIT_UNAVAILABLE = 69;

/** Software error - internal error */
export const EXIT_SOFTWARE = 70;

/** OS error - system error */
export const EXIT_OSERR = 71;

/** OS file - system file missing or not creatable */
export const EXIT_OSFILE = 72;

/** Can't create - output file cannot be created */
export const EXIT_CANTCREAT = 73;

/** I/O error - input/output error */
export const EXIT_IOERR = 74;

/** Temp failure - temporary failure, try again */
export const EXIT_TEMPFAIL = 75;

/** Protocol error - remote error in protocol */
export const EXIT_PROTOCOL = 76;

/** No permission - permission denied */
export const EXIT_NOPERM = 77;

/** Configuration error - configuration error */
export const EXIT_CONFIG = 78;

// ============================================================================
// Enact-specific exit codes (100-119)
// ============================================================================

/** Tool not found */
export const EXIT_TOOL_NOT_FOUND = 100;

/** Manifest error - invalid or missing manifest */
export const EXIT_MANIFEST_ERROR = 101;

/** Execution error - tool execution failed */
export const EXIT_EXECUTION_ERROR = 102;

/** Timeout error - operation timed out */
export const EXIT_TIMEOUT = 103;

/** Trust error - trust verification failed */
export const EXIT_TRUST_ERROR = 104;

/** Registry error - registry communication failed */
export const EXIT_REGISTRY_ERROR = 105;

/** Authentication error - not authenticated or token expired */
export const EXIT_AUTH_ERROR = 106;

/** Validation error - input validation failed */
export const EXIT_VALIDATION_ERROR = 107;

/** Network error - network communication failed */
export const EXIT_NETWORK_ERROR = 108;

/** Container error - container runtime error */
export const EXIT_CONTAINER_ERROR = 109;

// ============================================================================
// Exit code descriptions
// ============================================================================

const EXIT_CODE_DESCRIPTIONS: Record<number, string> = {
  [EXIT_SUCCESS]: "Success",
  [EXIT_FAILURE]: "General error",
  [EXIT_USAGE]: "Invalid command line arguments",
  [EXIT_DATAERR]: "Input data was incorrect",
  [EXIT_NOINPUT]: "Input file not found or not readable",
  [EXIT_NOUSER]: "User not found",
  [EXIT_NOHOST]: "Host not found",
  [EXIT_UNAVAILABLE]: "Service unavailable",
  [EXIT_SOFTWARE]: "Internal software error",
  [EXIT_OSERR]: "System error",
  [EXIT_OSFILE]: "System file missing",
  [EXIT_CANTCREAT]: "Cannot create output file",
  [EXIT_IOERR]: "I/O error",
  [EXIT_TEMPFAIL]: "Temporary failure, try again",
  [EXIT_PROTOCOL]: "Protocol error",
  [EXIT_NOPERM]: "Permission denied",
  [EXIT_CONFIG]: "Configuration error",
  [EXIT_TOOL_NOT_FOUND]: "Tool not found",
  [EXIT_MANIFEST_ERROR]: "Manifest error",
  [EXIT_EXECUTION_ERROR]: "Tool execution failed",
  [EXIT_TIMEOUT]: "Operation timed out",
  [EXIT_TRUST_ERROR]: "Trust verification failed",
  [EXIT_REGISTRY_ERROR]: "Registry error",
  [EXIT_AUTH_ERROR]: "Authentication error",
  [EXIT_VALIDATION_ERROR]: "Validation error",
  [EXIT_NETWORK_ERROR]: "Network error",
  [EXIT_CONTAINER_ERROR]: "Container runtime error",
};

/**
 * Get description for an exit code
 */
export function getExitCodeDescription(code: number): string {
  return EXIT_CODE_DESCRIPTIONS[code] ?? `Unknown error (code ${code})`;
}

/**
 * Exit with a specific code
 */
export function exit(code: number): never {
  process.exit(code);
}

/**
 * Exit with success
 */
export function exitSuccess(): never {
  process.exit(EXIT_SUCCESS);
}

/**
 * Exit with failure
 */
export function exitFailure(): never {
  process.exit(EXIT_FAILURE);
}

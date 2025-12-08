/**
 * Error handling utilities
 */

import type { ApiError } from "../types.ts";

/**
 * Standard error codes
 */
export const ErrorCodes = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  VERSION_YANKED: "VERSION_YANKED",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  NAMESPACE_MISMATCH: "NAMESPACE_MISMATCH",
  BUNDLE_TOO_LARGE: "BUNDLE_TOO_LARGE",
  ATTESTATION_VERIFICATION_FAILED: "ATTESTATION_VERIFICATION_FAILED",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * HTTP status codes for errors
 */
export const ErrorStatusCodes: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VERSION_YANKED: 410,
  VALIDATION_ERROR: 422,
  NAMESPACE_MISMATCH: 403,
  BUNDLE_TOO_LARGE: 413,
  ATTESTATION_VERIFICATION_FAILED: 422,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

/**
 * Create an API error object
 */
export function createError(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>
): ApiError {
  return {
    code,
    message,
    ...(details && { details }),
  };
}

/**
 * Create an error response
 */
export function errorResponse(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>
): Response {
  const error = createError(code, message, details);
  const status = ErrorStatusCodes[code];

  return new Response(JSON.stringify({ error }), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

/**
 * Error response helpers
 */
export const Errors = {
  unauthorized: (message = "Unauthorized") => errorResponse(ErrorCodes.UNAUTHORIZED, message),

  forbidden: (message = "Forbidden") => errorResponse(ErrorCodes.FORBIDDEN, message),

  notFound: (message: string, details?: Record<string, unknown>) =>
    errorResponse(ErrorCodes.NOT_FOUND, message, details),

  conflict: (message: string, details?: Record<string, unknown>) =>
    errorResponse(ErrorCodes.CONFLICT, message, details),

  versionYanked: (message: string, reason?: string, replacement?: string) =>
    errorResponse(ErrorCodes.VERSION_YANKED, message, {
      reason,
      replacement,
    }),

  validation: (message: string, details?: Record<string, unknown>) =>
    errorResponse(ErrorCodes.VALIDATION_ERROR, message, details),

  namespaceMismatch: (toolNamespace: string, userNamespace: string) =>
    errorResponse(
      ErrorCodes.NAMESPACE_MISMATCH,
      `Tool namespace "${toolNamespace}" does not match your username "${userNamespace}". You can only publish tools under your own namespace.`,
      { toolNamespace, userNamespace }
    ),

  bundleTooLarge: (size: number, maxSize: number) =>
    errorResponse(
      ErrorCodes.BUNDLE_TOO_LARGE,
      `Bundle size ${size} bytes exceeds maximum ${maxSize} bytes`,
      { size, maxSize }
    ),

  attestationFailed: (message: string, details?: Record<string, unknown>) =>
    errorResponse(ErrorCodes.ATTESTATION_VERIFICATION_FAILED, message, details),

  rateLimited: (message = "Rate limit exceeded") => errorResponse(ErrorCodes.RATE_LIMITED, message),

  internal: (message = "Internal server error") =>
    errorResponse(ErrorCodes.INTERNAL_ERROR, message),
};

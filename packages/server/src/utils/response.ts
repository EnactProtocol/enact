/**
 * Response utilities
 */

import type { ApiResponse, PaginationMeta } from "../types.ts";

/**
 * Create a successful JSON response
 */
export function jsonResponse<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

/**
 * Create a successful API response
 */
export function successResponse<T>(data: T, status = 200): Response {
  const response: ApiResponse<T> = { data };
  return jsonResponse(response, status);
}

/**
 * Create a paginated response
 */
export function paginatedResponse<T>(items: T[], meta: PaginationMeta, status = 200): Response {
  return jsonResponse(
    {
      data: items,
      meta,
    },
    status
  );
}

/**
 * Create a created response (201)
 */
export function createdResponse<T>(data: T): Response {
  return jsonResponse(data, 201);
}

/**
 * Create a no content response (204)
 */
export function noContentResponse(): Response {
  return new Response(null, {
    status: 204,
  });
}

/**
 * CORS headers for responses
 */
export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

/**
 * Add CORS headers to response
 */
export function addCorsHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Handle CORS preflight
 */
export function corsPreflightResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

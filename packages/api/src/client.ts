/**
 * Enact Registry API Client
 * Core HTTP client for interacting with the Enact registry
 */

import type { ApiError, RateLimitInfo } from "./types";

/**
 * Default registry URL
 */
export const DEFAULT_REGISTRY_URL = "https://siikwkfgsmouioodghho.supabase.co/functions/v1";

/**
 * Default Supabase anon key - required for all Edge Function requests
 */
const DEFAULT_SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpaWt3a2Znc21vdWlvb2RnaGhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2MTkzMzksImV4cCI6MjA4MDE5NTMzOX0.kxnx6-IPFhmGx6rzNx36vbyhFMFZKP_jFqaDbKnJ_E0";

/**
 * API client configuration options
 */
export interface ApiClientOptions {
  /** Registry base URL (default: https://siikwkfgsmouioodghho.supabase.co/functions/v1) */
  baseUrl?: string | undefined;
  /** Authentication token */
  authToken?: string | undefined;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number | undefined;
  /** Number of retry attempts for failed requests (default: 3) */
  retries?: number | undefined;
  /** User agent string */
  userAgent?: string | undefined;
}

/**
 * API response wrapper
 */
export interface ApiResponse<T> {
  /** Response data */
  data: T;
  /** HTTP status code */
  status: number;
  /** Rate limit information */
  rateLimit?: RateLimitInfo | undefined;
}

/**
 * API request error
 */
export class ApiRequestError extends Error {
  /** HTTP status code */
  readonly status: number;
  /** API error code */
  readonly code: string;
  /** Original error response */
  readonly response?: ApiError | undefined;

  constructor(message: string, status: number, code: string, response?: ApiError) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
    this.response = response;
  }
}

/**
 * Parse rate limit headers from response
 */
function parseRateLimitHeaders(headers: Headers): RateLimitInfo | undefined {
  const limit = headers.get("X-RateLimit-Limit");
  const remaining = headers.get("X-RateLimit-Remaining");
  const reset = headers.get("X-RateLimit-Reset");

  if (limit && remaining && reset) {
    return {
      limit: Number.parseInt(limit, 10),
      remaining: Number.parseInt(remaining, 10),
      reset: Number.parseInt(reset, 10),
    };
  }

  return undefined;
}

/**
 * Enact Registry API Client
 */
export class EnactApiClient {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly userAgent: string;
  private authToken: string | undefined;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? DEFAULT_REGISTRY_URL;
    this.timeout = options.timeout ?? 30000;
    this.maxRetries = options.retries ?? 3;
    this.userAgent = options.userAgent ?? "enact-cli/0.1.0";
    this.authToken = options.authToken;
  }

  /**
   * Set authentication token
   */
  setAuthToken(token: string | undefined): void {
    this.authToken = token;
  }

  /**
   * Get current authentication token
   */
  getAuthToken(): string | undefined {
    return this.authToken;
  }

  /**
   * Get the base URL for the registry
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Get the user agent string
   */
  getUserAgent(): string {
    return this.userAgent;
  }

  /**
   * Check if client is authenticated
   */
  isAuthenticated(): boolean {
    return this.authToken !== undefined;
  }

  /**
   * Build headers for a request
   */
  private buildHeaders(contentType?: string): Headers {
    const headers = new Headers();
    headers.set("User-Agent", this.userAgent);
    headers.set("Accept", "application/json");

    if (contentType) {
      headers.set("Content-Type", contentType);
    }

    // Supabase Edge Functions require BOTH apikey and Authorization headers
    // Always use the anon key for apikey header
    headers.set("apikey", DEFAULT_SUPABASE_ANON_KEY);

    // Authorization header uses auth token if available, otherwise anon key
    headers.set("Authorization", `Bearer ${this.authToken ?? DEFAULT_SUPABASE_ANON_KEY}`);

    return headers;
  }

  /**
   * Make an HTTP request with retry logic
   */
  private async request<T>(
    method: string,
    path: string,
    options: {
      body?: unknown;
      contentType?: string;
      retryCount?: number;
    } = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${path}`;
    const retryCount = options.retryCount ?? 0;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: this.buildHeaders(options.contentType),
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const rateLimit = parseRateLimitHeaders(response.headers);

      // Handle rate limiting with retry
      if (response.status === 429 && retryCount < this.maxRetries) {
        const retryAfter = response.headers.get("Retry-After");
        const delay = retryAfter ? Number.parseInt(retryAfter, 10) * 1000 : 1000 * (retryCount + 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.request<T>(method, path, { ...options, retryCount: retryCount + 1 });
      }

      // Handle error responses
      if (!response.ok) {
        let errorData: ApiError | undefined;
        try {
          errorData = (await response.json()) as ApiError;
        } catch {
          // Response body might not be JSON
        }

        const code = errorData?.error?.code ?? "unknown";
        const message = errorData?.error?.message ?? `HTTP ${response.status}`;

        throw new ApiRequestError(message, response.status, code, errorData);
      }

      // Handle 204 No Content
      if (response.status === 204) {
        return {
          data: undefined as T,
          status: response.status,
          rateLimit,
        };
      }

      // Parse JSON response
      let data: T;
      try {
        const text = await response.text();
        if (!text || text.trim() === "") {
          throw new ApiRequestError(
            "Server returned empty response",
            response.status,
            "empty_response"
          );
        }
        data = JSON.parse(text) as T;
      } catch (parseError) {
        if (parseError instanceof ApiRequestError) {
          throw parseError;
        }
        throw new ApiRequestError(
          "Server returned invalid JSON response",
          response.status,
          "invalid_json"
        );
      }

      return { data, status: response.status, rateLimit };
    } catch (error) {
      clearTimeout(timeoutId);

      // Handle network errors with retry
      if (error instanceof Error && error.name === "AbortError") {
        if (retryCount < this.maxRetries) {
          const delay = 1000 * (retryCount + 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
          return this.request<T>(method, path, { ...options, retryCount: retryCount + 1 });
        }
        throw new ApiRequestError("Request timeout", 0, "timeout");
      }

      // Re-throw ApiRequestErrors
      if (error instanceof ApiRequestError) {
        throw error;
      }

      // Wrap other errors
      throw new ApiRequestError(
        error instanceof Error ? error.message : "Unknown error",
        0,
        "network_error"
      );
    }
  }

  /**
   * GET request
   */
  async get<T>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>("GET", path);
  }

  /**
   * POST request
   */
  async post<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>("POST", path, {
      body,
      contentType: "application/json",
    });
  }

  /**
   * PUT request
   */
  async put<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>("PUT", path, {
      body,
      contentType: "application/json",
    });
  }

  /**
   * DELETE request
   */
  async delete<T>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>("DELETE", path);
  }

  /**
   * Download a file (returns raw response for streaming)
   */
  async download(path: string): Promise<Response> {
    const url = `${this.baseUrl}${path}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout * 10); // Longer timeout for downloads

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: this.buildHeaders(),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new ApiRequestError(
          `Download failed: HTTP ${response.status}`,
          response.status,
          "download_error"
        );
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof ApiRequestError) {
        throw error;
      }

      throw new ApiRequestError(
        error instanceof Error ? error.message : "Download failed",
        0,
        "download_error"
      );
    }
  }
}

/**
 * Create a new API client instance
 */
export function createApiClient(options?: ApiClientOptions): EnactApiClient {
  return new EnactApiClient(options);
}

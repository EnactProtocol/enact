/**
 * Mock HTTP server for API tests
 * Simulates the Enact registry API
 */

import type {
  AttestationResponse,
  CurrentUser,
  FeedbackAggregates,
  PublishResponse,
  ToolMetadata,
  ToolSearchResult,
  ToolVersionDetails,
} from "../../src/types";

/**
 * The Supabase anon key - used to identify public/anonymous requests
 * Requests with this key should not be treated as authenticated users
 */
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpaWt3a2Znc21vdWlvb2RnaGhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2MTkzMzksImV4cCI6MjA4MDE5NTMzOX0.kxnx6-IPFhmGx6rzNx36vbyhFMFZKP_jFqaDbKnJ_E0";

/**
 * Mock tool data (v2 format with full ToolMetadata shape)
 */
export const MOCK_TOOLS: Record<string, ToolMetadata> = {
  "alice/utils/greeter": {
    name: "alice/utils/greeter",
    description: "Greets the user by name",
    tags: ["utility", "text"],
    license: "MIT",
    author: { username: "alice", avatar_url: "https://enact.tools/avatars/alice.png" },
    created_at: "2025-01-10T10:30:00Z",
    updated_at: "2025-01-15T14:20:00Z",
    latest_version: "1.2.0",
    versions: [
      {
        version: "1.2.0",
        published_at: "2025-01-15T14:20:00Z",
        downloads: 450,
        bundle_hash: "sha256:abc123def456",
        yanked: false,
      },
      {
        version: "1.1.0",
        published_at: "2025-01-12T10:00:00Z",
        downloads: 200,
        bundle_hash: "sha256:def456abc123",
        yanked: false,
      },
      {
        version: "1.0.0",
        published_at: "2025-01-10T10:30:00Z",
        downloads: 100,
        bundle_hash: "sha256:ghi789xyz012",
        yanked: false,
      },
    ],
    versions_total: 3,
    total_downloads: 750,
  },
  "bob/data/csv-parser": {
    name: "bob/data/csv-parser",
    description: "Parse CSV files with custom delimiters",
    tags: ["data", "csv", "parser"],
    license: "Apache-2.0",
    author: { username: "bob" },
    created_at: "2025-01-05T08:00:00Z",
    updated_at: "2025-01-12T16:45:00Z",
    latest_version: "2.0.0",
    versions: [
      {
        version: "2.0.0",
        published_at: "2025-01-12T16:45:00Z",
        downloads: 1203,
        bundle_hash: "sha256:xyz789abc012",
        yanked: false,
      },
      {
        version: "1.0.0",
        published_at: "2025-01-05T08:00:00Z",
        downloads: 500,
        bundle_hash: "sha256:abc789xyz012",
        yanked: false,
      },
    ],
    versions_total: 2,
    total_downloads: 1703,
  },
};

/**
 * Mock version data (v2 format with full ToolVersionDetails shape)
 */
export const MOCK_VERSIONS: Record<string, ToolVersionDetails> = {
  "alice/utils/greeter@1.2.0": {
    name: "alice/utils/greeter",
    version: "1.2.0",
    description: "Greets the user by name",
    license: "MIT",
    yanked: false,
    manifest: {
      enact: "2.0.0",
      name: "alice/utils/greeter",
      version: "1.2.0",
      description: "Greets the user by name",
      from: "alpine:latest",
      command: "echo 'Hello, ${name}!'",
      timeout: "30s",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string" },
        },
        required: ["name"],
      },
    },
    rawManifest: `---
enact: 2.0.0
name: alice/utils/greeter
version: 1.2.0
description: Greets the user by name
license: MIT
from: alpine:latest
command: echo 'Hello, \${name}!'
timeout: 30s
inputSchema:
  type: object
  properties:
    name:
      type: string
  required:
    - name
---

# Greeter Tool

A simple tool that greets users by name.

## Usage

\`\`\`bash
enact run alice/utils/greeter --name "World"
\`\`\`

## Examples

- Greet a user: \`enact run alice/utils/greeter --name "Alice"\`
`,
    bundle: {
      hash: "sha256:abc123def456",
      size: 1024,
      download_url: "https://cdn.enact.tools/bundles/alice/utils/greeter/1.2.0.tar.gz",
    },
    attestations: [
      {
        auditor: "security@example.com",
        auditor_provider: "github",
        signed_at: "2025-01-16T09:30:00Z",
        rekor_log_id: "mock-log-id",
        rekor_log_index: 123789,
        verification: {
          verified: true,
          verified_at: "2025-01-16T09:31:00Z",
          rekor_verified: true,
          certificate_verified: true,
          signature_verified: true,
        },
      },
    ],
    published_by: { username: "alice", avatar_url: "https://enact.tools/avatars/alice.png" },
    published_at: "2025-01-15T14:20:00Z",
    downloads: 450,
  },
  "bob/data/csv-parser@2.0.0": {
    name: "bob/data/csv-parser",
    version: "2.0.0",
    description: "Parse CSV files with custom delimiters",
    license: "Apache-2.0",
    yanked: false,
    manifest: {
      enact: "2.0.0",
      name: "bob/data/csv-parser",
      version: "2.0.0",
      description: "Parse CSV files with custom delimiters",
      from: "python:3.12-slim",
      command: "python /app/parse.py ${input_file}",
      timeout: "60s",
      inputSchema: {
        type: "object",
        properties: {
          input_file: { type: "string" },
          delimiter: { type: "string", default: "," },
        },
        required: ["input_file"],
      },
    },
    // No rawManifest for this tool - tests the case where rawManifest is not provided
    bundle: {
      hash: "sha256:xyz789abc012",
      size: 2048,
      download_url: "https://cdn.enact.tools/bundles/bob/data/csv-parser/2.0.0.tar.gz",
    },
    attestations: [],
    published_by: { username: "bob" },
    published_at: "2025-01-12T16:45:00Z",
    downloads: 1203,
  },
};

/**
 * Mock trust status (v2 - simplified structure)
 */
export const MOCK_TRUST: Record<string, unknown> = {
  "alice/utils/greeter@1.2.0": {
    name: "alice/utils/greeter",
    version: "1.2.0",
    bundle_hash: "sha256:abc123def456",
    attestations: [
      {
        auditor: "security@auditfirm.com",
        auditor_provider: "github",
        signed_at: "2025-01-16T09:30:00Z",
        rekor_log_id: "mock-log-id",
        rekor_log_index: 123789,
        verification: {
          verified: true,
          verified_at: "2025-01-16T09:31:00Z",
          rekor_verified: true,
          certificate_verified: true,
          signature_verified: true,
        },
      },
    ],
  },
};

/**
 * Mock users (v2 format with CurrentUser shape)
 */
export const MOCK_USERS: Record<string, CurrentUser> = {
  alice: {
    id: "user-alice-123",
    username: "alice",
    email: "alice@example.com",
    namespaces: ["alice", "alice-org"],
    created_at: "2024-06-15T10:00:00Z",
  },
};

/**
 * Mock search results (v2 - includes author and trust_status)
 */
export function mockSearchResults(query: string, tags?: string): ToolSearchResult[] {
  const allTools: ToolSearchResult[] = [
    {
      name: "alice/utils/greeter",
      description: "Greets the user by name",
      tags: ["utility", "text"],
      version: "1.2.0",
      author: {
        username: "alice",
        avatar_url: "https://enact.tools/avatars/alice.png",
      },
      downloads: 450,
      trust_status: {
        auditor_count: 1,
      },
    },
    {
      name: "bob/data/csv-parser",
      description: "Parse CSV files with custom delimiters",
      tags: ["data", "csv", "parser"],
      version: "2.0.0",
      author: {
        username: "bob",
      },
      downloads: 1203,
      trust_status: {
        auditor_count: 2,
      },
    },
    {
      name: "acme/ai/text-generator",
      description: "Generate text using AI models",
      tags: ["ai", "text", "generation"],
      version: "3.0.0",
      author: {
        username: "acme",
        avatar_url: "https://enact.tools/avatars/acme.png",
      },
      downloads: 5000,
      trust_status: {
        auditor_count: 5,
      },
    },
  ];

  // Simple search filter
  let results = allTools;

  if (query) {
    const q = query.toLowerCase();
    results = results.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  }

  if (tags) {
    const tagList = tags.split(",").map((t) => t.trim().toLowerCase());
    results = results.filter((t) =>
      tagList.some((tag) => t.tags.map((x) => x.toLowerCase()).includes(tag))
    );
  }

  // Update relevance based on query match
  return results.map((r, i) => ({
    ...r,
    relevance: Math.max(0.5, 1 - i * 0.1),
  }));
}

/**
 * Mock bundle data (simple tar.gz simulation)
 */
export function createMockBundle(): Uint8Array {
  // This is just placeholder data - real bundles would be tar.gz
  const content = "mock bundle content for testing";
  return new TextEncoder().encode(content);
}

/**
 * Response handler type
 */
type RouteHandler = (
  request: Request,
  params: Record<string, string>
) => Promise<Response> | Response;

/**
 * Mock server state
 */
interface MockServerState {
  authToken: string | undefined;
  rateLimitRemaining: number;
  rateLimitReset: number;
}

/**
 * Route definition with more flexible matching
 */
interface Route {
  method: string;
  segments: string[]; // e.g., ["tools", "{name}", "versions", "{version}"]
  handler: RouteHandler;
}

/**
 * Create mock server instance
 */
export function createMockServer() {
  const state: MockServerState = {
    authToken: undefined,
    rateLimitRemaining: 1000,
    rateLimitReset: Math.floor(Date.now() / 1000) + 3600,
  };

  const routes: Route[] = [];

  function addRoute(method: string, path: string, handler: RouteHandler) {
    const segments = path.split("/").filter(Boolean);
    routes.push({ method, segments, handler });
  }

  /**
   * Match a path against a route and extract parameters.
   *
   * This handles routes like:
   * - /tools/{name} -> name can be "alice/utils/greeter"
   * - /tools/{name}/versions/{version} -> name="alice/utils/greeter", version="1.2.0"
   * - /tools/{name}/versions/{version}/bundle -> same with trailing literal
   * - /tools/{name}/versions/{version}/trust/attestations/{auditor} -> with auditor param
   *
   * Strategy: Match from the END of the route backwards to find literal anchors,
   * then assign remaining segments to {name}.
   */
  function matchRoute(pathSegments: string[], route: Route): Record<string, string> | null {
    const params: Record<string, string> = {};
    const routeSegs = route.segments;

    // If route starts with "tools" and has {name}, handle specially
    if (routeSegs[0] === "tools" && routeSegs[1] === "{name}") {
      // Find where 'versions' appears in both route and path (if at all)
      const routeVersionsIdx = routeSegs.indexOf("versions");
      const pathVersionsIdx = pathSegments.indexOf("versions");

      if (routeVersionsIdx === -1) {
        // Route is /tools/{name} or /tools/{name}/feedback etc.
        // Check if path has "versions" - if so, this route doesn't match
        if (pathVersionsIdx !== -1) return null;

        // Check for other fixed segments after {name}
        // e.g., /tools/{name}/feedback
        if (routeSegs.length > 2) {
          // The last segment(s) should match
          const routeTail = routeSegs.slice(2);
          const pathTail = pathSegments.slice(-routeTail.length);

          for (let i = 0; i < routeTail.length; i++) {
            if (routeTail[i] !== pathTail[i]) return null;
          }

          // Name is everything between "tools" and the tail
          if (pathSegments[0] !== "tools") return null;
          params.name = pathSegments.slice(1, pathSegments.length - routeTail.length).join("/");
          return params;
        }

        // Simple case: /tools/{name} - name is everything after "tools"
        if (pathSegments[0] !== "tools") return null;
        params.name = pathSegments.slice(1).join("/");
        return params;
      }

      // Route has "versions" - path must too
      if (pathVersionsIdx === -1) return null;
      if (pathSegments[0] !== "tools") return null;

      // Name is between "tools" and "versions"
      params.name = pathSegments.slice(1, pathVersionsIdx).join("/");

      // Now match the rest: /versions/{version}/...
      const routeRest = routeSegs.slice(routeVersionsIdx);
      const pathRest = pathSegments.slice(pathVersionsIdx);

      // routeRest[0] = "versions", pathRest[0] = "versions"
      if (routeRest[0] !== pathRest[0]) return null;

      // routeRest[1] should be {version}, pathRest[1] is the version value
      if (routeRest[1] === "{version}") {
        if (!pathRest[1]) return null;
        params.version = pathRest[1];
      }

      // Check remaining segments after version
      // But handle the special case: /trust/attestations/{auditor}
      // routeRest might be: ["versions", "{version}", "trust", "attestations", "{auditor}"]
      // pathRest might be:  ["versions", "1.2.0", "trust", "attestations", "github%3AEnactProtocol"]

      // Check if segment count matches
      if (pathRest.length !== routeRest.length) return null;

      // Check any trailing segments after version
      for (let i = 2; i < routeRest.length; i++) {
        const routeSeg = routeRest[i];
        const pathSeg = pathRest[i];

        if (!routeSeg || !pathSeg) return null;

        if (routeSeg.startsWith("{") && routeSeg.endsWith("}")) {
          // Parameter segment - extract value
          const paramName = routeSeg.slice(1, -1);
          params[paramName] = decodeURIComponent(pathSeg);
        } else if (routeSeg !== pathSeg) {
          return null;
        }
      }

      return params;
    }

    // For other routes (users, search, etc.), do simple exact/param matching
    if (pathSegments.length !== routeSegs.length) return null;

    for (let i = 0; i < routeSegs.length; i++) {
      const routeSeg = routeSegs[i];
      const pathSeg = pathSegments[i];

      if (!routeSeg || !pathSeg) return null;

      if (routeSeg.startsWith("{") && routeSeg.endsWith("}")) {
        const paramName = routeSeg.slice(1, -1);
        params[paramName] = pathSeg;
      } else if (routeSeg !== pathSeg) {
        return null;
      }
    }

    return params;
  }

  function jsonResponse(data: unknown, status = 200): Response {
    const headers = new Headers({
      "Content-Type": "application/json",
      "X-RateLimit-Limit": "1000",
      "X-RateLimit-Remaining": String(state.rateLimitRemaining),
      "X-RateLimit-Reset": String(state.rateLimitReset),
    });

    state.rateLimitRemaining = Math.max(0, state.rateLimitRemaining - 1);

    return new Response(JSON.stringify(data), { status, headers });
  }

  function errorResponse(code: string, message: string, status: number): Response {
    return jsonResponse({ error: { code, message } }, status);
  }

  function requireAuth(request: Request): Response | null {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return errorResponse("unauthorized", "Authentication required", 401);
    }
    // The anon key is not a valid user authentication token
    const token = authHeader.slice(7); // Remove "Bearer " prefix
    if (token === SUPABASE_ANON_KEY) {
      return errorResponse("unauthorized", "Authentication required", 401);
    }
    return null;
  }

  // Set up routes based on API.md spec

  // Search (v2 - returns 'tools' array)
  addRoute("GET", "/tools/search", (request) => {
    const url = new URL(request.url);
    const query = url.searchParams.get("q") || "";
    const tags = url.searchParams.get("tags") || undefined;
    const limit = Number.parseInt(url.searchParams.get("limit") || "20", 10);
    const offset = Number.parseInt(url.searchParams.get("offset") || "0", 10);

    const results = mockSearchResults(query, tags);
    const paged = results.slice(offset, offset + limit);

    return jsonResponse({
      tools: paged,
      total: results.length,
      limit,
      offset,
    });
  });

  // Get tool metadata
  addRoute("GET", "/tools/{name}", (_request, params) => {
    // Name can have slashes, so we need to reconstruct it
    const name = params.name;
    const tool = Object.values(MOCK_TOOLS).find(
      (t) => t.name === name || t.name.endsWith(`/${name}`)
    );

    if (!tool) {
      return errorResponse("not_found", `Tool not found: ${name}`, 404);
    }

    return jsonResponse(tool);
  });

  // Get tool version
  addRoute("GET", "/tools/{name}/versions/{version}", (_request, params) => {
    const { name, version } = params;
    const key = `${name}@${version}`;

    // Try to find matching version
    const versionData = Object.entries(MOCK_VERSIONS).find(
      ([k]) => k === key || k.endsWith(`/${name}@${version}`)
    );

    if (!versionData) {
      return errorResponse("not_found", `Version not found: ${key}`, 404);
    }

    return jsonResponse(versionData[1]);
  });

  // Download bundle (v2 - supports both /bundle and /download paths)
  addRoute("GET", "/tools/{name}/versions/{version}/bundle", () => {
    const bundle = createMockBundle();
    return new Response(bundle, {
      headers: {
        "Content-Type": "application/gzip",
        ETag: '"sha256:abc123def456"',
      },
    });
  });

  // Download bundle (alternative path used by downloadBundle function)
  addRoute("GET", "/tools/{name}/versions/{version}/download", () => {
    const bundle = createMockBundle();
    return new Response(bundle, {
      headers: {
        "Content-Type": "application/gzip",
        ETag: '"sha256:abc123def456"',
      },
    });
  });

  // Get trust status
  addRoute("GET", "/tools/{name}/versions/{version}/trust", (_request, params) => {
    const { name, version } = params;
    const key = `${name}@${version}`;

    const trust = Object.entries(MOCK_TRUST).find(
      ([k]) => k === key || k.endsWith(`/${name}@${version}`)
    );

    if (!trust) {
      // Return empty trust status
      return jsonResponse({
        name,
        version,
        bundle_hash: "sha256:unknown",
        attestations: [],
      });
    }

    return jsonResponse(trust[1]);
  });

  // Publish tool (v2 - uses /tools/{name} with multipart)
  addRoute("POST", "/tools/{name}", (request, params) => {
    const authError = requireAuth(request);
    if (authError) return authError;

    const name = params.name ?? "unknown";

    const response: PublishResponse = {
      name,
      version: "1.0.0", // Extract from manifest in real implementation
      published_at: new Date().toISOString(),
      bundle_hash: "sha256:newbundle123",
      bundle_size: 1024,
      download_url: `https://cdn.enact.tools/bundles/${name}/1.0.0.tar.gz`,
    };

    return jsonResponse(response, 201);
  });

  // Yank version (v2)
  addRoute("POST", "/tools/{name}/versions/{version}/yank", (request, params) => {
    const authError = requireAuth(request);
    if (authError) return authError;

    const version = params.version ?? "0.0.0";

    return jsonResponse({
      yanked: true,
      version,
      reason: "Security vulnerability",
      replacement_version: "2.0.0",
      yanked_at: new Date().toISOString(),
    });
  });

  // Unyank version (v2)
  addRoute("POST", "/tools/{name}/versions/{version}/unyank", (request, params) => {
    const authError = requireAuth(request);
    if (authError) return authError;

    const version = params.version ?? "0.0.0";

    return jsonResponse({
      yanked: false,
      version,
      unyanked_at: new Date().toISOString(),
    });
  });

  // Get attestations (v2)
  addRoute("GET", "/tools/{name}/versions/{version}/attestations", (request, _params) => {
    const url = new URL(request.url);
    const limit = Number.parseInt(url.searchParams.get("limit") || "20", 10);
    const offset = Number.parseInt(url.searchParams.get("offset") || "0", 10);

    return jsonResponse({
      attestations: [
        {
          auditor: "security@example.com",
          auditor_provider: "github",
          signed_at: "2025-01-16T09:30:00Z",
          rekor_log_id: "mock-log-id-123",
          rekor_log_index: 123789,
          verification: {
            verified: true,
            verified_at: "2025-01-16T09:31:00Z",
            rekor_verified: true,
            certificate_verified: true,
            signature_verified: true,
          },
        },
      ],
      total: 1,
      limit: Math.min(limit, 100),
      offset,
    });
  });

  // Submit attestation (v2)
  addRoute("POST", "/tools/{name}/versions/{version}/attestations", (request, _params) => {
    const authError = requireAuth(request);
    if (authError) return authError;

    const response: AttestationResponse = {
      auditor: "test@example.com",
      auditor_provider: "github",
      signed_at: new Date().toISOString(),
      rekor_log_id: "mock-log-id-456",
      rekor_log_index: 999999,
      verification: {
        verified: true,
        verified_at: new Date().toISOString(),
        rekor_verified: true,
        certificate_verified: true,
        signature_verified: true,
      },
    };

    return jsonResponse(response, 201);
  });

  // Revoke attestation (v2)
  addRoute("DELETE", "/tools/{name}/versions/{version}/attestations", (request) => {
    const authError = requireAuth(request);
    if (authError) return authError;

    const url = new URL(request.url);
    const auditor = url.searchParams.get("auditor") || "unknown@example.com";

    return jsonResponse({
      auditor: decodeURIComponent(auditor),
      revoked: true,
      revoked_at: new Date().toISOString(),
    });
  });

  // Download attestation by auditor (no auth required, just reading)
  addRoute("GET", "/tools/{name}/versions/{version}/trust/attestations/{auditor}", () => {
    // Return a mock Sigstore bundle
    return jsonResponse({
      mediaType: "application/vnd.dev.sigstore.bundle+json",
      verificationMaterial: {
        certificate: "mock-certificate-data",
        tlogEntries: [
          {
            logIndex: 123789,
            logId: "mock-log-id",
          },
        ],
      },
      messageSignature: {
        signature: "mock-signature-data",
      },
    });
  });

  // Delete tool
  addRoute("DELETE", "/tools/{name}", (request) => {
    const authError = requireAuth(request);
    if (authError) return authError;

    return new Response(null, { status: 204 });
  });

  // OAuth v2: Initiate login
  addRoute("POST", "/auth/login", () => {
    return jsonResponse({
      auth_url: "https://github.com/login/oauth/authorize?client_id=test",
    });
  });

  // OAuth v2: Exchange code for token
  addRoute("POST", "/auth/callback", () => {
    return jsonResponse({
      access_token: "mock-access-token",
      refresh_token: "mock-refresh-token",
      expires_in: 3600,
      user: {
        id: "user-123",
        username: "testuser",
        email: "test@example.com",
      },
    });
  });

  // OAuth v2: Refresh token
  addRoute("POST", "/auth/refresh", () => {
    return jsonResponse({
      access_token: "new-access-token",
      expires_in: 3600,
    });
  });

  // OAuth v2: Get current user (same as GET /users/me)
  addRoute("GET", "/auth/me", (request) => {
    const authError = requireAuth(request);
    if (authError) return authError;

    return jsonResponse(MOCK_USERS.alice);
  });

  // Get current user
  addRoute("GET", "/users/me", (request) => {
    const authError = requireAuth(request);
    if (authError) return authError;

    return jsonResponse(MOCK_USERS.alice);
  });

  // Get user profile
  addRoute("GET", "/users/{username}", (_request, params) => {
    const username = params.username ?? "unknown";

    return jsonResponse({
      username,
      display_name: username.charAt(0).toUpperCase() + username.slice(1),
      avatar_url: `https://enact.tools/avatars/${username}.png`,
      created_at: "2024-06-15T10:00:00Z",
      tools_count: 12,
    });
  });

  // Get feedback
  addRoute("GET", "/tools/{name}/feedback", () => {
    const feedback: FeedbackAggregates = {
      rating: 4.2,
      rating_count: 47,
      downloads: 1203,
    };
    return jsonResponse(feedback);
  });

  // Submit feedback
  addRoute("POST", "/tools/{name}/feedback", (request) => {
    const authError = requireAuth(request);
    if (authError) return authError;

    // Return 204 No Content for feedback submission
    return new Response(null, { status: 204 });
  });

  // Get user trust config (v2)
  addRoute("GET", "/users/{username}/trust", (_request, params) => {
    const username = params.username ?? "unknown";

    return jsonResponse({
      username,
      trusted_auditors: [
        {
          identity: "security@example.com",
          added_at: "2025-01-10T10:00:00Z",
        },
      ],
    });
  });

  // Update user trust config (v2)
  addRoute("PUT", "/users/me/trust", (request) => {
    const authError = requireAuth(request);
    if (authError) return authError;

    return jsonResponse({
      trusted_auditors: [
        {
          identity: "security@example.com",
          added_at: "2025-01-10T10:00:00Z",
        },
      ],
      updated_at: new Date().toISOString(),
    });
  });

  /**
   * Handle a request
   */
  async function fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    // Strip the /functions/v1 or /v1 prefix if present (Supabase Edge Functions path)
    let path = url.pathname;
    if (path.startsWith("/functions/v1")) {
      path = path.slice(13); // Remove "/functions/v1"
    } else if (path.startsWith("/v1")) {
      path = path.slice(3); // Remove "/v1"
    }
    const method = request.method;

    // Check rate limit
    if (state.rateLimitRemaining <= 0) {
      return errorResponse("rate_limited", "Too many requests", 429);
    }

    // Parse path segments
    const pathSegments = path.split("/").filter(Boolean);

    // Find matching route
    for (const route of routes) {
      if (route.method !== method) continue;

      const params = matchRoute(pathSegments, route);
      if (params !== null) {
        return route.handler(request, params);
      }
    }

    return errorResponse("not_found", `No route for ${method} ${path}`, 404);
  }

  return {
    fetch,
    state,
    setAuthToken(token: string | undefined) {
      state.authToken = token;
    },
    setRateLimit(remaining: number) {
      state.rateLimitRemaining = remaining;
    },
    resetRateLimit() {
      state.rateLimitRemaining = 1000;
    },
  };
}

/**
 * Type for mock server
 */
export type MockServer = ReturnType<typeof createMockServer>;

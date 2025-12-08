/**
 * Deno-compatible storage client for Edge Functions
 * Uses AWS SDK for Deno to interact with S3/R2/MinIO
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "https://deno.land/x/s3_lite_client@0.7.0/mod.ts";

/**
 * Storage configuration
 */
export interface StorageConfig {
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  bucket: string;
  region?: string;
}

/**
 * Storage error class
 */
export class StorageError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = "StorageError";
  }
}

/**
 * Generate storage key for a tool bundle
 * Format: bundles/{owner}/{path}/{version}.tar.gz
 */
export function getBundleKey(toolName: string, version: string): string {
  return `bundles/${toolName}/${version}.tar.gz`;
}

/**
 * S3/R2 storage client for Deno Edge Functions
 */
export class StorageClient {
  private s3: S3Client;
  private bucket: string;
  private endpoint?: string;

  constructor(config: StorageConfig) {
    this.bucket = config.bucket;
    this.endpoint = config.endpoint;

    // Parse endpoint URL properly
    let endPoint = "s3.amazonaws.com";
    let port = 443;
    let useSSL = true;

    if (config.endpoint) {
      const url = new URL(config.endpoint);
      endPoint = url.hostname;
      port = url.port ? parseInt(url.port, 10) : (url.protocol === "https:" ? 443 : 80);
      useSSL = url.protocol === "https:";
    }

    this.s3 = new S3Client({
      endPoint,
      port,
      useSSL,
      region: config.region ?? "auto",
      accessKey: config.accessKeyId!,
      secretKey: config.secretAccessKey!,
      bucket: config.bucket,
      pathStyle: !!config.endpoint, // Use path-style for custom endpoints
    });
  }

  /**
   * Upload file to storage
   */
  async upload(
    key: string,
    data: ArrayBuffer | Uint8Array,
    options?: {
      contentType?: string;
      metadata?: Record<string, string>;
    }
  ): Promise<{ url: string; etag: string }> {
    try {
      const buffer = data instanceof ArrayBuffer ? new Uint8Array(data) : data;

      const result = await this.s3.putObject(key, buffer, {
        metadata: {
          "Content-Type": options?.contentType ?? "application/octet-stream",
          ...options?.metadata,
        },
      });

      const url = this.endpoint
        ? `${this.endpoint}/${this.bucket}/${key}`
        : `https://${this.bucket}.s3.amazonaws.com/${key}`;

      const etag = result.etag ?? `"${await this.computeHash(data)}"`;

      console.log(`[Storage] Uploaded ${key} (${data.byteLength} bytes) - ETag: ${etag}`);

      return { url, etag };
    } catch (err) {
      throw new StorageError(
        `Failed to upload ${key}: ${err instanceof Error ? err.message : String(err)}`,
        "UPLOAD_FAILED"
      );
    }
  }

  /**
   * Download file from storage
   */
  async download(key: string): Promise<ArrayBuffer> {
    try {
      const result = await this.s3.getObject(key);

      if (!result.body) {
        throw new StorageError(`No data returned for ${key}`, "NO_DATA");
      }

      // Convert ReadableStream to ArrayBuffer
      const chunks: Uint8Array[] = [];
      const reader = result.body.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }

      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const resultArray = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        resultArray.set(chunk, offset);
        offset += chunk.length;
      }

      console.log(`[Storage] Downloaded ${key} (${resultArray.byteLength} bytes)`);

      return resultArray.buffer;
    } catch (err) {
      throw new StorageError(
        `Failed to download ${key}: ${err instanceof Error ? err.message : String(err)}`,
        "DOWNLOAD_FAILED"
      );
    }
  }

  /**
   * Delete file from storage
   */
  async delete(key: string): Promise<void> {
    try {
      await this.s3.deleteObject(key);
      console.log(`[Storage] Deleted ${key}`);
    } catch (err) {
      throw new StorageError(
        `Failed to delete ${key}: ${err instanceof Error ? err.message : String(err)}`,
        "DELETE_FAILED"
      );
    }
  }

  /**
   * Check if file exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      await this.s3.statObject(key);
      console.log(`[Storage] File exists: ${key}`);
      return true;
    } catch (err: unknown) {
      // S3 returns 404 for missing files
      if (err instanceof Error && err.message.includes("404")) {
        console.log(`[Storage] File not found: ${key}`);
        return false;
      }
      throw new StorageError(
        `Failed to check existence of ${key}: ${err instanceof Error ? err.message : String(err)}`,
        "EXISTS_CHECK_FAILED"
      );
    }
  }

  /**
   * Get file metadata
   */
  async getMetadata(key: string): Promise<{
    size: number;
    contentType: string;
    etag: string;
  }> {
    try {
      const stats = await this.s3.statObject(key);

      const metadata = {
        size: stats.size ?? 0,
        contentType: stats.metaData?.["content-type"] ?? "application/octet-stream",
        etag: stats.etag ?? '""',
      };

      console.log(`[Storage] Got metadata for ${key}:`, metadata);

      return metadata;
    } catch (err) {
      throw new StorageError(
        `Failed to get metadata for ${key}: ${err instanceof Error ? err.message : String(err)}`,
        "METADATA_FAILED"
      );
    }
  }

  /**
   * Compute SHA-256 hash of data
   */
  private async computeHash(data: ArrayBuffer | Uint8Array): Promise<string> {
    const buffer = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
}

/**
 * Create storage client from environment variables
 */
export function createStorageClient(): StorageClient {
  const config: StorageConfig = {
    accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID"),
    secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY"),
    bucket: Deno.env.get("R2_BUCKET") ?? "enact-bundles",
    endpoint: Deno.env.get("R2_ENDPOINT"),
    region: Deno.env.get("R2_REGION") ?? "auto",
  };

  // Validate required fields
  if (!config.accessKeyId || !config.secretAccessKey) {
    throw new StorageError(
      "Missing required storage credentials: R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY must be set",
      "MISSING_CREDENTIALS"
    );
  }

  return new StorageClient(config);
}

/**
 * Upload a tool bundle
 */
export async function uploadBundle(
  storage: StorageClient,
  toolName: string,
  version: string,
  data: ArrayBuffer | Uint8Array
): Promise<{ path: string; hash: string; size: number }> {
  const key = getBundleKey(toolName, version);

  // Upload to storage
  await storage.upload(key, data, {
    contentType: "application/gzip",
    metadata: {
      tool: toolName,
      version,
    },
  });

  // Compute hash
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = `sha256:${hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")}`;

  const size = data.byteLength;

  return {
    path: key,
    hash,
    size,
  };
}

/**
 * Download a tool bundle
 */
export async function downloadBundle(
  storage: StorageClient,
  toolName: string,
  version: string
): Promise<ArrayBuffer> {
  const key = getBundleKey(toolName, version);
  return await storage.download(key);
}

/**
 * Delete a tool bundle
 */
export async function deleteBundle(
  storage: StorageClient,
  toolName: string,
  version: string
): Promise<void> {
  const key = getBundleKey(toolName, version);
  await storage.delete(key);
}

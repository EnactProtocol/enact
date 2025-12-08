/**
 * R2/S3 storage client
 */

declare const Deno: { env: { get: (key: string) => string | undefined } } | undefined;

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

/**
 * Storage configuration
 */
export interface StorageConfig {
  accountId?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  bucket: string;
  endpoint?: string;
  region?: string;
}

/**
 * Upload options
 */
export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
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
 * R2/S3 storage client
 */
export class StorageClient {
  private config: StorageConfig;
  private s3Client: S3Client;

  constructor(config: StorageConfig) {
    this.config = config;

    // Create S3 client configured for R2 or S3
    const clientConfig: {
      region: string;
      endpoint?: string;
      credentials?: {
        accessKeyId: string;
        secretAccessKey: string;
      };
      forcePathStyle?: boolean;
    } = {
      region: config.region ?? "auto", // R2 uses "auto", S3 uses actual region
    };

    // Only set endpoint if provided (required for R2, optional for S3)
    if (config.endpoint) {
      clientConfig.endpoint = config.endpoint;
      // Use path-style URLs for custom endpoints (MinIO, R2)
      clientConfig.forcePathStyle = true;
    }

    // Only set credentials if both are provided
    if (config.accessKeyId && config.secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      };
    }

    this.s3Client = new S3Client(clientConfig);
  }

  /**
   * Upload file to R2/S3
   */
  async upload(
    key: string,
    data: ArrayBuffer | Uint8Array,
    options?: UploadOptions
  ): Promise<{ url: string; etag: string }> {
    try {
      const buffer = data instanceof ArrayBuffer ? new Uint8Array(data) : data;

      const command = new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: buffer,
        ContentType: options?.contentType ?? "application/octet-stream",
        Metadata: options?.metadata,
      });

      const response = await this.s3Client.send(command);

      // Construct public URL
      const url = this.config.endpoint
        ? `${this.config.endpoint}/${this.config.bucket}/${key}`
        : `https://${this.config.bucket}.s3.amazonaws.com/${key}`;

      const etag = response.ETag ?? `"${await this.computeHash(data)}"`;

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
   * Download file from R2/S3
   */
  async download(key: string): Promise<ArrayBuffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      });

      const response = await this.s3Client.send(command);

      if (!response.Body) {
        throw new StorageError(`No data returned for ${key}`, "NO_DATA");
      }

      // Convert readable stream to ArrayBuffer
      const chunks: Uint8Array[] = [];
      // @ts-ignore - Body is a readable stream in Deno/Node
      for await (const chunk of response.Body) {
        chunks.push(chunk);
      }

      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }

      console.log(`[Storage] Downloaded ${key} (${result.byteLength} bytes)`);

      return result.buffer;
    } catch (err) {
      throw new StorageError(
        `Failed to download ${key}: ${err instanceof Error ? err.message : String(err)}`,
        "DOWNLOAD_FAILED"
      );
    }
  }

  /**
   * Delete file from R2/S3
   */
  async delete(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      });

      await this.s3Client.send(command);

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
      const command = new HeadObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      });

      await this.s3Client.send(command);

      console.log(`[Storage] File exists: ${key}`);
      return true;
    } catch (err: unknown) {
      // @ts-ignore - AWS SDK error has $metadata
      if (err?.$metadata?.httpStatusCode === 404) {
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
      const command = new HeadObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      });

      const response = await this.s3Client.send(command);

      const metadata = {
        size: response.ContentLength ?? 0,
        contentType: response.ContentType ?? "application/octet-stream",
        etag: response.ETag ?? '""',
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
 * Note: Uses Deno.env in Edge Functions, process.env elsewhere
 *
 * Environment variables:
 * - R2_ACCOUNT_ID: Cloudflare account ID (optional)
 * - R2_ACCESS_KEY_ID: R2/S3 access key ID (required)
 * - R2_SECRET_ACCESS_KEY: R2/S3 secret access key (required)
 * - R2_BUCKET: Bucket name (default: "enact-bundles")
 * - R2_ENDPOINT: Custom endpoint URL (required for R2)
 * - R2_REGION: Region (default: "auto" for R2, or specific region for S3)
 */
export function createStorageClient(): StorageClient {
  // Helper to get env var - works in both Node.js and Deno
  const getEnv = (key: string): string | undefined => {
    // Check for Deno environment first
    if (typeof Deno !== "undefined" && Deno.env?.get) {
      return Deno.env.get(key);
    }
    // Fall back to Node.js process.env
    return process.env[key];
  };

  const accessKeyId = getEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = getEnv("R2_SECRET_ACCESS_KEY");

  // Validate required fields
  if (!accessKeyId || !secretAccessKey) {
    throw new StorageError(
      "Missing required storage credentials: R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY must be set",
      "MISSING_CREDENTIALS"
    );
  }

  const config: StorageConfig = {
    accessKeyId,
    secretAccessKey,
    bucket: getEnv("R2_BUCKET") ?? "enact-bundles",
    region: getEnv("R2_REGION") ?? "auto",
  };

  // Add optional properties only if defined
  const accountId = getEnv("R2_ACCOUNT_ID");
  if (accountId) config.accountId = accountId;

  const endpoint = getEnv("R2_ENDPOINT");
  if (endpoint) config.endpoint = endpoint;

  return new StorageClient(config);
}

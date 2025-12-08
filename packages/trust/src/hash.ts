/**
 * Hash utilities for content integrity verification
 */

import { type Hash, createHash } from "node:crypto";
import { createReadStream, statSync } from "node:fs";
import type { FileHashOptions, HashAlgorithm, HashResult } from "./types";

/**
 * Hash a string or buffer using the specified algorithm
 *
 * @param content - The content to hash
 * @param algorithm - The hash algorithm to use (default: sha256)
 * @returns Hash result with algorithm and digest
 *
 * @example
 * ```ts
 * const result = hashContent("hello world");
 * console.log(result.digest); // "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9"
 * ```
 */
export function hashContent(
  content: string | Buffer,
  algorithm: HashAlgorithm = "sha256"
): HashResult {
  const hash: Hash = createHash(algorithm);
  hash.update(content);
  const digest = hash.digest("hex");

  return {
    algorithm,
    digest,
  };
}

/**
 * Hash a buffer directly
 *
 * @param buffer - The buffer to hash
 * @param algorithm - The hash algorithm to use (default: sha256)
 * @returns Hash result with algorithm and digest
 *
 * @example
 * ```ts
 * const buffer = Buffer.from("hello world");
 * const result = hashBuffer(buffer);
 * ```
 */
export function hashBuffer(buffer: Buffer, algorithm: HashAlgorithm = "sha256"): HashResult {
  return hashContent(buffer, algorithm);
}

/**
 * Hash a file using streaming to support large files
 *
 * @param filePath - Path to the file to hash
 * @param options - Hashing options including algorithm and progress callback
 * @returns Promise resolving to hash result
 *
 * @throws Error if file doesn't exist or cannot be read
 *
 * @example
 * ```ts
 * const result = await hashFile("/path/to/file.txt", {
 *   algorithm: "sha256",
 *   onProgress: (read, total) => {
 *     console.log(`${(read / total * 100).toFixed(1)}% complete`);
 *   }
 * });
 * ```
 */
export async function hashFile(
  filePath: string,
  options: FileHashOptions = {}
): Promise<HashResult> {
  const { algorithm = "sha256", onProgress } = options;

  // Validate file exists and get size
  let fileSize: number;
  try {
    const stats = statSync(filePath);
    if (!stats.isFile()) {
      throw new Error(`Path is not a file: ${filePath}`);
    }
    fileSize = stats.size;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to access file: ${error.message}`);
    }
    throw error;
  }

  return new Promise((resolve, reject) => {
    const hash: Hash = createHash(algorithm);
    const stream = createReadStream(filePath);
    let bytesRead = 0;

    stream.on("data", (chunk: string | Buffer) => {
      hash.update(chunk);
      const chunkSize = typeof chunk === "string" ? Buffer.byteLength(chunk) : chunk.length;
      bytesRead += chunkSize;

      if (onProgress) {
        onProgress(bytesRead, fileSize);
      }
    });

    stream.on("end", () => {
      const digest = hash.digest("hex");
      resolve({
        algorithm,
        digest,
      });
    });

    stream.on("error", (error: Error) => {
      reject(new Error(`Failed to read file: ${error.message}`));
    });
  });
}

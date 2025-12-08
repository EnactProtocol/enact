#!/usr/bin/env bun

/**
 * Test script for storage integration
 *
 * This script tests the StorageClient with MinIO running locally.
 *
 * Prerequisites:
 * 1. Start MinIO: docker-compose up -d
 * 2. Set environment variables (automatically loaded from .env.local)
 *
 * Usage:
 *   bun run scripts/test-storage.ts
 */

import { createStorageClient } from "../src/storage/client.js";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const RESET = "\x1b[0m";

function log(color: string, prefix: string, message: string) {
  console.log(`${color}${prefix}${RESET} ${message}`);
}

function success(message: string) {
  log(GREEN, "✓", message);
}

function error(message: string) {
  log(RED, "✗", message);
}

function info(message: string) {
  log(BLUE, "ℹ", message);
}

function warn(message: string) {
  log(YELLOW, "⚠", message);
}

async function main() {
  console.log(`\n${BLUE}=== Enact Storage Integration Test ===${RESET}\n`);

  // Load environment variables
  const endpoint = process.env.R2_ENDPOINT || "http://localhost:9000";
  const bucket = process.env.R2_BUCKET || "enact-bundles";

  info(`Endpoint: ${endpoint}`);
  info(`Bucket: ${bucket}`);
  console.log();

  try {
    // Create storage client
    info("Creating storage client...");
    const storage = createStorageClient();
    success("Storage client created");
    console.log();

    // Test 1: Upload a file
    info("Test 1: Upload file");
    const testData = new TextEncoder().encode("Hello, Enact! This is a test bundle.");
    const testKey = `test-bundles/test-${Date.now()}.tar.gz`;

    const uploadResult = await storage.upload(testKey, testData, {
      contentType: "application/gzip",
      metadata: {
        tool: "test-tool",
        version: "1.0.0",
      },
    });

    success(`Uploaded: ${testKey}`);
    info(`  URL: ${uploadResult.url}`);
    info(`  ETag: ${uploadResult.etag}`);
    console.log();

    // Test 2: Check if file exists
    info("Test 2: Check file exists");
    const exists = await storage.exists(testKey);
    if (exists) {
      success(`File exists: ${testKey}`);
    } else {
      error(`File not found: ${testKey}`);
      process.exit(1);
    }
    console.log();

    // Test 3: Get metadata
    info("Test 3: Get file metadata");
    const metadata = await storage.getMetadata(testKey);
    success("Got metadata:");
    info(`  Size: ${metadata.size} bytes`);
    info(`  Content-Type: ${metadata.contentType}`);
    info(`  ETag: ${metadata.etag}`);
    console.log();

    // Test 4: Download file
    info("Test 4: Download file");
    const downloaded = await storage.download(testKey);
    const downloadedText = new TextDecoder().decode(downloaded);

    if (downloadedText === "Hello, Enact! This is a test bundle.") {
      success("Downloaded content matches original");
      info(`  Content: "${downloadedText}"`);
    } else {
      error("Downloaded content does not match!");
      info(`  Expected: "Hello, Enact! This is a test bundle."`);
      info(`  Got: "${downloadedText}"`);
      process.exit(1);
    }
    console.log();

    // Test 5: Delete file
    info("Test 5: Delete file");
    await storage.delete(testKey);
    success(`Deleted: ${testKey}`);
    console.log();

    // Test 6: Verify deletion
    info("Test 6: Verify file was deleted");
    const stillExists = await storage.exists(testKey);
    if (!stillExists) {
      success("File successfully deleted");
    } else {
      error("File still exists after deletion!");
      process.exit(1);
    }
    console.log();

    // All tests passed
    console.log(`${GREEN}=== All tests passed! ===${RESET}\n`);
    info("MinIO storage is working correctly");
    info("Access MinIO Console: http://localhost:9001");
    info("  Username: enact");
    info("  Password: enact123456");
    console.log();
  } catch (err) {
    console.log();
    error("Test failed!");
    if (err instanceof Error) {
      console.error(`${RED}Error: ${err.message}${RESET}`);
      if (err.stack) {
        console.error(err.stack);
      }
    } else {
      console.error(err);
    }
    console.log();
    warn("Make sure MinIO is running:");
    info("  docker-compose up -d");
    console.log();
    process.exit(1);
  }
}

main();

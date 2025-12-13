#!/usr/bin/env node

// Development shim - only works in the monorepo during development.
// In release builds, this should be replaced with the compiled binary.

const fs = require("node:fs");
const path = require("node:path");

// Check if we're in the monorepo (dev mode)
const cliPath = path.join(__dirname, "..", "..", "cli", "dist", "index.js");
if (fs.existsSync(cliPath)) {
  require(cliPath);
} else {
  console.error("Error: Enact binary not found for macOS ARM64 (Apple Silicon).");
  console.error("");
  console.error("The macOS ARM64 binary was not included in this release.");
  console.error("");
  console.error("Workarounds:");
  console.error("  1. Use Node.js directly: npx @enactprotocol/cli <command>");
  console.error("  2. Wait for a release with macOS ARM64 binaries");
  console.error("  3. Build from source: https://github.com/EnactProtocol/enact");
  process.exit(1);
}

#!/usr/bin/env node
/**
 * Postinstall script to patch sigstore packages for Bun/BoringSSL compatibility
 *
 * Patch 1: @sigstore/sign
 * Bun uses BoringSSL which requires an explicit digest algorithm for EC keys,
 * but @sigstore/sign uses `crypto.sign(null, ...)` which only works with Node's OpenSSL.
 * This patches the ephemeral signer to use 'sha256' explicitly.
 *
 * Patch 2: @sigstore/core
 * When loading trusted roots from JSON (like bundled seeds), binary data like rawBytes
 * is base64-encoded strings, not Buffers. The createPublicKey function incorrectly
 * treats strings as PEM, but they're actually base64-encoded DER.
 * This patches it to detect and handle base64 strings properly.
 */

const fs = require("node:fs");
const path = require("node:path");

// ============================================================================
// Patch 1: @sigstore/sign - Fix BoringSSL EC key signing
// ============================================================================

const ephemeralPath = path.join(
  __dirname,
  "..",
  "node_modules",
  "@sigstore",
  "sign",
  "dist",
  "signer",
  "fulcio",
  "ephemeral.js"
);

if (fs.existsSync(ephemeralPath)) {
  let content = fs.readFileSync(ephemeralPath, "utf-8");

  if (content.includes("sign('sha256',")) {
    console.log("[@sigstore/sign patch] Already patched, skipping...");
  } else {
    const original = "crypto_1.default.sign(null,";
    const patched = "crypto_1.default.sign('sha256',";

    if (content.includes(original)) {
      content = content.replace(original, patched);
      fs.writeFileSync(ephemeralPath, content);
      console.log("[@sigstore/sign patch] Applied BoringSSL compatibility patch");
    } else {
      console.log("[@sigstore/sign patch] Pattern not found, skipping...");
    }
  }
} else {
  console.log("[@sigstore/sign patch] Package not found, skipping...");
}

// ============================================================================
// Patch 2: @sigstore/core - Fix base64 string handling in createPublicKey
// ============================================================================

const cryptoPath = path.join(
  __dirname,
  "..",
  "node_modules",
  "@sigstore",
  "core",
  "dist",
  "crypto.js"
);

if (fs.existsSync(cryptoPath)) {
  let content = fs.readFileSync(cryptoPath, "utf-8");
  let patched = false;

  // Patch 2a: Handle base64 strings in createPublicKey
  if (content.includes("// PATCHED: Handle base64 strings")) {
    console.log("[@sigstore/core patch] createPublicKey already patched, skipping...");
  } else {
    const originalFn = `function createPublicKey(key, type = 'spki') {
    if (typeof key === 'string') {
        return crypto_1.default.createPublicKey(key);
    }
    else {
        return crypto_1.default.createPublicKey({ key, format: 'der', type: type });
    }
}`;

    const patchedFn = `function createPublicKey(key, type = 'spki') {
    // PATCHED: Handle base64 strings from JSON-deserialized trusted roots
    if (typeof key === 'string') {
        // Check if it looks like a PEM (starts with -----)
        if (key.startsWith('-----')) {
            return crypto_1.default.createPublicKey(key);
        }
        // Otherwise assume it's base64-encoded DER
        const derBuffer = Buffer.from(key, 'base64');
        return crypto_1.default.createPublicKey({ key: derBuffer, format: 'der', type: type });
    }
    else {
        return crypto_1.default.createPublicKey({ key, format: 'der', type: type });
    }
}`;

    if (content.includes(originalFn)) {
      content = content.replace(originalFn, patchedFn);
      patched = true;
      console.log("[@sigstore/core patch] Applied base64 string handling patch");
    } else {
      console.log("[@sigstore/core patch] createPublicKey pattern not found, skipping...");
    }
  }

  // Patch 2b: Fix verify function for BoringSSL (default to sha256 when algorithm is undefined)
  if (content.includes("// PATCHED: Default to sha256")) {
    console.log("[@sigstore/core patch] verify already patched, skipping...");
  } else {
    const originalVerify = `function verify(data, key, signature, algorithm) {
    // The try/catch is to work around an issue in Node 14.x where verify throws
    // an error in some scenarios if the signature is invalid.
    try {
        return crypto_1.default.verify(algorithm, data, key, signature);
    }
    catch (e) {
        /* istanbul ignore next */
        return false;
    }
}`;

    const patchedVerify = `function verify(data, key, signature, algorithm) {
    // PATCHED: Default to sha256 for BoringSSL compatibility
    // Bun uses BoringSSL which requires an explicit digest algorithm for EC keys
    const algo = algorithm ?? 'sha256';
    // The try/catch is to work around an issue in Node 14.x where verify throws
    // an error in some scenarios if the signature is invalid.
    try {
        return crypto_1.default.verify(algo, data, key, signature);
    }
    catch (e) {
        /* istanbul ignore next */
        return false;
    }
}`;

    if (content.includes(originalVerify)) {
      content = content.replace(originalVerify, patchedVerify);
      patched = true;
      console.log("[@sigstore/core patch] Applied verify sha256 default patch");
    } else {
      console.log("[@sigstore/core patch] verify pattern not found, skipping...");
    }
  }

  if (patched) {
    fs.writeFileSync(cryptoPath, content);
  }
} else {
  console.log("[@sigstore/core patch] Package not found, skipping...");
}

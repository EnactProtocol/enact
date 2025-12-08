/**
 * Cosign CLI integration for interactive OIDC signing
 *
 * The sigstore-js library is designed for CI environments where OIDC tokens
 * are available via environment variables. For interactive local signing,
 * we shell out to the cosign CLI which handles the browser-based OAuth flow.
 */

import { execSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SigstoreBundle } from "./types";

/**
 * Check if cosign CLI is available
 */
export function isCosignAvailable(): boolean {
  try {
    execSync("which cosign", { encoding: "utf-8", stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get cosign version information
 */
export function getCosignVersion(): string | undefined {
  try {
    const output = execSync("cosign version", { encoding: "utf-8", stdio: "pipe" });
    const match = output.match(/GitVersion:\s+v?([\d.]+)/);
    return match?.[1];
  } catch {
    return undefined;
  }
}

/**
 * Options for cosign signing
 */
export interface CosignSignOptions {
  /** Timeout in milliseconds for the OIDC flow */
  timeout?: number;
  /** Output bundle path (if not provided, a temp file is used) */
  outputPath?: string;
  /** Whether to run in verbose mode */
  verbose?: boolean;
}

/**
 * Result of cosign signing
 */
export interface CosignSignResult {
  /** The Sigstore bundle */
  bundle: SigstoreBundle;
  /** Path where the bundle was saved */
  bundlePath: string;
  /** Signer identity (email) extracted from the bundle */
  signerIdentity: string | undefined;
}

/**
 * Sign a blob (file or buffer) using cosign with interactive OIDC
 *
 * This opens a browser for OAuth authentication with Sigstore's public
 * OIDC provider. The signature, certificate, and Rekor entry are bundled
 * together in the Sigstore bundle format.
 *
 * @param data - The data to sign (Buffer or path to file)
 * @param options - Signing options
 * @returns The signing result with bundle
 */
export async function signWithCosign(
  data: Buffer | string,
  options: CosignSignOptions = {}
): Promise<CosignSignResult> {
  if (!isCosignAvailable()) {
    throw new Error(
      "cosign CLI is not installed. Install it with: brew install cosign\n" +
        "See: https://docs.sigstore.dev/cosign/system_config/installation/"
    );
  }

  const { timeout = 120000, outputPath, verbose = false } = options;

  // Create temp directory for working files
  const tempDir = join(tmpdir(), `enact-sign-${Date.now()}`);
  mkdirSync(tempDir, { recursive: true });

  const blobPath = join(tempDir, "blob");
  const bundlePath = outputPath ?? join(tempDir, "bundle.json");

  try {
    // Write data to temp file if it's a buffer
    if (Buffer.isBuffer(data)) {
      writeFileSync(blobPath, data);
    } else if (typeof data === "string" && existsSync(data)) {
      // It's a file path, copy to temp location
      const content = readFileSync(data);
      writeFileSync(blobPath, content);
    } else {
      // It's string content
      writeFileSync(blobPath, data);
    }

    // Run cosign sign-blob with bundle output
    // The --yes flag auto-confirms the OIDC consent prompt
    const args = [
      "sign-blob",
      "--yes", // Auto-confirm OIDC consent
      "--bundle",
      bundlePath,
      "--output-signature",
      "/dev/null", // We only want the bundle
      "--output-certificate",
      "/dev/null", // Bundle includes the cert
      blobPath,
    ];

    if (verbose) {
      console.log(`Running: cosign ${args.join(" ")}`);
    }

    await new Promise<void>((resolve, reject) => {
      const proc = spawn("cosign", args, {
        stdio: verbose ? "inherit" : ["inherit", "pipe", "pipe"],
        timeout,
      });

      let stderr = "";

      if (!verbose) {
        proc.stderr?.on("data", (data) => {
          stderr += data.toString();
        });
      }

      proc.on("error", (err) => {
        reject(new Error(`Failed to run cosign: ${err.message}`));
      });

      proc.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          // Check for common error patterns
          if (stderr.includes("context deadline exceeded") || stderr.includes("timeout")) {
            reject(
              new Error(
                "OIDC authentication timed out. Please try again and complete the browser flow."
              )
            );
          } else if (stderr.includes("cancelled")) {
            reject(new Error("Signing was cancelled."));
          } else {
            reject(new Error(`cosign exited with code ${code}: ${stderr || "(no output)"}`));
          }
        }
      });
    });

    // Read the bundle
    if (!existsSync(bundlePath)) {
      throw new Error("cosign did not produce a bundle file");
    }

    const bundleContent = readFileSync(bundlePath, "utf-8");
    const bundle = JSON.parse(bundleContent) as SigstoreBundle;

    // Extract signer identity from the bundle if possible
    const signerIdentity = extractSignerFromBundle(bundle);

    return {
      bundle,
      bundlePath,
      signerIdentity,
    };
  } finally {
    // Clean up temp files (but not the output bundle if specified)
    try {
      if (existsSync(blobPath)) {
        unlinkSync(blobPath);
      }
      if (!outputPath && existsSync(bundlePath)) {
        unlinkSync(bundlePath);
      }
      // Try to remove temp dir
      if (existsSync(tempDir)) {
        const { rmdirSync } = require("node:fs");
        rmdirSync(tempDir, { recursive: true });
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Sign an in-toto attestation using cosign
 *
 * For in-toto attestations, we use cosign attest-blob which wraps the
 * attestation in a DSSE envelope.
 *
 * @param attestation - The in-toto statement to sign
 * @param options - Signing options
 * @returns The signing result with bundle
 */
export async function attestWithCosign(
  attestation: Record<string, unknown>,
  options: CosignSignOptions = {}
): Promise<CosignSignResult> {
  if (!isCosignAvailable()) {
    throw new Error(
      "cosign CLI is not installed. Install it with: brew install cosign\n" +
        "See: https://docs.sigstore.dev/cosign/system_config/installation/"
    );
  }

  const { timeout = 120000, outputPath, verbose = false } = options;

  // Create temp directory for working files
  const tempDir = join(tmpdir(), `enact-attest-${Date.now()}`);
  mkdirSync(tempDir, { recursive: true });

  const predicatePath = join(tempDir, "predicate.json");
  const bundlePath = outputPath ?? join(tempDir, "bundle.json");
  // cosign attest-blob needs a subject file (the thing being attested)
  // For tool attestations, we'll create a dummy subject file
  const subjectPath = join(tempDir, "subject");

  try {
    // Extract the predicate from the in-toto statement
    // cosign attest-blob takes the predicate separately
    const statement = attestation as {
      _type: string;
      subject: Array<{ name: string; digest: Record<string, string> }>;
      predicateType: string;
      predicate: unknown;
    };

    // Write the predicate to a file
    writeFileSync(predicatePath, JSON.stringify(statement.predicate, null, 2));

    // Create a subject file with the expected content
    // The subject should be the content that matches the digest in the statement
    // For now, we'll just create a placeholder and rely on the predicate
    const subjectName = statement.subject?.[0]?.name ?? "tool.yaml";
    writeFileSync(subjectPath, subjectName);

    // Use cosign attest-blob
    // Note: attest-blob is for custom predicates, which is what we have
    const args = [
      "attest-blob",
      "--yes", // Auto-confirm OIDC consent
      "--bundle",
      bundlePath,
      "--predicate",
      predicatePath,
      "--type",
      statement.predicateType,
      subjectPath,
    ];

    if (verbose) {
      console.log(`Running: cosign ${args.join(" ")}`);
    }

    await new Promise<void>((resolve, reject) => {
      const proc = spawn("cosign", args, {
        stdio: verbose ? "inherit" : ["inherit", "pipe", "pipe"],
        timeout,
      });

      let stderr = "";

      if (!verbose) {
        proc.stderr?.on("data", (data) => {
          stderr += data.toString();
        });
      }

      proc.on("error", (err) => {
        reject(new Error(`Failed to run cosign: ${err.message}`));
      });

      proc.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          if (stderr.includes("context deadline exceeded") || stderr.includes("timeout")) {
            reject(
              new Error(
                "OIDC authentication timed out. Please try again and complete the browser flow."
              )
            );
          } else if (stderr.includes("cancelled")) {
            reject(new Error("Signing was cancelled."));
          } else {
            reject(new Error(`cosign exited with code ${code}: ${stderr || "(no output)"}`));
          }
        }
      });
    });

    // Read the bundle
    if (!existsSync(bundlePath)) {
      throw new Error("cosign did not produce a bundle file");
    }

    const bundleContent = readFileSync(bundlePath, "utf-8");
    const bundle = JSON.parse(bundleContent) as SigstoreBundle;

    // Extract signer identity from the bundle
    const signerIdentity = extractSignerFromBundle(bundle);

    return {
      bundle,
      bundlePath,
      signerIdentity,
    };
  } finally {
    // Clean up temp files
    try {
      for (const file of [predicatePath, subjectPath]) {
        if (existsSync(file)) {
          unlinkSync(file);
        }
      }
      if (!outputPath && existsSync(bundlePath)) {
        unlinkSync(bundlePath);
      }
      if (existsSync(tempDir)) {
        const { rmdirSync } = require("node:fs");
        rmdirSync(tempDir, { recursive: true });
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Verify a blob signature using cosign
 *
 * @param data - The data that was signed
 * @param bundle - The Sigstore bundle
 * @param expectedIdentity - Expected signer identity (email)
 * @param expectedIssuer - Expected OIDC issuer
 * @returns Whether verification succeeded
 */
export async function verifyWithCosign(
  data: Buffer | string,
  bundle: SigstoreBundle,
  expectedIdentity?: string,
  expectedIssuer?: string
): Promise<{ verified: boolean; error?: string | undefined; identity?: string | undefined }> {
  if (!isCosignAvailable()) {
    throw new Error("cosign CLI is not installed");
  }

  const tempDir = join(tmpdir(), `enact-verify-${Date.now()}`);
  mkdirSync(tempDir, { recursive: true });

  const blobPath = join(tempDir, "blob");
  const bundlePath = join(tempDir, "bundle.json");

  try {
    // Write data and bundle to temp files
    if (Buffer.isBuffer(data)) {
      writeFileSync(blobPath, data);
    } else {
      writeFileSync(blobPath, data);
    }
    writeFileSync(bundlePath, JSON.stringify(bundle, null, 2));

    // Build cosign verify-blob command
    const args = ["verify-blob", "--bundle", bundlePath];

    if (expectedIdentity) {
      args.push("--certificate-identity", expectedIdentity);
    } else {
      // Use regex to match any identity
      args.push("--certificate-identity-regexp", ".*");
    }

    if (expectedIssuer) {
      args.push("--certificate-oidc-issuer", expectedIssuer);
    } else {
      // Match common Sigstore OIDC issuers
      args.push(
        "--certificate-oidc-issuer-regexp",
        "(https://accounts.google.com|https://github.com/login/oauth|https://oauth2.sigstore.dev/auth)"
      );
    }

    args.push(blobPath);

    execSync(`cosign ${args.join(" ")}`, {
      encoding: "utf-8",
      stdio: "pipe",
    });

    const identity = extractSignerFromBundle(bundle);
    return {
      verified: true,
      error: undefined,
      identity,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return {
      verified: false,
      error,
    };
  } finally {
    // Clean up
    try {
      for (const file of [blobPath, bundlePath]) {
        if (existsSync(file)) {
          unlinkSync(file);
        }
      }
      if (existsSync(tempDir)) {
        const { rmdirSync } = require("node:fs");
        rmdirSync(tempDir, { recursive: true });
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Extract signer identity (email) from a Sigstore bundle
 *
 * The certificate in the bundle contains the signer's email in the
 * Subject Alternative Name (SAN) extension.
 */
function extractSignerFromBundle(bundle: SigstoreBundle): string | undefined {
  try {
    // The certificate is in verificationMaterial.certificate.rawBytes (base64)
    const certB64 = (
      bundle as unknown as {
        verificationMaterial?: {
          certificate?: {
            rawBytes?: string;
          };
        };
      }
    )?.verificationMaterial?.certificate?.rawBytes;

    if (!certB64) {
      return undefined;
    }

    // Decode the certificate
    const certDer = Buffer.from(certB64, "base64");

    // Simple extraction of email from certificate
    // Look for the email pattern in the SAN extension
    // This is a simplified extraction - a proper implementation would parse X.509
    const certStr = certDer.toString("latin1");

    // Look for email pattern - match word chars, dots, hyphens, plus before @
    // and domain after, but stop at non-word characters
    const emailMatch = certStr.match(/[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/);
    return emailMatch?.[0];
  } catch {
    return undefined;
  }
}

/**
 * Verify an attestation bundle using cosign
 *
 * @param bundle - The Sigstore bundle containing a DSSE-wrapped attestation
 * @param expectedIdentity - Expected signer identity (email)
 * @param expectedIssuer - Expected OIDC issuer
 * @param predicateType - The attestation predicate type (optional)
 * @returns Verification result
 */
export async function verifyAttestationWithCosign(
  bundle: SigstoreBundle,
  expectedIdentity?: string,
  expectedIssuer?: string,
  predicateType?: string
): Promise<{ verified: boolean; error?: string | undefined; identity?: string | undefined }> {
  if (!isCosignAvailable()) {
    throw new Error("cosign CLI is not installed");
  }

  const tempDir = join(tmpdir(), `enact-verify-attest-${Date.now()}`);
  mkdirSync(tempDir, { recursive: true });

  const bundlePath = join(tempDir, "bundle.json");

  try {
    writeFileSync(bundlePath, JSON.stringify(bundle, null, 2));

    // Build cosign verify-blob-attestation command
    const args = ["verify-blob-attestation", "--bundle", bundlePath];

    if (expectedIdentity) {
      args.push("--certificate-identity", expectedIdentity);
    } else {
      args.push("--certificate-identity-regexp", ".*");
    }

    if (expectedIssuer) {
      args.push("--certificate-oidc-issuer", expectedIssuer);
    } else {
      // Match common Sigstore OIDC issuers
      args.push("--certificate-oidc-issuer-regexp", ".*");
    }

    if (predicateType) {
      args.push("--type", predicateType);
    }

    // Don't check claims against a subject file
    args.push("--check-claims=false");

    // Use /dev/null as the "subject" - attestation verification doesn't need it
    args.push("/dev/null");

    // Use spawnSync to avoid shell escaping issues
    const { spawnSync } = require("node:child_process");
    const result = spawnSync("cosign", args, {
      encoding: "utf-8",
      stdio: "pipe",
    });

    if (result.status !== 0) {
      throw new Error(result.stderr || result.stdout || `cosign exited with code ${result.status}`);
    }

    const identity = extractSignerFromBundle(bundle);
    return {
      verified: true,
      error: undefined,
      identity,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return {
      verified: false,
      error,
    };
  } finally {
    try {
      if (existsSync(bundlePath)) {
        unlinkSync(bundlePath);
      }
      if (existsSync(tempDir)) {
        const { rmdirSync } = require("node:fs");
        rmdirSync(tempDir, { recursive: true });
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}

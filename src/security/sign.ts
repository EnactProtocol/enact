// enact-signer.ts - Exact webapp compatibility

import * as crypto from 'crypto';
import { parse, stringify } from 'yaml';
import * as fs from 'fs';
import * as path from 'path';

/**
 * EXACT copy of webapp's createCanonicalToolDefinition
 * This MUST match the webapp's cryptoService function exactly
 */
function createCanonicalToolDefinition(tool: Record<string, unknown>): Record<string, unknown> {
  const canonical: Record<string, unknown> = {};
  
  // CRITICAL: These must be in the exact same order as the webapp
  const orderedFields = [
    'name', 'description', 'command', 'protocol_version', 'version', 
    'timeout', 'tags', 'input_schema', 'output_schema', 'annotations', 
    'env_vars', 'examples', 'resources', 'doc', 'authors', 'enact'
  ];
  
  // Add fields in the specific order
  for (const field of orderedFields) {
    if (tool[field] !== undefined) {
      canonical[field] = tool[field];
    }
  }
  
  // Add any remaining fields not in the ordered list (sorted)
  const remainingFields = Object.keys(tool)
    .filter(key => !orderedFields.includes(key))
    .sort();
    
  for (const field of remainingFields) {
    if (tool[field] !== undefined) {
      canonical[field] = tool[field];
    }
  }
  
  return canonical;
}

/**
 * Create canonical tool JSON EXACTLY like the webapp does
 * This mirrors the webapp's createCanonicalToolJson function
 */
function createCanonicalToolJson(toolData: any): string {
  // Convert Tool to the format expected by createCanonicalToolDefinition
  // CRITICAL: Use the exact same field mapping as the webapp
  const toolRecord: Record<string, unknown> = {
    name: toolData.name,
    description: toolData.description,
    command: toolData.command,
    // Map database fields to canonical fields (EXACT webapp mapping)
    protocol_version: toolData.protocol_version,
    version: toolData.version,
    timeout: toolData.timeout,
    tags: toolData.tags,
    // Handle schema field mappings (use underscore versions like webapp)
    input_schema: toolData.input_schema,    // NOT inputSchema
    output_schema: toolData.output_schema,  // NOT outputSchema
    annotations: toolData.annotations,
    env_vars: toolData.env_vars,           // NOT env
    examples: toolData.examples,
    resources: toolData.resources,
    doc: toolData.doc,  // Use direct field, not from raw_content
    authors: toolData.authors,  // Use direct field, not from raw_content
    // Add enact field if missing (webapp behavior)
    enact: toolData.enact || '1.0.0'
  };

  // Use the standardized canonical function from cryptoService
  const canonical = createCanonicalToolDefinition(toolRecord);
  
  // Return deterministic JSON with sorted keys EXACTLY like webapp
  return JSON.stringify(canonical, Object.keys(canonical).sort());
}

// Updated interfaces for new protocol
interface SignatureData {
  algorithm: string;
  type: string;
  signer: string;
  created: string;
  value: string;
  role?: string;
}

interface EnactTool {
  name: string;
  description: string;
  command: string;
  timeout?: string;
  tags?: string[];
  version?: string;
  enact?: string;
  protocol_version?: string;
  input_schema?: any;      // Use underscore version
  output_schema?: any;     // Use underscore version
  annotations?: any;
  env_vars?: Record<string, any>;  // Use underscore version (not env)
  examples?: any;
  resources?: any;
  raw_content?: string;
  // New multi-signature format: public key -> signature data
  signatures?: Record<string, SignatureData>;
  [key: string]: any;
}

// Verification policies
interface VerificationPolicy {
  requireRoles?: string[];        // Require signatures with specific roles
  minimumSignatures?: number;     // Minimum number of valid signatures
  trustedSigners?: string[];      // Only accept signatures from these signers
  allowedAlgorithms?: string[];   // Allowed signature algorithms
}

const DEFAULT_POLICY: VerificationPolicy = {
  minimumSignatures: 1,
  allowedAlgorithms: ['sha256']
};

// Default directory for trusted keys
const TRUSTED_KEYS_DIR = path.join(process.env.HOME || '.', '.enact', 'trusted-keys');

/**
 * Get all trusted public keys mapped by their base64 representation
 * @returns Map of base64 public key -> PEM content
 */
export function getTrustedPublicKeysMap(): Map<string, string> {
  const trustedKeys = new Map<string, string>();
  
  // Load keys from the filesystem
  if (fs.existsSync(TRUSTED_KEYS_DIR)) {
    try {
      const files = fs.readdirSync(TRUSTED_KEYS_DIR);
      
      for (const file of files) {
        if (file.endsWith('.pem')) {
          const keyPath = path.join(TRUSTED_KEYS_DIR, file);
          const pemContent = fs.readFileSync(keyPath, 'utf8');
          
          // Convert PEM to base64 for map key
          const base64Key = pemToBase64(pemContent);
          trustedKeys.set(base64Key, pemContent);
        }
      }
    } catch (error) {
      console.error(`Error reading trusted keys: ${(error as Error).message}`);
    }
  }
  
  return trustedKeys;
}

/**
 * Convert PEM public key to base64 format for use as map key
 */
function pemToBase64(pem: string): string {
  return pem
    .replace(/-----BEGIN PUBLIC KEY-----/, '')
    .replace(/-----END PUBLIC KEY-----/, '')
    .replace(/\s/g, '');
}

/**
 * Convert base64 key back to PEM format
 */
function base64ToPem(base64: string): string {
  return `-----BEGIN PUBLIC KEY-----\n${base64.match(/.{1,64}/g)?.join('\n')}\n-----END PUBLIC KEY-----`;
}

/**
 * Sign an Enact tool and add to the signatures map
 * Uses EXACT same process as webapp for perfect compatibility
 */
export async function signTool(
  toolPath: string, 
  privateKeyPath: string,
  publicKeyPath: string,
  signerInfo: { id: string; role?: string },
  outputPath?: string
): Promise<string> {
  // Read files
  const toolYaml = fs.readFileSync(toolPath, 'utf8');
  const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
  const publicKeyPem = fs.readFileSync(publicKeyPath, 'utf8');
  
  // Parse the YAML
  const tool = parse(toolYaml) as EnactTool;
  
  // Create a copy for signing (without signatures)
  const toolForSigning: EnactTool = { ...tool };
  delete toolForSigning.signatures;
  
  // Use EXACT same canonical JSON creation as webapp
  const canonicalJson = createCanonicalToolJson(toolForSigning);
  
  console.error('=== SIGNING DEBUG (WEBAPP COMPATIBLE) ===');
  console.error('Tool for signing:', JSON.stringify(toolForSigning, null, 2));
  console.error('Canonical JSON (webapp format):', canonicalJson);
  console.error('Canonical JSON length:', canonicalJson.length);
  console.error('==========================================');
  
  // Create tool hash exactly like webapp (SHA-256 hash of canonical JSON)
  const toolHashBytes = await hashTool(toolForSigning);
  
  // Sign using Web Crypto API to match webapp exactly
  const { webcrypto } = await import('node:crypto');
  
  // Import the private key for Web Crypto API
  const privateKeyData = crypto.createPrivateKey({
    key: privateKey,
    format: 'pem',
    type: 'pkcs8'
  }).export({ format: 'der', type: 'pkcs8' });
  
  const privateKeyObj = await webcrypto.subtle.importKey(
    'pkcs8',
    privateKeyData,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  
  // Sign the hash bytes using Web Crypto API (produces IEEE P1363 format)
  const signatureArrayBuffer = await webcrypto.subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    privateKeyObj,
    toolHashBytes
  );
  
  const signature = new Uint8Array(signatureArrayBuffer);
  const signatureB64 = Buffer.from(signature).toString('base64');
  
  console.error('Generated signature (Web Crypto API):', signatureB64);
  console.error('Signature length:', signature.length, 'bytes (should be 64 for P-256)');
  
  // Convert public key to base64 for map key
  const publicKeyBase64 = pemToBase64(publicKeyPem);
  
  // Initialize signatures object if it doesn't exist
  if (!tool.signatures) {
    tool.signatures = {};
  }
  
  // Add signature to the map using public key as key
  tool.signatures[publicKeyBase64] = {
    algorithm: 'sha256',
    type: 'ecdsa-p256',
    signer: signerInfo.id,
    created: new Date().toISOString(),
    value: signatureB64,
    ...(signerInfo.role && { role: signerInfo.role })
  };
  
  // Convert back to YAML
  const signedToolYaml = stringify(tool);
  
  // Write to output file if specified
  if (outputPath) {
    fs.writeFileSync(outputPath, signedToolYaml);
  }
  
  return signedToolYaml;
}

/**
 * Hash tool data for signing - EXACT copy of webapp's hashTool function
 */
async function hashTool(tool: Record<string, unknown>): Promise<Uint8Array> {
  // Create canonical representation
  const canonical = createCanonicalToolDefinition(tool);
  
  // Remove signature if present to avoid circular dependency
  const { signature, ...toolForSigning } = canonical;
  
  // Create deterministic JSON with sorted keys
  const canonicalJson = JSON.stringify(toolForSigning, Object.keys(toolForSigning).sort());
  
  console.error('🔍 Canonical JSON for hashing:', canonicalJson);
  console.error('🔍 Canonical JSON length:', canonicalJson.length);
  
  // Hash the canonical JSON
  const encoder = new TextEncoder();
  const data = encoder.encode(canonicalJson);
  
  // Use Web Crypto API for hashing to match webapp exactly
  const { webcrypto } = await import('node:crypto');
  const hashBuffer = await webcrypto.subtle.digest('SHA-256', data);
  
  const hashBytes = new Uint8Array(hashBuffer);
  console.error('🔍 SHA-256 hash length:', hashBytes.length, 'bytes (should be 32)');
  
  return hashBytes;
}

/**
 * Verify tool signature using EXACT same process as webapp
 * This mirrors the webapp's verifyToolSignature function exactly
 */
export async function verifyToolSignature(
  toolObject: Record<string, unknown>,
  signatureB64: string, 
  publicKeyObj: CryptoKey
): Promise<boolean> {
  try {
    // Hash the tool (same process as signing) - EXACT webapp logic
    const toolHash = await hashTool(toolObject);
    
    // Convert Base64 signature to bytes EXACTLY like webapp
    const signatureBytes = new Uint8Array(
      atob(signatureB64).split('').map(char => char.charCodeAt(0))
    );
    
    console.error('🔍 Tool hash byte length:', toolHash.length, '(should be 32 for SHA-256)');
    console.error('🔍 Signature bytes length:', signatureBytes.length, '(should be 64 for P-256)');
    
    // Use Web Crypto API for verification (matches webapp exactly)
    const { webcrypto } = await import('node:crypto');
    const isValid = await webcrypto.subtle.verify(
      { name: 'ECDSA', hash: { name: 'SHA-256' } },
      publicKeyObj,
      signatureBytes,
      toolHash
    );
    
    console.error('🎯 Web Crypto API verification result:', isValid);
    return isValid;
  } catch (error) {
    console.error('❌ Verification error:', error);
    return false;
  }
}

/**
 * Verify an Enact tool with embedded signatures against trusted keys
 * Uses the exact same canonical format and verification approach as the webapp
 */
export async function verifyTool(
  toolYaml: string | EnactTool, 
  policy: VerificationPolicy = DEFAULT_POLICY
): Promise<{
  isValid: boolean;
  message: string;
  validSignatures: number;
  totalSignatures: number;
  verifiedSigners: Array<{ signer: string; role?: string; keyId: string }>;
  errors: string[];
}> {
  const errors: string[] = [];
  const verifiedSigners: Array<{ signer: string; role?: string; keyId: string }> = [];
  
  try {
    // Get trusted public keys
    const trustedKeys = getTrustedPublicKeysMap();
    if (trustedKeys.size === 0) {
      return {
        isValid: false,
        message: 'No trusted public keys available',
        validSignatures: 0,
        totalSignatures: 0,
        verifiedSigners: [],
        errors: ['No trusted keys configured']
      };
    }
    
    if (process.env.DEBUG) {
      console.error('Trusted keys available:');
      for (const [key, pem] of trustedKeys.entries()) {
        console.error(`  Key: ${key.substring(0, 20)}...`);
      }
    }
    
    // Parse the tool if it's YAML string
    const tool: EnactTool = typeof toolYaml === 'string' ? parse(toolYaml) : toolYaml;
    
    // Check if tool has signatures
    if (!tool.signatures || Object.keys(tool.signatures).length === 0) {
      return {
        isValid: false,
        message: 'No signatures found in the tool',
        validSignatures: 0,
        totalSignatures: 0,
        verifiedSigners: [],
        errors: ['No signatures found']
      };
    }
    
    const totalSignatures = Object.keys(tool.signatures).length;
    
    // Create canonical JSON for verification (without signatures)
    const toolForVerification: EnactTool = { ...tool };
    delete toolForVerification.signatures;
    
    // Use EXACT same canonical JSON creation as webapp
    const toolHashBytes = await hashTool(toolForVerification);
    
    // Debug output for verification
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG) {
      console.error('=== VERIFICATION DEBUG (WEBAPP COMPATIBLE) ===');
      console.error('Original tool signature field:', Object.keys(tool.signatures || {}));
      console.error('Tool before removing signatures:', JSON.stringify(tool, null, 2));
      console.error('Tool for verification:', JSON.stringify(toolForVerification, null, 2));
      console.error('Tool hash bytes length:', toolHashBytes.length, '(should be 32 for SHA-256)');
      console.error('==============================================');
    }
    
    // Verify each signature
    let validSignatures = 0;
    
    for (const [publicKeyBase64, signatureData] of Object.entries(tool.signatures)) {
      try {
        // Check if algorithm is allowed
        if (policy.allowedAlgorithms && !policy.allowedAlgorithms.includes(signatureData.algorithm)) {
          errors.push(`Signature by ${signatureData.signer}: unsupported algorithm ${signatureData.algorithm}`);
          continue;
        }
        
        // Check if signer is trusted (if policy specifies trusted signers)
        if (policy.trustedSigners && !policy.trustedSigners.includes(signatureData.signer)) {
          errors.push(`Signature by ${signatureData.signer}: signer not in trusted list`);
          continue;
        }
        
        // Check if we have this public key in our trusted keys
        const publicKeyPem = trustedKeys.get(publicKeyBase64);
        if (!publicKeyPem) {
          // Try to reconstruct PEM from base64 if not found directly
          const reconstructedPem = base64ToPem(publicKeyBase64);
          if (!trustedKeys.has(pemToBase64(reconstructedPem))) {
            errors.push(`Signature by ${signatureData.signer}: public key not trusted`);
            continue;
          }
        }
        
        if (process.env.DEBUG) {
          console.error('Looking for public key:', publicKeyBase64);
          console.error('Key found in trusted keys:', !!publicKeyPem);
        }
        
        // Verify the signature using Web Crypto API (webapp compatible)
        let isValid = false;
        try {
          const publicKeyToUse = publicKeyPem || base64ToPem(publicKeyBase64);
          
          if (process.env.DEBUG) {
            console.error('Signature base64:', signatureData.value);
            console.error('Signature buffer length (should be 64):', Buffer.from(signatureData.value, 'base64').length);
            console.error('Public key base64:', publicKeyBase64);
          }
          
          if (signatureData.type === 'ecdsa-p256') {
            // Use Web Crypto API to match webapp exactly
            const { webcrypto } = await import('node:crypto');
            
            // Import the public key (convert PEM to raw key data like webapp)
            const publicKeyData = crypto.createPublicKey({
              key: publicKeyToUse,
              format: 'pem',
              type: 'spki'
            }).export({ format: 'der', type: 'spki' });
            
            const publicKeyObj = await webcrypto.subtle.importKey(
              'spki',
              publicKeyData,
              { name: 'ECDSA', namedCurve: 'P-256' },
              false,
              ['verify']
            );
            
            // Use the centralized verification function (webapp compatible)
            isValid = await verifyToolSignature(toolForVerification, signatureData.value, publicKeyObj);
            
            if (process.env.DEBUG) {
              console.error('Web Crypto API verification result (webapp compatible):', isValid);
            }
          } else {
            // Fallback for other signature types
            const verify = crypto.createVerify('SHA256');
            const canonicalJson = createCanonicalToolJson(toolForVerification);
            verify.update(canonicalJson, 'utf8');
            const signature = Buffer.from(signatureData.value, 'base64');
            isValid = verify.verify(publicKeyToUse, signature);
          }
        } catch (verifyError) {
          errors.push(`Signature by ${signatureData.signer}: verification error - ${(verifyError as Error).message}`);
          continue;
        }
        
        if (isValid) {
          validSignatures++;
          verifiedSigners.push({
            signer: signatureData.signer,
            role: signatureData.role,
            keyId: publicKeyBase64.substring(0, 8) // First 8 chars as key ID
          });
        } else {
          errors.push(`Signature by ${signatureData.signer}: cryptographic verification failed`);
        }
        
      } catch (error) {
        errors.push(`Signature by ${signatureData.signer}: verification error - ${(error as Error).message}`);
      }
    }
    
    // Apply policy checks
    const policyErrors: string[] = [];
    
    // Check minimum signatures
    if (policy.minimumSignatures && validSignatures < policy.minimumSignatures) {
      policyErrors.push(`Policy requires ${policy.minimumSignatures} signatures, but only ${validSignatures} valid`);
    }
    
    // Check required roles
    if (policy.requireRoles && policy.requireRoles.length > 0) {
      const verifiedRoles = verifiedSigners.map(s => s.role).filter(Boolean);
      const missingRoles = policy.requireRoles.filter(role => !verifiedRoles.includes(role));
      if (missingRoles.length > 0) {
        policyErrors.push(`Policy requires roles: ${missingRoles.join(', ')}`);
      }
    }
    
    const isValid = policyErrors.length === 0 && validSignatures > 0;
    const allErrors = [...errors, ...policyErrors];
    
    let message: string;
    if (isValid) {
      message = `Tool "${tool.name}" verified with ${validSignatures}/${totalSignatures} valid signatures`;
      if (verifiedSigners.length > 0) {
        const signerInfo = verifiedSigners.map(s => 
          `${s.signer}${s.role ? ` (${s.role})` : ''}`
        ).join(', ');
        message += ` from: ${signerInfo}`;
      }
    } else {
      message = `Tool "${tool.name}" verification failed: ${allErrors[0] || 'Unknown error'}`;
    }
    
    return {
      isValid,
      message,
      validSignatures,
      totalSignatures,
      verifiedSigners,
      errors: allErrors
    };
    
  } catch (error) {
    return {
      isValid: false,
      message: `Verification error: ${(error as Error).message}`,
      validSignatures: 0,
      totalSignatures: 0,
      verifiedSigners: [],
      errors: [(error as Error).message]
    };
  }
}

/**
 * Check if a tool should be executed based on verification policy
 * @param tool Tool to check
 * @param policy Verification policy
 * @returns Whether execution should proceed
 */
export async function shouldExecuteTool(
  tool: EnactTool, 
  policy: VerificationPolicy = DEFAULT_POLICY
): Promise<{ allowed: boolean; reason: string }> {
  const verification = await verifyTool(tool, policy);
  
  if (verification.isValid) {
    return { 
      allowed: true, 
      reason: `Verified: ${verification.message}` 
    };
  } else {
    return { 
      allowed: false, 
      reason: `Verification failed: ${verification.message}` 
    };
  }
}

/**
 * Generate a new ECC key pair
 */
export function generateKeyPair(
  outputDir: string, 
  prefix = 'enact'
): { privateKeyPath: string; publicKeyPath: string } {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  
  const privateKeyPath = path.join(outputDir, `${prefix}-private.pem`);
  const publicKeyPath = path.join(outputDir, `${prefix}-public.pem`);
  
  fs.writeFileSync(privateKeyPath, privateKey);
  fs.writeFileSync(publicKeyPath, publicKey);
  
  return { privateKeyPath, publicKeyPath };
}

/**
 * Add a public key to trusted keys
 */
export function addTrustedKey(keyPath: string, keyName?: string): string {
  if (!fs.existsSync(TRUSTED_KEYS_DIR)) {
    fs.mkdirSync(TRUSTED_KEYS_DIR, { recursive: true });
  }
  
  const keyContent = fs.readFileSync(keyPath, 'utf8');
  const fileName = keyName || `trusted-key-${Date.now()}.pem`;
  const trustedKeyPath = path.join(TRUSTED_KEYS_DIR, fileName);
  
  fs.writeFileSync(trustedKeyPath, keyContent);
  return trustedKeyPath;
}

/**
 * List all trusted keys with their base64 representations
 */
export function listTrustedKeys(): Array<{ 
  id: string;
  filename: string;
  base64Key: string;
  fingerprint: string;
}> {
  const keyInfo: Array<{ id: string; filename: string; base64Key: string; fingerprint: string }> = [];
  
  if (fs.existsSync(TRUSTED_KEYS_DIR)) {
    try {
      const files = fs.readdirSync(TRUSTED_KEYS_DIR);
      
      for (const file of files) {
        if (file.endsWith('.pem')) {
          const keyPath = path.join(TRUSTED_KEYS_DIR, file);
          const keyContent = fs.readFileSync(keyPath, 'utf8');
          const base64Key = pemToBase64(keyContent);
          
          const fingerprint = crypto
            .createHash('sha256')
            .update(keyContent)
            .digest('hex')
            .substring(0, 16);
          
          keyInfo.push({
            id: base64Key.substring(0, 8),
            filename: file,
            base64Key,
            fingerprint
          });
        }
      }
    } catch (error) {
      console.error(`Error reading trusted keys: ${(error as Error).message}`);
    }
  }
  
  return keyInfo;
}

// Export verification policies for use in CLI/MCP server
export const VERIFICATION_POLICIES = {
  // Permissive: any valid signature from trusted key
  PERMISSIVE: {
    minimumSignatures: 1,
    allowedAlgorithms: ['sha256']
  } as VerificationPolicy,
  
  // Strict: require author + reviewer signatures
  ENTERPRISE: {
    minimumSignatures: 2,
    requireRoles: ['author', 'reviewer'],
    allowedAlgorithms: ['sha256']
  } as VerificationPolicy,
  
  // Maximum security: require author + reviewer + approver
  PARANOID: {
    minimumSignatures: 3,
    requireRoles: ['author', 'reviewer', 'approver'],
    allowedAlgorithms: ['sha256']
  } as VerificationPolicy
};

// Export types for use in other modules
export type { EnactTool, VerificationPolicy, SignatureData };

# Backend Verification Implementation Guide

**Document Version**: 1.0  
**Last Updated**: 2025-07-12  
**Audience**: Frontend Developers  

This document describes the exact implementation of tool signature verification in the Enact CLI backend, ensuring frontend signing implementations can generate compatible signatures.

## Overview

The backend verification process in the Enact CLI follows these steps:
1. **Fetch Tool Definition** from the registry
2. **Create Canonical JSON** using the same process as signing
3. **Import Public Keys** from trusted key storage
4. **Verify Signatures** using Web Crypto API
5. **Apply Security Policies** to determine execution approval

## Critical Implementation Details

### 1. Canonical JSON Generation Process

The backend uses a **three-step process** that must be matched exactly by the frontend:

```javascript
function createCanonicalToolJson(toolData) {
  // Step 1: Create canonical representation with field filtering
  const canonical = createCanonicalToolDefinition(toolData);
  
  // Step 2: Extra cleaning step - remove any remaining empty objects
  const cleanedCanonical = {};
  for (const [key, value] of Object.entries(canonical)) {
    if (!isEmpty(value)) {
      cleanedCanonical[key] = deepSortKeys(value); // Sort individual values
    }
  }
  
  // Step 3: Create deterministic JSON
  return JSON.stringify(cleanedCanonical);
}
```

#### Step 1: Field Selection and Mapping

The backend includes only security-critical fields with proper mapping:

```javascript
function createCanonicalToolDefinition(tool) {
  const canonical = {};

  // Core required fields - only add if not empty
  if (tool.name && !isEmpty(tool.name)) {
    canonical.name = tool.name;
  }
  if (tool.description && !isEmpty(tool.description)) {
    canonical.description = tool.description;
  }
  if (tool.command && !isEmpty(tool.command)) {
    canonical.command = tool.command;
  }
  
  // Protocol version mapping: protocol_version OR enact → enact
  const enactValue = tool.enact || tool.protocol_version;
  if (enactValue && !isEmpty(enactValue)) {
    canonical.enact = enactValue;
  }
  
  // Tool version
  if (tool.version && !isEmpty(tool.version)) {
    canonical.version = tool.version;
  }
  
  // Container/execution environment
  if (tool.from && !isEmpty(tool.from)) {
    canonical.from = tool.from;
  }
  
  // Execution timeout
  if (tool.timeout && !isEmpty(tool.timeout)) {
    canonical.timeout = tool.timeout;
  }
  
  // Input schema mapping: input_schema OR inputSchema → inputSchema
  const inputSchemaValue = tool.input_schema || tool.inputSchema;
  if (inputSchemaValue && !isEmpty(inputSchemaValue)) {
    canonical.inputSchema = inputSchemaValue;
  }
  
  // Environment variables mapping: env_vars OR env → env
  const envValue = tool.env_vars || tool.env;
  if (envValue && !isEmpty(envValue)) {
    canonical.env = envValue;
  }
  
  // Execution metadata/annotations
  if (tool.annotations && !isEmpty(tool.annotations)) {
    canonical.annotations = tool.annotations;
  }

  return canonical;
}
```

**Field Inclusion Rules:**
- ✅ **Included**: `name`, `description`, `command`, `enact`, `version`, `from`, `timeout`, `inputSchema`, `env`, `annotations`
- ❌ **Excluded**: `tags`, `outputSchema`, `examples`, `resources`, `doc`, `authors`, `license`, `created_at`, `updated_at`, etc.

**Field Mapping Rules:**
- `input_schema` OR `inputSchema` → `inputSchema` (canonical)
- `env_vars` OR `env` → `env` (canonical)
- `protocol_version` OR `enact` → `enact` (canonical)

#### Step 2: Empty Object Detection

The backend uses this exact `isEmpty()` function:

```javascript
function isEmpty(value) {
  if (value === null || value === undefined || value === '') {
    return true;
  }
  if (typeof value === 'object' && value !== null) {
    if (Array.isArray(value)) {
      return value.length === 0;
    }
    return Object.keys(value).length === 0; // Empty objects are removed
  }
  return false;
}
```

**Critical**: Empty objects `{}` are completely excluded from the canonical representation.

#### Step 3: Deep Key Sorting

The backend recursively sorts all object keys alphabetically:

```javascript
function deepSortKeys(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(deepSortKeys); // Arrays preserve order, elements are sorted
  }
  
  const sortedObj = {};
  const keys = Object.keys(obj).sort(); // Alphabetical sorting
  for (const key of keys) {
    sortedObj[key] = deepSortKeys(obj[key]); // Recursive sorting
  }
  return sortedObj;
}
```

### 2. Expected Canonical JSON Format

For the `kgroves88/hello-world` tool, the backend generates this exact canonical JSON:

```json
{
  "annotations": {
    "destructiveHint": false,
    "idempotentHint": true,
    "openWorldHint": false,
    "readOnlyHint": true
  },
  "command": "echo 'Hello, ${name}! Welcome to Enact Protocol.'",
  "description": "A simple greeting tool that says hello to a person",
  "enact": "1.0.0",
  "inputSchema": {
    "properties": {
      "name": {
        "default": "World",
        "description": "Name of the person to greet",
        "type": "string"
      }
    },
    "required": ["name"],
    "type": "object"
  },
  "name": "kgroves88/hello-world",
  "timeout": "10s",
  "version": "1.0.0"
}
```

**Key Characteristics:**
- **Length**: 469 characters (no whitespace)
- **All keys sorted alphabetically** at every nesting level
- **Empty objects excluded** (no `{}` values)
- **Consistent field mapping** applied

### 3. Hashing Process

The backend creates a SHA-256 hash of the canonical JSON:

```javascript
async function hashTool(canonicalJson) {
  const encoder = new TextEncoder();
  const data = encoder.encode(canonicalJson);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(hashBuffer);
}
```

**Expected Values:**
- **Input**: Canonical JSON string (469 characters)
- **Output**: 32-byte hash (SHA-256)

### 4. Public Key Management

The backend loads trusted public keys from `~/.enact/trusted-keys/`:

```javascript
function getTrustedPublicKeysMap() {
  const trustedKeys = new Map();
  
  // Load .pem files from trusted keys directory
  const files = fs.readdirSync(TRUSTED_KEYS_DIR);
  
  for (const file of files) {
    if (file.endsWith('.pem')) {
      const pemContent = fs.readFileSync(path.join(TRUSTED_KEYS_DIR, file), 'utf8');
      
      // Convert PEM to base64 for map key
      const base64Key = pemToBase64(pemContent);
      trustedKeys.set(base64Key, pemContent);
    }
  }
  
  return trustedKeys;
}

function pemToBase64(pem) {
  return pem
    .replace(/-----BEGIN PUBLIC KEY-----/, "")
    .replace(/-----END PUBLIC KEY-----/, "")
    .replace(/\s/g, "");
}
```

### 5. Signature Verification Process

The backend verifies signatures using Web Crypto API:

```javascript
async function verifyToolSignature(toolObject, signatureB64, publicKeyObj) {
  try {
    // Create canonical representation (same as signing)
    const canonicalJson = createCanonicalToolJson(toolObject);
    
    // Hash the canonical JSON
    const toolHash = await hashTool(canonicalJson);

    // Convert Base64 signature to bytes using same method as frontend
    const signatureBytes = new Uint8Array(
      atob(signatureB64)
        .split("")
        .map((char) => char.charCodeAt(0)),
    );

    // Verify using Web Crypto API
    const isValid = await crypto.subtle.verify(
      { name: "ECDSA", hash: { name: "SHA-256" } },
      publicKeyObj,
      signatureBytes,
      toolHash,
    );

    return isValid;
  } catch (error) {
    console.error('Verification error:', error);
    return false;
  }
}
```

### 6. Signature Metadata Format

The backend expects this signature format in the tool registry:

```javascript
{
  "signatures": {
    "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE...": {  // Public key as base64
      "algorithm": "sha256",
      "type": "ecdsa-p256", 
      "signer": "71e02e2c-148c-4534-9900-bd9646e99333",
      "created": "2025-07-12T18:24:40.751+00:00",
      "value": "zx0vXeNCdJ0KRJeLr4Mj/aTF/9l4w2J21HwSXPWlJWAlj5vNENcRYdVQ5ShFE2FH+j0PaopSKc6rDN2892+vLw==",
      "role": "author"
    }
  }
}
```

## Frontend Implementation Requirements

### 1. Must Use Identical Canonical JSON Generation

Your frontend MUST generate the exact same canonical JSON as shown above. Any difference will cause verification failure.

### 2. Base64 Encoding Compatibility

Use this exact method for signature encoding:

```javascript
// ✅ CORRECT - Matches backend verification
const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)));

// ❌ INCORRECT - Will fail verification  
const signatureB64 = Buffer.from(signature).toString('base64');
```

### 3. Cryptographic Parameters

**Required Parameters:**
- **Algorithm**: ECDSA P-256
- **Hash**: SHA-256
- **Key Format**: SPKI (Subject Public Key Info)
- **Signature Format**: IEEE P1363 (Web Crypto API default)

### 4. Tool Field Processing

**Before signing, your frontend must:**
1. **Map field names** according to the rules above
2. **Remove empty objects** completely
3. **Sort all keys** recursively
4. **Include only security-critical fields**

## Debugging and Verification

### 1. Canonical JSON Validation

To verify your frontend generates correct canonical JSON:

```javascript
function validateCanonicalJson(generatedJson) {
  const expected = `{"annotations":{"destructiveHint":false,"idempotentHint":true,"openWorldHint":false,"readOnlyHint":true},"command":"echo 'Hello, \${name}! Welcome to Enact Protocol.'","description":"A simple greeting tool that says hello to a person","enact":"1.0.0","inputSchema":{"properties":{"name":{"default":"World","description":"Name of the person to greet","type":"string"}},"required":["name"],"type":"object"},"name":"kgroves88/hello-world","timeout":"10s","version":"1.0.0"}`;
  
  console.log('✅ Length matches:', generatedJson.length === 469);
  console.log('✅ Content matches:', generatedJson === expected);
  
  return generatedJson === expected;
}
```

### 2. Signature Length Validation

```javascript
function validateSignature(signatureB64) {
  const signatureBytes = atob(signatureB64);
  console.log('✅ Signature length:', signatureBytes.length); // Should be 64 for P-256
  console.log('✅ Base64 length:', signatureB64.length);      // Should be ~88-96 chars
}
```

### 3. Hash Verification

```javascript
async function validateHash(canonicalJson) {
  const encoder = new TextEncoder();
  const data = encoder.encode(canonicalJson);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hash = new Uint8Array(hashBuffer);
  
  console.log('✅ Hash length:', hash.length); // Should be 32
  console.log('✅ Hash (hex):', Array.from(hash).map(b => b.toString(16).padStart(2, '0')).join(''));
}
```

## Common Issues and Solutions

### Issue 1: Verification Always Fails

**Cause**: Canonical JSON mismatch  
**Solution**: Compare your generated canonical JSON character-by-character with the expected format

### Issue 2: "Public Key Not Trusted" Error

**Cause**: Public key not in `~/.enact/trusted-keys/`  
**Solution**: Ensure the public key PEM file is saved in the correct directory

### Issue 3: "Signature Length Incorrect" Error

**Cause**: Wrong Base64 encoding method  
**Solution**: Use `btoa(String.fromCharCode(...new Uint8Array(signature)))`

### Issue 4: Empty Objects Included

**Cause**: Not filtering empty objects properly  
**Solution**: Ensure `{}` objects are completely excluded from canonical representation

## Testing Checklist

Before deploying frontend signing changes:

- [ ] **Canonical JSON exactly matches backend format**
- [ ] **All empty objects are excluded**
- [ ] **All keys are sorted alphabetically at every level**
- [ ] **Field mappings are applied correctly**
- [ ] **Base64 encoding uses btoa() method**
- [ ] **Signature length is 64 bytes (88-96 base64 chars)**
- [ ] **Hash length is 32 bytes**

## Integration Flow

1. **Frontend**: Generate canonical JSON using the exact process above
2. **Frontend**: Create SHA-256 hash of canonical JSON
3. **Frontend**: Sign hash using ECDSA P-256 with Web Crypto API
4. **Frontend**: Encode signature using `btoa(String.fromCharCode(...))`
5. **Frontend**: Submit tool with signature metadata to registry
6. **Backend**: Fetch tool from registry
7. **Backend**: Generate identical canonical JSON
8. **Backend**: Verify signature using Web Crypto API
9. **Backend**: Allow execution if verification passes

## Contact and Support

If verification is still failing after following this guide:

1. **Enable debug logging** in your frontend implementation
2. **Compare canonical JSON** character-by-character with expected output
3. **Verify signature encoding** method matches exactly
4. **Check public key** is correctly formatted and trusted

## Version History

- **v1.0** (2025-07-12): Initial implementation matching Enact CLI verification process

---

**Important**: This document describes the exact implementation in the Enact CLI backend. Any deviation from these specifications will result in signature verification failure.
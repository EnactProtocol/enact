# @enactprotocol/security

[![npm version](https://badge.fury.io/js/@enactprotocol%2Fsecurity.svg)](https://www.npmjs.com/package/@enactprotocol/security)
[![npm downloads](https://img.shields.io/npm/dm/@enactprotocol/security.svg)](https://www.npmjs.com/package/@enactprotocol/security)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

> **Cryptographic signing library for Enact Protocol documents with configurable field selection**

A comprehensive TypeScript security library providing cryptographic signing and verification for Enact Protocol tool definitions. Features cross-platform compatibility, field-specific signing, and full Enact Protocol compliance.

**✨ Perfect for**: Enact Protocol tools, multi-party signatures, sensitive data protection, cross-platform applications

## 📦 Packages

| Package | Description | Environment |
|---------|-------------|-------------|
| `@enactprotocol/security` | Backend/Node.js signing library | Server-side |
| `@enactprotocol/security-web` | Frontend/Browser signing library | Client-side |

## ⚡ Getting Started in 30 Seconds

```bash
# Install the package
npm install @enactprotocol/security

# Create and run this file
echo 'import { SigningService, CryptoUtils } from "@enactprotocol/security";

const tool = {
  name: "my-org/hello-world", 
  description: "My first tool",
  command: "echo \"Hello \${name}!\""
};

const keys = CryptoUtils.generateKeyPair();
const signature = SigningService.signDocument(tool, keys.privateKey, { useEnactDefaults: true });
const isValid = SigningService.verifyDocument(tool, signature, { useEnactDefaults: true });

console.log("✅ Signature valid:", isValid);' > test.mjs

node test.mjs
```

## 🚀 Quick Start

### Backend/Node.js Installation

```bash
npm install @enactprotocol/security
# or
yarn add @enactprotocol/security
# or  
bun add @enactprotocol/security
```

### Frontend/Browser Installation

```bash
npm install @enactprotocol/security-web
# or
yarn add @enactprotocol/security-web
# or
bun add @enactprotocol/security-web
```

### 🎮 Try the Interactive Examples

We've created working examples you can try immediately:

**📱 Web Demo**: Interactive browser application
```bash
git clone https://github.com/enactprotocol/security
cd security/example-web-app
npm install && npm run dev
# Open http://localhost:5173
```

**🖥️ Backend Demo**: Command-line demonstration
```bash
cd security/example-backend-app
npm install && node demo.js
```

## 🔧 Usage Examples

### Backend/Node.js Usage

```typescript
import { 
  SigningService, 
  CryptoUtils, 
  EnactFieldSelector,
  type EnactDocument 
} from '@enactprotocol/security';

// Generate a key pair
const keyPair = CryptoUtils.generateKeyPair();
console.log('Private key:', keyPair.privateKey);
console.log('Public key:', keyPair.publicKey);

// Define an Enact tool
const tool: EnactDocument = {
  name: "acme-corp/formatting/prettier",
  description: "Auto-formats JavaScript and TypeScript code",
  command: "npx prettier@3.3.3 --write '${file}'",
  enact: "1.0.0",
  version: "1.2.0",
  from: "node:18-alpine",
  timeout: "30s",
  annotations: {
    destructiveHint: true,
    title: "Code Formatter"
  },
  inputSchema: {
    type: "object",
    properties: {
      file: { type: "string", description: "File to format" }
    },
    required: ["file"]
  }
};

// Sign with Enact Protocol defaults (security-critical fields only)
const signature = SigningService.signDocument(tool, keyPair.privateKey, {
  useEnactDefaults: true
});

console.log('Signature:', signature.signature);
console.log('Public key:', signature.publicKey);

// Verify the signature
const isValid = SigningService.verifyDocument(tool, signature, {
  useEnactDefaults: true
});

console.log('Signature valid:', isValid); // true
```

### Frontend/Browser Usage

```typescript
import { 
  SigningService, 
  CryptoUtils,
  type EnactDocument 
} from '@enactprotocol/security-web';

// Same API as backend - works identically in browsers
const keyPair = CryptoUtils.generateKeyPair();

const tool: EnactDocument = {
  name: "my-org/web-tool",
  description: "A browser-based tool",
  command: "echo 'Hello from browser'",
  enact: "1.0.0"
};

// Sign and verify - identical to backend usage
const signature = SigningService.signDocument(tool, keyPair.privateKey, {
  useEnactDefaults: true
});

const isValid = SigningService.verifyDocument(tool, signature, {
  useEnactDefaults: true
});
```

## 🎯 Common Use Cases

### ✅ **Standard Enact Tool Signing** (Recommended)
Perfect for most Enact Protocol tools:
```typescript
const signature = SigningService.signDocument(tool, privateKey, {
  useEnactDefaults: true  // Signs all security-critical fields
});
```

### 🏢 **Enterprise Multi-Party Approval**
Different teams sign different aspects:
```typescript
// Developer signs core functionality
const devSignature = SigningService.signDocument(tool, devPrivateKey, {
  includeFields: ["name", "command", "description", "inputSchema"]
});

// Security team signs security aspects  
const secSignature = SigningService.signDocument(tool, secPrivateKey, {
  includeFields: ["annotations", "env", "from", "timeout"]
});
```

### 🔒 **Sensitive Data Protection**
Exclude confidential information from signatures:
```typescript
const signature = SigningService.signDocument(tool, privateKey, {
  useEnactDefaults: true,
  excludeFields: ["env", "metadata", "secrets"]  // Keep sensitive data private
});
```

### ⚡ **Minimal Signing** 
Sign only essential fields for performance:
```typescript
const signature = SigningService.signDocument(tool, privateKey, {
  includeFields: ["name", "command", "version"]  // Minimal signature
});
```

### 🌐 **Cross-Platform Verification**
Frontend creates, backend verifies (or vice versa):
```typescript
// Frontend (browser)
import { SigningService } from '@enactprotocol/security-web';
const signature = SigningService.signDocument(tool, privateKey, { useEnactDefaults: true });

// Backend (Node.js) - verifies frontend signature perfectly!
import { SigningService } from '@enactprotocol/security';
const isValid = SigningService.verifyDocument(tool, signature, { useEnactDefaults: true });
```

## 🔐 Field-Specific Signing

### Enact Protocol Default Signing

Signs only the **security-critical fields** defined by the Enact Protocol:

```typescript
const signature = SigningService.signDocument(tool, privateKey, {
  useEnactDefaults: true  // Signs: annotations, command, description, enact, env, from, inputSchema, name, timeout, version
});

// See which fields are signed
const signedFields = SigningService.getSignedFields({ useEnactDefaults: true });
console.log('Signed fields:', signedFields);
// Output: ['annotations', 'command', 'description', 'enact', 'env', 'from', 'inputSchema', 'name', 'timeout', 'version']
```

### Custom Field Selection

Sign only specific fields you care about:

```typescript
const signature = SigningService.signDocument(tool, privateKey, {
  includeFields: ["name", "command", "version", "license"]
});

// View the canonical document that gets signed
const canonical = SigningService.getCanonicalDocument(tool, {
  includeFields: ["name", "command", "version", "license"]
});
console.log('Canonical document:', canonical);
```

### Additional Critical Fields

Extend Enact defaults with extra fields:

```typescript
const signature = SigningService.signDocument(tool, privateKey, {
  useEnactDefaults: true,
  additionalCriticalFields: ["license", "tags", "authors"]
});
```

### Field Exclusion

Remove sensitive fields from signatures:

```typescript
const signature = SigningService.signDocument(tool, privateKey, {
  useEnactDefaults: true,
  excludeFields: ["env", "metadata"]  // Exclude potentially sensitive data
});
```

### Generic Document Signing

For non-Enact documents, use generic defaults:

```typescript
const document = {
  id: "contract-123",
  content: "Terms and conditions...",
  timestamp: Date.now(),
  metadata: { type: "contract" }
};

const signature = SigningService.signDocument(document, privateKey, {
  useEnactDefaults: false  // Uses generic defaults: id, content, timestamp
});
```

## 🌐 Cross-Platform Compatibility

Signatures created on the backend can be verified on the frontend and vice versa:

```typescript
// Backend creates signature
const backendSignature = BackendSigningService.signDocument(tool, privateKey, {
  useEnactDefaults: true
});

// Frontend verifies signature - works perfectly!
const isValid = FrontendSigningService.verifyDocument(tool, backendSignature, {
  useEnactDefaults: true
});
console.log('Cross-platform verification:', isValid); // true
```

## 🔑 Key Management

### Generate Key Pairs

```typescript
import { CryptoUtils } from '@enactprotocol/security';

// Generate a new key pair
const keyPair = CryptoUtils.generateKeyPair();

// Derive public key from existing private key
const publicKey = CryptoUtils.getPublicKeyFromPrivate(existingPrivateKey);
```

### Backend Key Manager

The backend package includes a key management utility:

```typescript
import { KeyManager } from '@enactprotocol/security';

// Generate and store a key pair
const keyPair = KeyManager.generateAndStoreKey('my-signing-key');

// Retrieve stored key
const storedKey = KeyManager.getKey('my-signing-key');

// Import existing key
KeyManager.importKey('imported-key', existingPrivateKey);

// List all stored keys
const keyIds = KeyManager.listKeys();
```

## 📋 Complete API Reference

### Core Functions

#### `SigningService.signDocument(document, privateKey, options?)`

Signs a document with configurable field selection.

**Parameters:**
- `document: EnactDocument` - Document to sign
- `privateKey: string` - Hex-encoded private key
- `options?: SigningOptions` - Signing configuration

**Options:**
```typescript
interface SigningOptions {
  algorithm?: 'secp256k1';           // Signature algorithm (default: 'secp256k1')
  useEnactDefaults?: boolean;        // Use Enact protocol critical fields (default: false)
  includeFields?: string[];          // Specific fields to include
  excludeFields?: string[];          // Fields to exclude from signing
  additionalCriticalFields?: string[]; // Extra fields to add to Enact defaults
}
```

**Returns:**
```typescript
interface Signature {
  signature: string;    // Hex-encoded signature
  publicKey: string;    // Hex-encoded public key
  algorithm: string;    // Signature algorithm used
  timestamp: number;    // Signature creation timestamp
}
```

#### `SigningService.verifyDocument(document, signature, options?)`

Verifies a document signature.

**Parameters:**
- `document: EnactDocument` - Document to verify
- `signature: Signature` - Signature object to verify
- `options?: SigningOptions` - Must match signing options

**Returns:** `boolean` - True if signature is valid

#### `SigningService.getCanonicalDocument(document, options?)`

Returns the canonical document that gets signed.

**Returns:** `Record<string, any>` - Canonical document object

#### `SigningService.getSignedFields(options?)`

Returns the list of fields that will be signed with given options.

**Returns:** `string[]` - Array of field names

### Utility Functions

#### `CryptoUtils.generateKeyPair()`

Generates a new secp256k1 key pair.

**Returns:**
```typescript
{
  privateKey: string;  // Hex-encoded private key
  publicKey: string;   // Hex-encoded public key
}
```

#### `CryptoUtils.getPublicKeyFromPrivate(privateKey)`

Derives public key from private key.

#### `CryptoUtils.hash(data)`

Creates SHA-256 hash of data.

#### `CryptoUtils.sign(privateKey, messageHash)`

Signs a message hash.

#### `CryptoUtils.verify(publicKey, messageHash, signature)`

Verifies a signature.

### Field Selectors

#### `EnactFieldSelector`

Pre-configured selector for Enact Protocol security-critical fields:
- `annotations`, `command`, `description`, `enact`, `env`, `from`, `inputSchema`, `name`, `timeout`, `version`

#### `GenericFieldSelector`

Pre-configured selector for generic documents:
- `id`, `content`, `timestamp`

#### `FieldSelector`

Create custom field configurations:

```typescript
import { FieldSelector, type FieldConfig } from '@enactprotocol/security';

const customConfig: FieldConfig[] = [
  { name: 'title', required: true, securityCritical: true },
  { name: 'content', required: true, securityCritical: true },
  { name: 'metadata', required: false, securityCritical: false }
];

const customSelector = new FieldSelector(customConfig);
```

## 🧪 Testing

Run the comprehensive test suite:

```bash
# Backend tests
cd packages/security && bun test

# Frontend tests  
cd packages/security-web && bun test

# Cross-platform compatibility test
bun run cross-platform-test.ts

# Field-specific signing tests
bun run field-specific-test.ts
```

## 🛡️ Security Features

- **🔐 secp256k1 ECDSA Signatures** - Industry-standard elliptic curve cryptography
- **📋 Enact Protocol Compliance** - Follows official Enact specification for field selection
- **🎯 Configurable Security** - Choose exactly which fields to include in signatures
- **🚫 Empty Field Exclusion** - Automatically excludes null, empty strings, and empty objects
- **🔄 Deterministic Signing** - Produces identical signatures for identical inputs
- **🌐 Cross-Platform Verified** - Backend and frontend signatures are fully compatible

## 📖 Advanced Examples

### Multi-Party Signing

```typescript
// Party 1 signs core fields
const authorSignature = SigningService.signDocument(tool, authorPrivateKey, {
  includeFields: ["name", "command", "description"]
});

// Party 2 signs security-critical fields
const securitySignature = SigningService.signDocument(tool, securityPrivateKey, {
  useEnactDefaults: true
});

// Verify both signatures
const authorValid = SigningService.verifyDocument(tool, authorSignature, {
  includeFields: ["name", "command", "description"]
});

const securityValid = SigningService.verifyDocument(tool, securitySignature, {
  useEnactDefaults: true
});
```

### Sensitive Data Protection

```typescript
// Sign everything except sensitive environment variables
const signature = SigningService.signDocument(tool, privateKey, {
  useEnactDefaults: true,
  excludeFields: ["env", "secrets", "apiKeys"]
});
```

### Custom Security Policy

```typescript
// Corporate security policy: sign metadata + Enact defaults
const corporateSignature = SigningService.signDocument(tool, privateKey, {
  useEnactDefaults: true,
  additionalCriticalFields: [
    "license",
    "authors", 
    "approval",
    "security-review"
  ]
});
```

## 🔧 Development Setup

```bash
# Clone the repository
git clone <repository-url>
cd enact-security

# Install dependencies
bun install

# Build both packages
bun run build

# Run all tests
bun test

# Run examples
bun run examples/enact-signing-examples.ts
```

## 🚨 Troubleshooting

### **"Cannot find module" errors**
Make sure you're using the correct import:
```typescript
// ✅ Correct - use default import
import { SigningService } from '@enactprotocol/security';

// ❌ Incorrect
import SigningService from '@enactprotocol/security';
```

### **Signature verification fails**
Ensure you use the same field selection for signing and verification:
```typescript
const options = { useEnactDefaults: true };
const signature = SigningService.signDocument(tool, privateKey, options);
const isValid = SigningService.verifyDocument(tool, signature, options); // Same options!
```

### **Cross-platform signatures don't match**
This is expected! Signatures include timestamps, so they'll be different each time. Verification should still work:
```typescript
// Different signatures (different timestamps) ✅
// But verification works across platforms ✅
```

### **Browser compatibility issues**
The web package requires modern browsers with Web Crypto API support:
- Chrome 37+, Firefox 34+, Safari 7+, Edge 12+
- Use HTTPS in production (required for Web Crypto API)

### **TypeScript errors**
Make sure you have the latest TypeScript definitions:
```bash
npm update @types/node  # For backend
```

### **Need help?**
- 📖 [Check the examples](./example-web-app) for working code
- 🐛 [Open an issue](https://github.com/enactprotocol/security/issues) 
- 💬 [Start a discussion](https://github.com/enactprotocol/security/discussions)

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality  
4. Ensure all tests pass
5. Submit a pull request

## 🆘 Support

- 📖 [Enact Protocol Specification](https://enactprotocol.com)
- 🐛 [Issue Tracker](https://github.com/enactprotocol/security/issues)
- 💬 [Discussions](https://github.com/enactprotocol/security/discussions)

---

**Ready to secure your Enact Protocol tools? Install the packages and start signing! 🚀**
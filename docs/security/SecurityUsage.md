# Security Configuration Usage Guide

This document provides practical examples for using the security configuration features in the Enact Protocol security library.

## Quick Start

```typescript
import { SigningService, CryptoUtils, DEFAULT_SECURITY_CONFIG } from '@enactprotocol/security';
import type { SecurityConfig } from '@enactprotocol/security';

// Create a document to sign
const tool = {
  name: "my-org/hello-world",
  description: "A simple greeting tool",
  command: "echo 'Hello ${name}!'",
  enact: "1.0.0"
};

// Generate keys
const keyPair = CryptoUtils.generateKeyPair();

// Sign the document
const signature = SigningService.signDocument(tool, keyPair.privateKey, {
  useEnactDefaults: true
});

// Verify with default config (minimumSignatures: 1, allowLocalUnsigned: true)
const isValid = SigningService.verifyDocument(tool, signature, {
  useEnactDefaults: true
});

console.log('Valid:', isValid); // true
```

## Security Configuration Options

### Basic Configuration

```typescript
interface SecurityConfig {
  allowLocalUnsigned?: boolean;  // Allow documents without signatures
  minimumSignatures?: number;    // Minimum number of signatures required
}

// Default configuration
const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  allowLocalUnsigned: true,
  minimumSignatures: 1
};
```

## Common Usage Patterns

### 1. Permissive Mode (Default)
**Use case**: Development, local tools, single-developer workflows

```typescript
const permissiveConfig: SecurityConfig = {
  allowLocalUnsigned: true,
  minimumSignatures: 1
};

// This will pass even with no signatures
const documentWithoutSignatures = {
  name: "local-tool",
  command: "echo 'local'",
  signatures: [] // Empty signatures array
};

const isValid = SigningService.verifyDocument(
  documentWithoutSignatures,
  {} as any, // Dummy signature
  { useEnactDefaults: true },
  permissiveConfig
);
console.log('Valid:', isValid); // true
```

### 2. Single Signature Required
**Use case**: Personal tools, simple validation

```typescript
const singleSignatureConfig: SecurityConfig = {
  allowLocalUnsigned: false,
  minimumSignatures: 1
};

// Must have at least one valid signature
const signature = SigningService.signDocument(tool, keyPair.privateKey, {
  useEnactDefaults: true
});

const isValid = SigningService.verifyDocument(
  tool,
  signature,
  { useEnactDefaults: true },
  singleSignatureConfig
);
console.log('Valid:', isValid); // true
```

### 3. Multi-Party Approval
**Use case**: Enterprise environments, critical tools, compliance requirements

```typescript
const enterpriseConfig: SecurityConfig = {
  allowLocalUnsigned: false,
  minimumSignatures: 2
};

// Create multiple signatures from different parties
const developerKeys = CryptoUtils.generateKeyPair();
const reviewerKeys = CryptoUtils.generateKeyPair();

const devSignature = SigningService.signDocument(tool, developerKeys.privateKey, {
  useEnactDefaults: true
});

const reviewSignature = SigningService.signDocument(tool, reviewerKeys.privateKey, {
  useEnactDefaults: true
});

// Add signatures to document
const toolWithMultipleSignatures = {
  ...tool,
  signatures: [devSignature, reviewSignature]
};

const isValid = SigningService.verifyDocument(
  toolWithMultipleSignatures,
  devSignature, // This gets ignored since document has signatures array
  { useEnactDefaults: true },
  enterpriseConfig
);
console.log('Valid:', isValid); // true
```

### 4. Strict Security Mode
**Use case**: Production environments, sensitive operations

```typescript
const strictConfig: SecurityConfig = {
  allowLocalUnsigned: false,
  minimumSignatures: 3
};

// Requires 3 signatures: developer + reviewer + security team
const devSignature = SigningService.signDocument(tool, developerKeys.privateKey, {
  useEnactDefaults: true
});

const reviewSignature = SigningService.signDocument(tool, reviewerKeys.privateKey, {
  useEnactDefaults: true
});

const securityKeys = CryptoUtils.generateKeyPair();
const secSignature = SigningService.signDocument(tool, securityKeys.privateKey, {
  useEnactDefaults: true
});

const secureDocument = {
  ...tool,
  signatures: [devSignature, reviewSignature, secSignature]
};

const isValid = SigningService.verifyDocument(
  secureDocument,
  devSignature,
  { useEnactDefaults: true },
  strictConfig
);
console.log('Valid:', isValid); // true
```

## Configuration Scenarios

### Development Environment
```typescript
const devConfig: SecurityConfig = {
  allowLocalUnsigned: true,
  minimumSignatures: 1
};
// ✅ Allows unsigned local tools
// ✅ Single signature sufficient for signed tools
```

### Testing Environment
```typescript
const testConfig: SecurityConfig = {
  allowLocalUnsigned: false,
  minimumSignatures: 1
};
// ❌ Requires all tools to be signed
// ✅ Single signature sufficient
```

### Production Environment
```typescript
const prodConfig: SecurityConfig = {
  allowLocalUnsigned: false,
  minimumSignatures: 2
};
// ❌ No unsigned tools allowed
// ❌ Requires multiple signatures for approval
```

## Error Handling

### Insufficient Signatures
```typescript
const config: SecurityConfig = {
  allowLocalUnsigned: false,
  minimumSignatures: 2
};

const toolWithOneSignature = {
  ...tool,
  signatures: [signature] // Only 1 signature, need 2
};

const isValid = SigningService.verifyDocument(
  toolWithOneSignature,
  signature,
  { useEnactDefaults: true },
  config
);
console.log('Valid:', isValid); // false - insufficient signatures
```

### Invalid Signatures
```typescript
const invalidSignature = {
  signature: 'invalid_signature_data',
  publicKey: 'invalid_key',
  algorithm: 'secp256k1',
  timestamp: Date.now()
};

const toolWithInvalidSignature = {
  ...tool,
  signatures: [invalidSignature]
};

const isValid = SigningService.verifyDocument(
  toolWithInvalidSignature,
  invalidSignature,
  { useEnactDefaults: true }
);
console.log('Valid:', isValid); // false - cryptographically invalid
```

## Best Practices

### 1. Environment-Based Configuration
```typescript
const getSecurityConfig = (environment: string): SecurityConfig => {
  switch (environment) {
    case 'development':
      return {
        allowLocalUnsigned: true,
        minimumSignatures: 1
      };
    case 'staging':
      return {
        allowLocalUnsigned: false,
        minimumSignatures: 1
      };
    case 'production':
      return {
        allowLocalUnsigned: false,
        minimumSignatures: 2
      };
    default:
      return DEFAULT_SECURITY_CONFIG;
  }
};

const config = getSecurityConfig(process.env.NODE_ENV || 'development');
```

### 2. Gradual Security Increase
```typescript
// Start permissive, increase security over time
const phases = {
  phase1: { allowLocalUnsigned: true, minimumSignatures: 1 },   // Launch
  phase2: { allowLocalUnsigned: false, minimumSignatures: 1 },  // Require signing
  phase3: { allowLocalUnsigned: false, minimumSignatures: 2 }   // Require approval
};
```

### 3. Role-Based Workflows
```typescript
// Different signature requirements for different types of tools
const getConfigForTool = (toolType: string): SecurityConfig => {
  switch (toolType) {
    case 'utility':
      return { allowLocalUnsigned: true, minimumSignatures: 1 };
    case 'deployment':
      return { allowLocalUnsigned: false, minimumSignatures: 2 };
    case 'security':
      return { allowLocalUnsigned: false, minimumSignatures: 3 };
    default:
      return DEFAULT_SECURITY_CONFIG;
  }
};
```

## Integration Examples

### CLI Tool Integration
```typescript
import { SigningService } from '@enactprotocol/security';

class ToolVerifier {
  constructor(private securityConfig: SecurityConfig) {}

  async verifyTool(tool: EnactDocument): Promise<boolean> {
    // Tool must have at least one signature to verify
    if (!tool.signatures?.length && !this.securityConfig.allowLocalUnsigned) {
      return false;
    }

    // If no signatures and local unsigned allowed
    if (!tool.signatures?.length && this.securityConfig.allowLocalUnsigned) {
      return true;
    }

    // Verify signatures using first signature as reference
    return SigningService.verifyDocument(
      tool,
      tool.signatures[0],
      { useEnactDefaults: true },
      this.securityConfig
    );
  }
}

// Usage
const verifier = new ToolVerifier({
  allowLocalUnsigned: false,
  minimumSignatures: 2
});

const isToolValid = await verifier.verifyTool(someTool);
```

### Config File Integration
```typescript
// ~/.enact/security/config.json
{
  "minimumSignatures": 1,
  "allowLocalUnsigned": true
}

// Load configuration
import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const loadSecurityConfig = (): SecurityConfig => {
  try {
    const configPath = join(homedir(), '.enact', 'security', 'config.json');
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    
    return {
      allowLocalUnsigned: config.allowLocalUnsigned ?? true,
      minimumSignatures: config.minimumSignatures ?? 1
    };
  } catch {
    return DEFAULT_SECURITY_CONFIG;
  }
};

const config = loadSecurityConfig();
```

## Migration Guide

### From No Security Config
```typescript
// Before
const isValid = SigningService.verifyDocument(tool, signature, options);

// After  
const isValid = SigningService.verifyDocument(
  tool, 
  signature, 
  options,
  DEFAULT_SECURITY_CONFIG // Uses minimumSignatures: 1, allowLocalUnsigned: true
);
```

### Upgrading Security Gradually
```typescript
// Week 1: Start with permissive defaults
let config = DEFAULT_SECURITY_CONFIG;

// Week 2: Require signing for new tools
config = { ...config, allowLocalUnsigned: false };

// Week 4: Require multiple signatures for critical tools
if (tool.annotations?.critical) {
  config = { ...config, minimumSignatures: 2 };
}
```

## Summary

The security configuration system provides flexible verification policies that can adapt to different environments and security requirements:

- **Development**: Permissive, allows unsigned tools
- **Testing**: Requires signatures but single signature sufficient  
- **Production**: Strict multi-party approval required

Use the configuration to gradually increase security maturity while maintaining usability for developers.
# Enact Security Package Requirements

This document outlines the complete security functionality that needs to be implemented in the separate `@enactprotocol/security` npm package to replace the current embedded security implementation in enact-cli.

## Overview

The enact-security package should provide a comprehensive security framework for the Enact Protocol, handling cryptographic signing, verification, policy enforcement, and command safety analysis.

## Core Components Required

### 1. Cryptographic Signing Module

#### Key Management
```typescript
interface KeyManager {
  generateKeyPair(algorithm: 'ecdsa-p256' | 'secp256k1'): Promise<KeyPair>
  storeKey(keyId: string, key: PrivateKey, keyPath?: string): Promise<void>
  loadKey(keyId: string, keyPath?: string): Promise<PrivateKey>
  listKeys(keyPath?: string): Promise<string[]>
  deleteKey(keyId: string, keyPath?: string): Promise<void>
  exportPublicKey(keyId: string): Promise<string>
  importTrustedKey(keyId: string, publicKey: string): Promise<void>
  getTrustedKeys(): Promise<Map<string, PublicKey>>
}
```

#### Signing Functionality
```typescript
interface ToolSigner {
  signTool(tool: EnactTool, keyId: string, role?: string): Promise<Signature>
  signCriticalFields(tool: EnactTool, keyId: string, role?: string): Promise<Signature>
  addSignature(tool: EnactTool, signature: Signature): EnactTool
  removeSignature(tool: EnactTool, signerId: string): EnactTool
  getCanonicalRepresentation(tool: EnactTool): string
}
```

#### Verification Engine
```typescript
interface VerificationEngine {
  verifySignature(tool: EnactTool, signature: Signature): Promise<boolean>
  verifyAllSignatures(tool: EnactTool): Promise<VerificationResult[]>
  verifyPolicy(tool: EnactTool, policy: VerificationPolicy): Promise<PolicyResult>
  validateSignatureChain(tool: EnactTool): Promise<ChainValidationResult>
}
```

### 2. Security Policy Framework

#### Policy Types
```typescript
enum VerificationPolicy {
  PERMISSIVE = 'permissive',    // 1 valid signature required
  ENTERPRISE = 'enterprise',    // Author + reviewer (2 minimum)
  PARANOID = 'paranoid',        // Author + reviewer + approver (3 minimum)
  CUSTOM = 'custom'             // User-defined policy
}

interface PolicyConfig {
  policy: VerificationPolicy
  requiredRoles?: string[]
  minimumSignatures?: number
  trustedSigners?: string[]
  customValidation?: (tool: EnactTool) => Promise<boolean>
}
```

#### Policy Enforcement
```typescript
interface PolicyEnforcer {
  enforcePolicy(tool: EnactTool, config: PolicyConfig): Promise<PolicyResult>
  validateRoles(signatures: Signature[], requiredRoles: string[]): boolean
  checkSignatureThreshold(signatures: Signature[], minimum: number): boolean
  auditVerification(tool: EnactTool, result: PolicyResult): Promise<void>
}
```

### 3. Command Safety Analysis

#### Safety Analyzer
```typescript
interface CommandSafetyAnalyzer {
  analyzeCommand(command: string): SafetyAnalysis
  validateEnvironmentVariables(env: Record<string, string>): ValidationResult
  checkDestructivePatterns(command: string): DestructivePattern[]
  validateVersionPinning(command: string): PinningValidation
  sanitizeInput(input: string): string
}

interface SafetyAnalysis {
  isSafe: boolean
  risks: SecurityRisk[]
  warnings: SecurityWarning[]
  recommendations: string[]
}
```

#### Risk Assessment
```typescript
interface SecurityRisk {
  level: 'low' | 'medium' | 'high' | 'critical'
  category: 'destructive' | 'network' | 'filesystem' | 'execution' | 'injection'
  description: string
  pattern?: string
  mitigation?: string
}
```

### 4. Verification Enforcer

#### Central Enforcement
```typescript
interface VerificationEnforcer {
  shouldVerifyTool(tool: EnactTool, context: ExecutionContext): boolean
  enforceVerification(tool: EnactTool, policy: PolicyConfig): Promise<EnforcementResult>
  bypassVerification(tool: EnactTool, reason: string): Promise<void>
  auditSecurityEvent(event: SecurityEvent): Promise<void>
}

interface ExecutionContext {
  source: 'local' | 'registry' | 'remote'
  environment: 'development' | 'production' | 'testing'
  user?: string
  origin?: string
}
```

### 5. Data Types and Interfaces

#### Core Types
```typescript
interface EnactTool {
  name: string
  description: string
  command: string
  enact?: string
  version?: string
  from?: string
  timeout?: string
  signatures?: Signature[]
  [key: string]: any
}

interface Signature {
  signer: string
  algorithm: 'sha256'
  type: 'ecdsa-p256' | 'secp256k1'
  value: string
  created: string
  role?: string
}

interface KeyPair {
  publicKey: string
  privateKey: string
  algorithm: string
}

interface VerificationResult {
  valid: boolean
  signer: string
  error?: string
  timestamp: string
}

interface PolicyResult {
  passed: boolean
  policy: VerificationPolicy
  requiredSignatures: number
  validSignatures: number
  missingRoles: string[]
  errors: string[]
}
```

## Required Functionality

### 1. Field-Specific Signing
- Sign only security-critical fields: `name`, `description`, `command`, `from`, `timeout`, `enact`
- Exclude non-critical fields like `examples`, `doc`, `authors`
- Handle legacy field mappings
- Exclude null/undefined/empty values
- Generate deterministic canonical representations

### 2. Multi-Signature Support
- Support multiple signers per tool
- Role-based signatures (author, reviewer, approver)
- Signature aggregation and validation
- Conflict resolution for multiple signatures

### 3. Cross-Platform Compatibility
- Browser-compatible cryptography (Web Crypto API)
- Node.js native crypto support
- React Native compatibility
- Consistent behavior across platforms

### 4. Key Storage and Management
- Secure key storage in `~/.enact/trusted-keys/`
- Key import/export functionality
- Trusted key management
- Key rotation support

### 5. Security Audit and Logging
- Comprehensive security event logging
- Verification audit trails
- Performance metrics
- Error tracking and reporting

### 6. Command Safety Features
- Dangerous command pattern detection
- Environment variable sanitization
- Version pinning validation
- Network access validation
- Destructive operation detection

## Integration Requirements

### CLI Integration
```typescript
// The package should export these main interfaces
export {
  ToolSigner,
  VerificationEngine,
  PolicyEnforcer,
  CommandSafetyAnalyzer,
  VerificationEnforcer,
  KeyManager,
  VerificationPolicy,
  type EnactTool,
  type Signature,
  type PolicyConfig,
  type SafetyAnalysis
}
```

### Configuration
```typescript
interface SecurityConfig {
  keyStorePath?: string
  defaultPolicy?: VerificationPolicy
  trustedKeyRegistries?: string[]
  auditLogPath?: string
  bypassDevelopment?: boolean
  enableCommandSafety?: boolean
}
```

## Performance Requirements

- Signature verification: < 100ms per signature
- Command safety analysis: < 50ms per command
- Key operations: < 200ms
- Memory usage: < 50MB for typical workloads
- Support for concurrent operations

## Security Requirements

- Use industry-standard cryptographic algorithms (ECDSA P-256, secp256k1)
- Secure key storage with appropriate file permissions
- Protection against timing attacks
- Input validation and sanitization
- Secure random number generation
- No secret logging or exposure

## Testing Requirements

### Unit Tests
- Cryptographic operation validation
- Policy enforcement testing
- Command safety analysis
- Key management operations
- Error handling and edge cases

### Integration Tests
- Cross-platform compatibility
- Performance benchmarks
- Security vulnerability testing
- Real-world tool signing scenarios

### Security Tests
- Cryptographic strength validation
- Side-channel attack resistance
- Input fuzzing and validation
- Key material protection

## Documentation Requirements

### API Documentation
- Complete TypeScript definitions
- Usage examples for all interfaces
- Migration guide from embedded security
- Best practices and security guidelines

### Security Documentation
- Threat model analysis
- Security policy explanations
- Cryptographic algorithm justification
- Audit and compliance information

## Migration Strategy

### Phase 1: Package Creation
1. Create npm package structure
2. Implement core cryptographic functions
3. Add basic signing and verification
4. Create unit tests

### Phase 2: Feature Completion
1. Implement policy framework
2. Add command safety analysis
3. Complete key management
4. Add integration tests

### Phase 3: Integration
1. Update enact-cli to use the package
2. Remove embedded security code
3. Update documentation
4. Performance optimization

### Phase 4: Production Ready
1. Security audit
2. Performance benchmarking
3. Documentation completion
4. Release and deployment

## Dependencies

### Required Dependencies
- `@noble/secp256k1` - secp256k1 cryptography
- `@noble/curves` - ECDSA P-256 cryptography
- `canonicalize` - JSON canonicalization

### Optional Dependencies
- `winston` - Logging framework
- `joi` - Input validation
- `fs-extra` - Enhanced file operations

## Package Structure
```
@enactprotocol/security/
├── src/
│   ├── crypto/
│   │   ├── signing.ts
│   │   ├── verification.ts
│   │   └── keys.ts
│   ├── policy/
│   │   ├── enforcer.ts
│   │   └── policies.ts
│   ├── safety/
│   │   ├── analyzer.ts
│   │   └── patterns.ts
│   ├── storage/
│   │   └── keystore.ts
│   ├── types/
│   │   └── index.ts
│   └── index.ts
├── tests/
├── docs/
└── package.json
```

This security package will provide a complete, standalone security solution that can be used across all Enact Protocol implementations while maintaining the high security standards required for a cryptographic signing system.
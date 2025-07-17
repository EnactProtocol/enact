# Enact CLI Security Improvements: Moving Signature Verification to Execution Point

## Current Security Issues

### 1. Signature Verification Happens Too Early
Currently, signature verification occurs early in the execution flow, creating a significant security gap:

```typescript
// CLI exec command (packages/cli/src/commands/exec.ts)
if (!options.skipVerification) {
    const verification = await verifyTool(toolForVerification, policy);
    // ... lots of other processing ...
    // ... command building ...
    // ... environment resolution ...
    // ... ACTUAL EXECUTION happens much later
}
```

### 2. Multiple Bypass Mechanisms
- `--skip-verification` flag
- `skipVerification: true` option  
- `--force` flag continues on verification failure
- User confirmation prompt allows manual override
- Local files automatically skip verification

### 3. Time-of-Check-Time-of-Use (TOCTOU) Vulnerability
There's a significant gap between signature verification and actual execution, creating opportunities for:
- Tool manipulation between verification and execution
- Race conditions in multi-threaded environments
- Security bypass through different execution paths

## Security Improvements Implemented

### 1. Moved Verification to Execution Point
```typescript
// NEW: Verification happens immediately before execution
async executeTool(tool: EnactTool, inputs: Record<string, any> = {}, options: ToolExecuteOptions = {}): Promise<ExecutionResult> {
    // ... input validation and safety checks first ...
    
    // ⚠️ SECURITY: MANDATORY SIGNATURE VERIFICATION MUST BE LAST STEP BEFORE EXECUTION
    // This ensures verification cannot be bypassed through different execution paths
    const verificationResult = await enforceSignatureVerification(tool, {
        skipVerification: options.skipVerification,
        verifyPolicy: options.verifyPolicy,
        force: options.force,
        allowUnsigned: false, // Never allow unsigned tools in production
    });

    // Block execution if verification fails - NO EXCEPTIONS
    if (!verificationResult.allowed) {
        return createVerificationFailureResult(tool, verificationResult, executionId);
    }

    // 🔒 SECURITY CHECKPOINT PASSED - PROCEEDING WITH EXECUTION
    return await this.executionProvider.execute(tool, inputs, environment);
}
```

### 2. Benefits of This Approach
- **Eliminates TOCTOU vulnerabilities**: Verification happens immediately before execution
- **Centralized security**: All execution paths go through the same verification checkpoint
- **Atomic operation**: Verification and execution are coupled together
- **Audit trail**: Security decisions are logged at the execution point

## Additional Security Improvements Needed

### 1. Reduce Bypass Mechanisms
```typescript
// RECOMMENDED: Restrict skipVerification to development only
export async function enforceSignatureVerification(
    tool: EnactTool,
    options: VerificationEnforcementOptions = {},
): Promise<VerificationEnforcementResult> {
    // Only allow skipping in development environments
    if (options.skipVerification && process.env.NODE_ENV !== 'development') {
        logger.error(`🚨 SECURITY ERROR: skipVerification not allowed in production`);
        return {
            allowed: false,
            reason: 'Signature verification cannot be skipped in production',
            error: { message: 'Production environments require signature verification', code: 'SKIP_VERIFICATION_BLOCKED' }
        };
    }
    
    // ... rest of verification logic
}
```

### 2. Mandatory Verification for All Execution Paths
```typescript
// RECOMMENDED: Apply verification to ALL execution paths
const EXECUTION_PATHS = [
    'enact exec',           // CLI execution
    'MCP server execution', // MCP server execution  
    'Direct API calls',     // Direct library usage
    'Local file execution', // Local YAML files
];

// Each path MUST go through enforceSignatureVerification()
```

### 3. Enhanced Audit Logging
```typescript
// RECOMMENDED: Enhanced security audit logging
export function logSecurityAudit(
    tool: EnactTool,
    verificationResult: VerificationEnforcementResult,
    executionAllowed: boolean,
    options: any
) {
    const auditLog = {
        timestamp: new Date().toISOString(),
        tool: tool.name,
        version: tool.version,
        command: tool.command,
        executionAllowed,
        verificationResult: {
            isValid: verificationResult.verificationResult?.isValid || false,
            validSignatures: verificationResult.verificationResult?.validSignatures || 0,
            totalSignatures: verificationResult.verificationResult?.totalSignatures || 0,
            verifiedSigners: verificationResult.verificationResult?.verifiedSigners || [],
            errors: verificationResult.verificationResult?.errors || [],
        },
        securityFlags: {
            skipVerification: options.skipVerification || false,
            force: options.force || false,
            verifyPolicy: options.verifyPolicy || 'permissive',
            allowUnsigned: options.allowUnsigned || false,
        },
        environment: {
            nodeEnv: process.env.NODE_ENV,
            executionProvider: 'direct', // or 'dagger'
            pid: process.pid,
        }
    };
    
    // Log to security audit file
    logger.security('TOOL_EXECUTION_AUDIT', auditLog);
}
```

### 4. Remove User Confirmation Prompts
```typescript
// CURRENT: User can override security (BAD)
if (!verification.isValid && !options.force) {
    const shouldContinue = await p.confirm({
        message: "Tool signature verification failed. Continue anyway?",
        initialValue: false,
    });
    if (!shouldContinue) {
        return; // User cancelled
    }
}

// RECOMMENDED: No user override for security failures
if (!verification.isValid && !options.force) {
    throw new Error(`Tool signature verification failed: ${verification.message}`);
}
```

### 5. Strengthen Local File Verification
```typescript
// CURRENT: Local files skip verification (BAD)
if (isLocalFile) {
    executionPromise = enactCore.executeRawTool(yamlContent, inputs, {
        skipVerification: true, // This is a security hole
        // ...
    });
}

// RECOMMENDED: Local files should also be verified
if (isLocalFile) {
    executionPromise = enactCore.executeRawTool(yamlContent, inputs, {
        skipVerification: false, // Verify local files too
        verifyPolicy: 'permissive', // But use permissive policy
        // ...
    });
}
```

## Implementation Priority

1. **HIGH PRIORITY**: Move signature verification to execution point ✅ DONE
2. **HIGH PRIORITY**: Remove user confirmation prompts for security failures
3. **MEDIUM PRIORITY**: Restrict skipVerification to development only
4. **MEDIUM PRIORITY**: Apply verification to local files with permissive policy  
5. **LOW PRIORITY**: Enhanced audit logging

## Testing the Security Improvements

Run the security tests to verify the improvements:

```bash
cd /Users/keithgroves/projects/enact/enact-cli
bun test packages/shared/tests/security.test.ts
```

The tests should pass and verify that:
- Signature verification happens at the execution point
- Tools without valid signatures are blocked
- Multiple signature verification works correctly
- Security audit logging captures all relevant information

## Next Steps

1. Review and approve the security improvements
2. Implement the additional recommendations above
3. Update documentation to reflect security changes
4. Train developers on the new security model
5. Consider implementing a security policy configuration system

# Security Enhancement Implementation Plan

## 1. Remove CLI Bypass Mechanisms

### Remove --skip-verification Flag

**File:** `packages/cli/src/commands/exec.ts`

```typescript
// REMOVE these options from CLI:
// --skip-verification
// --force (for verification failures)

// REPLACE with environment-based development override:
const isDevelopment = process.env.NODE_ENV === 'development' || 
                     process.env.ENACT_ALLOW_UNSIGNED === 'true';

if (!isDevelopment) {
    // No bypass allowed in production
    options.skipVerification = false;
    options.force = false;
}
```

### Strengthen CLI Verification

```typescript
// In handleExecCommand, make verification mandatory:
if (!options.skipVerification || !isDevelopment) {
    const verification = await verifyTool(toolForVerification, policy);
    
    if (!verification.isValid) {
        // NO user prompt in production
        if (isDevelopment) {
            // Only allow bypass in development with clear warning
            console.error(pc.red("🚨 DEVELOPMENT MODE: Unsigned tool execution"));
            const shouldContinue = await p.confirm({
                message: "DEVELOPMENT ONLY: Continue with unsigned tool?",
                initialValue: false,
            });
            if (!shouldContinue) {
                process.exit(1);
            }
        } else {
            // Mandatory failure in production
            console.error(pc.red("❌ Tool signature verification failed"));
            console.error(pc.red("   Production security requires signed tools"));
            process.exit(1);
        }
    }
}
```

## 2. Secure MCP Server Execution

### Remove MCP Bypass Parameters

**File:** `packages/mcp-server/src/index.ts`

```typescript
// REMOVE skipVerification parameter from MCP tool schemas:
// skipVerification: z.boolean().optional()

// REPLACE with security-first approach:
const securityConfig = {
    allowUnsigned: process.env.ENACT_ALLOW_UNSIGNED === 'true',
    verificationPolicy: process.env.ENACT_VERIFY_POLICY || 'enterprise',
    logSecurityEvents: true
};

// Remove local file exemption:
if (isLocalFile) {
    // Even local files must be verified in production
    const yamlContent = await fs.readFile(toolToExecute.path, "utf-8");
    executionPromise = enactCore.executeRawTool(yamlContent, inputs, {
        timeout: timeout || "300s",
        verifyPolicy: securityConfig.verificationPolicy,
        skipVerification: securityConfig.allowUnsigned, // Only if explicitly allowed
        force: false, // Never force in production
        dryRun,
        verbose,
    });
}
```

## 3. Harden Core Execution

### Mandatory Verification Enforcement

**File:** `packages/shared/src/core/EnactCore.ts`

```typescript
// In executeTool method, strengthen verification:
async executeTool(
    tool: EnactTool,
    inputs: Record<string, any> = {},
    options: ToolExecuteOptions = {},
): Promise<ExecutionResult> {
    // ... existing code ...

    // 🔒 MANDATORY SECURITY CHECKPOINT - NO BYPASS ALLOWED
    const securityContext = {
        environment: process.env.NODE_ENV || 'production',
        allowUnsigned: process.env.ENACT_ALLOW_UNSIGNED === 'true',
        verificationPolicy: options.verifyPolicy || 'enterprise',
        executionPath: this.getExecutionPath(),
    };

    // Override any bypass attempts in production
    if (securityContext.environment === 'production') {
        options.skipVerification = false;
        options.force = false;
    }

    const verificationResult = await enforceSignatureVerification(tool, {
        skipVerification: securityContext.allowUnsigned && options.skipVerification,
        verifyPolicy: securityContext.verificationPolicy,
        force: false, // Never force in production
        allowUnsigned: securityContext.allowUnsigned,
        executionContext: securityContext,
    });

    // Log security audit - ALWAYS
    this.logSecurityEvent({
        tool: tool.name,
        action: 'execution_attempt',
        verificationResult,
        securityContext,
        timestamp: new Date().toISOString(),
    });

    // MANDATORY BLOCK - no exceptions in production
    if (!verificationResult.allowed) {
        return createVerificationFailureResult(tool, verificationResult, executionId);
    }

    // ... rest of execution ...
}
```

## 4. Security Audit Logging

### Add Comprehensive Security Logging

**File:** `packages/shared/src/security/security-logger.ts`

```typescript
export class SecurityLogger {
    private static instance: SecurityLogger;
    
    static getInstance(): SecurityLogger {
        if (!SecurityLogger.instance) {
            SecurityLogger.instance = new SecurityLogger();
        }
        return SecurityLogger.instance;
    }

    logSecurityEvent(event: SecurityEvent): void {
        const securityLog = {
            timestamp: new Date().toISOString(),
            level: 'SECURITY',
            ...event,
        };

        // Always log to console in production
        if (process.env.NODE_ENV === 'production') {
            console.error(JSON.stringify(securityLog));
        }

        // Log to file if specified
        if (process.env.ENACT_SECURITY_LOG_FILE) {
            this.writeToFile(securityLog);
        }

        // Send to security monitoring if configured
        if (process.env.ENACT_SECURITY_WEBHOOK) {
            this.sendToWebhook(securityLog);
        }
    }

    logVerificationBypass(tool: string, reason: string): void {
        this.logSecurityEvent({
            type: 'VERIFICATION_BYPASS',
            tool,
            reason,
            severity: 'HIGH',
            requiresReview: true,
        });
    }

    logUnsignedExecution(tool: string, context: any): void {
        this.logSecurityEvent({
            type: 'UNSIGNED_EXECUTION',
            tool,
            context,
            severity: 'HIGH',
            requiresReview: true,
        });
    }
}
```

## 5. Environment Configuration

### Secure Environment Variables

**File:** `packages/shared/src/config/security-config.ts`

```typescript
export class SecurityConfig {
    static getSecurityPolicy(): SecurityPolicy {
        const env = process.env.NODE_ENV || 'production';
        
        // Production defaults - most secure
        const productionDefaults = {
            allowUnsigned: false,
            verificationPolicy: 'enterprise',
            requireMultipleSignatures: true,
            logAllExecutions: true,
            blockDangerousCommands: true,
            enforceResourceLimits: true,
        };

        // Development overrides - with warnings
        const developmentOverrides = {
            allowUnsigned: process.env.ENACT_ALLOW_UNSIGNED === 'true',
            verificationPolicy: process.env.ENACT_VERIFY_POLICY || 'permissive',
            requireMultipleSignatures: false,
        };

        if (env === 'development') {
            const config = { ...productionDefaults, ...developmentOverrides };
            
            if (config.allowUnsigned) {
                console.warn('🚨 DEVELOPMENT MODE: Unsigned tool execution enabled');
                console.warn('   This is NOT safe for production use!');
            }
            
            return config;
        }

        // Production - no overrides allowed
        return productionDefaults;
    }
}
```

## 6. Testing Security Hardening

### Add Security Bypass Tests

**File:** `packages/shared/tests/security-bypass.test.ts`

```typescript
describe('Security Bypass Prevention', () => {
    test('should block --skip-verification in production', async () => {
        process.env.NODE_ENV = 'production';
        delete process.env.ENACT_ALLOW_UNSIGNED;
        
        const result = await enactCore.executeTool(unsignedTool, {}, {
            skipVerification: true  // This should be ignored
        });
        
        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('SIGNATURE_VERIFICATION_FAILED');
    });

    test('should log security bypass attempts', async () => {
        const logSpy = jest.spyOn(SecurityLogger.getInstance(), 'logVerificationBypass');
        
        await enactCore.executeTool(unsignedTool, {}, {
            skipVerification: true
        });
        
        expect(logSpy).toHaveBeenCalledWith(
            unsignedTool.name,
            'skipVerification=true attempted'
        );
    });

    test('should allow unsigned tools only in development with explicit flag', async () => {
        process.env.NODE_ENV = 'development';
        process.env.ENACT_ALLOW_UNSIGNED = 'true';
        
        const result = await enactCore.executeTool(unsignedTool, {}, {
            skipVerification: true
        });
        
        // Should succeed with warnings
        expect(result.success).toBe(true);
    });
});
```

## Implementation Timeline

### Week 1: Critical Security Hardening
- [ ] Remove CLI bypass flags
- [ ] Strengthen MCP server verification
- [ ] Add mandatory verification enforcement
- [ ] Implement security audit logging

### Week 2: Testing & Validation
- [ ] Add comprehensive security tests
- [ ] Test bypass prevention
- [ ] Validate production security
- [ ] Document security procedures

### Week 3: Production Deployment
- [ ] Deploy security hardening
- [ ] Monitor security events
- [ ] Validate no bypass mechanisms
- [ ] Security audit review

This implementation plan eliminates the bypass mechanisms while maintaining developer usability through environment-based configuration. The key is making security mandatory by default with explicit opt-out only in development environments.

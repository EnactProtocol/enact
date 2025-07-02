// src/security/verification-enforcer.ts - Mandatory signature verification enforcement
import { verifyTool, VERIFICATION_POLICIES, type VerificationPolicy } from './sign';
import type { EnactTool, ExecutionResult } from '../types';
import logger from '../exec/logger';

export interface VerificationEnforcementOptions {
  skipVerification?: boolean;
  verifyPolicy?: 'permissive' | 'enterprise' | 'paranoid';
  force?: boolean;
  allowUnsigned?: boolean; // Explicit flag for allowing unsigned tools (only for dev/testing)
}

export interface VerificationEnforcementResult {
  allowed: boolean;
  reason: string;
  verificationResult?: {
    isValid: boolean;
    message: string;
    validSignatures: number;
    totalSignatures: number;
    verifiedSigners: Array<{ signer: string; role?: string; keyId: string }>;
    errors: string[];
  };
  error?: {
    message: string;
    code: string;
    details?: any;
  };
}

/**
 * Enforce mandatory signature verification for tool execution
 * This is the central function that should be called before ANY tool execution
 */
export async function enforceSignatureVerification(
  tool: EnactTool,
  options: VerificationEnforcementOptions = {}
): Promise<VerificationEnforcementResult> {
  const toolName = tool.name || 'unknown';
  
  // Check if verification is explicitly skipped
  if (options.skipVerification) {
    logger.warn(`🚨 SECURITY WARNING: Signature verification skipped for tool: ${toolName}`);
    logger.warn(`   This bypasses security measures and is NOT recommended for production use!`);
    
    return {
      allowed: true,
      reason: `Verification skipped by request for tool: ${toolName}`,
      verificationResult: {
        isValid: false,
        message: 'Verification skipped',
        validSignatures: 0,
        totalSignatures: 0,
        verifiedSigners: [],
        errors: ['Signature verification was explicitly skipped']
      }
    };
  }

  // Check if tool has any signatures
  const hasSignatures = !!(tool.signatures && Object.keys(tool.signatures).length > 0) || !!tool.signature;
  
  if (!hasSignatures) {
    logger.warn(`⚠️  Tool has no signatures: ${toolName}`);
    
    // Only allow unsigned tools if explicitly permitted (for development/testing)
    if (options.allowUnsigned) {
      logger.warn(`   Allowing unsigned tool execution due to allowUnsigned flag (DEV/TEST ONLY)`);
      return {
        allowed: true,
        reason: `Unsigned tool allowed by explicit permission: ${toolName}`,
        verificationResult: {
          isValid: false,
          message: 'No signatures found, but execution allowed',
          validSignatures: 0,
          totalSignatures: 0,
          verifiedSigners: [],
          errors: ['Tool has no signatures but execution was explicitly allowed']
        }
      };
    }
    
    // Reject unsigned tools by default
    return {
      allowed: false,
      reason: `Tool has no signatures and unsigned execution is not permitted: ${toolName}`,
      error: {
        message: `Tool "${toolName}" has no cryptographic signatures. For security, only signed tools can be executed.`,
        code: 'NO_SIGNATURES_FOUND',
        details: {
          toolName,
          hasSignature: !!tool.signature,
          hasSignatures: !!tool.signatures,
          signatureCount: tool.signatures ? Object.keys(tool.signatures).length : 0
        }
      }
    };
  }

  // Perform signature verification
  try {
    logger.info(`🔐 Verifying signatures for tool: ${toolName}`);
    
    // Determine verification policy
    const policyKey = (options.verifyPolicy || 'permissive').toUpperCase() as 'PERMISSIVE' | 'ENTERPRISE' | 'PARANOID';
    const policy: VerificationPolicy = VERIFICATION_POLICIES[policyKey] || VERIFICATION_POLICIES.PERMISSIVE;
    
    logger.info(`   Using verification policy: ${policyKey.toLowerCase()}`);
    if (policy.minimumSignatures) {
      logger.info(`   Minimum signatures required: ${policy.minimumSignatures}`);
    }
    if (policy.requireRoles) {
      logger.info(`   Required roles: ${policy.requireRoles.join(', ')}`);
    }
    
    // Verify the tool
    const verificationResult = await verifyTool(tool, policy);
    
    if (verificationResult.isValid) {
      logger.info(`✅ Signature verification passed for tool: ${toolName}`);
      logger.info(`   Valid signatures: ${verificationResult.validSignatures}/${verificationResult.totalSignatures}`);
      
      if (verificationResult.verifiedSigners.length > 0) {
        logger.info(`   Verified signers: ${verificationResult.verifiedSigners
          .map(s => `${s.signer}${s.role ? ` (${s.role})` : ''}`)
          .join(', ')}`);
      }
      
      return {
        allowed: true,
        reason: `Tool signature verification passed: ${verificationResult.message}`,
        verificationResult
      };
    } else {
      logger.error(`❌ Signature verification failed for tool: ${toolName}`);
      logger.error(`   Policy: ${policyKey.toLowerCase()}`);
      logger.error(`   Valid signatures: ${verificationResult.validSignatures}/${verificationResult.totalSignatures}`);
      
      if (verificationResult.errors.length > 0) {
        logger.error(`   Errors:`);
        verificationResult.errors.forEach(error => logger.error(`     - ${error}`));
      }
      
      return {
        allowed: false,
        reason: `Tool signature verification failed: ${verificationResult.message}`,
        verificationResult,
        error: {
          message: `Tool "${toolName}" failed signature verification. ${verificationResult.message}`,
          code: 'SIGNATURE_VERIFICATION_FAILED',
          details: {
            toolName,
            policy: policyKey.toLowerCase(),
            validSignatures: verificationResult.validSignatures,
            totalSignatures: verificationResult.totalSignatures,
            errors: verificationResult.errors,
            verifiedSigners: verificationResult.verifiedSigners
          }
        }
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown verification error';
    logger.error(`💥 Signature verification error for tool: ${toolName} - ${errorMessage}`);
    
    return {
      allowed: false,
      reason: `Signature verification error: ${errorMessage}`,
      error: {
        message: `Signature verification failed due to error: ${errorMessage}`,
        code: 'VERIFICATION_ERROR',
        details: { toolName, originalError: error }
      }
    };
  }
}

/**
 * Create an execution result for verification failure
 */
export function createVerificationFailureResult(
  tool: EnactTool,
  verificationResult: VerificationEnforcementResult,
  executionId: string
): ExecutionResult {
  return {
    success: false,
    error: verificationResult.error || {
      message: verificationResult.reason,
      code: 'VERIFICATION_FAILED'
    },
    metadata: {
      executionId,
      toolName: tool.name || 'unknown',
      version: tool.version,
      executedAt: new Date().toISOString(),
      environment: 'direct',
      command: tool.command
    }
  };
}

/**
 * Log security audit information for tool execution
 */
export function logSecurityAudit(
  tool: EnactTool,
  verificationResult: VerificationEnforcementResult,
  executionAllowed: boolean,
  options: VerificationEnforcementOptions
) {
  const auditLog = {
    timestamp: new Date().toISOString(),
    tool: tool.name || 'unknown',
    version: tool.version,
    command: tool.command,
    executionAllowed,
    verificationSkipped: options.skipVerification || false,
    verificationPolicy: options.verifyPolicy || 'permissive',
    verificationResult: verificationResult.verificationResult ? {
      isValid: verificationResult.verificationResult.isValid,
      validSignatures: verificationResult.verificationResult.validSignatures,
      totalSignatures: verificationResult.verificationResult.totalSignatures,
      verifiedSigners: verificationResult.verificationResult.verifiedSigners
    } : null,
    errors: verificationResult.error ? [verificationResult.error.message] : []
  };
  
  logger.info(`🔍 Security Audit Log:`, auditLog);
}

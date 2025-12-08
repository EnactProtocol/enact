/**
 * Attestation generation module
 *
 * This module provides functions for creating in-toto attestations and SLSA provenance
 * statements that can be signed using Sigstore.
 */

import { hashContent, hashFile } from "../hash";
import type {
  EnactToolPredicate,
  InTotoStatement,
  InTotoSubject,
  SLSAProvenancePredicate,
  SLSAResourceDescriptor,
} from "./types";

// ============================================================================
// Constants
// ============================================================================

/**
 * The primary Enact website/registry URL
 * Used for attestation types, tool URLs, and documentation references
 */
export const ENACT_BASE_URL = "https://enact.tools";

/** in-toto statement type */
export const INTOTO_STATEMENT_TYPE = "https://in-toto.io/Statement/v1";

/** SLSA Provenance predicate type v1.0 */
export const SLSA_PROVENANCE_TYPE = "https://slsa.dev/provenance/v1";

/** Enact tool attestation predicate type */
export const ENACT_TOOL_TYPE = `${ENACT_BASE_URL}/attestation/tool/v1`;

/** Enact audit attestation predicate type */
export const ENACT_AUDIT_TYPE = `${ENACT_BASE_URL}/attestation/audit/v1`;

/** Enact build type for SLSA provenance */
export const ENACT_BUILD_TYPE = `${ENACT_BASE_URL}/build/v1`;

// ============================================================================
// Subject Creation
// ============================================================================

/**
 * Create an in-toto subject from content
 *
 * @param name - The subject name (e.g., file path or artifact identifier)
 * @param content - The content to hash
 * @returns The in-toto subject with sha256 digest
 *
 * @example
 * ```ts
 * const subject = createSubjectFromContent("tool.yaml", yamlContent);
 * // { name: "tool.yaml", digest: { sha256: "abc123..." } }
 * ```
 */
export function createSubjectFromContent(name: string, content: string | Buffer): InTotoSubject {
  const hash = hashContent(content, "sha256");
  return {
    name,
    digest: {
      sha256: hash.digest,
    },
  };
}

/**
 * Create an in-toto subject from a file
 *
 * @param name - The subject name (can differ from file path)
 * @param filePath - Path to the file to hash
 * @returns Promise resolving to the in-toto subject
 *
 * @example
 * ```ts
 * const subject = await createSubjectFromFile("my-tool@1.0.0", "/path/to/tool.yaml");
 * ```
 */
export async function createSubjectFromFile(
  name: string,
  filePath: string
): Promise<InTotoSubject> {
  const hash = await hashFile(filePath, { algorithm: "sha256" });
  return {
    name,
    digest: {
      sha256: hash.digest,
    },
  };
}

/**
 * Create an in-toto subject with multiple digest algorithms
 *
 * @param name - The subject name
 * @param content - The content to hash
 * @returns Subject with both sha256 and sha512 digests
 */
export function createSubjectWithMultipleDigests(
  name: string,
  content: string | Buffer
): InTotoSubject {
  const sha256 = hashContent(content, "sha256");
  const sha512 = hashContent(content, "sha512");

  return {
    name,
    digest: {
      sha256: sha256.digest,
      sha512: sha512.digest,
    },
  };
}

// ============================================================================
// Statement Creation
// ============================================================================

/**
 * Create a generic in-toto statement
 *
 * @param subjects - The subjects (artifacts) covered by this attestation
 * @param predicateType - The predicate type URI
 * @param predicate - The predicate content
 * @returns The in-toto statement
 *
 * @example
 * ```ts
 * const statement = createStatement(
 *   [subject],
 *   "https://example.com/predicate/v1",
 *   { customField: "value" }
 * );
 * ```
 */
export function createStatement<T>(
  subjects: InTotoSubject[],
  predicateType: string,
  predicate: T
): InTotoStatement<T> {
  return {
    _type: INTOTO_STATEMENT_TYPE,
    subject: subjects,
    predicateType,
    predicate,
  };
}

// ============================================================================
// SLSA Provenance
// ============================================================================

/**
 * Options for creating SLSA provenance
 */
export interface SLSAProvenanceOptions {
  /** Build type URI (e.g., "https://enact.tools/build/v1") */
  buildType: string;
  /** Builder ID (e.g., "https://github.com/enact-dev/enact-cli") */
  builderId: string;
  /** External parameters (inputs to the build) */
  externalParameters?: Record<string, unknown>;
  /** Internal parameters (builder-controlled) */
  internalParameters?: Record<string, unknown>;
  /** Source dependencies */
  resolvedDependencies?: SLSAResourceDescriptor[];
  /** Build invocation ID */
  invocationId?: string;
  /** Build start time */
  startedOn?: Date;
  /** Build finish time */
  finishedOn?: Date;
}

/**
 * Create a SLSA provenance predicate
 *
 * @param options - Provenance options
 * @returns The SLSA provenance predicate
 *
 * @example
 * ```ts
 * const provenance = createSLSAProvenance({
 *   buildType: "https://enact.tools/build/v1",
 *   builderId: "https://github.com/enact-dev/enact-cli@v2.0.0",
 *   externalParameters: {
 *     manifestPath: "tool.yaml"
 *   }
 * });
 * ```
 */
export function createSLSAProvenance(options: SLSAProvenanceOptions): SLSAProvenancePredicate {
  const provenance: SLSAProvenancePredicate = {
    buildDefinition: {
      buildType: options.buildType,
      externalParameters: options.externalParameters || {},
    },
    runDetails: {
      builder: {
        id: options.builderId,
      },
    },
  };

  // Add optional fields
  if (options.internalParameters) {
    provenance.buildDefinition.internalParameters = options.internalParameters;
  }

  if (options.resolvedDependencies) {
    provenance.buildDefinition.resolvedDependencies = options.resolvedDependencies;
  }

  // Add metadata if any timestamps are provided
  if (options.invocationId || options.startedOn || options.finishedOn) {
    provenance.runDetails.metadata = {};

    if (options.invocationId) {
      provenance.runDetails.metadata.invocationId = options.invocationId;
    }

    if (options.startedOn) {
      provenance.runDetails.metadata.startedOn = options.startedOn.toISOString();
    }

    if (options.finishedOn) {
      provenance.runDetails.metadata.finishedOn = options.finishedOn.toISOString();
    }
  }

  return provenance;
}

/**
 * Create a SLSA provenance statement for an artifact
 *
 * @param subjects - The artifacts to attest
 * @param options - Provenance options
 * @returns The complete in-toto statement with SLSA provenance
 */
export function createSLSAProvenanceStatement(
  subjects: InTotoSubject[],
  options: SLSAProvenanceOptions
): InTotoStatement<SLSAProvenancePredicate> {
  const provenance = createSLSAProvenance(options);
  return createStatement(subjects, SLSA_PROVENANCE_TYPE, provenance);
}

// ============================================================================
// Enact Tool Attestation
// ============================================================================

/**
 * Options for creating an Enact tool attestation
 */
export interface EnactToolAttestationOptions {
  /** Tool name */
  name: string;
  /** Tool version */
  version: string;
  /** Tool publisher identity (email or URI) */
  publisher: string;
  /** Tool description */
  description?: string;
  /** Tool repository URL */
  repository?: string;
  /** Build timestamp */
  buildTimestamp?: Date;
  /** Build environment info */
  buildEnvironment?: Record<string, string>;
  /** Source commit SHA */
  sourceCommit?: string;
  /** Bundle hash (for remote signing) */
  bundleHash?: string;
}

/**
 * Create an Enact tool attestation predicate
 *
 * @param options - Tool attestation options
 * @returns The Enact tool predicate
 *
 * @example
 * ```ts
 * const toolPredicate = createEnactToolPredicate({
 *   name: "my-tool",
 *   version: "1.0.0",
 *   publisher: "user@example.com",
 *   description: "A useful tool"
 * });
 * ```
 */
export function createEnactToolPredicate(options: EnactToolAttestationOptions): EnactToolPredicate {
  const predicate: EnactToolPredicate = {
    type: ENACT_TOOL_TYPE,
    tool: {
      name: options.name,
      version: options.version,
      publisher: options.publisher,
    },
  };

  // Add optional tool fields
  if (options.description) {
    predicate.tool.description = options.description;
  }

  if (options.repository) {
    predicate.tool.repository = options.repository;
  }

  // Add build information if provided
  if (options.buildTimestamp || options.buildEnvironment || options.sourceCommit) {
    predicate.build = {
      timestamp: (options.buildTimestamp || new Date()).toISOString(),
    };

    if (options.buildEnvironment) {
      predicate.build.environment = options.buildEnvironment;
    }

    if (options.sourceCommit) {
      predicate.build.sourceCommit = options.sourceCommit;
    }
  }

  return predicate;
}

/**
 * Create an Enact tool attestation statement
 *
 * @param manifestContent - The tool manifest content
 * @param options - Tool attestation options
 * @returns The complete in-toto statement for the tool
 */
export function createEnactToolStatement(
  manifestContent: string | Buffer,
  options: EnactToolAttestationOptions
): InTotoStatement<EnactToolPredicate> {
  const subject = createSubjectFromContent(`${options.name}@${options.version}`, manifestContent);
  const predicate = createEnactToolPredicate(options);
  return createStatement([subject], ENACT_TOOL_TYPE, predicate);
}

// ============================================================================
// Enact Audit Attestation
// ============================================================================

/**
 * Options for creating an Enact audit attestation
 */
export interface EnactAuditAttestationOptions {
  /** Tool name being audited */
  toolName: string;
  /** Tool version being audited */
  toolVersion: string;
  /** Auditor identity (email or URI) */
  auditor: string;
  /** Audit result */
  result: "passed" | "passed-with-warnings" | "failed";
  /** Audit timestamp */
  timestamp?: Date;
  /** Audit notes */
  notes?: string;
}

/**
 * Audit predicate structure
 */
export interface EnactAuditPredicate {
  type: typeof ENACT_AUDIT_TYPE;
  tool: {
    name: string;
    version: string;
  };
  audit: {
    auditor: string;
    timestamp: string;
    result: "passed" | "passed-with-warnings" | "failed";
    notes?: string;
  };
}

/**
 * Create an Enact audit attestation predicate
 *
 * @param options - Audit attestation options
 * @returns The Enact audit predicate
 */
export function createEnactAuditPredicate(
  options: EnactAuditAttestationOptions
): EnactAuditPredicate {
  const predicate: EnactAuditPredicate = {
    type: ENACT_AUDIT_TYPE,
    tool: {
      name: options.toolName,
      version: options.toolVersion,
    },
    audit: {
      auditor: options.auditor,
      timestamp: (options.timestamp || new Date()).toISOString(),
      result: options.result,
    },
  };

  if (options.notes) {
    predicate.audit.notes = options.notes;
  }

  return predicate;
}

/**
 * Create an Enact audit attestation statement
 *
 * @param manifestContent - The tool manifest content being audited
 * @param options - Audit attestation options
 * @returns The complete in-toto statement for the audit
 */
export function createEnactAuditStatement(
  manifestContent: string | Buffer,
  options: EnactAuditAttestationOptions
): InTotoStatement<EnactAuditPredicate> {
  const subject = createSubjectFromContent(
    `${options.toolName}@${options.toolVersion}`,
    manifestContent
  );
  const predicate = createEnactAuditPredicate(options);
  return createStatement([subject], ENACT_AUDIT_TYPE, predicate);
}

// ============================================================================
// Resource Descriptors
// ============================================================================

/**
 * Create a SLSA resource descriptor for a file
 *
 * @param filePath - Path to the file
 * @param options - Additional descriptor options
 * @returns Promise resolving to the resource descriptor
 */
export async function createResourceDescriptorFromFile(
  filePath: string,
  options: {
    uri?: string;
    name?: string;
    downloadLocation?: string;
    mediaType?: string;
  } = {}
): Promise<SLSAResourceDescriptor> {
  const hash = await hashFile(filePath, { algorithm: "sha256" });

  const descriptor: SLSAResourceDescriptor = {
    name: options.name || filePath,
    digest: {
      sha256: hash.digest,
    },
  };

  if (options.uri) descriptor.uri = options.uri;
  if (options.downloadLocation) descriptor.downloadLocation = options.downloadLocation;
  if (options.mediaType) descriptor.mediaType = options.mediaType;

  return descriptor;
}

/**
 * Create a SLSA resource descriptor from content
 *
 * @param content - The content
 * @param options - Descriptor options
 * @returns The resource descriptor
 */
export function createResourceDescriptorFromContent(
  content: string | Buffer,
  options: {
    uri?: string;
    name?: string;
    downloadLocation?: string;
    mediaType?: string;
  } = {}
): SLSAResourceDescriptor {
  const hash = hashContent(content, "sha256");

  const descriptor: SLSAResourceDescriptor = {
    digest: {
      sha256: hash.digest,
    },
  };

  if (options.uri) descriptor.uri = options.uri;
  if (options.name) descriptor.name = options.name;
  if (options.downloadLocation) descriptor.downloadLocation = options.downloadLocation;
  if (options.mediaType) descriptor.mediaType = options.mediaType;

  return descriptor;
}

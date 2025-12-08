/**
 * Tests for Sigstore attestation module
 */

import { describe, expect, it } from "bun:test";
import { unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ENACT_AUDIT_TYPE,
  ENACT_TOOL_TYPE,
  INTOTO_STATEMENT_TYPE,
  SLSA_PROVENANCE_TYPE,
  createEnactAuditPredicate,
  createEnactAuditStatement,
  createEnactToolPredicate,
  createEnactToolStatement,
  createResourceDescriptorFromContent,
  createResourceDescriptorFromFile,
  createSLSAProvenance,
  createSLSAProvenanceStatement,
  createStatement,
  createSubjectFromContent,
  createSubjectFromFile,
  createSubjectWithMultipleDigests,
} from "../../src/sigstore/attestation";

describe("Sigstore Attestation", () => {
  describe("Constants", () => {
    it("should export in-toto statement type", () => {
      expect(INTOTO_STATEMENT_TYPE).toBe("https://in-toto.io/Statement/v1");
    });

    it("should export SLSA provenance type", () => {
      expect(SLSA_PROVENANCE_TYPE).toBe("https://slsa.dev/provenance/v1");
    });

    it("should export Enact tool type", () => {
      expect(ENACT_TOOL_TYPE).toBe("https://enact.tools/attestation/tool/v1");
    });

    it("should export Enact audit type", () => {
      expect(ENACT_AUDIT_TYPE).toBe("https://enact.tools/attestation/audit/v1");
    });
  });

  describe("createSubjectFromContent", () => {
    it("should create subject with sha256 digest", () => {
      const subject = createSubjectFromContent("test.yaml", "hello world");

      expect(subject.name).toBe("test.yaml");
      expect(subject.digest.sha256).toBeDefined();
      expect(subject.digest.sha256).toHaveLength(64); // SHA256 hex is 64 chars
    });

    it("should create consistent hashes for same content", () => {
      const subject1 = createSubjectFromContent("file1.txt", "test content");
      const subject2 = createSubjectFromContent("file2.txt", "test content");

      expect(subject1.digest.sha256).toBe(subject2.digest.sha256);
    });

    it("should create different hashes for different content", () => {
      const subject1 = createSubjectFromContent("file.txt", "content1");
      const subject2 = createSubjectFromContent("file.txt", "content2");

      expect(subject1.digest.sha256).not.toBe(subject2.digest.sha256);
    });

    it("should handle Buffer content", () => {
      const buffer = Buffer.from("binary content");
      const subject = createSubjectFromContent("binary.bin", buffer);

      expect(subject.name).toBe("binary.bin");
      expect(subject.digest.sha256).toBeDefined();
    });
  });

  describe("createSubjectFromFile", () => {
    const testFile = join(tmpdir(), "test-attestation-subject.txt");

    it("should create subject from file", async () => {
      writeFileSync(testFile, "file content for testing");

      try {
        const subject = await createSubjectFromFile("my-artifact", testFile);

        expect(subject.name).toBe("my-artifact");
        expect(subject.digest.sha256).toBeDefined();
        expect(subject.digest.sha256).toHaveLength(64);
      } finally {
        unlinkSync(testFile);
      }
    });
  });

  describe("createSubjectWithMultipleDigests", () => {
    it("should create subject with both sha256 and sha512", () => {
      const subject = createSubjectWithMultipleDigests("artifact.tar.gz", "test content");

      expect(subject.name).toBe("artifact.tar.gz");
      expect(subject.digest.sha256).toBeDefined();
      expect(subject.digest.sha512).toBeDefined();
      expect(subject.digest.sha256).toHaveLength(64); // SHA256
      expect(subject.digest.sha512).toHaveLength(128); // SHA512
    });
  });

  describe("createStatement", () => {
    it("should create in-toto statement with custom predicate", () => {
      const subject = createSubjectFromContent("test.yaml", "content");
      const predicate = { customField: "value", count: 42 };

      const statement = createStatement([subject], "https://example.com/predicate/v1", predicate);

      expect(statement._type).toBe(INTOTO_STATEMENT_TYPE);
      expect(statement.subject).toHaveLength(1);
      expect(statement.predicateType).toBe("https://example.com/predicate/v1");
      expect(statement.predicate).toEqual(predicate);
    });

    it("should support multiple subjects", () => {
      const subjects = [
        createSubjectFromContent("file1.txt", "content1"),
        createSubjectFromContent("file2.txt", "content2"),
      ];

      const statement = createStatement(subjects, "https://example.com/v1", {});

      expect(statement.subject).toHaveLength(2);
    });
  });

  describe("createSLSAProvenance", () => {
    it("should create minimal SLSA provenance", () => {
      const provenance = createSLSAProvenance({
        buildType: "https://enact.tools/build/v1",
        builderId: "https://github.com/enact-dev/cli@v2.0.0",
      });

      expect(provenance.buildDefinition.buildType).toBe("https://enact.tools/build/v1");
      expect(provenance.buildDefinition.externalParameters).toEqual({});
      expect(provenance.runDetails.builder.id).toBe("https://github.com/enact-dev/cli@v2.0.0");
    });

    it("should include external parameters", () => {
      const provenance = createSLSAProvenance({
        buildType: "https://enact.tools/build/v1",
        builderId: "builder-id",
        externalParameters: { manifestPath: "tool.yaml", version: "1.0.0" },
      });

      expect(provenance.buildDefinition.externalParameters).toEqual({
        manifestPath: "tool.yaml",
        version: "1.0.0",
      });
    });

    it("should include internal parameters", () => {
      const provenance = createSLSAProvenance({
        buildType: "https://enact.tools/build/v1",
        builderId: "builder-id",
        internalParameters: { builderVersion: "2.0.0" },
      });

      expect(provenance.buildDefinition.internalParameters).toEqual({ builderVersion: "2.0.0" });
    });

    it("should include metadata with timestamps", () => {
      const startTime = new Date("2024-01-01T10:00:00Z");
      const endTime = new Date("2024-01-01T10:05:00Z");

      const provenance = createSLSAProvenance({
        buildType: "https://enact.tools/build/v1",
        builderId: "builder-id",
        invocationId: "build-123",
        startedOn: startTime,
        finishedOn: endTime,
      });

      expect(provenance.runDetails.metadata?.invocationId).toBe("build-123");
      expect(provenance.runDetails.metadata?.startedOn).toBe("2024-01-01T10:00:00.000Z");
      expect(provenance.runDetails.metadata?.finishedOn).toBe("2024-01-01T10:05:00.000Z");
    });
  });

  describe("createSLSAProvenanceStatement", () => {
    it("should create complete SLSA provenance statement", () => {
      const subjects = [createSubjectFromContent("artifact.tar.gz", "artifact content")];

      const statement = createSLSAProvenanceStatement(subjects, {
        buildType: "https://enact.tools/build/v1",
        builderId: "builder-id",
      });

      expect(statement._type).toBe(INTOTO_STATEMENT_TYPE);
      expect(statement.predicateType).toBe(SLSA_PROVENANCE_TYPE);
      expect(statement.subject).toEqual(subjects);
      expect(statement.predicate.buildDefinition.buildType).toBe("https://enact.tools/build/v1");
    });
  });

  describe("createEnactToolPredicate", () => {
    it("should create minimal tool predicate", () => {
      const predicate = createEnactToolPredicate({
        name: "my-tool",
        version: "1.0.0",
        publisher: "user@example.com",
      });

      expect(predicate.type).toBe(ENACT_TOOL_TYPE);
      expect(predicate.tool.name).toBe("my-tool");
      expect(predicate.tool.version).toBe("1.0.0");
      expect(predicate.tool.publisher).toBe("user@example.com");
    });

    it("should include optional tool fields", () => {
      const predicate = createEnactToolPredicate({
        name: "my-tool",
        version: "1.0.0",
        publisher: "user@example.com",
        description: "A useful tool",
        repository: "https://github.com/owner/repo",
      });

      expect(predicate.tool.description).toBe("A useful tool");
      expect(predicate.tool.repository).toBe("https://github.com/owner/repo");
    });

    it("should include build information", () => {
      const buildTime = new Date("2024-01-01T12:00:00Z");

      const predicate = createEnactToolPredicate({
        name: "my-tool",
        version: "1.0.0",
        publisher: "user@example.com",
        buildTimestamp: buildTime,
        buildEnvironment: { NODE_VERSION: "20.0.0" },
        sourceCommit: "abc123def456",
      });

      expect(predicate.build?.timestamp).toBe("2024-01-01T12:00:00.000Z");
      expect(predicate.build?.environment).toEqual({ NODE_VERSION: "20.0.0" });
      expect(predicate.build?.sourceCommit).toBe("abc123def456");
    });
  });

  describe("createEnactToolStatement", () => {
    it("should create complete tool attestation statement", () => {
      const manifestContent = "name: my-tool\nversion: 1.0.0";

      const statement = createEnactToolStatement(manifestContent, {
        name: "my-tool",
        version: "1.0.0",
        publisher: "user@example.com",
      });

      expect(statement._type).toBe(INTOTO_STATEMENT_TYPE);
      expect(statement.predicateType).toBe(ENACT_TOOL_TYPE);
      expect(statement.subject[0]?.name).toBe("my-tool@1.0.0");
      expect(statement.predicate.tool.name).toBe("my-tool");
    });
  });

  describe("createEnactAuditPredicate", () => {
    it("should create audit predicate with passed result", () => {
      const predicate = createEnactAuditPredicate({
        toolName: "my-tool",
        toolVersion: "1.0.0",
        auditor: "auditor@security.org",
        result: "passed",
      });

      expect(predicate.type).toBe(ENACT_AUDIT_TYPE);
      expect(predicate.tool.name).toBe("my-tool");
      expect(predicate.tool.version).toBe("1.0.0");
      expect(predicate.audit.auditor).toBe("auditor@security.org");
      expect(predicate.audit.result).toBe("passed");
      expect(predicate.audit.timestamp).toBeDefined();
    });

    it("should include audit notes", () => {
      const predicate = createEnactAuditPredicate({
        toolName: "my-tool",
        toolVersion: "1.0.0",
        auditor: "auditor@security.org",
        result: "passed-with-warnings",
        notes: "Minor issues found but acceptable",
      });

      expect(predicate.audit.result).toBe("passed-with-warnings");
      expect(predicate.audit.notes).toBe("Minor issues found but acceptable");
    });
  });

  describe("createEnactAuditStatement", () => {
    it("should create complete audit attestation statement", () => {
      const manifestContent = "name: my-tool\nversion: 1.0.0";

      const statement = createEnactAuditStatement(manifestContent, {
        toolName: "my-tool",
        toolVersion: "1.0.0",
        auditor: "auditor@security.org",
        result: "passed",
      });

      expect(statement._type).toBe(INTOTO_STATEMENT_TYPE);
      expect(statement.predicateType).toBe(ENACT_AUDIT_TYPE);
      expect(statement.subject[0]?.name).toBe("my-tool@1.0.0");
    });
  });

  describe("createResourceDescriptorFromFile", () => {
    const testFile = join(tmpdir(), "test-resource-descriptor.txt");

    it("should create resource descriptor from file", async () => {
      writeFileSync(testFile, "resource content");

      try {
        const descriptor = await createResourceDescriptorFromFile(testFile);

        expect(descriptor.name).toBe(testFile);
        expect(descriptor.digest?.sha256).toBeDefined();
      } finally {
        unlinkSync(testFile);
      }
    });

    it("should include optional fields", async () => {
      writeFileSync(testFile, "resource content");

      try {
        const descriptor = await createResourceDescriptorFromFile(testFile, {
          uri: "https://example.com/resource",
          name: "custom-name",
          downloadLocation: "https://download.example.com/resource",
          mediaType: "application/octet-stream",
        });

        expect(descriptor.uri).toBe("https://example.com/resource");
        expect(descriptor.name).toBe("custom-name");
        expect(descriptor.downloadLocation).toBe("https://download.example.com/resource");
        expect(descriptor.mediaType).toBe("application/octet-stream");
      } finally {
        unlinkSync(testFile);
      }
    });
  });

  describe("createResourceDescriptorFromContent", () => {
    it("should create resource descriptor from content", () => {
      const descriptor = createResourceDescriptorFromContent("test content");

      expect(descriptor.digest?.sha256).toBeDefined();
    });

    it("should include optional fields", () => {
      const descriptor = createResourceDescriptorFromContent("test content", {
        uri: "https://example.com/resource",
        name: "resource-name",
        mediaType: "text/plain",
      });

      expect(descriptor.uri).toBe("https://example.com/resource");
      expect(descriptor.name).toBe("resource-name");
      expect(descriptor.mediaType).toBe("text/plain");
    });
  });
});

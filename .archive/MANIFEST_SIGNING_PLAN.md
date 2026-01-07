# Manifest-Based Signing Implementation Plan

## Background

Per Bob Callaway (Google Sigstore team): **"Most folks would just create and sign a manifest of checksums."**

### Current Problem
- **Issue**: tar.gz archives aren't deterministic
- **Impact**: Locally-computed bundle hash ≠ server-computed hash
- **Consequence**: Cannot sign before publishing because attestations reference different hashes

### Current Flow (Works)
1. Publish tool → creates tar.gz bundle on server
2. Server computes bundle hash
3. Sign the published bundle hash
4. Attestation matches server's bundle

### Desired Flow (Currently Broken)
1. Sign locally before publishing
2. Publish tool with pre-signed attestation
3. ❌ Problem: Local tar.gz hash ≠ server tar.gz hash

## Solution: Manifest-Based Signing

### Core Concept
Instead of signing the tar.gz bundle hash, **sign a manifest of individual file checksums**.

### Why This Works
1. **Deterministic**: File hashes are deterministic (tar.gz is not)
2. **Pre-publish signing**: Can compute file hashes locally
3. **Server verification**: Server can reconstruct manifest from uploaded bundle
4. **Content integrity**: Actually better than bundle hash - verifies each file

## Architecture Design

### 1. Manifest Format

```json
{
  "version": "1.0",
  "tool": {
    "name": "author/tool-name",
    "version": "1.0.0"
  },
  "files": [
    {
      "path": "SKILL.md",
      "sha256": "abc123...",
      "size": 1234
    },
    {
      "path": "src/main.py",
      "sha256": "def456...",
      "size": 5678
    }
  ],
  "manifest_hash": {
    "algorithm": "sha256",
    "digest": "xyz789..."
  }
}
```

### 2. Signing Flow (Local → Pre-publish)

```bash
enact sign ./my-tool
```

**Steps**:
1. Scan tool directory
2. Compute hash for each file (respecting .gitignore)
3. Create manifest with all file hashes
4. Compute manifest hash (canonical JSON)
5. Create attestation with manifest hash as subject
6. Sign with Sigstore
7. Save `.enact-manifest.json` and `.sigstore-bundle.json`

### 3. Publishing Flow (with Pre-signed Attestation)

```bash
enact publish ./my-tool
```

**Steps**:
1. Check for existing `.enact-manifest.json` and `.sigstore-bundle.json`
2. Create tar.gz bundle (existing logic)
3. Upload bundle + manifest + attestation bundle
4. Server verifies:
   - Extract tar.gz
   - Recompute file hashes
   - Verify manifest matches
   - Verify attestation signature
   - Store attestation

### 4. Verification Flow

```bash
enact verify author/tool@1.0.0
```

**Steps**:
1. Download tool bundle
2. Fetch attestations
3. Extract bundle
4. Recompute file hashes
5. Verify against signed manifest
6. Verify Sigstore signatures

## Implementation Plan

### Phase 1: Manifest Generation (`@enactprotocol/trust`)

**Files to create**:
- `packages/trust/src/manifest.ts` - Manifest creation/verification

**New Functions**:
```typescript
// Create a checksum manifest for a directory
export async function createChecksumManifest(
  toolDir: string,
  options?: {
    ignorePatterns?: string[];
    onProgress?: (file: string) => void;
  }
): Promise<ChecksumManifest>

// Verify a directory matches a manifest
export async function verifyChecksumManifest(
  toolDir: string,
  manifest: ChecksumManifest
): Promise<ManifestVerificationResult>

// Compute canonical hash of manifest (for signing)
export function computeManifestHash(
  manifest: ChecksumManifest
): HashResult
```

**Types**:
```typescript
export interface ChecksumManifest {
  version: "1.0";
  tool: {
    name: string;
    version: string;
  };
  files: FileChecksum[];
  manifest_hash: {
    algorithm: "sha256";
    digest: string;
  };
}

export interface FileChecksum {
  path: string; // Relative path from tool root
  sha256: string;
  size: number;
}

export interface ManifestVerificationResult {
  valid: boolean;
  errors?: string[];
  missingFiles?: string[];
  modifiedFiles?: string[];
  extraFiles?: string[];
}
```

### Phase 2: Update Sign Command (`packages/cli/src/commands/sign/`)

**Modify**: `index.ts`

**Changes**:
1. Add manifest generation step before attestation
2. Sign manifest hash instead of bundle hash
3. Save `.enact-manifest.json` alongside `.sigstore-bundle.json`
4. Update dry-run preview to show manifest signing

**New workflow**:
```typescript
async function signLocalTool(
  pathArg: string,
  options: SignOptions,
  ctx: CommandContext
): Promise<void> {
  // 1. Load manifest
  const { manifest, manifestDir } = findManifestPath(pathArg);
  
  // 2. Create checksum manifest
  const checksumManifest = await createChecksumManifest(manifestDir, {
    ignorePatterns: loadGitignore(manifestDir),
    onProgress: (file) => dim(`  Hashing: ${file}`)
  });
  
  // 3. Compute manifest hash
  const manifestHash = computeManifestHash(checksumManifest);
  
  // 4. Create attestation with manifest hash as subject
  const attestationOptions: EnactToolAttestationOptions = {
    name: manifest.name,
    version: manifest.version,
    artifactHash: manifestHash.digest, // ← manifest hash, not bundle hash
    // ...
  };
  
  // 5. Sign with Sigstore
  const { bundle } = await signAttestation(statement, signOptions);
  
  // 6. Save both files
  writeFileSync(
    join(manifestDir, '.enact-manifest.json'),
    JSON.stringify(checksumManifest, null, 2)
  );
  writeFileSync(
    join(manifestDir, '.sigstore-bundle.json'),
    JSON.stringify(bundle, null, 2)
  );
}
```

### Phase 3: Update Publish Command (`packages/cli/src/commands/publish/`)

**Modify**: `index.ts`

**Changes**:
1. Check for existing `.enact-manifest.json` and `.sigstore-bundle.json`
2. If found, include in publish request
3. Update publish API to accept manifest + attestation bundle

**New workflow**:
```typescript
async function publishHandler(
  pathArg: string,
  options: PublishOptions,
  ctx: CommandContext
): Promise<void> {
  // ... existing manifest loading ...
  
  // Check for pre-signed attestation
  const manifestPath = join(toolDir, '.enact-manifest.json');
  const bundlePath = join(toolDir, '.sigstore-bundle.json');
  
  let checksumManifest: ChecksumManifest | undefined;
  let sigstoreBundle: SigstoreBundle | undefined;
  
  if (existsSync(manifestPath) && existsSync(bundlePath)) {
    info('Found pre-signed attestation');
    checksumManifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    sigstoreBundle = JSON.parse(readFileSync(bundlePath, 'utf-8'));
    
    // Verify manifest still matches current files
    const verification = await verifyChecksumManifest(toolDir, checksumManifest);
    if (!verification.valid) {
      warning('Checksum manifest is outdated - files have changed since signing');
      // Prompt to re-sign or continue without attestation
    }
  }
  
  // Create bundle (existing logic)
  const bundleData = await createBundleFromDir(toolDir);
  
  // Publish with optional manifest + attestation
  const result = await publishTool(client, {
    name: fullName,
    manifest: toolManifest,
    bundle: bundleData,
    rawManifest,
    visibility,
    checksumManifest,
    sigstoreBundle,
  });
}
```

### Phase 4: Update Publish API (`packages/api/src/publish.ts`)

**Modify**: `publishTool` function

**Changes**:
1. Accept optional `checksumManifest` and `sigstoreBundle`
2. Include in multipart upload

```typescript
export async function publishTool(
  client: EnactApiClient,
  options: {
    name: string;
    manifest: Record<string, unknown>;
    bundle: ArrayBuffer | Uint8Array;
    rawManifest?: string;
    visibility?: ToolVisibility;
    // NEW: Pre-signed attestation support
    checksumManifest?: ChecksumManifest;
    sigstoreBundle?: SigstoreBundle;
  }
): Promise<PublishResult> {
  const { 
    name, 
    manifest, 
    bundle, 
    rawManifest, 
    visibility = "private",
    checksumManifest,
    sigstoreBundle 
  } = options;

  const formData = new FormData();
  formData.append("manifest", JSON.stringify(manifest));
  formData.append("bundle", bundleBlob, "bundle.tar.gz");
  
  if (rawManifest) {
    formData.append("raw_manifest", rawManifest);
  }
  
  // NEW: Include pre-signed attestation
  if (checksumManifest && sigstoreBundle) {
    formData.append("checksum_manifest", JSON.stringify(checksumManifest));
    formData.append("sigstore_bundle", JSON.stringify(sigstoreBundle));
  }
  
  formData.append("visibility", visibility);
  
  // ... rest of existing logic
}
```

### Phase 5: Server-Side Verification (Supabase Edge Function)

**File**: `supabase/functions/registry-v2/publish.ts` (or similar)

**Changes**:
1. Accept optional `checksum_manifest` and `sigstore_bundle` in publish endpoint
2. Extract uploaded tar.gz
3. Recompute file hashes
4. Verify against submitted manifest
5. Verify Sigstore bundle signature
6. Store attestation if valid

```typescript
// Server-side publish handler
async function handlePublish(req: Request): Promise<Response> {
  // ... existing upload logic ...
  
  // Check for pre-signed attestation
  const checksumManifest = formData.get('checksum_manifest');
  const sigstoreBundle = formData.get('sigstore_bundle');
  
  if (checksumManifest && sigstoreBundle) {
    // 1. Extract tar.gz to temp dir
    const extractedDir = await extractTarGz(bundleBuffer);
    
    // 2. Recompute file hashes
    const computedManifest = await createChecksumManifest(
      extractedDir,
      JSON.parse(checksumManifest)
    );
    
    // 3. Verify manifest matches
    const manifestsMatch = compareManifests(
      JSON.parse(checksumManifest),
      computedManifest
    );
    
    if (!manifestsMatch) {
      return new Response(
        JSON.stringify({ 
          error: 'Checksum manifest does not match uploaded bundle' 
        }),
        { status: 400 }
      );
    }
    
    // 4. Verify Sigstore bundle
    const verification = await verifyBundle(
      JSON.parse(sigstoreBundle),
      computedManifest.manifest_hash.digest
    );
    
    if (!verification.verified) {
      return new Response(
        JSON.stringify({ 
          error: 'Sigstore verification failed',
          details: verification.error
        }),
        { status: 400 }
      );
    }
    
    // 5. Store attestation
    await storeAttestation({
      toolName,
      version,
      sigstoreBundle: JSON.parse(sigstoreBundle),
      checksumManifest: JSON.parse(checksumManifest),
    });
  }
  
  // ... rest of publish logic ...
}
```

### Phase 6: Update Verification (`packages/trust/src/sigstore/verification.ts`)

**Add function**:
```typescript
export async function verifyManifestAttestation(
  bundle: SigstoreBundle,
  toolDir: string,
  manifest: ChecksumManifest
): Promise<VerificationResult> {
  // 1. Verify files match manifest
  const manifestVerification = await verifyChecksumManifest(toolDir, manifest);
  
  if (!manifestVerification.valid) {
    return {
      verified: false,
      error: 'Files do not match manifest',
      details: manifestVerification
    };
  }
  
  // 2. Compute manifest hash
  const manifestHash = computeManifestHash(manifest);
  
  // 3. Verify Sigstore bundle against manifest hash
  return await verifyBundle(bundle, manifestHash.digest);
}
```

## Migration Strategy

### ~~Backward Compatibility~~ → Clean Break

**Decision**: Manifest-only signing (no legacy bundle-hash support)

Since the old signing method was never widely used, we're implementing manifest-based 
signing as the only method. This simplifies the codebase and avoids technical debt.

### Implementation Approach

1. **Phase 1**: Implement manifest generation
2. **Phase 2**: Update `enact sign` to use manifest signing (replaces old method)
3. **Phase 3**: Update server to require manifests
4. **Phase 4**: Update `enact publish` to include pre-signed attestations
5. **Phase 5**: Testing and rollout

## File Structure Changes

### New Files
```
packages/trust/src/
  manifest.ts                    # Checksum manifest creation/verification
  
packages/trust/tests/
  manifest.test.ts               # Manifest tests

docs/
  MANIFEST_SIGNING_PLAN.md       # This document
```

### Modified Files
```
packages/cli/src/commands/sign/index.ts
packages/cli/src/commands/publish/index.ts
packages/api/src/publish.ts
packages/trust/src/sigstore/verification.ts
packages/trust/src/index.ts      # Export manifest functions
```

### New Artifact Files (per-tool)
```
my-tool/
  .enact-manifest.json           # Checksum manifest
  .sigstore-bundle.json          # Signature bundle
  .gitignore                     # Should ignore these
```

## Benefits of This Approach

### 1. **Deterministic Signing**
- File hashes are deterministic
- Independent of tar.gz compression/ordering
- Reproducible on any machine

### 2. **Pre-Publish Signing**
- Sign before publishing
- No need to fetch from registry to sign
- Faster workflow for developers

### 3. **Better Security**
- Verifies individual files, not just bundle
- Can detect which files changed
- More granular integrity checking

### 4. **Flexibility**
- Can sign locally without internet
- Can verify without downloading full bundle
- Supports partial verification

### 5. **Standard Practice**
- Recommended by Sigstore team
- Used by other ecosystems (npm, cargo, etc.)
- Industry-standard approach

## Example Workflows

### Local Development → Sign → Publish

```bash
# 1. Develop tool locally
cd my-tool
vim SKILL.md

# 2. Sign locally (creates .enact-manifest.json + .sigstore-bundle.json)
enact sign .
# ✓ Created checksum manifest (5 files)
# ✓ Computed manifest hash: sha256:abc123...
# ✓ Signed with Sigstore
# ✓ Saved .enact-manifest.json and .sigstore-bundle.json

# 3. Publish with pre-signed attestation
enact publish .
# ✓ Found pre-signed attestation
# ✓ Verified manifest matches current files
# ✓ Created bundle
# ✓ Uploaded to registry
# ✓ Server verified attestation
# ✓ Published: my-tool@1.0.0
```

### Sign Remote Tool (Post-Publish)

```bash
# Still supported for backward compatibility
enact sign author/tool@1.0.0
# ✓ Fetched tool metadata
# ✓ Downloaded bundle
# ✓ Verified checksum manifest
# ✓ Signed manifest hash
# ✓ Submitted attestation to registry
```

## Testing Plan

### Unit Tests
- [ ] `createChecksumManifest` with various file types
- [ ] `verifyChecksumManifest` with valid/invalid manifests
- [ ] `computeManifestHash` produces canonical output
- [ ] Manifest verification detects file changes

### Integration Tests
- [ ] Local sign → verify manifest created
- [ ] Publish with pre-signed attestation
- [ ] Server verifies manifest matches bundle
- [ ] Verify downloaded tool against manifest

### Edge Cases
- [ ] Empty directory
- [ ] Binary files
- [ ] Large files (streaming)
- [ ] Symlinks (should error or ignore)
- [ ] Modified files after signing
- [ ] Missing manifest file
- [ ] Corrupt manifest

## Open Questions

1. **Should we include the manifest in the bundle?**
   - Pro: Self-contained verification
   - Con: Redundant data
   - **Decision: No** - keep manifest separate, server reconstructs from uploaded bundle

2. **What about manifest schema versioning?**
   - Start with `version: "1.0"`
   - Plan for future schema changes

3. **Should manifest include git metadata?**
   - Could include git commit hash if available
   - Optional field: `git_commit: "abc123..."`
   - Future enhancement

4. **Handle ignore patterns?**
   - Use `.gitignore` by default
   - Support `.enactignore` for tool-specific patterns
   - Already implemented in publish command

5. **Canonical JSON for manifest hash?**
   - Use `JSON.stringify` with stable ordering
   - Sort object keys recursively
   - Consistent whitespace (none - minified for hashing)

6. **Backward compatibility with old signing method?**
   - **Decision: No** - manifest-only signing, clean break from unused legacy method

7. **Should .enact-manifest.json and .sigstore-bundle.json be gitignored?**
   - **Decision: Yes** - add to .gitignore, these are generated artifacts

## Timeline Estimate

- **Phase 1** (Manifest generation): 2-3 days
- **Phase 2** (Update sign command): 2 days
- **Phase 3** (Update publish command): 1-2 days
- **Phase 4** (Update publish API): 1 day
- **Phase 5** (Server-side verification): 3-4 days
- **Phase 6** (Update verification): 1-2 days
- **Testing & Polish**: 2-3 days

**Total**: ~2 weeks for full implementation

## Next Steps

1. ✅ Review this plan with team
2. Create `packages/trust/src/manifest.ts`
3. Add unit tests for manifest functions
4. Update sign command (with `--manifest` flag initially)
5. Test end-to-end workflow
6. Roll out to production

---

**References**:
- Bob Callaway recommendation: "create and sign a manifest of checksums"
- Sigstore documentation: https://docs.sigstore.dev/
- In-toto specification: https://in-toto.io/

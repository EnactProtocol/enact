# Trust System Audit

**Date:** December 3, 2025  
**Status:** ✅ Implementation Complete

This document captures the findings from auditing the trust system implementation against the documented design in `TRUST.md`.

**Update:** All issues identified in this audit have been resolved. See the "Resolution Summary" section at the end.

---

## Architecture Overview

### Trust Model (Simplified)

The Enact trust system uses a **single unified model**: cryptographic attestations signed via OIDC identities.

**Key Insight:** Publishers who want their tools trusted should **sign their own tools**. There's no separate "publisher trust" concept — if you trust `github:alice` as an auditor, you trust tools signed by Alice, whether she authored them or reviewed someone else's.

This means:
- **Self-attestation is the norm** - Publishers sign their own tools before publishing
- **Third-party audits are optional** - Security firms or reviewers can add additional attestations
- **One identity format** - All trust uses `provider:identity` format (e.g., `github:alice`)

**No more distinction between publishers and auditors** — everyone who signs is an "attester" and users configure which attesters they trust.

### When Trust is Checked

Trust verification occurs at **install time only**:

| Action | Trust Check | Rationale |
|--------|-------------|-----------|
| `enact install <tool>` | ✅ Yes | Installing from registry, need verification |
| `enact install .` | ❌ No | Local tool, user is developing/testing |
| `enact run <tool>` | ❌ No | Already installed, was verified at install |
| `enact sign .` | ❌ No | Creating attestation, not consuming |
| `enact publish .` | ❌ No | User publishing their own tool |

**Rationale:** Local tools (`~/.enact/tools/`, `.enact/tools/`) are user-controlled. The security boundary is at the point of fetching external code from the registry.

---

## Simplified Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     enact install tool@v1.0                      │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
                    ┌───────────────────────┐
                    │ Fetch attestations    │
                    │ from registry         │
                    └───────────────────────┘
                                 │
                                 ▼
                    ┌───────────────────────┐
                    │ Verify attestations   │
                    │ locally (Sigstore)    │
                    └───────────────────────┘
                                 │
                                 ▼
                    ┌───────────────────────┐
                    │ Match against         │
                    │ trusted identities    │
                    └───────────────────────┘
                                 │
              ┌─────────────────┴─────────────────┐
              │                                   │
   ≥ minimum_attestations              < minimum_attestations
              │                                   │
              ▼                                   ▼
   ┌────────────────┐                  ┌──────────────────┐
   │ Install        │                  │ Apply policy:    │
   │                │                  │ - require: block │
   └────────────────┘                  │ - prompt: ask    │
                                       │ - allow: install │
                                       └──────────────────┘
```

**Example scenarios:**

1. **Alice publishes a tool and signs it with `github:alice`**
   - User has `github:alice` in their trusted list → installs
   - User doesn't trust Alice → prompted or blocked

2. **Bob publishes a tool, security firm signs it with `github:security-firm`**
   - User trusts `github:security-firm` → installs (even if they don't know Bob)
   - User trusts `github:bob` → installs (Bob self-signed)
   - User trusts neither → prompted or blocked

3. **Tool has multiple attestations**
   - User requires `minimum_attestations: 2`
   - Tool signed by `github:alice` and `github:ossf`
   - User trusts both → installs
   - User only trusts one → prompted or blocked

---

## Current Implementation Status

### ✅ Working Correctly

1. **Core Sigstore Integration** (`@enactprotocol/trust`)
   - Keyless signing via OIDC (Fulcio certificates)
   - Rekor transparency log integration
   - Bundle verification with `verifyBundle()`
   - In-toto attestation format support

2. **Identity Conversion** (`@enactprotocol/shared`)
   - `emailToProviderIdentity()` correctly maps OIDC emails to `provider:identity` format
   - Wildcard matching for org-level trust (e.g., `github:my-org/*`)

3. **Local Trust Configuration** (`@enactprotocol/shared/config.ts`)
   - `getTrustedIdentities()` / `addTrustedIdentity()` / `removeTrustedIdentity()`
   - Policy options: `require_attestation`, `prompt`, `allow`

4. **Attestation Verification** (`@enactprotocol/api/attestations.ts`)
   - `verifyAllAttestations()` performs local cryptographic verification
   - Never trusts registry's verification status
   - `hasTrustedAttestation()` checks against user's trust config

5. **Install Flow** (`packages/cli/src/commands/install/index.ts`)
   - Fetches attestations from registry
   - Verifies locally using `verifyAllAttestations()`
   - Applies trust policy (require_attestation/prompt/allow)

---

## Issues Found

### 1. Remove Publisher Trust Concept

**Current state:** The codebase has both "trusted publishers" and "trusted auditors" as separate concepts.

**Recommended change:** Remove publisher trust entirely. Publishers who want trust should self-sign their tools.

**Files to update:**
- `packages/shared/src/config.ts` - Remove `publishers` from TrustConfig, remove `getTrustedPublishers()`, etc.
- `packages/cli/src/commands/trust/index.ts` - Remove publisher handling, simplify to auditors only
- `docs/TRUST.md` - Update documentation to reflect unified model

**Why:** Simplifies the mental model. One type of trust, one identity format, one verification path.

---

### 2. `minimum_attestations` Not Implemented

**Documentation says:**
```yaml
trust:
  auditors:
    - github:EnactProtocol
    - github:ossf
  minimum_attestations: 2  # Require both auditors to sign
```

**Current implementation:** `minimum_attestations` field exists in config schema but is never checked.

**Location:** 
- Schema: `packages/shared/src/config.ts` (TrustConfig interface)
- Should be checked in: `packages/cli/src/commands/install/index.ts`

**Fix Required:** After verifying attestations, check count:
```typescript
const minimumRequired = config.trust?.minimum_attestations ?? 1;
if (trustedVerifiedAuditors.length < minimumRequired) {
  error(`Requires ${minimumRequired} trusted attestation(s), found ${trustedVerifiedAuditors.length}`);
}
```

---

### 3. `enact report` Uses Feedback API Instead of Signed Attestation

**Documentation says:**
> `enact report tool@version --reason "..."` creates a signed failed attestation

**Current implementation:** Uses `submitFeedback()` API (rating system) instead of creating a cryptographically signed attestation with `result: "failed"`.

**Location:** `packages/cli/src/commands/report/index.ts`

**Impact:** Reports are not cryptographically verified, defeating the purpose of the attestation model.

**Fix Required:** Use `createEnactAuditStatement()` with `result: "failed"` and sign via Sigstore:
```typescript
const statement = createEnactAuditStatement(manifestContent, {
  toolName,
  toolVersion,
  auditor: userEmail,
  result: "failed",
  notes: options.reason,
});
const signed = await signAttestation(statement);
await submitAttestationToRegistry(client, { name: toolName, version, sigstoreBundle: signed.bundle });
```

---

### 4. Documentation Predicate Type Mismatch

**In `docs/TRUST.md` example (line ~532):**
```json
"predicateType": "https://enact.tools/audit/v1"
```

**Actual implementation:**
```typescript
export const ENACT_AUDIT_TYPE = "https://enact.tools/attestation/audit/v1";
```

**Fix:** Update documentation to include `/attestation/` in the path.

---

## Configuration Schema (Simplified)

```yaml
# ~/.enact/config.yaml
trust:
  # Trusted identities (OIDC format)
  # Anyone who signs with these identities is trusted
  # This includes tool authors who self-sign AND third-party reviewers
  trusted:
    - github:EnactProtocol      # Official Enact tools
    - github:alice              # Trust Alice's self-signed tools
    - github:security-firm      # Trust this security firm's reviews
    - github:my-org/*           # Trust entire GitHub org
    - google:*@company.com      # Trust company email domain

  # How many trusted attestations required
  minimum_attestations: 1

  # Policy when trust requirements not met
  # - require_attestation: Block installation (default)
  # - prompt: Ask user to confirm
  # - allow: Install anyway (dev mode)
  policy: require_attestation
```

**Note:** The current implementation uses `auditors` as the key. Consider renaming to `trusted` for clarity since publishers self-sign.

---

## Action Items

| Priority | Issue | Fix |
|----------|-------|-----|
| 🔴 High | Remove publisher trust concept | Simplify to single attestation model |
| 🔴 High | `enact report` not signed | Use Sigstore signing |
| 🟡 Medium | `minimum_attestations` unused | Add check in install flow |
| 🟢 Low | Doc predicate type mismatch | Update TRUST.md example |
| 🟢 Low | Rename `auditors` to `trusted` | Better reflects unified model |

---

## Files Involved

- `packages/trust/src/sigstore/` - Core Sigstore integration
- `packages/shared/src/config.ts` - Trust configuration management
- `packages/api/src/attestations.ts` - Attestation API and verification
- `packages/api/src/trust.ts` - Registry trust sync
- `packages/cli/src/commands/install/index.ts` - Install flow with trust checks
- `packages/cli/src/commands/sign/index.ts` - Publisher attestation signing
- `packages/cli/src/commands/report/index.ts` - Issue reporting (needs fix)
- `packages/cli/src/commands/trust/index.ts` - Trust management CLI

---

## Testing Recommendations

1. **Unit Tests**
   - Test `emailToProviderIdentity()` with various OIDC providers
   - Test wildcard matching for org-level trust
   - Test `minimum_attestations` enforcement

2. **Integration Tests**
   - Install with trusted attestation
   - Install with untrusted tool under each policy mode
   - Report creation with Sigstore signing

3. **E2E Tests**
   - Full sign → publish → install flow
   - Report → attestation visibility flow

---

## Resolution Summary

All issues identified in this audit have been resolved:

### ✅ Removed Publisher Trust
- **Files Changed:** `packages/shared/src/config.ts`, `packages/shared/src/index.ts`
- Removed `publishers` from `TrustConfig` interface
- Removed `getTrustedPublishers`, `addTrustedPublisher`, `removeTrustedPublisher` functions
- Updated exports

### ✅ Unified Trust CLI
- **File Changed:** `packages/cli/src/commands/trust/index.ts`
- Removed publisher/auditor distinction in CLI
- All identities now use `provider:identity` format
- Added validation requiring colon in identity format
- Simplified list output to show "Trusted Identities"

### ✅ Enforced minimum_attestations
- **File Changed:** `packages/cli/src/commands/install/index.ts`
- Added check that `trustedVerifiedAuditors.length >= minimumAttestations`
- Applies policy-based blocking/prompting when threshold not met

### ✅ Fixed Report Command
- **File Changed:** `packages/cli/src/commands/report/index.ts`
- Now uses `createEnactAuditStatement()` with `result: "failed"`
- Signs via Sigstore OIDC flow
- Submits signed attestation to registry
- Added `--local` flag for local-only signing

### ✅ Updated Documentation
- **File Changed:** `docs/TRUST.md`
- Removed all publisher trust references
- Updated to unified identity model
- Fixed predicate type to `https://enact.tools/attestation/audit/v1`
- Updated policy name to `require_attestation`
- Updated all examples

### ✅ Fixed Policy Naming
- **Files Changed:** `packages/shared/src/config.ts`, `packages/cli/src/commands/install/index.ts`
- Standardized on `require_attestation` (not `require_audit`)
- Added legacy compatibility check in `getTrustPolicy()`

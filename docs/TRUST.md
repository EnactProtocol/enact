# TRUST.md

## Enact Trust System

**A cryptographic attestation model for verifying AI tools with signed attestations.**

Enact uses **Sigstore** for cryptographic signing. Publishers and auditors use their OIDC identities (GitHub, Google, Microsoft, etc.) to sign attestations about tools.

Users configure which identities they trust, giving them full control over what runs on their system.

---

## Overview

### Unified Identity Model

Everyone who signs tools is identified by their **OIDC identity** in `provider:identity` format:

- `github:alice` - GitHub user alice
- `github:EnactProtocol` - GitHub organization
- `google:security@company.com` - Google account
- `microsoft:user@company.com` - Microsoft account

**Key insight:** Whether you're a tool author signing your own tool or a third-party auditor reviewing someone else's tool, you use the same signing mechanism and identity format. Users configure which identities they trust.

---

## How It Works

### 1. Tool Authors Sign Their Tools

When you publish a tool, you sign it with your OIDC identity:

```bash
# Login and sign your tool
enact auth login
enact sign .

? Sign attestation with:
  > GitHub
    Google
    Microsoft

# Opens browser for OIDC authentication
# Creates Sigstore signature
# Submits attestation to Enact registry
# ✓ Attestation published
#   Signed by: github:alice
#   Logged to Rekor: #123456

# Then publish
enact publish .
# ✓ Published alice/utils/greeter@v1.0
```

**What gets signed:**
- Tool bundle hash (cryptographic proof of exact version)
- Your OIDC identity
- Timestamp (via Rekor transparency log)

### 2. Third-Party Auditors Can Also Sign

Anyone can audit any tool by signing an attestation:

```bash
# Download tool for inspection
enact inspect alice/utils/greeter@v1.0
cd greeter

# Review the code, run security scans, test it
# ...

# Sign if it passes review (from tool directory)
enact sign .
# ✓ Attestation published
#   Signed by: github:security-firm
```

**Or report issues:**
```bash
# Report if tool has security issues
enact report alice/utils/greeter@v1.0 --reason "SQL injection vulnerability"
# ✓ Failed attestation published
#   Signed by: github:security-firm
```

### 3. Users Configure Trust

Control which identities you trust:

```bash
# Trust specific identities (always use provider:identity format)
enact trust github:alice
enact trust github:EnactProtocol
enact trust google:security@company.com

# Remove trust
enact trust -r github:alice

# List all trusted identities
enact trust list
```

**Or edit config directly:**
```yaml
# ~/.enact/config.yaml
trust:
  auditors:
    - github:EnactProtocol
    - github:alice
    - google:security@company.com
  
  policy: require_attestation  # Default: block if not trusted
  minimum_attestations: 1
```

### 4. Installing with Trust Verification

```bash
enact install alice/utils/greeter

Tool: alice/utils/greeter@v1.0
  
Attestations:
  ✓ github:alice - passed (tool author)
  ✓ github:EnactProtocol - passed (third-party audit)
  ✓ github:ossf - passed (third-party audit)

Trust Status:
  ✓ 2 trusted attestations found (github:alice, github:EnactProtocol)
  
Decision: ✓ INSTALL (meets minimum_attestations: 1)

Installed alice/utils/greeter@v1.0
```

---

## Trust Decision Flow

When you install a tool, Enact checks:

1. **Fetch all attestations** from the registry
2. **Verify cryptographically** via Sigstore
3. **Check against trusted identities** in your config
4. **Apply minimum_attestations** requirement
5. **Apply policy** (require_attestation, prompt, or allow)

**Example scenarios:**

```yaml
# Scenario 1: Trust the tool author
trust:
  auditors:
    - github:alice

# alice/tool (signed by alice) → Installs (trusted author)
# bob/tool (signed by bob) → Checks policy (not trusted)
```

```yaml
# Scenario 2: Only trust security auditors
trust:
  auditors:
    - github:security-firm
    - github:ossf

# alice/tool (audited by security-firm) → Installs
# alice/tool (only self-signed) → Blocked/prompted
# bob/tool (audited by ossf) → Installs
```

```yaml
# Scenario 3: Require multiple attestations
trust:
  auditors:
    - github:alice
    - github:EnactProtocol
    - github:ossf
  minimum_attestations: 2

# Tool needs 2+ trusted attestations to install
```

---

## Trust Policies

```yaml
trust:
  policy: require_attestation  # Options: require_attestation, prompt, allow
  minimum_attestations: 1      # How many trusted attestations required
```

**Policies:**
- **require_attestation** - Block if no trusted attestations found (default, strictest)
- **prompt** - Ask user to confirm untrusted tools (interactive mode only)
- **allow** - Install anyway (development mode only)

**Minimum attestations:**
```yaml
trust:
  auditors:
    - github:EnactProtocol
    - github:ossf
    - github:alice
  minimum_attestations: 2  # Require 2 trusted attestations to install
```

---

## Self-Signing

Tool authors typically sign their own tools:

```bash
# Sign your tool before publishing
enact sign .
# Signs with: github:alice

# Publish
enact publish .
# ✓ Published alice/my-tool@v1.0
```

**User perspective:**
```
Attestations:
  ✓ github:alice - passed (tool author)

Your trust:
  Trusted identities: github:EnactProtocol (not matching)

⚠ No trusted attestations found
Install anyway? [y/N]:
```

**To trust this author:**
```bash
enact trust github:alice
```

Now tools signed by `github:alice` will be trusted.

---

## CLI Commands

### Trust Management
```bash
# Trust identities (always use provider:identity format)
enact trust github:alice
enact trust github:EnactProtocol
enact trust google:security@company.com

# Remove trust
enact trust -r github:alice

# List all trusted identities
enact trust list

# Check trust status for a tool
enact trust check alice/my-tool@v1.0
```

### Signing and Reporting
```bash
# Sign your own tool (from tool directory)
enact sign .

# Download and audit someone else's tool
enact inspect tool@version
cd tool-name

# Review code, run security scans, test functionality
# ...

# Sign if it passes audit (from tool directory)
enact sign .

# Report if it fails audit
enact report tool@version --reason "Security issue found"

# Check attestations for any tool
enact trust check tool@version
```

---

## Identity Format

All trusted identities use the `provider:identity` format:

**Common providers:**
```bash
enact trust github:alice              # GitHub user
enact trust github:my-org             # GitHub organization  
enact trust google:alice@example.com  # Google account
enact trust microsoft:user@company.com # Microsoft account
```

**Wildcards (in config file):**
```yaml
trust:
  auditors:
    - github:my-org/*        # Trust entire GitHub org
    - google:*@company.com   # Trust all company emails
```

**Advanced (explicit issuer in config file):**
```yaml
trust:
  auditors:
    - issuer: https://token.actions.githubusercontent.com
      subject: https://github.com/EnactProtocol/*
```

---

## Default Configuration

```yaml
# ~/.enact/config.yaml (created on first run)
trust:
  auditors:
    - github:EnactProtocol  # Trust official Enact tools
  
  policy: require_attestation  # Block untrusted tools by default
  minimum_attestations: 1
```

---

## Example Workflows

### Personal Developer
```yaml
trust:
  auditors:
    - github:alice          # Trust your own signing identity
    - github:EnactProtocol  # Trust official auditor
  policy: require_attestation
```

```bash
# Your workflow
enact sign .              # Sign with github:alice
enact publish .           # Publish to alice/*
enact install alice/tool  # Installs (trusted identity)
```

### Enterprise Security Team
```yaml
trust:
  auditors:
    - microsoft:security@company.com
    - github:company-security/*
  
  policy: require_attestation
  minimum_attestations: 1
```

Only tools signed by internal security team can be installed.

### Open Source Project
```yaml
trust:
  auditors:
    - github:EnactProtocol
    - github:ossf
    - github:my-project/*
  
  policy: require_attestation
  minimum_attestations: 2
```

Require at least 2 trusted attestations for any tool.

### Development Mode
```yaml
trust:
  auditors:
    - github:alice
  
  policy: allow  # Install anything (for testing only)
```

---

## Becoming a Trusted Auditor

1. **Choose your OIDC identity** (GitHub, Google, etc.)
2. **Review tools thoroughly**
   - Download for inspection: `enact inspect tool@version`
   - Navigate to tool: `cd tool-name`
   - Analyze code, run security scans
   - Test functionality
3. **Sign attestations**
   - `enact sign .` from tool directory if it passes
   - `enact report tool@ver --reason "..."` if it fails
4. **Build reputation**
   - Be transparent about methodology
   - Provide detailed reports
   - Be consistent
5. **Tell users to trust you**
   - Document your process
   - Share your identity: `github:your-org`
   - Users add with `enact trust github:your-org`

---

## Security Guarantees

### What Enact Provides

✅ **Identity verification** - OIDC identities verified via Sigstore  
✅ **Attestation authenticity** - Cryptographic proof via Sigstore  
✅ **Integrity** - Tools haven't been tampered with  
✅ **Transparency** - All attestations in public Rekor log  
✅ **User control** - You choose who to trust  

### What Enact Does NOT Provide

❌ **Code quality** - Attestations don't guarantee bug-free code  
❌ **Signer competence** - You must vet who you trust  
❌ **Continuous monitoring** - Point-in-time attestations only  
❌ **Legal warranties** - Technical verification, not legal liability  

---

## FAQ

### Q: Do I need to trust every tool author?

**A:** No. You can trust specific identities you've vetted (like `github:alice`), or rely on third-party auditors you trust (like `github:security-firm`). If a tool is signed by any identity you trust, it can be installed.

### Q: Can tool authors sign their own tools?

**A:** Yes! This is the typical workflow. When you publish a tool, you sign it with `enact sign .` using your OIDC identity. Users who trust your identity can install your tools.

### Q: What if I want extra verification beyond the author?

**A:** Use `minimum_attestations: 2` in your config. This requires tools to have attestations from 2+ trusted identities before installing.

### Q: Can attestations be faked?

**A:** No. Sigstore provides cryptographic proof. Attestations are signed with OIDC identities and logged in Rekor's transparency log. Tampering is cryptographically detectable.

### Q: What happens if someone reports a tool as failed?

**A:** Failed attestations are still recorded. If a trusted identity reports a tool, installation will be blocked/prompted. Use `enact trust check tool@version` to see all attestations including reports.

### Q: How do I see why a tool was reported?

**A:** Use `enact trust check tool@version` to view all attestations and any failure reasons.

### Q: What OIDC providers are supported?

**A:** GitHub, Google, Microsoft, GitLab, and custom OIDC servers. The CLI will guide you through authentication.

### Q: What's the identity format?

**A:** Always `provider:identity`, e.g., `github:alice`, `google:user@example.com`. This format is required for all trust operations.

---

## Technical Details

### Attestation Structure

Attestations follow the in-toto statement format:

```json
{
  "_type": "https://in-toto.io/Statement/v1",
  "subject": [{
    "name": "pkg:enact/alice/utils/greeter@v1.0",
    "digest": {
      "sha256": "abc123..."
    }
  }],
  "predicateType": "https://enact.tools/attestation/audit/v1",
  "predicate": {
    "type": "https://enact.tools/attestation/audit/v1",
    "tool": {
      "name": "alice/utils/greeter",
      "version": "1.0.0"
    },
    "audit": {
      "auditor": "alice@github.com",
      "timestamp": "2025-01-15T10:30:00Z",
      "result": "passed",
      "notes": "No security issues found"
    }
  }
}
```

This is signed with Sigstore and stored in the registry with the certificate containing:
- Issuer (OIDC provider URL)
- Subject (user/workflow identity)
- Email (if available)

### Trust Matching

When verifying trust, Enact:

1. Extracts OIDC identity from Sigstore certificate
2. Converts email to `provider:identity` format
3. Checks if it matches any trusted identity pattern
4. Supports wildcards: `github:my-org/*` matches any identity from that org
5. Verifies Sigstore signature cryptographically
6. Checks Rekor transparency log for tampering

---

## Learn More

- **Sigstore Documentation** - https://docs.sigstore.dev
- **Rekor Transparency Log** - https://rekor.sigstore.dev
- **OIDC Explained** - https://openid.net/connect/
- **Enact Registry** - https://enact.tools

---

## License

MIT License © 2025 Enact Protocol Contributors
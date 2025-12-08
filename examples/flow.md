# Enact Tool Publishing Flow

This document walks through the complete flow of creating, signing, and publishing an Enact tool using a real-world example: a Python PDF extraction tool.

## Example Tool: `pdf-extract`

A tool that extracts text from PDF files using Python and PyMuPDF.

### Directory Structure

```
pdf-extract/
├── enact.md          # Tool manifest (with frontmatter)
├── extract.py        # Python implementation
└── requirements.txt  # Python dependencies
```

### Tool Files

**`enact.md`** - Tool manifest with documentation:

```markdown
---
name: pdf-extract
version: 1.0.0
description: Extract text content from PDF files
author: alice@example.com
license: MIT

from: python:3.12-slim

inputSchema:
  type: object
  properties:
    file:
      type: string
      description: Path to the PDF file
  required:
    - file

outputSchema:
  type: object
  properties:
    text:
      type: string
      description: Extracted text content
    pages:
      type: integer
      description: Number of pages processed

env:
  - PYTHONUNBUFFERED=1

mount:
  source: .

command: |
  pip install -q -r requirements.txt && python extract.py "${file}"
---

# PDF Extract Tool

Extracts text content from PDF documents using PyMuPDF.

## Usage

\`\`\`bash
enact run pdf-extract --input file=/path/to/document.pdf
\`\`\`

## Output

Returns JSON with extracted text and page count.
```

**`extract.py`** - Python implementation:

```python
#!/usr/bin/env python3
"""Extract text from PDF files using PyMuPDF."""

import json
import sys
import fitz  # PyMuPDF

def extract_text(pdf_path: str) -> dict:
    """Extract text from a PDF file."""
    doc = fitz.open(pdf_path)
    
    text_parts = []
    for page in doc:
        text_parts.append(page.get_text())
    
    return {
        "text": "\n".join(text_parts),
        "pages": len(doc)
    }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided"}))
        sys.exit(1)
    
    result = extract_text(sys.argv[1])
    print(json.dumps(result))
```

**`requirements.txt`**:

```
PyMuPDF>=1.23.0
```

---

## Publishing Flow

### Step 1: Local Development & Testing

```bash
# Test the tool locally
enact run ./pdf-extract --input file=./sample.pdf

# Verify it works
enact run ./pdf-extract --input file=./sample.pdf --dry-run
```

### Step 2: Install Locally (Optional)

```bash
# Install to your user tools directory
enact install ./pdf-extract --global

# Now you can run it by name
enact run pdf-extract --input file=./document.pdf
```

### Step 3: Authenticate with Registry

```bash
# Login to Enact registry (opens browser for OIDC flow)
enact auth login

# Check authentication status
enact auth status
# Output: Logged in as alice@example.com via Google
```

### Step 4: Publish (with Automatic Signing)

```bash
# Publish the tool - this triggers the signing flow
enact publish ./pdf-extract
```

**What happens during `enact publish`:**

1. **Validate Manifest**
   - Parse `enact.md` frontmatter
   - Validate required fields (name, version, from, command)
   - Check inputSchema/outputSchema validity

2. **Create Bundle**
   - Package all files: `enact.md`, `extract.py`, `requirements.txt`
   - Calculate SHA256 hash of the bundle

3. **Generate Attestation**
   ```json
   {
     "_type": "https://in-toto.io/Statement/v1",
     "subject": [{
       "name": "pdf-extract@1.0.0",
       "digest": {
         "sha256": "a1b2c3d4e5f6..."
       }
     }],
     "predicateType": "https://enact.tools/attestation/tool/v1",
     "predicate": {
       "type": "https://enact.tools/attestation/tool/v1",
       "tool": {
         "name": "pdf-extract",
         "version": "1.0.0",
         "publisher": "alice@example.com",
         "description": "Extract text content from PDF files",
         "repository": "https://github.com/alice/pdf-extract"
       },
       "build": {
         "timestamp": "2024-01-15T10:30:00Z",
         "sourceCommit": "abc123def456"
       }
     }
   }
   ```

4. **Sign with Sigstore (Keyless)**
   - Use OIDC token from authentication
   - Request short-lived certificate from Fulcio
   - Sign attestation with certificate
   - Log signature to Rekor transparency log

5. **Upload to Registry**
   - Upload tool bundle
   - Upload Sigstore bundle (signature + certificate + log entry)
   - Registry verifies signature before accepting

**Output:**

```
✓ Validated manifest
✓ Created tool bundle (sha256:a1b2c3d4...)
✓ Generated attestation
✓ Signed with Sigstore
  • Certificate issued by Fulcio
  • Logged to Rekor (entry: 12345678)
  • Identity: alice@example.com (Google)
✓ Published to registry

Tool published: pdf-extract@1.0.0
  URL: https://enact.tools/tools/alice/pdf-extract/1.0.0
  Attestation: https://enact.tools/tools/alice/pdf-extract/1.0.0/attestation
```

---

## Consumer Flow

### Step 1: Search for Tool

```bash
enact search pdf
# Output:
#   alice/pdf-extract@1.0.0 - Extract text content from PDF files
#   bob/pdf-to-text@2.1.0 - Convert PDF to plain text
```

### Step 2: Inspect Before Installing

```bash
enact get alice/pdf-extract
# Output:
#   Name: pdf-extract
#   Version: 1.0.0
#   Author: alice@example.com
#   Description: Extract text content from PDF files
#   
#   Trust Status:
#   ✓ Signed by alice@example.com (Google OIDC)
#   ✓ Certificate issued: 2024-01-15T10:30:00Z
#   ✓ Logged in Rekor: entry 12345678
```

### Step 3: Configure Trust Policy

```bash
# Trust Alice as a publisher
enact trust alice@example.com

# Or trust all tools from a GitHub org
enact trust "https://github.com/myorg/*"

# List trusted identities
enact trust list
```

### Step 4: Install (with Verification)

```bash
enact install alice/pdf-extract
```

**What happens during `enact install`:**

1. **Download Bundle**
   - Fetch tool bundle from registry
   - Fetch Sigstore attestation bundle

2. **Verify Signature**
   - Verify Sigstore bundle signature
   - Check certificate chain to Fulcio root
   - Verify Rekor inclusion proof

3. **Evaluate Trust Policy**
   - Extract signer identity from certificate
   - Check if identity matches trusted publishers
   - Fail if not trusted (unless `--allow-untrusted`)

4. **Install Tool**
   - Extract to `~/.enact/tools/alice/pdf-extract/`
   - Store attestation for future reference

**Output:**

```
Downloading alice/pdf-extract@1.0.0...
✓ Downloaded bundle (sha256:a1b2c3d4...)
✓ Verified signature
  • Signed by: alice@example.com
  • Certificate: valid, issued by Fulcio
  • Rekor entry: 12345678 (verified)
✓ Publisher trusted: alice@example.com
✓ Installed to ~/.enact/tools/alice/pdf-extract/

Run with: enact run alice/pdf-extract --input file=<path>
```

### Step 5: Run the Tool

```bash
enact run alice/pdf-extract --input file=./report.pdf
# Output: {"text": "...", "pages": 5}
```

---

## Audit Flow (Optional)

Third-party auditors can add their own attestations to tools:

### Auditor Signs Tool

```bash
# Auditor reviews the tool and creates an audit attestation
enact sign alice/pdf-extract --audit --result passed --notes "Security review complete"
```

This creates an audit attestation:

```json
{
  "_type": "https://in-toto.io/Statement/v1",
  "subject": [{
    "name": "pdf-extract@1.0.0",
    "digest": { "sha256": "a1b2c3d4..." }
  }],
  "predicateType": "https://enact.tools/attestation/audit/v1",
  "predicate": {
    "type": "https://enact.tools/attestation/audit/v1",
    "tool": {
      "name": "pdf-extract",
      "version": "1.0.0"
    },
    "audit": {
      "auditor": "security@auditfirm.com",
      "timestamp": "2024-01-20T14:00:00Z",
      "result": "passed",
      "notes": "Security review complete"
    }
  }
}
```

### User Configures Auditor Trust

```bash
# Trust a specific auditor
enact trust security@auditfirm.com --auditor

# Require audited tools only
enact config set trust.requireAudit true
```

Now when installing, Enact will require both:
1. Publisher signature from trusted identity
2. Audit attestation from trusted auditor

---

## Trust Policy Details

The trust system evaluates attestations against a policy:

```yaml
# ~/.enact/trust-policy.yaml
name: my-policy
version: "1.0"

trustedPublishers:
  - identity: alice@example.com
    issuer: https://accounts.google.com
  - identity: "https://github.com/myorg/*"
    issuer: https://token.actions.githubusercontent.com

trustedAuditors:
  - identity: security@auditfirm.com
    issuer: https://accounts.google.com

requireAttestation: true
requireAudit: false
allowUnsigned: false
```

**Policy Evaluation:**

| Scenario | Result |
|----------|--------|
| Tool signed by `alice@example.com` | ✅ Trusted |
| Tool signed by `bob@example.com` | ❌ Not trusted |
| Tool signed by GitHub Actions from `myorg/repo` | ✅ Trusted |
| Unsigned tool | ❌ Rejected (requireAttestation: true) |
| Tool without audit (requireAudit: true) | ❌ Rejected |

---

## CI/CD Integration

### GitHub Actions Example

```yaml
# .github/workflows/publish.yml
name: Publish Tool

on:
  push:
    tags:
      - 'v*'

permissions:
  id-token: write  # Required for OIDC signing
  contents: read

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Enact
        uses: enact-dev/setup-enact@v1
      
      - name: Publish Tool
        run: enact publish ./pdf-extract
        # OIDC token is automatically available
        # Tool will be signed with GitHub Actions identity:
        # "https://github.com/alice/pdf-extract/.github/workflows/publish.yml@refs/tags/v1.0.0"
```

The published tool will show:

```
Trust Status:
✓ Signed by GitHub Actions
  Repository: alice/pdf-extract
  Workflow: .github/workflows/publish.yml
  Ref: refs/tags/v1.0.0
✓ Logged in Rekor: entry 12345678
```

---

## Summary

The Enact signing flow provides:

1. **Keyless Signing** - No private keys to manage
2. **Identity-Based Trust** - Trust publishers by their identity (email, GitHub repo)
3. **Transparency** - All signatures logged to public Rekor log
4. **Verification** - Automatic verification on install
5. **Audit Support** - Third-party security attestations
6. **CI/CD Native** - Works seamlessly with GitHub Actions, GitLab CI, etc.

This ensures that every tool you install comes from a verified source and hasn't been tampered with.

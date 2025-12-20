# Enact Protocol

A verified, portable way to define, discover, and safely run **AI-executable tools**.

Think **npm for AI tools**—publish once, run anywhere, with cryptographic verification and deterministic execution.

Each tool includes a self-contained `SKILL.md` manifest describing its inputs, outputs, environment, and execution command. This format aligns with Anthropic's Agent Skills specification.

> **Backwards Compatibility:** Enact also recognizes `enact.md`, `enact.yaml`, and `enact.yml` for existing tools.

**What Enact provides:**
* 🔍 **Semantic discovery** — AI models and developers can find tools by task or capability
* 🛡️ **Verified execution** — Cryptographic attestations via Sigstore + container sandboxing
* 🔁 **Determinism** — Tools execute exactly as defined in their manifest
* 🧩 **Composition** — Tools can be combined in workflows
* 🗂️ **Versioning** — Semantic versions and reproducible, immutable bundles
* 🔐 **Trust control** — You decide which identities to trust

---

## Prerequisites

* Node.js 18+ (for the CLI)
* Docker or compatible container runtime (for execution)
* Enact account (sign up at [enact.tools](https://enact.tools))

---

## Quick Start

### 1. Install the CLI

```bash
npm install -g enact-cli
```

### 2. Create an Enact account

Sign up at [https://enact.tools](https://enact.tools) to claim your namespace.

Your username becomes your namespace (e.g., username `alice` can publish to `alice/*`).

### 3. Create a tool

Create a `SKILL.md` manifest:

```markdown
---
enact: "2.0.0"
name: "alice/utils/greeter"
description: "Greets the user by name"
command: "echo 'Hello, ${name}!'"
inputSchema:
  type: object
  properties:
    name: { type: string }
  required: ["name"]
---

# Greeter

A simple tool that greets users by name.
```

### 4. Test locally

```bash
enact run . --args '{"name":"World"}'
# → Hello, World!
```

### Advanced: Tools with Build Steps

For tools that need compilation or dependency installation, use the `build` field:

```markdown
---
enact: "2.0.0"
name: "alice/utils/hello-rust"
description: "A Rust greeting tool"
from: "rust:1.75-alpine"
build: "rustc hello.rs -o hello"
command: "./hello ${name}"
inputSchema:
  type: object
  properties:
    name: { type: string }
  required: ["name"]
---
```

Build steps are cached by Dagger—first run compiles, subsequent runs are instant.

### 5. Publish

```bash
enact auth login
enact publish .
# ✓ Published alice/utils/greeter@v1.0.0
```

### 6. (Optional) Sign and attest your tool

Sign your tool with Sigstore keyless signing to build trust:

```bash
enact sign .

? Sign attestation with:
  > GitHub
    Google
    Microsoft

# Opens browser for authentication
# ✓ Attestation published
  Signed by: github:alice
  Logged to Rekor: #123456
```

---

## Trust System

Enact uses cryptographic attestations via Sigstore. All trust is based on OIDC identities in `provider:identity` format:

- `github:alice` — GitHub user
- `github:EnactProtocol` — GitHub organization
- `google:security@company.com` — Google account

Tool authors sign their own tools. Third-party auditors can add additional attestations.

```bash
# Trust identities (always use provider:identity format)
enact trust github:alice
enact trust github:EnactProtocol
enact trust google:security@company.com

# Remove trust
enact trust -r github:alice
enact trust -r github:sketchy-org
```

**When you install a tool:**
1. Does the tool have attestations from identities you trust? → Install
2. No trusted attestations? → Blocked (default policy: `require_attestation`)

See [TRUST.md](docs/TRUST.md) for complete details.

---

## Installing Tools

```bash
# Install with trust verification
enact install alice/utils/greeter

Tool: alice/utils/greeter@v1.0.0
  Published by: @alice (Enact)
  
Attestations:
  ✓ github:EnactProtocol - passed
  
Trust Status: ✓ TRUSTED
Install? [Y/n]:

# Install for your project (tracked in .enact/tools.json)
enact install alice/utils/greeter

# Install globally
enact install alice/utils/greeter --global

# Install all project-defined tools
enact install
```

---

## Running Tools

**Deterministic execution** (only the manifest-defined command runs):

```bash
enact run alice/utils/greeter --args '{"name":"Alice"}'
# → Hello, Alice!
```

**Exploratory execution** (run arbitrary commands in the tool's environment):

```bash
enact exec alice/utils/greeter "cat SKILL.md"
```

---

## Auditing Tools

Anyone can review and attest tools:

```bash
# Download tool for inspection (without installing)
enact inspect alice/utils/greeter@v1.0.0
cd greeter

# Review the code, run security scans, test it
# ...

# Sign if it passes (from tool directory)
enact sign .

# Or report issues
enact report alice/utils/greeter@v1.0.0 --reason "Security vulnerability found"
```

Your attestation is cryptographically signed via Sigstore and logged to the public Rekor transparency log.

---

## Discovery

```bash
# Search the registry
enact search "pdf extraction"

# Learn about a tool
enact learn alice/utils/greeter

# Check tool's trust status and attestations
enact trust check alice/utils/greeter@v1.0.0

# List installed tools
enact list
```

---

## Directory Layout

Where Enact stores things:

| Location                         | Purpose                                              |
| -------------------------------- | ---------------------------------------------------- |
| `.enact/`                        | Project-installed tools (commit `.enact/tools.json`) |
| `~/.enact/tools/`                | Global installs                                      |
| `~/.enact/cache/`                | Immutable tool bundles for fast reinstalls           |
| `~/.enact/config.yaml`           | Trust configuration (identities, policies)           |
| `~/.enact/.env`                  | Global environment variables                         |

---

## Trust Configuration

Example `~/.enact/config.yaml`:

```yaml
trust:
  # Trusted identities (OIDC format: provider:identity)
  auditors:
    - github:EnactProtocol
    - github:alice
    - github:ossf
    - google:security@company.com
  
  # Policy: require_attestation (default), prompt, or allow
  policy: require_attestation
  
  # Require at least this many trusted attestations
  minimum_attestations: 1
```

---

## Security Model

### What Enact Provides

✅ **Publisher identity** - Verified Enact accounts control namespaces  
✅ **Attestation authenticity** - Cryptographic proof via Sigstore  
✅ **Integrity** - Tools haven't been tampered with since attestation  
✅ **Transparency** - All attestations logged in public Rekor log  
✅ **User control** - You choose who to trust  
✅ **Container isolation** - Tools run in sandboxed environments  

### What Enact Does NOT Provide

❌ **Code quality guarantees** - Attestations verify identity, not correctness  
❌ **Auditor competence** - You must evaluate auditors yourself  
❌ **Continuous monitoring** - Attestations are point-in-time  
❌ **Absolute safety** - Always review tools before trusting them  

---

## Example Workflows

### Personal Developer

```bash
# Create and publish your own tools
enact sign .
enact publish .

# Trust yourself (use your GitHub identity)
enact trust github:alice

# Install your tools without prompts
enact install alice/my-tool
```

### Enterprise Team

```yaml
# ~/.enact/config.yaml
trust:
  auditors:
    - microsoft:security@company.com
    - github:company-security/*
  policy: require_attestation
```

Only tools audited by your security team can be installed.

### Open Source Project

```bash
# Trust official auditors
enact trust github:EnactProtocol
enact trust github:ossf

# Install community tools
enact install community/useful-tool
# ✓ Verified by github:ossf
```

---

## CLI Commands

### Publishing
```bash
enact auth login               # Authenticate with Enact
enact sign .                   # Sign tool locally
enact publish .                # Publish tool to your namespace
```

### Trust Management
```bash
enact trust github:alice       # Trust identity
enact trust -r github:alice    # Remove trust
enact trust list               # Show trusted identities
enact trust check tool@version # Check tool's trust status
```

### Installation
```bash
enact install tool             # Install with verification
enact install tool --global    # Install globally
enact install                  # Install all project tools
```


### Auditing
```bash
enact install tool@version     # Install for review
enact sign .                   # Sign from tool directory if it passes
enact report tool@version      # Report issues
```

### Running
```bash
enact run tool --args '{...}'  # Deterministic execution
enact exec tool "command"      # Exploratory execution
```

### Discovery
```bash
enact search "query"           # Search registry
enact learn tool               # Learn about a tool
enact list                     # List installed tools
```

### Environment & Secrets
```bash
enact env set KEY VAL                      # Set env var
enact env set KEY --secret --namespace ns  # Set secret in keyring.
enact config list              # View configuration
```

---

## Learn More

* **Trust System** — [TRUST.md](docs/TRUST.md) - Complete guide to publishers, auditors, and attestations
* **Protocol Specification** — [SPEC.md](docs/SPEC.md) - Technical specification
* **CLI Commands** — [COMMANDS.md](docs/COMMANDS.md) - Full command reference
* **Full Documentation** — [https://enactprotocol.com](https://enactprotocol.com)

---

## Getting Help

* **GitHub Issues** - [github.com/enactprotocol/cli/issues](https://github.com/enactprotocol/cli/issues)
* **Documentation** - [enactprotocol.com](https://enactprotocol.com)

---


---

## License

MIT License © 2025 Enact Protocol Contributors
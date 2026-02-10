# Enact Protocol Field Specification

**Version:** 2.0.0
**Last Updated:** 2025-11-17

This document provides a comprehensive reference for all Enact protocol fields used in tool definitions.

## Overview

Enact tools use a **two-file model** aligned with the [Agent Skills standard](https://agentskills.io):

1. **`SKILL.md`** — Agent-facing documentation (YAML frontmatter with `name`, `description` + Markdown body)
2. **`skill.yaml`** — Execution metadata (scripts, hooks, env, container image)

### Relationship to Agent Skills

The `SKILL.md` file follows the open [Agent Skills standard](https://agentskills.io/specification). The base standard defines a minimal format: a `SKILL.md` file with YAML frontmatter (`name`, `description`) plus Markdown instructions.

**Enact's `skill.yaml` adds fields that make skills executable:**
- `scripts` — Named executable commands with `{{param}}` template substitution
- `hooks.build` — Build/setup commands (cached by Dagger)
- `from` — Base Docker image
- `env` — Environment variables and secrets
- `timeout` — Execution time limits

This means a skill folder contains:
1. **What the tool does** (`SKILL.md` — standard Agent Skills interface for AI)
2. **How to run it** (`skill.yaml` — Enact's execution extensions)

> **Note:** For backwards compatibility, Enact also recognizes `enact.md`, `enact.yaml`, and `enact.yml`.

## Package Definition (Optional)

To avoid duplication and support shared configuration (like environment variables), you can place an **`enact-package.yaml`** file in any directory.

- **Scope:** Applies to all tools in the same directory and subdirectories.
- **Inheritance:** Tools inherit fields from the nearest `enact-package.yaml`.
- **Overriding:** Tools can override inherited fields (except `env`, which is merged).

**Example `enact-package.yaml`:**
```yaml
enact: "2.0.0"
# Shared environment variables for all tools in this folder
env:
  API_TOKEN:
    description: "API Token for the service"
    secret: true

# Shared metadata
authors:
  - name: "Acme Corp"
license: "MIT"
```

---

## Minimal Example

**SKILL.md:**
```markdown
---
name: alice/utils/greeter
description: Greets the user by name
---

# Greeter

A simple tool that greets users by name.
Provide a `name` parameter to get a personalized greeting.
```

**skill.yaml:**
```yaml
enact: "2.0.0"
name: alice/utils/greeter
description: Greets the user by name

scripts:
  greet: "echo 'Hello, {{name}}!'"
```

### Example with Build Step

**skill.yaml:**
```yaml
enact: "2.0.0"
name: alice/utils/hello-rust
description: A Rust-based greeting tool
from: rust:1.75-alpine

hooks:
  build:
    - rustc hello.rs -o hello

scripts:
  greet: "./hello {{name}}"
```

---

## Required Fields

These fields must be present in `skill.yaml` (or `SKILL.md` frontmatter).

### `name`
- **Type:** `string`
- **Description:** Hierarchical tool identifier using filepath-style naming
- **Format:** `org/path/to/tool-name` 
- **Common pattern:** `org/category/tool-name` (but not prescribed)
- **Examples:**
  - `enact/text/analyzer` - Two levels
  - `acme-corp/internal/data/processor` - Three levels
  - `username/personal/utility` - Two levels
  - `mycompany/ai/nlp/sentiment/advanced-analyzer` - Five levels
- **Notes:**
  - Used for tool identity and prevents impersonation
  - No prescribed depth — use what makes sense for your organization
  - Like Java packages, deeper hierarchies provide better organization

### `description`
- **Type:** `string`
- **Description:** Human-readable description of what the tool does
- **Best Practice:** Include what it does and when to use it
- **Example:** `"Formats JavaScript/TypeScript code using Prettier"`

### `scripts`
- **Type:** `object` (map of script name → command string or expanded definition)
- **Description:** Named executable commands with `{{param}}` template substitution
- **Format:** Each key is a script name, value is a command string or expanded object
- **Template syntax:** `{{param}}` — each template becomes a single argument, regardless of content
- **Examples:**
  ```yaml
  # Simple string form
  scripts:
    greet: "echo 'Hello, {{name}}!'"
    format: "npx prettier@3.3.3 --write {{file}}"

  # Expanded form with metadata
  scripts:
    calculate:
      command: "python3 calc.py {{operation}} {{a}} {{b}}"
      description: "Perform arithmetic operations"
      inputSchema:
        type: object
        properties:
          operation: { type: string, enum: [add, subtract, multiply] }
          a: { type: number }
          b: { type: number }
        required: [operation, a, b]
  ```
- **Notes:**
  - Parameters are auto-inferred from `{{param}}` patterns when `inputSchema` is not provided
  - Optional parameters without values are omitted entirely from the command
  - Omit `scripts` for LLM-driven tools (instructions-only, no deterministic execution)

---

## Recommended Fields

These optional fields should be included in the YAML frontmatter for better tool discovery, execution control, and documentation.

### `enact`
- **Type:** `string`
- **Description:** Version of the Enact protocol specification
- **Format:** Semantic version (e.g., `"2.0.0"`)
- **Default:** Latest version at time of tool creation
- **Example:** `enact: "2.0.0"`

### `from`
- **Type:** `string`
- **Description:** Container base image for tool execution
- **Format:** Docker image name with tag
- **Examples:**
  - `from: "node:18-alpine"`
  - `from: "python:3.11-slim"`
  - `from: "ghcr.io/company/custom-env:v2.1.0"`
- **Default:** `"alpine:latest"` (if omitted)
- **Best Practice:** Pin specific tags, prefer minimal images (`alpine`, `slim`)

### `timeout`
- **Type:** `string`
- **Description:** Maximum execution time for the tool
- **Format:** Go duration format
- **Examples:** `"30s"`, `"5m"`, `"1h"`
- **Default:** `"30s"`
- **Notes:** Critical for preventing DoS attacks. Only applies to command execution, not build steps.

### `hooks`
- **Type:** `object`
- **Description:** Lifecycle hooks for the tool
- **Fields:**
  - `build` — `string` or `array of strings` — Build commands to run before execution
  - `postinstall` — `string` or `array of strings` — Commands to run after installation
- **Execution:** Build runs outside the timeout, cached by Dagger for fast subsequent runs
- **Use cases:** Compiling code, installing dependencies, preparing the environment
- **Examples:**
  ```yaml
  hooks:
    build:
      - pip install -r requirements.txt
      - npm install

  hooks:
    build:
      - rustc hello.rs -o hello
    postinstall:
      - echo "Setup complete"
  ```
- **Notes:**
  - Build steps are cached by Dagger's layer caching
  - First run may be slow, subsequent runs are instant
  - Errors during build will fail the tool execution
  - Use for setup that doesn't need to run every time

### `version`
- **Type:** `string`
- **Description:** Tool version (not protocol version)
- **Format:** Semantic versioning (major.minor.patch)
- **Example:** `version: "1.2.3"`
- **Best Practice:** Follow semver conventions
- **Note:** In manifests, omit the `v` prefix. When referencing tools (e.g., `enact install tool@v1.2.3`), always use the `v` prefix.

### `license`
- **Type:** `string`
- **Description:** Software license for the tool
- **Format:** SPDX license identifier
- **Examples:** `"MIT"`, `"Apache-2.0"`, `"GPL-3.0"`
- **Best Practice:** Always include for published tools

### `tags`
- **Type:** `array of strings`
- **Description:** Keywords for tool discovery and categorization
- **Example:**
  ```yaml
  tags:
    - text
    - analysis
    - nlp
  ```
- **Best Practice:** Use relevant, searchable terms

---

## Schema Fields

These fields define input and output structure. They can be specified per-script in the expanded form, or auto-inferred from `{{param}}` patterns.

### `inputSchema`
- **Type:** `object` (JSON Schema)
- **Description:** Defines the structure and validation for tool input parameters
- **Format:** JSON Schema (typically `type: object`)
- **Example:**
  ```yaml
  inputSchema:
    type: object
    properties:
      file:
        type: string
        description: "Path to file to process"
      operation:
        type: string
        enum: ["summarize", "validate", "transform"]
    required: ["file", "operation"]
  ```
- **Best Practice:** Include for scripts that accept complex or typed arguments.
- **Notes:** When omitted, `inputSchema` is auto-inferred from `{{param}}` patterns in the script command (all params become required strings). Use the expanded script form to provide explicit schemas.

### `outputSchema`
- **Type:** `object` (JSON Schema)
- **Description:** Defines the structure of tool output
- **Format:** JSON Schema
- **Example:**
  ```yaml
  outputSchema:
    type: object
    properties:
      status:
        type: string
        enum: ["success", "error"]
      result:
        type: object
      errors:
        type: array
        items:
          type: string
  ```
- **Best Practice:** Strongly recommended for all tools
- **Notes:** Enables structured output validation

---

## Environment Variables and Secrets

Enact provides a unified `env` field for all runtime configuration. The `secret: true` flag determines storage:

1. **Secrets** (`secret: true`) → Stored in OS keyring
2. **Environment variables** (`secret: false`, default) → Stored in `.env` files

### `env`
- **Type:** `object`
- **Description:** Environment variable configuration for the tool
- **Structure:**
  ```yaml
  env:
    VARIABLE_NAME:
      description: string    # What this variable is for (required)
      secret: boolean        # If true, stored in OS keyring (default: false)
      default: string        # Default value if not set (optional, non-secrets only)
  ```

### Secret Variables (`secret: true`)

- **Storage:** OS keyring (macOS Keychain, Windows Credential Manager, Linux Secret Service)
- **Resolution:** Namespace inheritance - walks up the tool path
- **Example:**
  ```yaml
  env:
    API_TOKEN:
      description: "API authentication token"
      secret: true
    DATABASE_PASSWORD:
      description: "Database credentials"
      secret: true
  ```
- **Resolution example:**
  ```
  Tool: alice/api/slack/notifier
  Needs: API_TOKEN

  Lookup:
    1. alice/api/slack:API_TOKEN
    2. alice/api:API_TOKEN ✓ found
    3. alice:API_TOKEN
  ```
- **Security:** Never written to disk, injected via Dagger's secure secret API
- **CLI:** `enact env set/get/list/delete --secret --namespace <namespace>`

### Non-Secret Variables (`secret: false` or omitted)

- **Storage:**
  - Global: `~/.enact/.env`
  - Local (project): `.enact/.env`
- **Priority:** Local → Global → Default
- **Example:**
  ```yaml
  env:
    LOG_LEVEL:
      description: "Logging verbosity level"
      default: "info"
    API_BASE_URL:
      description: "API endpoint URL"
      default: "https://api.example.com"
  ```
- **Security:** May appear in logs and cache keys
- **CLI:** `enact env set/get/list/delete/edit [--local]`

### Unified CLI

All environment variables and secrets are managed through a single command:

```bash
# Non-secrets
enact env set LOG_LEVEL debug              # Global
enact env set LOG_LEVEL debug --local      # Project-specific

# Secrets (add --secret --namespace)
enact env set API_TOKEN --secret --namespace alice/api

# Resolution for a tool
enact env resolve alice/api/slack/notifier
```

### Complete Example

```yaml
env:
  # Secrets (stored in OS keyring)
  SLACK_TOKEN:
    description: "Slack Bot OAuth Token"
    secret: true
  
  # Non-secrets (stored in .env files)
  SLACK_CHANNEL:
    description: "Default channel to post to"
    default: "#general"
  
  LOG_LEVEL:
    description: "Logging verbosity"
    default: "info"
```

### Migration from older format

If you have a separate `secrets` array, migrate to the unified `env` structure:

**Old format (deprecated):**
```yaml
secrets:
  - API_KEY

env:
  LOG_LEVEL:
    description: "Logging level"
    default: "info"
```

**New format:**
```yaml
env:
  API_KEY:
    description: "API authentication key"
    secret: true
  
  LOG_LEVEL:
    description: "Logging level"
    default: "info"
```

---

## Behavior Annotations

Provide execution hints to AI models via the `annotations` field in the YAML frontmatter.

### `annotations`
- **Type:** `object`
- **Description:** Hints about tool behavior for AI models
- **All fields default to `false`**
- **Fields:**

#### `title`
- **Type:** `string`
- **Description:** Human-readable display name
- **Optional**

#### `readOnlyHint`
- **Type:** `boolean`
- **Description:** Tool does not modify the environment
- **Example use:** Read-only operations, analysis tools

#### `destructiveHint`
- **Type:** `boolean`
- **Description:** Tool may make irreversible changes
- **Example use:** Delete operations, file modifications

#### `idempotentHint`
- **Type:** `boolean`
- **Description:** Multiple executions produce the same result
- **Example use:** Stateless transformations

#### `openWorldHint`
- **Type:** `boolean`
- **Description:** Tool interacts with external systems (network, APIs)
- **Example use:** Web scraping, API calls

**Example:**
```yaml
annotations:
  title: "Data Analyzer"
  readOnlyHint: true
  destructiveHint: false
  idempotentHint: true
  openWorldHint: false
```

---

## Resource Requirements

Specify resource limits in the YAML frontmatter's `resources` field to control execution constraints.

### `resources`
- **Type:** `object`
- **Description:** Resource limits and requirements for tool execution
- **Fields:**

#### `memory`
- **Type:** `string`
- **Description:** System memory needed
- **Format:** Kubernetes-style units
- **Examples:** `"512Mi"`, `"2Gi"`, `"16Gi"`

#### `gpu`
- **Type:** `string`
- **Description:** GPU memory needed
- **Format:** Kubernetes-style units
- **Examples:** `"24Gi"`, `"48Gi"`

#### `disk`
- **Type:** `string`
- **Description:** Disk space needed
- **Format:** Kubernetes-style units
- **Examples:** `"100Gi"`, `"500Gi"`, `"1Ti"`

**Example:**
```yaml
resources:
  memory: "2Gi"
  gpu: "24Gi"
  disk: "100Gi"
```

---

## Documentation Fields

Additional metadata fields in the YAML frontmatter for richer tool documentation.

### `doc`
- **Type:** `string`
- **Description:** Extended Markdown documentation for the tool (YAML frontmatter field)
- **Format:** Markdown
- **Best Practice:** Keep brief in YAML frontmatter; use the Markdown body section of `SKILL.md` for extensive documentation, or `RESOURCES.md` for progressive disclosure

### `authors`
- **Type:** `array of objects`
- **Description:** Tool creators and maintainers
- **Structure:**
  ```yaml
  authors:
    - name: string     # Author name (required)
      email: string    # Author email (optional)
      url: string      # Author website (optional)
  ```
- **Example:**
  ```yaml
  authors:
    - name: "Alice Developer"
      email: "alice@acme-corp.com"
      url: "https://example.com"
  ```

---

## Testing and Examples

Define test cases in the YAML frontmatter's `examples` field to enable automated validation.

### `examples`
- **Type:** `array of objects`
- **Description:** Test cases and expected outputs for validation
- **Structure:**
  ```yaml
  examples:
    - input: object         # Input parameters (optional, omit for no-input tools)
      output: any           # Expected output (optional)
      description: string   # Test description (optional)
  ```
- **Example:**
  ```yaml
  examples:
    - input:
        file: "data.csv"
        operation: "validate"
      output:
        status: "success"
        result:
          valid: true
          rows: 1000
      description: "Validate CSV structure"
  ```

---

## Security and Signing

Enact uses **Sigstore** for cryptographic signing and verification of published tools. Signatures are **not stored in the tool metadata file** but in separate `.sigstore-bundle` files alongside tool bundles.

### Sigstore-Based Signing

**How it works:**
1. **Local tools** (`~/.enact/local/`) do not require signing (trusted environment)
2. **Published tools** are signed using Sigstore before distribution
3. **Signature bundles** (`.sigstore-bundle`) contain:
   - Short-lived X.509 certificates from Fulcio (Certificate Authority)
   - ECDSA P-256 signatures
   - Rekor transparency log entries
   - Identity claims (GitHub OAuth, SSO)

**Signing process:**
```bash
$ enact sign my-tool/
Creating bundle...
├─ Creating tarball: my-tool-v1.0.0.tar.gz
├─ Computing SHA256 hash: abc123...
└─ ✓ Bundle created

Signing with Sigstore...
├─ Authenticating with GitHub OAuth...
├─ ✓ Authenticated as alice@acme-corp.com
├─ Requesting certificate from Fulcio...
├─ ✓ Issued: 10 minute validity
├─ Generating ECDSA P-256 signature...
├─ Submitting to Rekor transparency log...
├─ ✓ Logged at index: 12347
└─ ✓ Created: my-tool.sigstore-bundle
```

**Verification checks:**
1. Bundle integrity (SHA-256 hash)
2. Signature validity (ECDSA P-256)
3. Certificate chain to Fulcio CA
4. Rekor transparency log proof
5. Certificate revocation status (CRL)
6. Identity claims in certificate

**Storage locations:**
- Active tools: `~/.enact/tools/{org}/{path}/{tool}/` - No signature required (user-controlled)
- Installed skills: `~/.agent/skills/{org}/{path}/{tool}/` - Verified on download from registry
- Signature bundles: Stored alongside cached bundles as `.sigstore-bundle`

**Security benefits:**
- Identity-based certificates (no long-lived keys)
- Immutable audit trail (Rekor)
- Real-time revocation (CRL)
- Public auditability

---

## Custom Extensions

Add custom metadata fields to the YAML frontmatter using the `x-*` prefix.

### `x-*` prefix
- **Type:** Any
- **Description:** Custom fields for implementation-specific or organizational metadata
- **Format:** Must start with `x-`
- **Not included in signature verification**
- **Examples:**
  ```yaml
  x-internal-id: "tool-12345"
  x-team-owner: "platform-team"
  x-cost-center: "engineering"
  x-compliance-level: "high"
  ```

---

## Signed Content

When publishing tools, Sigstore signs the **entire tool bundle** (tarball). The signature covers:

**What gets signed:**
- The complete tarball (`.tar.gz`) containing:
  - Tool definition file (`SKILL.md` with YAML frontmatter + Markdown documentation)
  - Source code and dependencies
  - Additional documentation files (e.g., `RESOURCES.md`)
  - All resources

**Hash computation:**
- SHA-256 hash of the entire tarball
- Any modification to any file breaks the signature
- Ensures complete bundle integrity

**What is NOT signed in the metadata:**
- Signatures are stored separately in `.sigstore-bundle` files
- The `SKILL.md` file does not contain signature fields
- This keeps the tool definition clean and focused on functionality

**Example:**
```bash
# Tool structure
my-tool/
├── SKILL.md           # Agent-facing documentation
├── skill.yaml         # Execution metadata (scripts, hooks, env)
├── src/               # Source code
└── RESOURCES.md       # Additional documentation (optional)

# After signing
my-tool-v1.0.0.tar.gz           # Signed tarball
my-tool.sigstore-bundle         # Signature + certificate + Rekor proof
```

---

## File Format

Enact tools use a **two-file model**:

### `SKILL.md` — Agent-facing documentation

A Markdown document with YAML frontmatter following the [Agent Skills standard](https://agentskills.io):

```markdown
---
name: org/category/tool
description: Tool description
---

# Tool Name

Detailed documentation in Markdown format.

## Usage

Explain how to use the tool, provide examples, tips, etc.
```

### `skill.yaml` — Execution metadata

Defines how to run the tool (scripts, hooks, env, container image):

```yaml
enact: "2.0.0"
name: org/category/tool
description: Tool description
from: python:3.11-slim

hooks:
  build:
    - pip install -r requirements.txt

scripts:
  process: "python src/main.py {{input}}"
```

### Execution Model

The presence of a `scripts` field determines execution:
- **With `scripts`** → Container-executed (deterministic)
- **Without `scripts`** → LLM-driven (instructions interpreted by AI from SKILL.md)

---

## Tool Types

The presence of a `scripts` field in `skill.yaml` determines the execution model.

### Container-Executed Tools
- **Has:** `scripts` field in `skill.yaml`
- **Execution:** Runs in isolated container
- **Characteristics:** Deterministic, reproducible
- **Use case:** Scripts, CLI tools, data processing

### LLM-Driven Tools (Instructions-Only)
- **No:** `scripts` field — only `SKILL.md` with documentation
- **Execution:** Markdown instructions interpreted by LLM
- **Characteristics:** Non-deterministic, flexible
- **Use case:** Complex analysis, creative tasks, multi-step reasoning
- **Supports:** Progressive disclosure (on-demand content loading via RESOURCES.md)

---

## Directory Structure

### Active User-Level Tools
```
~/.enact/tools/
└── {org}/
    └── {path}/                      # Arbitrary depth hierarchy (like Java packages)
        └── {to}/
            └── {tool}/
                ├── SKILL.md         # Agent-facing documentation
                ├── skill.yaml       # Execution metadata
                ├── src/             # Source code (if any)
                └── RESOURCES.md     # Additional docs (optional)
```

**Examples:**
```
~/.enact/tools/acme-corp/api/slack-notifier/
~/.enact/tools/mycompany/ai/nlp/sentiment/analyzer/
~/.enact/tools/username/utils/helper/
```

**Notes:**
- These are the "active" installed tools (like npm global installs)
- No version directory - only one active version at a time per tool
- Can be modified/customized by the user
- Created when you run `enact install --global` or `enact install .`

### Installed Skills
```
~/.agent/skills/
└── {org}/
    └── {path}/                      # Arbitrary depth hierarchy
        └── {to}/
            └── {tool}/
                ├── SKILL.md
                ├── skill.yaml
                ├── src/
                └── ...
```

**Examples:**
```
~/.agent/skills/acme-corp/api/slack-notifier/
~/.agent/skills/mycompany/ai/nlp/sentiment/analyzer/
```

**Notes:**
- Follows the [Agent Skills standard](https://agentskills.io) directory layout
- One version per skill (no version subdirectories)
- Verified on download from registry
- Created automatically during install or download

### Project-Level Tools
```
my-project/
├── .enact/
│   ├── tools.json               # Project manifest (commit to git)
│   └── {org}/
│       └── {path}/
│           └── {tool}/
│               ├── SKILL.md
│               └── ...
```

**Notes:**
- Tools installed for specific projects only
- Created when you run `enact install <tool>` (without --global)
- Team members can sync via `tools.json`

### Secrets and Environment Variables

**Secrets (OS Keyring):**
- Stored in OS-native keyring (macOS Keychain, Windows Credential Manager, Linux Secret Service)
- Service name: `enact-cli`
- Account format: `{namespace}:{SECRET_NAME}`
- Resolution: Namespace inheritance (walks up tool path)

**Environment Variables (.env files):**
```
~/.enact/
└── .env                              # Global non-secret env vars

project-dir/
└── .enact/
    └── .env                          # Local project overrides
```

**Priority order:**
1. Local project `.env` (`.enact/.env`)
2. Global user `.env` (`~/.enact/.env`)
3. Default values from tool manifest

---

## Security Considerations

### Command Injection Prevention
The `scripts` field uses `{{param}}` template substitution. Each `{{param}}` becomes a single argument passed directly to `execve()` — no shell interpretation occurs.

**Security model:**
- `{{param}}` values are passed as individual arguments, not through a shell
- No shell metacharacters can break out of the argument boundary
- Optional parameters without values are omitted entirely (no empty arguments)

**Best Practices:**
1. **Use environment variables** for complex or sensitive inputs:
   ```yaml
   env:
     INPUT_DATA:
       description: "Complex input data"
   scripts:
     process: "python process.py"
   ```
2. **Use JSON files** for complex structured data — write the input to a file and pass the filename.

### Secret Management
Tools often require API keys or credentials. **Never hardcode secrets in `skill.yaml` or `SKILL.md`.**

**Best Practices:**

1. **Declare Secrets:** Use `secret: true` in the `env` field:
   ```yaml
   env:
     OPENAI_API_KEY:
       description: "OpenAI API key for model access"
       secret: true
     DATABASE_PASSWORD:
       description: "Database credentials"
       secret: true
   ```

2. **User Storage:** Users set secrets using the unified CLI, which stores them in the OS keyring:
   ```bash
   enact env set OPENAI_API_KEY --secret --namespace alice/api
   ```

3. **Namespace Inheritance:** Secrets are shared across all tools in a namespace (e.g., `alice/api/*` shares `alice/api:OPENAI_API_KEY`).

4. **Runtime Injection:** Secrets are loaded from the keyring and injected securely via Dagger's secret API - never written to disk.

5. **Non-Sensitive Config:** Omit `secret` (or set to `false`) for configuration that can be stored in `.env` files:
   ```yaml
   env:
     LOG_LEVEL:
       description: "Logging verbosity"
       default: "info"
   ```

---

## Best Practices Summary

1. **Naming:** Use hierarchical paths like Java packages (e.g., `org/category/tool-name` or deeper as needed)
2. **Versions:** Pin exact versions in `scripts` commands (e.g., `npx prettier@3.3.3`)
3. **Schemas:** Always provide `inputSchema` and `outputSchema`
4. **Containers:** Pin specific image tags, prefer minimal images
5. **Annotations:** Set appropriate behavior hints for safety
6. **Documentation:** Include clear descriptions and examples
7. **Security:** Sign tools before public distribution
8. **Timeouts:** Set realistic timeout values
9. **Resources:** Specify resource limits for resource-intensive tools
10. **Testing:** Include examples for validation

---

## References

- **Agent Skills Standard:** [agentskills.io](https://agentskills.io)
- **Implementation Guide:** [README.md](README.md)
- **CLI Commands:** [COMMANDS.md](COMMANDS.md)

---

## License

MIT License

© 2025 Enact Protocol Contributors

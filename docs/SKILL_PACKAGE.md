# skill.package.yml Reference

A complete guide to the `skill.package.yml` manifest format for Enact skills.

## Overview

The `skill.package.yml` file is the execution manifest for an Enact skill. It defines:

- **Identity**: Name, version, and description
- **Runtime**: Container image and environment setup
- **Scripts**: Executable commands that can be invoked
- **Secrets**: Environment variables and API keys
- **Metadata**: Authors, license, and documentation

This file works alongside `SKILL.md` (agent-facing documentation) to create a complete, executable skill package.

---

## Minimal Example

```yaml
name: acme/greeter
version: "1.0.0"
description: Greets users by name

scripts:
  greet: "echo Hello"
```

That's it! This defines a working skill with one executable script.

---

## Complete Example

```yaml
name: acme/scraper
version: "1.2.0"
description: Scrape web pages and extract structured data

env:
  API_KEY:
    description: API key for the scraping service
    secret: true
    required: true
  LOG_LEVEL:
    description: Logging verbosity (debug, info, warn, error)
    default: info

scripts:
  build: "pip install -r requirements.txt"
  scrape: "python scrape.py"
---

## Field Reference

### Required Fields

#### `name`
**Type:** `string`
**Required:** Yes

Hierarchical identifier for the skill. Must be unique within its scope.

**Format:** `scope/skill-name` or `scope/category/skill-name`

**Examples:**
```yaml
name: acme/greeter
name: acme/web/scraper
name: org/ml/image-classifier
```

#### `description`
**Type:** `string`
**Required:** Yes

Human-readable summary of what the skill does. Keep it concise (1-2 sentences).

**Example:**
```yaml
description: Scrape web pages and convert HTML to clean markdown
```

---

### Version & Runtime

#### `version`
**Type:** `string`
**Recommended**

Semantic version of your skill (e.g., `"1.2.3"`). Used for dependency resolution and updates.

**Example:**
```yaml
version: "2.1.0"
```

#### `from`
**Type:** `string`
**Recommended**

Base Docker image for execution. If not specified, uses a minimal default.

**Common choices:**
```yaml
from: python:3.12-slim      # Python
from: node:20-alpine        # Node.js
from: rust:1.75-alpine      # Rust
from: golang:1.21-alpine    # Go
from: ubuntu:22.04          # Generic Linux
```

#### `timeout`
**Type:** `string`
**Default:** `"30s"`

Maximum execution time before the skill is terminated.

**Format:** `<number><unit>` where unit is `s` (seconds), `m` (minutes), or `h` (hours)

**Examples:**
```yaml
timeout: 30s    # 30 seconds
timeout: 5m     # 5 minutes
timeout: 1h     # 1 hour
```

---

### Scripts

#### `scripts`
**Type:** `Record<string, string | ScriptDefinition>`
**Core feature**

Named executable commands. Each script becomes a callable action via the `:script` syntax.

**Simple form (command string):**
```yaml
scripts:
  greet: "python hello.py"
  scrape: "python scrape.py"
  build: "pip install -r requirements.txt"
```

**Expanded form (with metadata):**
```yaml
scripts:
  scrape:
    command: "python scrape.py"
    description: "Scrape a URL and return markdown"
    annotations:
      openWorldHint: true
```

**How arguments work:**

Arguments are passed directly to your script command without modification:

```bash
# CLI usage with flags
enact run acme/scraper:scrape --url https://example.com --format markdown

# Your script receives:
python scrape.py --url https://example.com --format markdown

# CLI usage with JSON (converted to flags)
enact run acme/scraper:scrape -a '{"url": "https://example.com", "format": "markdown"}'

# Your script receives:
python scrape.py --url https://example.com --format markdown
```

**Your script should handle its own argument parsing** using standard tools:
- Python: `argparse`, `click`, `typer`
- Node.js: `commander`, `yargs`
- Rust: `clap`, `structopt`
- Go: `flag`, `cobra`

**Best practices:**
- Use the `build` script name for setup/installation (e.g., `pip install`, `npm install`)
- Keep script commands simple - just the base command, no arguments in the manifest
- Let your script handle all argument parsing and validation

---

### Environment Variables

#### `env`
**Type:** `Record<string, EnvVariable>`

Environment variables and secrets required by the skill.

**Structure:**
```yaml
env:
  VARIABLE_NAME:
    description: "What this variable is for"
    secret: true|false      # Store in keyring vs .env file
    required: true|false    # Must be set before execution
    default: "value"        # Default value (non-secrets only)
```

**Examples:**

**API key (secret):**
```yaml
env:
  OPENAI_API_KEY:
    description: OpenAI API key from platform.openai.com
    secret: true
    required: true
```

**Configuration (non-secret):**
```yaml
env:
  LOG_LEVEL:
    description: Logging verbosity level
    default: info
  MAX_RETRIES:
    description: Maximum number of retry attempts
    default: "3"
```

**Setting values:**
```bash
# Secrets (stored in OS keyring)
enact env set OPENAI_API_KEY sk-... --secret --namespace acme

# Non-secrets (stored in .env)
enact env set LOG_LEVEL debug --namespace acme
```

**Access in scripts:**
```python
import os
api_key = os.getenv('OPENAI_API_KEY')
log_level = os.getenv('LOG_LEVEL', 'info')
```

---

### Behavior Annotations

#### `annotations`
**Type:** `ToolAnnotations`

Hints for AI agents about skill behavior. These help agents make informed decisions about when and how to use the skill.

**Available annotations:**

**`readOnlyHint`** - Skill does not modify the environment
```yaml
annotations:
  readOnlyHint: true
```

**`idempotentHint`** - Multiple executions produce the same result
```yaml
annotations:
  idempotentHint: true
```

**`destructiveHint`** - Skill may make irreversible changes
```yaml
annotations:
  destructiveHint: true
```

**`openWorldHint`** - Skill interacts with external systems (network, APIs)
```yaml
annotations:
  openWorldHint: true
```

**Example:**
```yaml
annotations:
  readOnlyHint: true        # Read-only operation
  idempotentHint: true      # Safe to retry
  openWorldHint: true       # Makes HTTP requests
```

---

### Metadata

#### `license`
**Type:** `string`

SPDX license identifier (e.g., `MIT`, `Apache-2.0`, `GPL-3.0`)

```yaml
license: MIT
```

#### `authors`
**Type:** `Author[]`

Skill creators and maintainers.

```yaml
authors:
  - name: Alice Developer
    email: alice@example.com
    url: https://alice.dev
  - name: Bob Contributor
```

#### `tags`
**Type:** `string[]`

Keywords for discovery and categorization.

```yaml
tags:
  - web
  - scraping
  - markdown
  - data-extraction
```

---

### Testing & Documentation

#### `examples`
**Type:** `ToolExample[]`

Test cases with example inputs and expected outputs.

```yaml
examples:
  - description: Basic greeting
    input:
      name: World
    output:
      message: "Hello World!"

  - description: Scrape homepage
    input:
      url: "https://example.com"
    output:
      title: "Example Domain"
```

---

### Advanced Features

#### `hooks`
**Type:** `ToolHooks`

Lifecycle hooks for installation and builds.

**`hooks.build`** - Legacy build commands (auto-executed for backwards compatibility)
```yaml
hooks:
  build: "pip install requests"
```

**`hooks.postinstall`** - Run after skill installation
```yaml
hooks:
  postinstall:
    - "npm install"
    - "npm run build"
```

> **Note:** Prefer using `scripts.build` instead of `hooks.build`. Scripts give agents explicit control - they call build when needed rather than auto-executing.

#### `resources`
**Type:** `ResourceRequirements`

Resource limits and requirements.

```yaml
resources:
  memory: 2Gi      # System memory
  gpu: 24Gi        # GPU memory
  disk: 100Gi      # Disk space
```

---

## Best Practices

### 1. **Keep scripts simple**
Scripts should just be the base command. Let your script handle argument parsing.

**Good:**
```yaml
scripts:
  scrape: "python scrape.py"
```

**Your Python script:**
```python
import argparse

parser = argparse.ArgumentParser()
parser.add_argument('--url', required=True)
parser.add_argument('--format', default='markdown')
args = parser.parse_args()
```

### 2. **Use meaningful script names**
Script names become the action identifier (`skill:script`).

```yaml
scripts:
  build: "pip install -r requirements.txt"   # Setup/installation
  scrape: "python scrape.py"                 # Main action
  validate: "python validate.py"             # Validation
```

### 3. **Document environment variables**
Provide clear descriptions for all env vars, especially secrets.

```yaml
env:
  API_KEY:
    description: "API key from https://platform.example.com/keys"
    secret: true
```

### 4. **Use annotations appropriately**
Help agents understand your skill's behavior:

```yaml
# Data processing skill
annotations:
  readOnlyHint: true
  idempotentHint: true

# API client
annotations:
  openWorldHint: true
  idempotentHint: false

# Database migration
annotations:
  destructiveHint: true
  idempotentHint: false
```

### 5. **Include examples**
Examples serve as both documentation and tests.

```yaml
examples:
  - description: Basic usage
    input:
      url: "https://example.com"
    output:
      title: "Example Domain"
```

### 6. **Version appropriately**
Follow semantic versioning:
- `1.0.0` → `1.0.1`: Bug fix
- `1.0.0` → `1.1.0`: New feature (backwards compatible)
- `1.0.0` → `2.0.0`: Breaking change

---

## File Location

Place `skill.package.yml` in your skill's root directory:

```
my-skill/
├── SKILL.md              # Agent-facing documentation
├── skill.package.yml     # Execution manifest (this file)
├── scrape.py             # Your implementation
└── requirements.txt      # Dependencies
```

---

## Publishing

When you publish a skill with `enact publish`, the manifest is:
1. **Validated** - Ensures all required fields are present
2. **Signed** - Cryptographically signed for verification
3. **Uploaded** - Published to the registry with the signature

Users can verify authenticity and integrity before running your skill.

---

## Migration from Template System

If you have an old skill using `{{param}}` templates, update it:

**Before:**
```yaml
scripts:
  scrape: "python scrape.py {{url}} {{format}}"
```

**After:**
```yaml
scripts:
  scrape: "python scrape.py"
```

**Update your Python script:**
```python
import argparse

parser = argparse.ArgumentParser()
parser.add_argument('--url', required=True)
parser.add_argument('--format', default='markdown')
args = parser.parse_args()

# Use args.url and args.format
```

---

## See Also

- [Getting Started](../GETTING-STARTED.md) - Create your first skill
- [SKILL.md Documentation](./SKILL_Doc.md) - Agent-facing documentation format
- [Environment Variables](./ENV.md) - Managing secrets and configuration
- [Protocol Spec](./SPEC.md) - Full protocol specification

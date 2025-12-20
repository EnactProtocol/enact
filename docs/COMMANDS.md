# Enact CLI Commands Reference

This document provides a comprehensive overview of all available commands in the Enact CLI tool.

## Table of Contents

### Setup & Initialization
1. [setup](#1-setup---configure-enact) - Configure Enact
2. [init](#2-init---initialize-project) - Initialize project

### Core Commands
3. [run](#3-run---run-tools-declared-command) - Run tool's declared command
4. [exec](#4-exec---execute-arbitrary-command-in-tools-environment) - Execute arbitrary command in tool's environment
5. [install](#5-install---install-tool) - Install tool
6. [search](#6-search---discover-tools) - Discover tools
7. [sign](#7-sign---sign-tool) - Sign tool
8. [publish](#8-publish---publish-tool) - Publish tool
9. [learn](#9-learn---learn-about-a-tool) - Learn about a tool
10. [inspect](#10-inspect---inspect-tool-for-auditing) - Inspect tool for auditing

### Trust & Security Commands
11. [trust](#11-trust---manage-trust-settings) - Manage trust settings
12. [report](#12-report---report-tool-issues) - Report tool issues
13. [yank](#13-yank---yank-tool-version) - Yank a tool version
14. [unyank](#14-unyank---restore-yanked-version) - Restore yanked version

### Environment & Configuration
15. [env](#15-env---environment--secret-management) - Environment & secret management
16. [config](#16-config---configuration) - Configuration

### Utility Commands
17. [cache](#17-cache---cache-management) - Cache management
18. [list](#18-list---list-tools) - List tools

### Authentication
19. [auth](#19-auth---authentication) - Authentication

---

## Overview

Enact CLI manages containerized tools with cryptographic signing. It supports local development in `~/.enact/local/` and automatic caching of registry tools in `~/.enact/cache/`.

## Global Options

- `--help, -h` - Show help message
- `--version, -V` - Show version information
- `--verbose` - Show detailed execution information

## Setup & Initialization

### 1. setup - Configure Enact

**Purpose**: Set up Enact configuration (first-time setup or reconfiguration).

**Usage**: `enact setup [options]`

**Options**:
- `--global, -g` - Initialize global configuration (`~/.enact/config.yaml`)
- `--force, -f` - Overwrite existing configuration without prompting
- `--verbose, -v` - Show detailed output

**Behavior**:
- Creates `~/.enact/` directory structure
- Initializes `config.yaml` with default settings
- Sets up authentication if needed

**Examples**:
```bash
# Interactive setup
enact setup

# Force reconfigure global settings
enact setup --global --force
```

---

### 2. init - Initialize Project

**Purpose**: Initialize Enact in the current directory. Can create tool manifests, agent guides, or Claude-specific instructions.

**Usage**: `enact init [options]`

**Options**:
- `--name, -n <name>` - Tool name (default: `username/my-tool`)
- `--force, -f` - Overwrite existing files
- `--tool` - Create a new Enact tool (default)
- `--agent` - Create `AGENTS.md` for projects that use Enact tools
- `--claude` - Create `CLAUDE.md` with Claude-specific instructions
- `--verbose, -v` - Show detailed output

**Modes**:

**Tool Mode (default)**:
Creates a new Enact tool with:
- `SKILL.md` - Tool manifest (YAML frontmatter + documentation)
- `AGENTS.md` - Development guide for AI agents
- Basic project structure

**Agent Mode**:
Creates `AGENTS.md` with instructions for AI agents on how to use Enact tools in your project.

**Claude Mode**:
Creates `CLAUDE.md` with Claude Code-specific instructions for working with your project.

**Examples**:
```bash
# Create a new tool
enact init
enact init --name myorg/utils/my-tool

# Create agent instructions for existing project
enact init --agent

# Create Claude-specific instructions
enact init --claude

# Overwrite existing files
enact init --tool --force
```

---

## Core Commands

### 3. run - Run Tool's Declared Command

**Purpose**: Execute a tool's canonical, signed command.

**Usage**: `enact run <tool-name> --args '<json>'`

**Arguments**:
- `tool-name` - Tool identifier (e.g., "myorg/utils/hello")
- `--args` - JSON object with tool parameters

**Options**:
- `--timeout <duration>` - Override tool timeout (e.g., 30s, 5m)
- `--no-cache` - Force a clean run by disabling Dagger caching
- `--dry-run` - Show what would execute without running
- `--verbose` - Show detailed execution info
- `--quiet, -q` - Suppress output except for tool output

**Behavior**:
- If tool has `command` field → executes in container with declared command
- If tool has no `command` field → displays the tool's markdown instructions
- If tool has `build` field → build commands run first (cached by Dagger)

**Build Caching**:
Tools with a `build` field benefit from Dagger's layer caching:
- First run: Container image pull + build steps + command (may be slow)
- Subsequent runs: Cached build → only command executes (instant)
- Use `--no-cache` to force a fresh build

**Resolution order**: Project `.enact/` → `~/.enact/tools/` (user-level) → `~/.enact/cache/` → download from registry

**Examples**:
```bash
# Run local tool
enact run myorg/utils/hello --args '{"name":"Alice"}'

# Run from cache or download
enact run kgroves88/ai/pdf-extract --args '{"pdf_path":"doc.pdf","pages":[1,2]}'

# Dry run to see what would execute
enact run myorg/data/processor --args '{"file":"data.csv"}' --dry-run

# Run tool with build step (first run compiles, subsequent runs are cached)
enact run ./examples/hello-rust --args '{"name":"World"}'

# Force fresh build (skip cache)
enact run myorg/utils/tool --args '{}' --no-cache

# Quiet mode (only show tool output)
enact run myorg/utils/hello --args '{"name":"Alice"}' --quiet
```

---

### 2. exec - Execute Arbitrary Command in Tool's Environment

**Purpose**: Run custom commands inside a tool's containerized environment.

**Usage**: `enact exec <tool-name> "<command>"`

**Arguments**:
- `tool-name` - Tool identifier (e.g., "myorg/utils/hello")
- `command` - Shell command to execute inside the container

**Options**:
- `--timeout <duration>` - Override tool timeout (e.g., 30s, 5m)
- `--verbose` - Show detailed execution info

**Behavior**:
- Runs the provided command inside the tool's container (defined by `from:` field)
- Same isolation and security guarantees as `run`
- Not signed or deterministic — useful for experimentation, debugging, or one-off tasks

**⚠️ Security Warning**:
This command bypasses the deterministic execution guarantee of the signed manifest. It allows running *any* command inside the container. Use with caution, especially when automating tool execution.

**Resolution order**: Project `.enact/` → `~/.enact/tools/` (user-level) → `~/.enact/cache/` → download from registry

**Examples**:
```bash
# Run custom Python script in tool's environment
enact exec acme-corp/data/processor "python scripts/validate.py data.csv"

# Execute shell commands for debugging
enact exec myorg/utils/analyzer "ls -la && cat config.json"

# Run one-off data transformation
enact exec kgroves88/ai/pdf-extract "python extract.py --file=doc.pdf --pages=1-5"
```

---

### 3. install - Install Tool

**Purpose**: Install tools to project or globally (like npm).

**Usage**: `enact install [tool-name] [options]`

**Arguments**:
- `tool-name` - Tool identifier from registry, current directory (`.`), or omit for batch install
  - Format: `org/path/tool` or `org/path/tool@v1.0.0`
  - Note: Always use `v` prefix when specifying versions (e.g., `@v1.0.0`)

**Options**:
- `--global, -g` - Install globally for user-level access (like npm -g)
- `--force, -f` - Overwrite existing installation
- `--verbose` - Show detailed output
- `--json` - Output result as JSON

**Behavior**:

All tools are stored in the cache (`~/.enact/cache/{tool}/{version}/`) and tracked via `tools.json` files.

**Project-level (default):**
- `enact install <tool-name>` → Downloads to cache, adds to `./.enact/tools.json`
- `enact install` → Installs all tools from `./.enact/tools.json`
- `enact install .` → Packages current directory to cache, adds to `./.enact/tools.json`

**User-level (--global):**
- `enact install <tool-name> --global` → Downloads to cache, adds to `~/.enact/tools.json`
- `enact install . --global` → Packages current directory to cache, adds to `~/.enact/tools.json`

**Resolution order**: `./.enact/tools.json` (project) → `~/.enact/tools.json` (global) → `~/.enact/cache/` → download from registry

**Examples**:
```bash
# Install tool for current project (like npm install <package>)
enact install acme-corp/data/csv-processor
# Downloads to ~/.enact/cache/acme-corp/data/csv-processor/v1.0.0/
# Adds to ./.enact/tools.json

# Install all project tools (like npm install)
enact install
# Reads ./.enact/tools.json and installs all listed tools to cache

# Install tool globally (like npm install -g <package>)
enact install acme-corp/data/csv-processor --global
# Downloads to ~/.enact/cache/acme-corp/data/csv-processor/v1.0.0/
# Adds to ~/.enact/tools.json

# Install current directory globally (like npm install -g .)
cd my-tool/
enact install . --global
# Packages to ~/.enact/cache/myorg/category/my-tool/v1.0.0/
# Adds to ~/.enact/tools.json

# Install current directory to project
cd my-tool/
enact install .
# Packages to ~/.enact/cache/myorg/category/my-tool/v1.0.0/
# Adds to ./.enact/tools.json
```

**Project tools.json** (`./.enact/tools.json`):
```json
{
  "tools": {
    "acme-corp/data/csv-processor": "^1.0.0",
    "myorg/utils/formatter": "latest"
  }
}
```

---

### 4. search - Discover Tools

**Purpose**: Search registry for tools using tags and descriptions.

**Usage**: `enact search <query> [options]`

**Arguments**:
- `query` - Search keywords (matches tags, descriptions, names)

**Options**:
- `--tags <tags>` - Filter by tags (comma-separated)
- `--limit <n>` - Max results (default: 20)
- `--json` - Output as JSON

**Examples**:
```bash
enact search "pdf extraction"
enact search --tags csv,data --limit 10
enact search formatter --json
```

---

### 5. sign - Sign Tool

**Purpose**: Cryptographically sign a tool and submit attestation to registry.

**Usage**: `enact sign <path-or-ref> [options]`

**Arguments**:
- `path-or-ref` - Either a local path to tool directory OR a remote tool reference (`author/tool@version`)

**Options**:
- `--identity, -i <email>` - Sign with specific identity (uses OAuth)
- `--output, -o <path>` - Output path for signature bundle (local only)
- `--dry-run` - Show what would be signed without signing
- `--local` - Save signature locally only, do not submit to registry
- `--verbose` - Show detailed output
- `--json` - Output result as JSON

**Process**:
1. Authenticates via OAuth (GitHub)
2. Generates ephemeral keypair
3. Requests certificate from Fulcio
4. Creates in-toto attestation
5. Signs with ECDSA
6. Logs to Rekor transparency log
7. Submits attestation to Enact registry (unless --local)

**Examples**:
```bash
# Sign a local tool
enact sign ./my-tool/
enact sign ./my-tool/ --output=./my-tool.sigstore
enact sign ./my-tool/ --dry-run  # Preview without signing
enact sign ./my-tool/ --local    # Sign locally without submitting

# Sign a remote tool (already published)
enact sign alice/my-tool@1.0.0            # Sign by bundle hash
enact sign alice/my-tool@1.0.0 --dry-run  # Preview what would be signed
```

**Remote signing**: When signing a remote tool reference, the CLI fetches the tool's bundle hash from the registry and creates an attestation for that specific version. This allows auditors to sign tools without downloading the source.

---

### 6. publish - Publish Tool

**Purpose**: Publish signed tool to registry.

**Usage**: `enact publish <path> [options]`

**Arguments**:
- `path` - Path to tool directory (must be signed)

**Requirements**:
- Tool must be validated
- Tool must be signed
- Must be authenticated

**Examples**:
```bash
# Complete publishing workflow
enact sign ./my-tool/
enact publish ./my-tool/
```

---

### 7. learn - Learn About a Tool

**Purpose**: Retrieve tool metadata, instructions, and usage information.

**Usage**: `enact learn <tool-name> [options]`

**Arguments**:
- `tool-name` - Tool identifier (local path or registry name)

**Options**:
- `--format <format>` - Output format: yaml, json, md (default: yaml)

**Returns**:
- Tool metadata (name, description, tags)
- Full instructions from SKILL.md
- Input/output schemas
- Whether tool is executable (has `command` field)

**Examples**:
```bash
# Learn about a registry tool
enact learn kgroves88/ai/pdf-extract

# Learn about an instruction-only tool
enact learn acme-corp/workflows/data-pipeline

# Learn about a local tool
enact learn ./my-tool

# Output as JSON
enact learn acme-corp/data/processor --format json

# Output as markdown (shows full instructions)
enact learn acme-corp/workflows/data-pipeline --format md
```

---

### 8. inspect - Inspect Tool for Auditing

**Purpose**: Open a tool's page in the browser for inspection (or download locally for deeper review).

**Usage**: `enact inspect <tool[@version]> [options]`

**Arguments**:
- `tool[@version]` - Tool identifier with optional version

**Options**:
- `-d, --download` - Download tool locally instead of opening browser
- `-o, --output <path>` - Output directory when downloading (default: tool name in current directory)
- `-f, --force` - Overwrite existing directory
- `--verbose` - Show detailed output
- `--json` - Output result as JSON

**Behavior**:
- Default: Opens the tool's page in your browser for quick review
- With `--download`: Downloads the tool bundle and extracts to a local directory
- Does NOT install to ~/.enact/cache/ or update tools.json
- Does NOT require trust verification (purpose is to audit before trusting)

**Use cases**:
- Quick browser-based review of tool metadata and code
- Security audits before adding a tool to your trusted list
- Deeper code review with `--download` for local inspection
- Reviewing tool code before your organization adopts it

**Examples**:
```bash
# Open tool page in browser (default)
enact inspect alice/utils/greeter

# Inspect specific version in browser
enact inspect alice/utils/greeter@v1.0.0

# Download for deeper review (extracts to ./greeter/)
enact inspect alice/utils/greeter --download

# Specify output directory when downloading
enact inspect alice/utils/greeter --download --output ./review/greeter

# Complete audit workflow
enact inspect alice/utils/greeter@v1.0.0 --download
cd greeter
# Review code, run security scans, test functionality...
enact sign .          # Sign if it passes
# OR
enact report alice/utils/greeter@v1.0.0 --reason "Issue found"
```

---

## Trust & Security Commands

### 9. trust - Manage Trust Settings

**Purpose**: Control which identities you trust for attestation verification.

**Usage**: `enact trust <subcommand> [identity]`

**Subcommands**:
- `<identity>` - Trust an identity (must be in `provider:identity` format)
- `-r <identity>` or `remove <identity>` - Remove trust
- `list` - List all trusted identities
- `check <tool@version>` - Check trust status of a tool

**Identity format** (always `provider:identity`):
- `github:alice` - GitHub user
- `github:EnactProtocol` - GitHub organization
- `google:security@company.com` - Google account
- `microsoft:user@company.com` - Microsoft account

**Wildcards** (in config file):
- `github:my-org/*` - Trust entire GitHub org
- `google:*@company.com` - Trust all company emails

**Examples**:
```bash
# Trust identities (always use provider:identity format)
enact trust github:alice
enact trust github:EnactProtocol
enact trust google:security@company.com

# Remove trust
enact trust -r github:alice
enact trust -r github:sketchy-org

# List trusted identities
enact trust list

# Check tool's trust status and view attestations
enact trust check alice/utils/greeter@v1.0.0
```

**Configuration storage**: `~/.enact/config.yaml`

See [TRUST.md](TRUST.md) for complete trust system documentation.

---

### 10. report - Report Tool Issues

**Purpose**: Report security vulnerabilities or issues with a tool.

**Usage**: `enact report <tool[@version]> --reason "<description>" [options]`

**Arguments**:
- `tool[@version]` - Tool identifier, optionally with version

**Options**:
- `--reason, -r <description>` - Issue description (required)
- `--severity, -s <level>` - Severity: critical, high, medium, low (default: medium)
- `--category, -c <type>` - Issue type: security, malware, quality, license, other (default: other)
- `--dry-run` - Show what would be submitted without submitting
- `--verbose` - Show detailed output
- `--json` - Output result as JSON

**Behavior**:
- Creates a report in the registry
- Notifies tool publisher
- May affect tool's trust status
- Reports are public and auditable

**Examples**:
```bash
# Report security vulnerability
enact report alice/utils/greeter@v1.0.0 \
  --reason "SQL injection vulnerability in query handler" \
  --severity critical \
  --category security

# Report quality issue
enact report bob/tools/formatter@v2.0.0 \
  --reason "Tool fails on large files" \
  --severity medium \
  --category quality

# Preview without submitting
enact report alice/utils/greeter \
  --reason "Issue description" \
  --dry-run
```

**Note**: False reports may result in account suspension.

---

## Environment & Configuration

### 11. env - Environment & Secret Management

**Purpose**: Unified management of both environment variables (.env files) and secrets (OS keyring).

**Usage**: `enact env <subcommand> [options]`

**Subcommands**:
- `set <key> [value]` - Set environment variable or secret
- `get <key>` - Get environment variable or check secret existence
- `list` - List environment variables or secrets
- `delete <key>` - Delete environment variable or secret
- `resolve <tool>` - Show complete environment resolution for a tool
- `edit` - Open .env file in editor (non-secrets only)

**Storage**:
- **Non-secrets**: `.env` files
  - Global: `~/.enact/.env`
  - Local: `.enact/.env`
  - Priority: Local → Global → Default
- **Secrets** (with `--secret` flag): OS keyring
  - Service: `enact-cli`
  - Account format: `{namespace}:{SECRET_NAME}`
  - Namespace inheritance (walks up tool path)

**Options**:
- `--secret` - Store in OS keyring instead of `.env` file
- `--namespace <namespace>` - Namespace for secret (required with `--secret`)
- `--local` - Use local project `.env` (ignored with `--secret`)

**Examples - Non-Secret Environment Variables**:
```bash
# Set global environment variable
enact env set LOG_LEVEL debug
# ✓ Environment variable 'LOG_LEVEL' set globally.
#   Location: ~/.enact/.env

# Set local (project) environment variable
enact env set LOG_LEVEL debug --local
# ✓ Environment variable 'LOG_LEVEL' set for project.
#   Location: .enact/.env

# Get variable value
enact env get LOG_LEVEL
# LOG_LEVEL=debug (from .enact/.env)

# List all environment variables
enact env list
# Global (~/.enact/.env):
#   LOG_LEVEL=info
#   API_BASE_URL=https://api.example.com
#
# Local (.enact/.env):
#   LOG_LEVEL=debug
#   API_BASE_URL=https://dev-api.example.com
#
# Effective values:
#   LOG_LEVEL=debug (local override)
#   API_BASE_URL=https://dev-api.example.com (local override)

# Edit environment file
enact env edit          # Opens ~/.enact/.env
enact env edit --local  # Opens .enact/.env

# Delete variable
enact env delete LOG_LEVEL --local
# ✓ Environment variable 'LOG_LEVEL' removed from .enact/.env
```

**Examples - Secrets (OS Keyring)**:
```bash
# Set a secret (prompts for value)
enact env set API_TOKEN --secret --namespace alice/api
# Enter secret value for API_TOKEN: *************
# ✓ Secret 'API_TOKEN' stored securely in keyring.
#   Available to: alice/api/*

# Check if secret exists (never prints value)
enact env get API_TOKEN --secret --namespace alice/api
# ✓ Secret 'API_TOKEN' exists at alice/api

# List secrets for namespace
enact env list --secret --namespace alice/api
# Secrets for alice/api:
#   API_TOKEN
#   SLACK_WEBHOOK

# Delete a secret
enact env delete API_TOKEN --secret --namespace alice/api
# ✓ Secret 'API_TOKEN' removed from system keyring.
```

**Examples - Resolution**:
```bash
# Show complete environment for a tool
enact env resolve alice/api/slack/notifier

# Secrets (from keyring):
#   API_TOKEN      ← alice/api:API_TOKEN ✓
#   SLACK_WEBHOOK  ← alice/api:SLACK_WEBHOOK ✓
#
# Environment Variables:
#   LOG_LEVEL      ← .enact/.env (local) = debug
#   API_BASE_URL   ← ~/.enact/.env (global) = https://api.example.com
#
# Missing:
#   ✗ DATABASE_URL (required secret)
#   To set: enact env set DATABASE_URL --secret --namespace alice/api
```

**Namespace Inheritance (Secrets)**:

Secrets walk up the tool path to find values:
```
Tool: alice/api/slack/notifier
Needs: API_TOKEN

Lookup:
  1. alice/api/slack:API_TOKEN
  2. alice/api:API_TOKEN ✓ found
  3. alice:API_TOKEN
```

---

### 12. config - Configuration

**Purpose**: Manage CLI configuration.

**Usage**: `enact config <subcommand> [options]`

**Subcommands**:
- `set <key> <value>` - Set configuration value
- `get <key>` - Get configuration value
- `list` - List all configuration
- `reset` - Reset to defaults

**Common settings**:
- `registry.url` - Registry URL (default: https://enact.tools)
- `cache.dir` - Cache directory (default: ~/.enact/cache)
- `tools.dir` - User-level tools directory (default: ~/.enact/tools)

**Examples**:
```bash
enact config set registry.url https://my-registry.com
enact config get registry.url
enact config list
```

---

## Utility Commands

### 13. cache - Cache Management

**Purpose**: Manage downloaded tool cache.

**Usage**: `enact cache <subcommand>`

**Subcommands**:
- `list` - List cached tools
- `clean` - Remove unused cached tools
- `clear` - Remove all cached tools
- `info` - Show cache statistics

**Examples**:
```bash
enact cache list
enact cache clean              # Remove tools not used in 30 days
enact cache clear              # Remove all cached tools
enact cache info               # Show cache size and stats
```

---

### 14. list - List Tools

**Purpose**: List installed tools.

**Usage**: `enact list [options]`

**Options**:
- `-g, --global` - List global tools (from `~/.enact/tools.json`)
- `-v, --verbose` - Show detailed output including cache paths
- `--json` - Output as JSON

**Behavior**:
- Default: Lists project tools from `./.enact/tools.json`
- With `-g`: Lists global tools from `~/.enact/tools.json`
- Tools are stored in cache and referenced by the tools.json files

**Examples**:
```bash
enact list           # List project tools
enact list -g        # List global tools
enact list -v        # Show cache paths
enact list --json    # Output as JSON
```

---

## Authentication

### 15. auth - Authentication

**Purpose**: Manage authentication for publishing and private registries.

**Usage**: `enact auth <subcommand>`

**Subcommands**:
- `login` - Authenticate via OAuth
- `logout` - Remove credentials
- `status` - Show authentication status
- `whoami` - Show current authenticated user

**Examples**:
```bash
enact auth login
enact auth status
enact auth whoami
enact auth logout
```

---

## Quick Workflows

### User-Level Tool Development
```bash
# 1. Create tool in project directory
cd my-tool-project

# 2. Create SKILL.md
cat > SKILL.md <<'EOF'
---
enact: "2.0.0"
name: "myorg/utils/my-tool"
description: "My tool"
tags: ["utility"]
command: "echo 'Hello ${name}!'"
inputSchema:
  type: object
  properties:
    name: { type: string }
  required: ["name"]
---

# My Tool

Simple greeting tool.
EOF

# 3. Test locally first (no install needed)
enact run . --args '{"name":"World"}'

# 4. Install globally when ready
enact install . --global
# Packages to ~/.enact/cache/myorg/utils/my-tool/v1.0.0/
# Adds to ~/.enact/tools.json

# 5. Test the installed version
enact run myorg/utils/my-tool --args '{"name":"World"}'
```

### Publishing Workflow
```bash
# 1. Sign
enact sign ./my-tool/

# 2. Publish
enact publish ./my-tool/
```

### Project Tool Setup
```bash
# 1. Initialize project with tools
cd my-project

# 2. Install tools for project
enact install acme-corp/data/csv-processor
enact install myorg/utils/formatter
# Creates ./.enact/tools.json, downloads to ~/.enact/cache/

# 3. Team members clone and install
git clone https://github.com/myorg/my-project
cd my-project
enact install
# Reads ./.enact/tools.json and downloads all tools to cache

# 4. Use project tools
enact run acme-corp/data/csv-processor --args '{"file":"data.csv"}'
```

### Installing & Using
```bash
# 1. Search
enact search "pdf extraction"

# 2. Learn about the tool
enact learn kgroves88/ai/pdf-extract

# 3. Inspect before trusting (opens in browser)
enact inspect kgroves88/ai/pdf-extract

# 4. Install and execute
enact install kgroves88/ai/pdf-extract
enact run kgroves88/ai/pdf-extract --args '{"pdf_path":"doc.pdf"}'
```

### Customizing Registry Tool
```bash
# 1. Download for inspection and editing
enact inspect acme-corp/brand/reviewer --download
cd reviewer/

# 2. Customize
vim VOICE_GUIDE.md

# 3. Install your modified version
enact install . --global

# 4. Use your customized version (global tools take priority)
enact run acme-corp/brand/reviewer --args '{"content":"test"}'
```

---

## Directory Structure

```
my-project/                   # Project directory
├── .enact/
│   ├── tools.json           # Project tools manifest (commit to git)
│   └── .env                 # Project environment variables
└── ...

~/.enact/
├── tools.json               # Global installed tools registry (points to cache)
├── cache/                   # All tools stored here (both project and global)
│   └── {org}/
│       └── {path}/
│           └── {tool}/
│               └── v1.0.0/
│                   ├── SKILL.md
│                   ├── src/
│                   └── ...
├── .env                     # Global environment variables
└── config.yaml              # CLI configuration
```

---

## Configuration Files

### ~/.enact/config.yaml
```yaml
registry:
  url: https://enact.tools

cache:
  dir: ~/.enact/cache
  maxSize: 10GB
```

### ~/.enact/tools.json
```json
{
  "tools": {
    "alice/greeter": "1.0.0",
    "bob/formatter": "2.1.0"
  }
}
```

### Tool Resolution

When executing a tool, Enact searches in this order:

1. **Project tools** (`./.enact/tools.json` → cache) - Tools installed for current project
2. **Global tools** (`~/.enact/tools.json` → cache) - Tools installed with `--global`
3. **Cache** (`~/.enact/cache/`) - Any cached version
4. **Registry** - Download, verify signature, cache, execute

---

## Exit Codes

Enact uses standardized exit codes following Unix conventions:

### Standard Codes
- `0` - Success
- `1` - General error
- `2` - Invalid command line arguments

### BSD sysexits.h Codes (64-78)
- `65` - Data error (input data was incorrect)
- `66` - Input file not found or not readable
- `69` - Service unavailable
- `70` - Internal software error
- `74` - I/O error
- `77` - Permission denied
- `78` - Configuration error

### Enact-Specific Codes (100-109)
- `100` - Tool not found
- `101` - Manifest error (invalid or missing manifest)
- `102` - Execution error (tool execution failed)
- `103` - Timeout error
- `104` - Trust verification failed
- `105` - Registry error
- `106` - Authentication error
- `107` - Validation error
- `108` - Network error
- `109` - Container runtime error

---

## Environment Variables

- `ENACT_REGISTRY_URL` - Override registry URL
- `ENACT_CACHE_DIR` - Override cache directory
- `ENACT_TOOLS_DIR` - Override user-level tools directory
- `ENACT_DEBUG` - Enable debug logging

---

## Security Notes

1. **User-level tools** (`~/.enact/tools/`) skip signature verification (user-controlled workspace)
2. **Cached tools** are verified on download from registry
3. **Signature verification** happens automatically during install/run
4. **Environment variables** are scoped to tool namespaces
5. Use `enact trust check` to view trust status and attestations for any tool

---

## Common Patterns

| Task | Command |
|------|---------|
| Install tool for project | `enact install org/cat/tool` |
| Install all project tools | `enact install` (reads ./.enact/tools.json) |
| Install tool globally | `enact install org/cat/tool --global` |
| Install current dir globally | `enact install . --global` |
| Run tool | `enact run org/cat/tool --args '{...}'` |
| Run custom command | `enact exec org/cat/tool "command"` |
| Find tools | `enact search "keyword"` |
| Customize registry tool | `enact install org/cat/tool --global` then edit |
| Sign tool | `enact sign ./my-tool/` |
| Publish tool | `enact sign && enact publish` |
| Report issue | `enact report org/cat/tool --reason "description"` |
| Check tool trust | `enact trust check org/cat/tool@version` |
| Clean cache | `enact cache clean` |
| Check auth status | `enact auth whoami` |

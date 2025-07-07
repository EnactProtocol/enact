# Enact CLI Commands Reference

This document provides a comprehensive overview of all available commands in the Enact CLI tool for easy reference and LLM processing.

## Overview

Enact CLI is a command-line tool for managing and publishing Enact tools. It provides functionality for authentication, tool creation, publishing, searching, execution, signing, and remote server management.

## Global Options

- `--help, -h` - Show help message
- `--version, -v` - Show version information

## Commands

### 1. auth - Authentication Management

**Purpose**: Manages authentication for the Enact CLI using OAuth flow.

**Usage**: `enact auth <subcommand> [options]`

**Subcommands**:
- `login` - Start OAuth login flow
- `logout` - Remove stored authentication credentials
- `status` - Show current authentication status  
- `token` - Show current authentication token (if authenticated)

**Options**:
- `--server <url>` - Specify the enact server URL (default: https://enact.tools)
- `--port <number>` - Local callback port for OAuth (default: 8080)

**Examples**:
```bash
enact auth login
enact auth status
enact auth login --server https://api.example.com --port 3000
enact auth logout
```

### 2. search - Tool Discovery

**Purpose**: Search for Enact tools in the registry using various filters.

**Usage**: `enact search [query] [options]`

**Arguments**:
- `query` - Search query (keywords, tool names, descriptions)

**Options**:
- `--limit <number>` - Maximum number of results (default: 20)
- `--tags <tags>` - Filter by tags (comma-separated)
- `--format <format>` - Output format: table, json, list (default: table)
- `--json` - Output results as JSON (shorthand for --format json)
- `--author <author>` - Filter by author

**Examples**:
```bash
enact search "text processing"
enact search formatter --tags cli,text
enact search --author myorg
enact search prettier --limit 5 --format json
enact search prettier --limit 5 --json
```

### 3. exec - Tool Execution

**Purpose**: Execute an Enact tool by fetching its definition from the registry or loading from a local file, with signature verification support.

**Usage**: `enact exec <tool-name-or-path> [options]`

**Arguments**:
- `tool-name-or-path` - Name of the tool (e.g., "enact/text/slugify") or path to local YAML file

**Options**:
- `--input <data>` - Input data as JSON string or stdin
- `--params <params>` - Parameters as JSON object  
- `--timeout <time>` - Override tool timeout (Go duration format: 30s, 5m, 1h)
- `--dry` - Show command that would be executed without running it
- `--verbose, -v` - Show detailed execution information
- `--skip-verification` - Skip signature verification (not recommended)
- `--verify-policy <policy>` - Verification policy: permissive, enterprise, paranoid (default: permissive)
- `--force` - Force execution even if signature verification fails

**Security Policies**:
- `permissive` - Require 1+ valid signatures from trusted keys (default)
- `enterprise` - Require author + reviewer signatures
- `paranoid` - Require author + reviewer + approver signatures

**Examples**:
```bash
enact exec enact/text/slugify --input "Hello World"
enact exec org/ai/review --params '{"file": "README.md"}' --verify-policy enterprise
enact exec ./my-tool.yaml --input "test data"
enact exec untrusted/tool --skip-verification
```

### 4. init - Tool Creation

**Purpose**: Creates a new Enact tool definition with interactive prompts.

**Usage**: `enact init [name] [options]`

**Arguments**:
- `name` - Optional tool name (e.g., my-tool, text/analyzer)

**Options**:
- `--minimal` - Create a minimal tool definition (3 fields only)

**Examples**:
```bash
enact init                       # Interactive mode
enact init my-tool               # Create my-tool.yaml
enact init text/analyzer         # Create text/analyzer.yaml
enact init --minimal             # Create minimal tool definition
```

### 5. publish - Tool Publishing

**Purpose**: Publish a tool to the Enact registry.

**Usage**: `enact publish [options]`

**Options**:
- `--url <url>` - Specify custom registry URL
- `--token <token>` - Provide authentication token directly

**Features**:
- Interactive file selection if no file specified
- Authentication verification
- Tool validation before publishing
- History tracking of published tools
- Support for custom registry URLs

**Examples**:
```bash
enact publish                    # Interactive mode
enact publish --url https://custom-registry.com
enact publish --token abc123
```

### 6. sign - Cryptographic Signing

**Purpose**: Manage tool signatures and verification for security.

**Usage**: `enact sign <subcommand> [options]`

**Subcommands**:
- `verify <tool-path> [policy]` - Verify tool signatures
- `list-keys` - List trusted public keys
- `sign <tool-path>` - Sign a tool (requires private key)

**Options**:
- `--policy <policy>` - Verification policy: permissive, enterprise, paranoid
- `--private-key <path>` - Path to private key for signing
- `--role <role>` - Role for signature: author, reviewer, approver
- `--signer <name>` - Signer identifier
- `--verbose, -v` - Show detailed information

**Verification Policies**:
- `permissive` - Require 1+ valid signatures from trusted keys (default)
- `enterprise` - Require author + reviewer signatures
- `paranoid` - Require author + reviewer + approver signatures

**Examples**:
```bash
enact sign verify my-tool.yaml
enact sign verify my-tool.yaml enterprise
enact sign list-keys
enact sign sign my-tool.yaml --private-key ~/.enact/private.pem --role author
```

### 7. remote - Server Management

**Purpose**: Manages remote server configurations for publishing enact documents.

**Usage**: `enact remote <subcommand> [options]`

**Subcommands**:
- `add <name> <url>` - Adds a new remote server
- `remove <name>` - Removes an existing remote server
- `list` - Lists all configured remote servers
- `ls` - Alias for list

**Examples**:
```bash
enact remote add production https://api.enact.tools
enact remote list
enact remote remove staging
```

### 8. user - User Operations

**Purpose**: User-related operations and information retrieval.

**Usage**: `enact user <subcommand> [options]`

**Subcommands**:
- `public-key` - Get user public key

**Options**:
- `--server <url>` - Specify server URL
- `--token <token>` - Provide authentication token directly
- `--format <format>` - Output format

**Examples**:
```bash
enact user public-key
enact user public-key --server https://custom-server.com
```

## Interactive Mode

When run without arguments, Enact CLI enters interactive mode with a menu system:

```bash
enact
```

**Available Actions**:
- 🔍 Search for tools
- ⚡ Execute a tool
- 📤 Publish a tool
- 📝 Create a new tool definition
- ✍️ Sign & verify tools
- 🔐 Manage authentication
- 🌐 Manage remote servers
- 👤 User operations
- ❓ Show help
- 👋 Exit

## Configuration

The CLI stores configuration in `~/.enact/`:
- `auth.json` - Authentication credentials
- `config.json` - General configuration including remote servers

## Security Features

- **Signature Verification**: Tools can be cryptographically signed and verified
- **Multiple Verification Policies**: Choose security level based on requirements
- **Trusted Key Management**: Maintain list of trusted public keys
- **OAuth Authentication**: Secure authentication flow with remote servers

## Common Patterns

1. **First-time setup**: `enact auth login`
2. **Find tools**: `enact search <query>`
3. **Execute tools**: `enact exec <tool-name>`
4. **Create new tool**: `enact init`
5. **Publish tool**: `enact publish`
6. **Verify security**: `enact sign verify <tool>`

## Error Handling

All commands include comprehensive error handling and user-friendly error messages. Use `--verbose` flag for detailed debugging information when troubleshooting issues.

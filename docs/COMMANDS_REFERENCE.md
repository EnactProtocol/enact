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
- `--limit <number>, -l <number>` - Maximum number of results (default: 20)
- `--tags <tags>` - Filter by tags (comma-separated)
- `--format <format>, -f <format>` - Output format: table, json, list (default: table)
- `--json` - Output results as JSON (shorthand for --format json)
- `--author <author>, -a <author>` - Filter by author

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
- `--input <data>, -i <data>` - Input data as JSON string or stdin
- `--params <params>` - Parameters as JSON object  
- `--timeout <time>` - Override tool timeout (Go duration format: 30s, 5m, 1h)
- `--dry` - Show command that would be executed without running it
- `--verbose, -v` - Show detailed execution information
- `--dangerously-skip-verification` - Skip all signature verification (DANGEROUS, not recommended)

**Examples**:
```bash
enact exec enact/text/slugify --input "Hello World"
enact exec org/ai/review --params '{"file": "README.md"}'
enact exec ./my-tool.yaml --input "test data"
enact exec untrusted/tool --dangerously-skip-verification  # DANGEROUS, not recommended
```

### 4. get - Tool Information

**Purpose**: Get detailed information about a tool from the registry.

**Usage**: `enact get <tool-name> [options]`

**Arguments**:
- `tool-name` - Name of the tool (e.g., "enact/text/slugify")

**Options**:
- `--format <format>` - Output format: json, yaml, default (default: default)

**Examples**:
```bash
enact get enact/text/slugify
enact get org/ai/review --format json
enact get my/tool --format yaml
```

### 5. init - Tool Creation

**Purpose**: Creates a new Enact tool definition with interactive prompts.

**Usage**: `enact init [name] [options]`

**Arguments**:
- `name` - Optional tool name (e.g., my-tool, text/analyzer)

**Options**:
- `--minimal, -m` - Create a minimal tool definition (3 fields only)

**Examples**:
```bash
enact init                       # Interactive mode
enact init my-tool               # Create my-tool.yaml
enact init text/analyzer         # Create text/analyzer.yaml
enact init --minimal             # Create minimal tool definition
```

### 6. publish - Tool Publishing

**Purpose**: Publish a tool to the Enact registry.

**Usage**: `enact publish [options]`

**Options**:
- `--url <url>` - Specify custom registry URL
- `--token <token>` - Provide authentication token directly
- `--file <file>` - Specify tool file to publish
- `--verbose, -v` - Show detailed publishing information

**Features**:
- Interactive file selection if no file specified
- Authentication verification
- Tool validation before publishing
- History tracking of published tools
- Support for custom registry URLs

**Examples**:
```bash
enact publish                    # Interactive mode
enact publish --file my-tool.yaml
enact publish --url https://custom-registry.com
enact publish --token abc123
```

### 7. env - Environment Variable Management

**Purpose**: Manage environment variables with package-based namespacing for tool execution.

**Usage**: `enact env <subcommand> [options]`

**Subcommands**:
- `set <key> <value>` - Set an environment variable
- `get <key>` - Get an environment variable value
- `list` - List all environment variables
- `delete <key>` - Delete an environment variable
- `packages` - List all packages with environment variables
- `export <package>` - Export variables for a package as shell commands
- `clear <package>` - Clear all variables for a package

**Options**:
- `--package <package>` - Specify package namespace (e.g., "acme-corp/api")
- `--format <format>` - Output format: table, json, env (default: table)
- `--show` - Show variable values (otherwise hidden for security)

**Examples**:
```bash
enact env set API_KEY secret123 --package acme-corp/api
enact env get API_KEY --package acme-corp/api
enact env list --package acme-corp/api --show
enact env packages
enact env export acme-corp/api
enact env clear acme-corp/api
```

### 8. config - Configuration Management

**Purpose**: Manage CLI configuration settings and setup.

**Usage**: `enact config <subcommand> [options]`

**Subcommands**:
- `setup` - Interactive configuration setup
- `list` - List all configuration settings
- `get <key>` - Get a configuration value
- `set <key> <value>` - Set a configuration value
- `reset` - Reset configuration to defaults

**Options**:
- `--global` - Apply to global configuration

**Examples**:
```bash
enact config setup
enact config list
enact config get default-server
enact config set default-server https://my-server.com
enact config reset
```

### 9. mcp - MCP Client Integration

**Purpose**: Manage MCP (Model Context Protocol) client integrations for AI model access.

**Usage**: `enact mcp <subcommand> [options]`

**Subcommands**:
- `install` - Install MCP client configuration
- `list` - List available MCP clients
- `status` - Show MCP integration status

**Options**:
- `--client <client>` - Specify MCP client: claude-desktop, claude-code, vscode, goose, gemini

**Examples**:
```bash
enact mcp list
enact mcp install --client claude-desktop
enact mcp install --client vscode
enact mcp status
```

### 10. remote - Server Management

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

### 11. user - User Operations

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
- 🌍 Manage environment variables
- ⚙️ Configuration setup
- 🔌 MCP client integration
- 🔐 Manage authentication
- 🌐 Manage remote servers
- 👤 User operations
- ❓ Show help
- 👋 Exit

## Configuration

The CLI stores configuration in `~/.enact/`:
- `auth.json` - Authentication credentials
- `config.json` - General configuration including remote servers
- `env/` - Package-scoped environment variables directory

## Security Features

- **Signature Verification**: Basic signature verification during tool execution
- **OAuth Authentication**: Secure authentication flow with remote servers
- **Environment Variable Encryption**: Optional encryption for sensitive environment variables
- **Package-based Isolation**: Environment variables scoped to tool packages

## Common Patterns

1. **First-time setup**: `enact config setup` or `enact auth login`
2. **Find tools**: `enact search <query>`
3. **Get tool info**: `enact get <tool-name>`
4. **Execute tools**: `enact exec <tool-name>`
5. **Create new tool**: `enact init`
6. **Publish tool**: `enact publish`
7. **Manage environment**: `enact env set KEY value --package my-package`
8. **Setup MCP integration**: `enact mcp install --client claude-desktop`

## Known Limitations

### Commands Not Yet Implemented

The following commands are referenced in help text but not yet implemented:

1. **`sign` command** - Cryptographic signing and verification
   - `enact sign verify <tool>` - Tool signature verification
   - `enact sign list-keys` - List trusted public keys
   - `enact sign sign <tool>` - Sign a tool with private key

2. **`test` command** - Tool testing functionality
   - Referenced in `init` command output but not implemented

3. **`validate` command** - Tool definition validation
   - May be planned for future releases

### Partial Implementations

- **Security policies**: The `--verify-policy` flag is documented but policy enforcement is basic
- **Signature verification**: Basic verification exists but advanced multi-signature policies are not implemented

## Error Handling

All commands include comprehensive error handling and user-friendly error messages. Use `--verbose` flag for detailed debugging information when troubleshooting issues.

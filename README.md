# Enact CLI

Official CLI for the Enact Protocol - package, secure, and discover AI tools.

## Features

- 🔍 **Search & Discovery** - Find AI tools in the Enact ecosystem
- ⚡ **Execute Tools** - Run tools directly with secure execution
- 📦 **Publishing** - Publish your own tools to the registry
- 🔐 **Security** - **Mandatory cryptographic signing and verification** for all tool execution
- 🎯 **MCP Integration** - Full Model Context Protocol support
- 🚀 **Direct Library** - Use as a library in your applications
- 🌐 **Environment Manager** - Web-based interface for managing environment variables

## Installation

### For End Users

```bash
# Install globally
npm install -g @enactprotocol/cli

# Now you can use:
enact search --tags web,api
enact exec author/tool-name
enact-mcp-server  # Start MCP server
```

### For MCP (Model Context Protocol) Users

After installation, you can use Enact with any MCP client:

```bash
# With MCP Inspector
npx @modelcontextprotocol/inspector enact-mcp-server

# Auto-install to supported MCP clients
enact mcp install

# Or manually add to Claude Desktop config
{
  "mcpServers": {
    "enact": {
      "command": "npx",
      "args": ["-y", "@enactprotocol/mcp-server"]
    }
  }
}

# Or manually add to Gemini config (~/.gemini/settings.json)
{
  "mcpServers": {
    "enact": {
      "command": "npx",
      "args": ["-y", "@enactprotocol/mcp-server"]
    }
  }
}
```

#### Supported MCP Clients

The `enact mcp install` command supports automatic installation for:

- **Claude Desktop** - `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)
- **Claude Code** - `~/.claude.json`
- **VS Code MCP** - VS Code settings.json
- **Goose AI** - `~/.config/goose/config.yaml`
- **Gemini** - `~/.gemini/settings.json`

After installation, restart your MCP client to activate the Enact tools.

See [MCP_USAGE.md](./MCP_USAGE.md) for detailed MCP integration guide.

## Quick Start

### CLI Usage
```bash
# Search for tools
enact search "text processing"

# Get help
enact --help

# Execute a tool
enact exec author/tool-name --input '{"key": "value"}'

# MCP integration commands
enact mcp install    # Install to MCP clients
enact mcp list       # List detected MCP clients
enact mcp status     # Check installation status
```

### MCP Server Usage
```bash
# Start the minimal MCP server (7 essential tools)
enact-mcp-server

# Start the MCP server  
enact-mcp
```

> 🆕 **Minimal Implementation**: The MCP server now uses a streamlined implementation with 7 essential tools instead of 20+. See [MCP_MINIMAL_IMPLEMENTATION.md](./MCP_MINIMAL_IMPLEMENTATION.md) for details.

#### Essential MCP Tools (Minimal Implementation)

1. **`execute-tool-by-name`** - Smart tool execution (local → cache → registry)
2. **`manage-local-tools`** - Local tool management and directory operations
3. **`create-local-tool`** - Create new local YAML tools
4. **`enact-search-tools`** - Search registry tools
5. **`check-operation-status`** - Monitor background operations
6. **`launch-env-manager-server`** - Start environment variable web UI
7. **`enact-core-status`** - System health and status

#### Environment Manager Web Interface

The MCP server includes a built-in web interface for managing environment variables:

- **URL**: `http://localhost:5555` (when MCP server is running)
- **Features**: Package-based environment variable management
- **File Structure**: `~/.enact/env/{namespace}/.env`

See [ENVIRONMENT_MANAGER.md](./ENVIRONMENT_MANAGER.md) for detailed usage instructions.

## Security

🔐 **Mandatory Signature Verification** - All tools must be cryptographically signed and verified before execution.

**Verification Policies:**
- `permissive` - Require 1+ valid signatures (default)
- `enterprise` - Require author + reviewer signatures
- `paranoid` - Require author + reviewer + approver signatures

**Example Usage:**
```bash
# Tools are automatically verified before execution
enact exec my-org/secure-tool

# Use strict enterprise policy
enact exec critical-tool --verify-policy enterprise

# Sign your own tools
enact sign sign my-tool.yaml --role author
```

📋 **See [MANDATORY_SIGNATURE_VERIFICATION.md](./MANDATORY_SIGNATURE_VERIFICATION.md) for complete security documentation.**

### Library Usage
```typescript
import { executeToolByName, searchTools } from '@enactprotocol/shared/lib/enact-direct';

// Search for tools
const tools = await searchTools({ query: 'text processing', limit: 5 });

// Execute a tool
const result = await executeToolByName('author/tool-name', { input: 'data' });
```

## Available MCP Servers

This package provides multiple MCP server options:

| Command | Description | Best For |
|---------|-------------|----------|
| `enact-mcp` | Modern MCP server | All integrations |

## Development

This section provides instructions for setting up your development environment and contributing to the Enact CLI.

### Prerequisites

* **Bun:** This project is built using Bun. Ensure you have Bun installed on your system. You can find installation instructions on the [official Bun website](https://bun.sh/).
* **Node.js (optional):** While Bun is the primary runtime, having Node.js installed can be helpful for certain development tools. You can download it from [nodejs.org](https://nodejs.org/).

### Getting Started

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd enact-cli
   ```

2. **Install dependencies:**
   ```bash
   bun install
   ```
   This command will install all the necessary dependencies listed in your `package.json` file.

3. **Build and install locally:**
   ```bash
   chmod +x deploy
   ./deploy
   ```
   This creates a standalone binary and installs it to your PATH so you can use `enact` commands globally.

### Development Workflow

1. **Make changes:** Create a new branch for your feature or bug fix:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b bugfix/your-bug-fix
   ```
   Make your code changes in the `src/` directory.

2. **Test during development:** You can run the CLI directly without building:
   ```bash
   bun src/index.ts <command> [arguments] [options]
   
   # Examples:
   bun src/index.ts --help
   bun src/index.ts publish
   bun src/index.ts create my-tool
   ```

3. **Build and test the binary:** After making changes, rebuild and test:
   ```bash
   ./deploy
   enact --version  # Test the installed binary
   ```

4. **Run tests:**
   ```bash
   bun test                    # Run all tests
   bun test mcp.test.ts        # Run MCP-specific tests
   bun test --coverage         # Run with coverage report
   ```

5. **Lint and format your code:**
   ```bash
   bun run lint     # Check for issues
   bun run format   # Format code
   ```

6. **Commit your changes:**
   ```bash
   git add .
   git commit -m "feat: Add your feature description"
   ```
   Follow [conventional commit](https://conventionalcommits.org/) guidelines for better collaboration.

7. **Push and create PR:**
   ```bash
   git push origin feature/your-feature-name
   ```
   Then create a pull request on GitHub.

### Development Commands

| Command | Description |
|---------|-------------|
| `bun src/index.ts` | Run CLI directly from source |
| `./deploy` | Build and install binary to PATH |
| `bun test` | Run test suite |
| `bun run lint` | Check code style |
| `bun run format` | Format code |

### Project Structure

```
src/
├── index.ts           # CLI entry point
├── commands/          # Command implementations
│   ├── publish.ts     # Publish command
│   ├── create.ts      # Create command
│   └── remote.ts      # Remote management
└── utils/             # Shared utilities
    ├── help.ts        # Help system
    ├── logger.ts      # Logging utilities
    ├── config.ts      # Configuration management
    └── version.ts     # Version display
```

### Building for Release

To build standalone binaries for distribution:

```bash
# Single platform (current system)
bun build src/index.ts --compile --outfile=dist/enact

# Multiple platforms
bun build src/index.ts --compile --target=bun-linux-x64 --outfile=dist/enact-linux
bun build src/index.ts --compile --target=bun-darwin-x64 --outfile=dist/enact-macos  
bun build src/index.ts --compile --target=bun-windows-x64 --outfile=dist/enact.exe
```

### Debugging

For debugging during development:

```bash
# Run with debug output
DEBUG=* bun src/index.ts <command>

# Or set log level in code
# See src/utils/logger.ts for LogLevel options
```

## Execution Providers

Enact uses different execution providers for different types of operations to balance security and performance:

### **Dagger (Containerized) - Default for Tool Execution**
- `enact exec <tool-name>` - External tools from registry
- MCP server executing tools - AI-requested tool execution
- **Why**: External tools are containerized for security isolation

### **Direct (Host) - Used for CLI Operations**  
- `enact search` - Registry API calls
- `enact get` - Tool information retrieval
- `enact verify` - Signature verification (crypto operations)
- `enact publish` - Publishing to registry
- `enact config`, `enact mcp`, `enact help` - Local operations
- **Why**: Fast execution for operations that don't run external code

### **Configuration**
You can override the tool execution provider:

```bash
# Use direct execution (faster, less secure)
enact config set executionProvider direct

# Use Dagger execution (default, more secure)
enact config set executionProvider dagger

# Check current configuration
enact config get executionProvider
```

**Note**: CLI operations always use direct execution regardless of this setting for performance.

### Contributing Guidelines

- Follow TypeScript best practices
- Add tests for new features (comprehensive test suite available)
- Update documentation for any CLI changes
- Use conventional commit messages
- Ensure the binary builds successfully before submitting PRs
- Run the test suite to verify MCP configuration generation works correctly

**For detailed development workflow, workspace linking, and publishing processes, see [DEVELOPMENT.md](./DEVELOPMENT.md).**
- Run the test suite to verify MCP configuration generation works correctly

### Troubleshooting

**Binary not found after build:**
- Ensure `~/.local/bin` is in your PATH
- Try restarting your terminal
- Run `source ~/.bashrc` (or your shell profile)

**Permission denied:**
- Make sure deploy script is executable: `chmod +x deploy`
- Check that `~/.local/bin` has write permissions

**Bun build fails:**
- Ensure you're using a recent version of Bun (`bun --version`)
- Check for TypeScript errors: `bun check src/index.ts`
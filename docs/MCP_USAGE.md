# Enact CLI MCP Server - Usage Guide

## Installation

### Global Installation (Recommended for MCP Servers)
```bash
npm install -g @enactprotocol/cli
```

### Local Installation
```bash
npm install @enactprotocol/cli
```

## Running the MCP Servers

After installing the package, you have **4 different ways** to run Enact MCP servers:

### 1. **`enact-mcp-server`** (Recommended - Full Features)
The comprehensive MCP server with all 10 Enact tools:

```bash
# Global installation
enact-mcp-server

# With MCP Inspector
npx @modelcontextprotocol/inspector enact-mcp-server

# In MCP client configuration
{
  "mcpServers": {
    "enact": {
      "command": "enact-mcp-server"
    }
  }
}
```

**Features:**
- ✅ Execute tools by name
- ✅ Search tools
- ✅ Get tool information
- ✅ Execute raw tools from YAML
- ✅ Get tools by tags/author
- ✅ Tool existence checks
- ✅ Authentication status
- ✅ Dynamic tool registration
- ✅ And more...

### 2. **`enact-mcp-direct`** (Simple & Fast)
Lightweight MCP server with core functionality:

```bash
# Global installation
enact-mcp-direct

# With MCP Inspector
npx @modelcontextprotocol/inspector enact-mcp-direct
```

**Features:**
- ✅ Execute tools by name
- ✅ Search tools
- ✅ Get tool information
- ✅ Execute raw tools
- ✅ Basic tool operations

### 3. **`enact-mcp`** (Entry Point Wrapper)
Entry point that starts the direct MCP server:

```bash
# Global installation
enact-mcp

# With MCP Inspector
npx @modelcontextprotocol/inspector enact-mcp
```

### 4. **`enact`** (CLI + MCP Library)
The main CLI that can also be used as a library:

```bash
# CLI usage
enact search --tags web,api
enact exec author/tool-name

# Library usage (in your own MCP server)
import { executeToolByName, searchTools } from 'enact-cli/dist/lib/enact-direct.js'
```

## MCP Client Configuration Examples

### Claude Desktop
Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "enact": {
      "command": "enact-mcp-server",
      "env": {
        "ENACT_API_URL": "https://enact.tools",
        "ENACT_AUTH_TOKEN": "your-token-here"
      }
    }
  }
}
```

### Continue.dev
Add to your `config.json`:

```json
{
  "contextProviders": [
    {
      "name": "enact",
      "params": {
        "serverCommand": "enact-mcp-server"
      }
    }
  ]
}
```

### Custom MCP Client
```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "enact-mcp-server"
});

const client = new Client({
  name: "my-client",
  version: "1.0.0"
});

await client.connect(transport);

// Use Enact tools
const result = await client.callTool({
  name: "execute-tool-by-name",
  arguments: {
    name: "author/tool-name",
    inputs: { key: "value" }
  }
});
```

## Local Development Usage

If you're developing locally or want to use a specific version:

```bash
# Install locally
npm install @enactprotocol/cli

# Run via npx
npx enact-mcp-server

# Run via node (after building)
node node_modules/enact-cli/dist/mcp-server.js

# With MCP Inspector
npx @modelcontextprotocol/inspector node node_modules/enact-cli/dist/mcp-server.js
```

## Environment Variables

Configure the MCP servers with these environment variables:

```bash
# API Configuration
export ENACT_API_URL="https://enact.tools"
export ENACT_SUPABASE_URL="https://xjnhhxwxovjifdxdwzih.supabase.co"

# Authentication
export ENACT_AUTH_TOKEN="your-auth-token"

# Security
export ENACT_VERIFY_POLICY="permissive"  # or "enterprise" or "paranoid"

# Then run
enact-mcp-server
```

## Available Tools (via MCP)

After connecting to any of the MCP servers, you'll have access to these tools:

1. **`execute-tool-by-name`** - Execute any Enact tool
2. **`enact-search-tools`** - Search the Enact tool registry
3. **`enact-get-tool-info`** - Get detailed tool information
4. **`execute-raw-tool`** - Execute tools from YAML definitions
5. **`enact-get-tools-by-tags`** - Find tools by tags
6. **`enact-get-tools-by-author`** - Find tools by author
7. **`enact-tool-exists`** - Check if a tool exists
8. **`enact-get-auth-status`** - Check authentication status
9. **`enact-search-and-register-tools`** - Dynamic tool discovery
10. **`enact-register-tool`** - Register new tools dynamically

## Comparison of MCP Server Options

| Feature | `enact-mcp-server` | `enact-mcp-direct` | `enact-mcp` |
|---------|-------------------|-------------------|-------------|
| **Full Tool Set** | ✅ All 10 tools | ✅ Core 4 tools | ✅ Core 4 tools |
| **Dynamic Registration** | ✅ Yes | ❌ No | ❌ No |
| **Performance** | 🟡 Comprehensive | 🟢 Fast | 🟢 Fast |
| **Memory Usage** | 🟡 Higher | 🟢 Lower | 🟢 Lower |
| **Best For** | Production use | Simple integrations | Development |

## Recommendation

For most use cases, use **`enact-mcp-server`** as it provides the complete Enact ecosystem functionality through MCP.

## Troubleshooting

### Permission Issues
```bash
# If you get permission errors
chmod +x $(which enact-mcp-server)
```

### Missing Dependencies
```bash
# Reinstall to fix missing dependencies
npm uninstall -g enact-cli
npm install -g @enactprotocol/cli
```

### Debug Mode
```bash
# Run with debug logging
DEBUG=* enact-mcp-server
```

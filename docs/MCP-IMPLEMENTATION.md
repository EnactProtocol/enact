# MCP Server Implementation Plan

## Overview

The Enact MCP server exposes Enact tools to AI agents via the Model Context Protocol. Unlike the CLI which operates in a project context with local folders, the MCP server operates in a **global context** where "installed tools" means tools installed globally via `enact install --global`.

## Transport Modes

| Mode | Flag | Use Case |
|------|------|----------|
| **stdio** | (default) | Claude Desktop, local IDE integrations |
| **Streamable HTTP** | `--http` | Remote agents, web integrations, multi-tenant |

```bash
# Local mode (Claude Desktop, etc.)
enact-mcp

# Remote mode
enact-mcp --http --port 3000
```

## Tool Categories

### 1. Meta-Tools (Built-in)

These are always available and allow agents to manage their Enact environment:

| MCP Tool | Purpose | Equivalent CLI |
|----------|---------|----------------|
| `enact__search` | Find tools in registry | `enact search` |
| `enact__learn` | Read tool documentation | `enact learn` |
| `enact__install` | Install a tool globally | `enact install --global` |
| `enact__uninstall` | Remove a tool | `enact uninstall --global` |
| `enact__list` | List installed tools | `enact list --global` |
| `enact__run` | Run any tool by name | `enact run` |

### 2. Projected Tools (Dynamic)

Every globally installed tool is automatically projected as a first-class MCP tool:

```
Installed: alice/utils/weather
     ↓
MCP Tool: alice__utils__weather
```

The agent sees it as a native tool with proper schema, not as "call enact_run with args".

## UX Flow

### Agent Discovery Flow

```
Agent: "I need to analyze some CSV data"
    │
    ▼
┌─────────────────────────────────────┐
│ 1. enact__search("csv analysis")    │
│    → Returns: alice/data/csv-parse  │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 2. enact__learn("alice/data/csv")   │
│    → Returns: Full documentation    │
│    → Agent learns: inputs, outputs  │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 3. enact__install("alice/data/csv") │
│    → Installs globally              │
│    → Tool now projected as MCP tool │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 4. alice__data__csv(file: "x.csv")  │
│    → Executes directly via Dagger   │
│    → Returns structured output      │
└─────────────────────────────────────┘
```

### Why This Model?

1. **No Project Context**: MCP servers run as standalone processes, not in a project directory
2. **Global = Installed**: The agent's "installed tools" are the globally installed Enact tools
3. **Dynamic Projection**: When a tool is installed, it immediately appears as a callable MCP tool
4. **Self-Service**: Agents can discover, learn about, and install tools without human intervention

## Meta-Tool Schemas

### `enact__search`

```json
{
  "name": "enact__search",
  "description": "Search the Enact registry for tools. Returns matching tools with descriptions.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Search query (keywords, descriptions, or tags)"
      },
      "limit": {
        "type": "number",
        "description": "Maximum results to return",
        "default": 10
      }
    },
    "required": ["query"]
  }
}
```

### `enact__learn`

```json
{
  "name": "enact__learn",
  "description": "Get documentation for a tool. Returns the full enact.md content including usage instructions.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "tool": {
        "type": "string",
        "description": "Tool name (e.g., 'alice/utils/weather')"
      },
      "version": {
        "type": "string",
        "description": "Specific version (optional, defaults to latest)"
      }
    },
    "required": ["tool"]
  }
}
```

### `enact__install`

```json
{
  "name": "enact__install",
  "description": "Install a tool globally. After installation, the tool becomes available as a callable MCP tool.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "tool": {
        "type": "string",
        "description": "Tool name (e.g., 'alice/utils/weather')"
      },
      "version": {
        "type": "string",
        "description": "Specific version (optional, defaults to latest)"
      }
    },
    "required": ["tool"]
  }
}
```

### `enact__uninstall`

```json
{
  "name": "enact__uninstall",
  "description": "Uninstall a globally installed tool.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "tool": {
        "type": "string",
        "description": "Tool name to uninstall"
      }
    },
    "required": ["tool"]
  }
}
```

### `enact__list`

```json
{
  "name": "enact__list",
  "description": "List all globally installed tools. These are the tools available for direct execution.",
  "inputSchema": {
    "type": "object",
    "properties": {}
  }
}
```

### `enact__run`

```json
{
  "name": "enact__run",
  "description": "Run any tool by name, even if not installed. For installed tools, prefer calling them directly.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "tool": {
        "type": "string",
        "description": "Tool name (e.g., 'alice/utils/weather' or 'alice/utils/weather@1.0.0')"
      },
      "args": {
        "type": "object",
        "description": "Arguments to pass to the tool"
      }
    },
    "required": ["tool"]
  }
}
```

## Security Considerations

### Trust Policy

The MCP server respects the user's trust policy from `~/.enact/config.yaml`:

- **For `enact__learn`**: Attestation checks before showing documentation (prevents prompt injection)
- **For `enact__install`**: Attestation checks before installation
- **For `enact__run`**: Attestation checks before execution (if not already installed)
- **For projected tools**: Already verified at install time

### Non-Interactive Mode

Since MCP servers run non-interactively:
- `trust_policy: prompt` behaves like `require_attestation` (fails if not trusted)
- `trust_policy: allow` permits unverified tools (not recommended for MCP)
- `trust_policy: require_attestation` is recommended for MCP deployments

## Tool Name Conversion

Enact tool names use `/` as namespace separators. While the MCP spec (SEP-986) allows slashes, some clients (e.g., OpenAI API) do not support them. For maximum compatibility, we convert slashes to double underscores.

**Conversion:**
- Enact: `alice/utils/weather` → MCP: `alice__utils__weather`
- MCP: `alice__utils__weather` → Enact: `alice/utils/weather`

**Why double underscores?**
- Single underscore could conflict with tool names that already contain underscores
- Double underscore (`__`) is unlikely to appear in natural tool names
- Provides unambiguous round-trip conversion

Meta-tools use the `enact/` namespace: `enact/search`, `enact/learn`, etc. (converted to `enact__search`, `enact__learn` for compatibility).

## Dynamic Tool List Updates

When tools are installed/uninstalled, the MCP server's tool list updates dynamically:

1. Agent calls `enact__install("alice/data/csv")`
2. Tool is installed globally
3. Next `ListTools` request includes `alice__data__csv`
4. Agent can now call `alice__data__csv(...)` directly

## Implementation Phases

### Phase 1: Core (Current)
- [x] stdio transport
- [x] Streamable HTTP transport
- [x] Dynamic tool projection from global installs
- [x] Actual tool execution via Dagger

### Phase 2: Meta-Tools
- [ ] `enact__search` - Registry search
- [ ] `enact__learn` - Documentation retrieval (with attestation checks)
- [ ] `enact__install` - Global installation
- [ ] `enact__uninstall` - Global uninstallation
- [ ] `enact__list` - List installed tools
- [ ] `enact__run` - Run any tool by name

### Phase 3: Enhanced UX
- [ ] Tool refresh notification (notify clients when tool list changes)
- [ ] Caching of registry searches
- [ ] Session-scoped tool installations (for multi-tenant)

## MCP Tools Configuration

The MCP server reads tool configuration from `~/.enact/mcp.json`:

```json
{
  "tools": {
    "alice/utils/weather": "1.0.0",
    "bob/data/csv-parse": "2.1.0"
  },
  "toolsets": {
    "default": ["alice/utils/weather", "bob/data/csv-parse"],
    "data-analysis": ["bob/data/csv-parse", "bob/data/json-transform"]
  },
  "activeToolset": "default"
}
```

### Schema

| Field | Type | Description |
|-------|------|-------------|
| `tools` | `Record<string, string>` | Map of tool name to version (same as tools.json) |
| `toolsets` | `Record<string, string[]>` | Named collections of tools for different contexts |
| `activeToolset` | `string \| null` | Currently active toolset (null = expose all tools) |

### Toolsets

Toolsets allow switching between different tool configurations:

```bash
# List available toolsets
enact mcp toolsets

# Switch toolset
enact mcp use data-analysis

# Create a new toolset from currently installed tools
enact mcp toolset create my-toolset

# Add tool to a toolset
enact mcp toolset add my-toolset alice/utils/weather

# Use all installed tools (no filtering)
enact mcp use --all
```

When `activeToolset` is set, only tools in that toolset are exposed to MCP clients. This lets you:
- Create focused toolsets for different tasks (e.g., "web-dev", "data-science")
- Reduce noise for AI agents by only exposing relevant tools
- Share toolset configurations with team members

### Relationship to tools.json

| File | Scope | Purpose |
|------|-------|---------|
| `~/.enact/tools.json` | Global | All globally installed tools (CLI) |
| `.enact/tools.json` | Project | Project-specific installed tools (CLI) |
| `~/.enact/mcp.json` | Global | Tools exposed to MCP clients + toolset config |

By default, `mcp.json` mirrors `tools.json` (global) - when you install a tool globally, it's added to both. The `mcp.json` file adds toolset management on top.

## General Configuration

The MCP server reads from `~/.enact/config.yaml`:

```yaml
# Trust policy for MCP operations
trust:
  policy: require_attestation  # Recommended for MCP
  minimum_attestations: 1
  trusted_auditors:
    - github:alice
    - github:bob

# Registry configuration
registry:
  url: https://api.enact.dev
```

## Example Session

```
[Agent connects to MCP server]

Agent → ListTools
Server ← { tools: [enact__search, enact__learn, enact__install, ...] }

Agent → CallTool(enact__search, { query: "pdf extraction" })
Server ← { results: [{ name: "alice/pdf/extract", description: "..." }] }

Agent → CallTool(enact__learn, { tool: "alice/pdf/extract" })
Server ← { documentation: "# PDF Extract\n\n..." }

Agent → CallTool(enact__install, { tool: "alice/pdf/extract" })
Server ← { success: true, message: "Installed alice/pdf/extract@1.2.0" }

Agent → ListTools
Server ← { tools: [enact__search, ..., alice__pdf__extract] }  // New tool!

Agent → CallTool(alice__pdf__extract, { file: "/path/to/doc.pdf" })
Server ← { text: "Extracted text from PDF..." }
```

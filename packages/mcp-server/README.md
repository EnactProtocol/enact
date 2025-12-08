# @enactprotocol/mcp-server

MCP protocol server for Enact tool integration.

## Overview

This package provides:
- MCP protocol server implementation
- Dynamic tool projection (Enact tools → MCP tools)
- Meta-tools for Enact management (search, install, run, etc.)
- Stdio transport for AI agent integration

## Status

Currently in Phase 1 (scaffolding). Full implementation will be completed in Phase 4.

## Dependencies

- `@enactprotocol/shared` - For core logic
- `@modelcontextprotocol/sdk` - MCP protocol implementation

## Development

```bash
# Build
bun run build

# Test
bun test

# Run in development mode
bun run dev

# Type check
bun run typecheck
```

## Usage (Phase 4+)

```bash
# Run the MCP server
enact-mcp
```

## Planned Features (Phase 4)

- [ ] MCP SDK integration
- [ ] Server initialization and capabilities
- [ ] Tool projection system
- [ ] Meta-tools: enact-search, enact-inspect, enact-install, enact-list, enact-run, enact-exec
- [ ] Dynamic tool discovery from ~/.enact/tools/
- [ ] Integration tests

# @enactprotocol/cli

Command-line interface for Enact.

## Overview

This package provides:
- User-facing CLI commands
- Tool execution (run, exec)
- Discovery (search, get, list)
- Management (install, sign, publish)
- Security (trust, report)
- Configuration (env, config, cache)

## Status

Currently in Phase 1 (scaffolding). Full implementation will be completed in Phase 5.

## Dependencies

- `@enactprotocol/shared` - For core logic
- `commander` - CLI framework
- `chalk` - Terminal colors
- `ora` - Spinners and progress indicators
- `inquirer` - Interactive prompts

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

## Usage (Phase 5+)

```bash
# Execute a tool
enact run <tool> [inputs...]

# Search for tools
enact search <query>

# Install a tool
enact install <tool>

# Manage trust
enact trust add <identity>

# More commands coming in Phase 5...
```

## Planned Commands (Phase 5)

### Execution
- `enact run` - Execute a tool with inputs
- `enact exec` - Execute from local file

### Discovery
- `enact search` - Search registry
- `enact get` - Get tool details
- `enact list` - List installed tools

### Management
- `enact install` - Install tool

### Security
- `enact sign` - Sign tool
- `enact publish` - Publish to registry

### Trust
- `enact trust add/remove/list/check` - Manage trust

### Configuration
- `enact env` - Environment variables
- `enact config` - CLI configuration
- `enact cache` - Cache management

### Auth
- `enact auth login/logout/status` - Authentication

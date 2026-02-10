# @enactprotocol/cli

Command-line interface for Enact.

## Overview

This package provides:
- User-facing CLI commands
- Tool execution (run, exec)
- Discovery (search, learn, list)
- Management (install, sign, publish)
- Security (trust, report)
- Configuration (env, config, cache)

## Dependencies

- `@enactprotocol/shared` - Core logic
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

## Usage

```bash
# Execute a tool
enact run <tool> [inputs...]

# Search for tools
enact search <query>

# Install a tool
enact install <tool>

# Manage trust
enact trust add <identity>
```

See [CLI Commands Reference](../../docs/COMMANDS.md) for the full command list.

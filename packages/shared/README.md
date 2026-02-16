# @enactprotocol/shared

Core business logic and utilities for Enact.

## Overview

This package provides:
- Manifest parsing (skill.package.yml, SKILL.md, and legacy enact.yaml/enact.md)
- Configuration management (~/.enact/config.yaml)
- Environment variable management (package-scoped)
- Tool resolution (local, user-level, registry)
- Trust store and policy enforcement
- Execution engine interfaces
- Registry client

## Development

```bash
# Build
bun run build

# Test
bun test

# Type check
bun run typecheck
```

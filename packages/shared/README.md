# @enactprotocol/shared

Core business logic and utilities for Enact.

## Overview

This package provides:
- Manifest parsing (enact.yaml and enact.md)
- Configuration management (~/.enact/config.yaml)
- Environment variable management (package-scoped)
- Tool resolution (local, user-level, registry)
- Trust store and policy enforcement
- Execution engine interfaces
- Registry client

## Status

Currently in Phase 1 (scaffolding). Full implementation will be completed in Phase 3.

## Dependencies

- `@enactprotocol/security` - For cryptographic operations

## Development

```bash
# Build
bun run build

# Test
bun test

# Type check
bun run typecheck
```

## Planned Features (Phase 3)

- [ ] Configuration system (paths, config, env, trust)
- [ ] Manifest parser with YAML/Markdown support
- [ ] Tool resolution with caching strategy
- [ ] Execution providers (Dagger and Direct)
- [ ] Registry HTTP client
- [ ] Comprehensive utilities (logger, tarball, version, fs)

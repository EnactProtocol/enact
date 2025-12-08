# @enactprotocol/execution

Dagger-based execution engine for Enact tools.

## Overview

This package provides the Dagger SDK-based execution provider for running containerized Enact tools. It was separated from `@enactprotocol/shared` to keep the core shared package browser-safe.

## Key Features

- **DaggerExecutionProvider**: Main execution provider using Dagger SDK
- **Containerized execution**: Runs tools in isolated Docker/Podman containers
- **Runtime detection**: Automatically detects available container runtimes
- **Health monitoring**: Tracks engine health with automatic recovery
- **Retry logic**: Exponential backoff for transient failures

## Architecture

This package depends on:
- `@enactprotocol/shared` - Core types, command parsing, and validation utilities
- `@dagger.io/dagger` - Container orchestration SDK (Node.js only)

**Important**: This package contains Node.js-only code and should NEVER be imported in browser environments. For browser-safe tool utilities, use `@enactprotocol/shared` instead.

## Usage

```typescript
import { DaggerExecutionProvider, createExecutionProvider } from '@enactprotocol/execution';
import type { ToolManifest } from '@enactprotocol/shared';

// Create execution provider
const provider = createExecutionProvider({
  defaultTimeout: 30000,
  maxRetries: 3,
});

// Execute a tool
const result = await provider.execute(manifest, input, options);
```

## Dependency Separation

```
@enactprotocol/cli (Node.js)
  ├─> @enactprotocol/execution (Node.js only - Dagger SDK)
  └─> @enactprotocol/shared (Browser-safe)

@enactprotocol/web (Browser)
  └─> @enactprotocol/api
      └─> @enactprotocol/shared (Browser-safe, no Dagger)
```

## Development

```bash
# Build
bun run build

# Type check
bun run typecheck

# Lint
bun run lint
```

## License

MIT

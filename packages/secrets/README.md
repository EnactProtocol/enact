# @enactprotocol/secrets

OS keyring integration and environment variable management for Enact.

## Overview

This package provides:
- OS-native keyring storage (macOS Keychain, Windows Credential Manager, Linux Secret Service)
- Namespace-scoped secret resolution with inheritance
- `.env` file management (global and local)
- Dagger secret URI scheme support
- Secure secret handling with memory-only runtime

## Architecture

### Secret Storage

Secrets are stored in the OS keyring with the service name `enact-cli` and account identifier `{namespace}:{SECRET_NAME}`.

Examples:
- `alice/api:API_TOKEN`
- `acme-corp/data:DATABASE_URL`

### Namespace Inheritance

When resolving secrets, Enact walks up the namespace path:

```
Tool: alice/api/slack/notifier
Needs: API_TOKEN

Lookup:
  1. alice/api/slack:API_TOKEN
  2. alice/api:API_TOKEN ✓ found
  3. alice:API_TOKEN
```

First match wins.

### Environment Variables

Non-secret environment variables are stored in `.env` files with priority:

1. **Local project** (`.enact/.env`) - highest priority
2. **Global user** (`~/.enact/.env`)
3. **Default values** from tool manifest - lowest priority

## Status

Currently in Phase 1 (scaffolding). Full implementation will be completed in Phase 3.

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

- [ ] Keyring integration (@zowe/secrets-for-zowe-sdk)
- [ ] setSecret() / getSecret() / listSecrets() / deleteSecret()
- [ ] Namespace inheritance resolution
- [ ] .env file reading and writing
- [ ] Dagger secret URI parsing (env://, file://, cmd://, op://, vault://)
- [ ] Cross-platform testing
- [ ] Comprehensive test coverage

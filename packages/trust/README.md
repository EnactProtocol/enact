# @enactprotocol/trust

Sigstore integration, attestations, and verification for Enact.

## Overview

This package provides:
- Sigstore integration for keyless signing and verification
- Attestation generation and validation (in-toto, SLSA)
- Bundle signature verification
- Certificate chain validation
- Trust policy enforcement

## Status

Currently in Phase 1 (scaffolding). Full implementation will be completed in Phase 2.

## Development

```bash
# Build
bun run build

# Test
bun test

# Type check
bun run typecheck
```

## Planned Features (Phase 2)

- [ ] Hash utilities with streaming support
- [ ] Sigstore keyless signing via OIDC
- [ ] Bundle verification with certificate chain validation
- [ ] In-toto attestation format support
- [ ] SLSA provenance support
- [ ] Comprehensive test coverage

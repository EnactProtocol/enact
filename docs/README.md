# Enact Documentation

Technical reference documentation for the Enact protocol and implementation.

## Core Documentation

### Protocol & Specification
- **[PROTOCOL.md](./PROTOCOL.md)** - Protocol overview and core concepts
- **[SPEC.md](./SPEC.md)** - Tool manifest specification (enact.yaml format)
- **[REGISTRY-SPEC.md](./REGISTRY-SPEC.md)** - Complete registry HTTP API specification

### Command Line Interface
- **[COMMANDS.md](./COMMANDS.md)** - Complete CLI command reference
- **[ENV.md](./ENV.md)** - Environment variables and configuration

### Trust & Security
- **[TRUST.md](./TRUST.md)** - Trust system architecture and verification
- **[TRUST_AUDIT.md](./TRUST_AUDIT.md)** - Security implementation audit

### Integration
- **[API.md](./API.md)** - Registry HTTP API documentation
- **[DAGGER.md](./DAGGER.md)** - Execution engine (Dagger) integration
- **[MCP.md](./MCP.md)** - Model Context Protocol integration

## Getting Started

For user-focused documentation, see:
- [Getting Started Guide](../GETTING-STARTED.md) - Installation and basic usage
- [Development Setup](../DEV-SETUP.md) - Contributing to Enact
- [Deployment Guide](../DEPLOYMENT.md) - Production deployment

## Overview

Enact is a verified, portable protocol for AI-executable tools. Key features:

- 🔍 **Discovery** - Search and find tools by capability
- 🔐 **Trust** - Cryptographic verification via Sigstore
- 🐳 **Execution** - Containerized, reproducible tool runs
- 📦 **Registry** - Centralized tool distribution
- 🤖 **AI Integration** - Native MCP support for agents

## Architecture

```
┌─────────────┐
│     CLI     │  @enactprotocol/cli
└──────┬──────┘
       │
       ├──────▶ Registry API     (@enactprotocol/api)
       ├──────▶ Trust System     (@enactprotocol/trust)
       ├──────▶ Execution Engine (@enactprotocol/execution + Dagger)
       └──────▶ MCP Server       (@enactprotocol/mcp-server)
```

## Contributing

See [DEV-SETUP.md](../DEV-SETUP.md) for development environment setup and contribution guidelines.

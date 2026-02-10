# Enact Documentation

Technical reference documentation for the Enact protocol and implementation.

## Core Documentation

### Protocol & Specification
- **[PROTOCOL.md](./PROTOCOL.md)** - Protocol overview and core concepts
- **[SPEC.md](./SPEC.md)** - Tool manifest specification (skill.yaml format)

### Command Line Interface
- **[COMMANDS.md](./COMMANDS.md)** - Complete CLI command reference
- **[ENV.md](./ENV.md)** - Environment variables and configuration

### Trust & Security
- **[TRUST.md](./TRUST.md)** - Trust system architecture and verification

### Integration
- **[API.md](./API.md)** - Registry HTTP API documentation
- **[DAGGER.md](./DAGGER.md)** - Execution engine (Dagger) integration
- **[MCP.md](./MCP.md)** - Model Context Protocol integration

## Getting Started

For user-focused documentation, see:
- [Getting Started Guide](../GETTING-STARTED.md) - Installation and basic usage
- [Development Setup](../DEV-SETUP.md) - Contributing to Enact

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

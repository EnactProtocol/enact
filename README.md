# Enact

A verified, portable protocol for defining, discovering, and safely executing AI-ready tools.

## Overview

Enact provides an end-to-end infrastructure for creating, publishing, and running containerized tools designed for AI agents and automation workflows. It combines a tool registry, trust and attestation system, and secure execution engine into a unified platform.

**Key Features**

* 📦 **Tool Registry** — Discover, publish, and share executable tools
* 🔐 **Trust System** — Sigstore-based signing, verification, and attestations
* 🐳 **Containerized Execution** — Isolated and reproducible runs powered by Dagger
* 🌐 **Web UI** — Manage environments, secrets, and configuration
* 🤖 **MCP Integration** — Native Model Context Protocol support for AI agents

---

## Quick Start

### Installation

```bash
# Install globally
npm install -g @enactprotocol/cli

# Or using bun
bun install -g @enactprotocol/cli
```

### Basic Usage

```bash
# Configure Enact
enact setup

# Search for tools
enact search greeting

# Install a tool
enact install examples/hello-simple

# Execute it
enact run examples/hello-simple --input name=World
```

---

## Architecture

This monorepo contains all core Enact components:

```
packages/
├── api           # Registry API client
├── cli           # Command-line interface
├── execution     # Dagger-based execution engine
├── mcp-server    # MCP server for AI integrations
├── secrets       # Secure credential storage
├── server        # Supabase Edge Functions (registry backend)
├── shared        # Core utilities and business logic
├── trust         # Sigstore integration & attestations
└── web           # Web UI for configuration and secrets
```

---

## Documentation

* **Getting Started:** [GETTING-STARTED.md](./GETTING-STARTED.md)
* **Development Setup:** [DEV-SETUP.md](./DEV-SETUP.md)
* **Deployment Guide:** [DEPLOYMENT.md](./DEPLOYMENT.md)
* **API Reference:** [docs/API.md](./docs/API.md)
* **Trust System:** [docs/TRUST.md](./docs/TRUST.md)
* **Roadmap:** [ROADMAP.md](./ROADMAP.md)

---

## Developer Guide

See [DEV-SETUP.md](./DEV-SETUP.md) for full instructions.

**Build individual packages:**

```bash
bun run build:api
bun run build:cli
bun run build:execution
bun run build:mcp-server
bun run build:secrets
bun run build:shared
bun run build:trust
```

**Run CLI in development mode:**

```bash
cd packages/cli
bun run dev -- search calculator
```

**Type checking & cleanup:**

```bash
bun run typecheck     # Type checking
bun run clean         # Remove build artifacts and node_modules
```

---

## Packages

### **@enactprotocol/api**

Registry API client for tool discovery and installation.
Features:

* Tool search and metadata retrieval
* Bundle download and caching
* Authentication support
* Rate limiting & error handling
  **Status:** Core functionality complete.

### **@enactprotocol/cli**

User-facing command-line interface.
Commands include:

* `enact setup` — Initial configuration
* `enact search` — Discover tools
* `enact install` — Install tools
* `enact run` — Execute tools
* `enact get` / `inspect` / `list` — Metadata and installed tools
  **Status:** Core commands implemented and stable.

### **@enactprotocol/execution**

Execution engine with sandboxing and resource isolation using Dagger.
**Status:** Core execution engine complete with container support.

### **@enactprotocol/mcp-server**

MCP server enabling AI agents to discover and invoke tools.
**Status:** Not yet started.

### **@enactprotocol/secrets**

Secure credential storage using system keyring (macOS Keychain, Windows Credential Manager, Linux Secret Service).
**Status:** Full implementation complete with namespace resolution.

### **@enactprotocol/server**

Supabase Edge Functions backend for the registry with PostgreSQL database and R2 storage.
**Status:** Production-ready with full search, publish, trust, and attestation APIs.

### **@enactprotocol/shared**

Core utilities, types, and business logic shared across all packages.
**Status:** Complete with manifest parsing, validation, tool resolution, and registry management.

### **@enactprotocol/trust**

Sigstore integration for signing and verifying tool attestations.
**Status:** Complete with certificate-based identity verification and policy evaluation.

### **@enactprotocol/web**

React-based web UI for managing environments, secrets, and configuration.
**Status:** Complete with Supabase authentication and environment management.

---

## Project Status

* ✅ **Phase 1:** Monorepo Foundation
* ✅ **Phase 2:** Core CLI Commands
* ✅ **Phase 3:** Registry Backend (Supabase Edge Functions)
* ✅ **Phase 4:** Local Development Environment
* ✅ **Phase 5:** Trust & Attestation System (Sigstore integration)
* ✅ **Phase 6:** Execution Engine (Dagger-based containerization)
* ✅ **Phase 7:** Secrets Management (System keyring integration)
* ✅ **Phase 8:** Web UI (React app with Supabase auth)
* ⏳ **Phase 9:** MCP Server (Model Context Protocol) - **In Progress**

Full roadmap in [ROADMAP.md](./ROADMAP.md).

---

## Development

### Prerequisites

* Bun 1.0+
* Docker (execution engine)
* Supabase CLI (local registry)

### Setup

```bash
bun install
bun run build
bun test
bun run typecheck
bun run lint
```

**Local development workflow:**

```bash
# Start the local registry
cd packages/server
supabase start

# Develop CLI
cd packages/cli
bun run dev -- search calculator

# Watch tests
bun test --watch
```

---

## Contributing

We welcome contributions!

1. Fork the repository
2. Create a feature branch
3. Implement your changes with tests
4. Run `bun run lint` and `bun test`
5. Submit a pull request

---

## License

Apache-2.0 — see [LICENSE](./LICENSE).

---

## Community

* **Registry:** [https://siikwkfgsmouioodghho.supabase.co/functions/v1](https://siikwkfgsmouioodghho.supabase.co/functions/v1)
* **Issues:** [https://github.com/EnactProtocol/enact-cli-2.0/issues](https://github.com/EnactProtocol/enact-cli-2.0/issues)
* **Discussions:** [https://github.com/EnactProtocol/enact-cli-2.0/discussions](https://github.com/EnactProtocol/enact-cli-2.0/discussions)


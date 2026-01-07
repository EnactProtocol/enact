# Enact

Everything you need to run your own AI tool registry. See it live: **[enact.tools](https://enact.tools)**

Enact is a verified, portable standard for defining, discovering, and safely executing AI-ready tools.

## Overview

Enact provides end-to-end infrastructure for creating, publishing, and running containerized tools designed for AI agents and automation workflows. It combines a tool registry, trust and attestation system, and secure execution engine into a unified platform.

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
npm install -g enact-cli

# Or using bun
bun install -g enact-cli
```

### Basic Usage

```bash
# Search for tools
enact search greeting

# Learn about a tool (view its SKILL.md documentation)
enact learn enact/hello-python

# Run a tool
enact run enact/hello-python --args '{"name": "World"}'
```

### Example: What `enact learn` Shows

```bash
$ enact learn enact/hello-python

enact/hello-python@1.0.3
───────────────────────────

---
name: "enact/hello-python"
version: "1.0.3"
description: "A simple Python greeting tool"
from: "python:3.12-slim"

inputSchema:
  type: object
  properties:
    name:
      type: string
      description: "Name to greet"
      default: "World"

command: "python /workspace/hello.py ${name}"
---

# Hello Python

A simple Python tool that greets you by name.
```

### Example: Running a Tool

```bash
$ enact run enact/hello-python --args '{"name": "Anthropic"}'

◇  ✓ Resolved: enact/hello-python
◐  Running enact/hello-python (python:3.12-slim)...
◇  ✓ Execution complete

Hello, Anthropic! 🐍
Generated at: 2025-12-19T15:33:38
Python version: 3.12.12
```

### Example Tool Structure

An Enact tool is a directory with a `SKILL.md` manifest and your code:

```
my-tool/
├── SKILL.md          # Tool manifest (required) - defines inputs, outputs, and execution
├── main.py           # Your code (any language)
└── requirements.txt  # Dependencies (optional)
```

**SKILL.md** is a Markdown file with YAML frontmatter that defines your tool:

```yaml
---
name: acme/hello-python
version: 1.0.0
description: A friendly greeting tool
from: python:3.12-slim
build: pip install -r requirements.txt
command: python /workspace/main.py ${name}

inputSchema:
  type: object
  properties:
    name:
      type: string
      description: Name to greet
      default: World
---

# Hello Python

This tool greets you by name. Pass a `name` parameter to customize the greeting.
```

Create a new tool with `enact init --tool`, test with `enact run ./`, and publish with `enact publish`.

---

## MCP Integration

Enact provides native [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) support, allowing AI agents like Claude to discover and run tools from the registry.

### Setup for Claude Code

```bash
claude mcp add enact --transport stdio -- npx -y @enactprotocol/mcp-server
```

### Setup for Other MCP Clients

Run `enact mcp install` for configuration instructions for Claude Desktop, Cursor, VS Code, and other MCP clients.

### MCP Tools

Once connected, AI agents have access to these tools:

| Tool | Description |
|------|-------------|
| `enact_search` | Search the registry for tools by keyword or capability |
| `enact_learn` | Get detailed documentation, schemas, and usage examples |
| `enact_run` | Execute any tool from the registry |
| `enact_install` | Install a tool for faster subsequent executions |

### Example: Web Scraping with Firecrawl

```
User: "Scrape the Anthropic homepage and summarize it"

Claude uses enact_search to find: enact/firecrawl
Claude uses enact_run with:
  tool: "enact/firecrawl"
  args: {"url": "https://anthropic.com", "action": "scrape"}

→ Returns clean markdown content ready for summarization
```

### Example: Search the Web

```
User: "Find the latest news about AI agents"

Claude uses enact_run with:
  tool: "enact/firecrawl"
  args: {"url": "AI agents news 2025", "action": "search", "limit": 5}

→ Returns scraped content from top search results
```

### Example: Extract Structured Data

```
User: "Get the pricing tiers from stripe.com/pricing"

Claude uses enact_run with:
  tool: "enact/firecrawl"
  args: {
    "url": "https://stripe.com/pricing",
    "action": "extract",
    "prompt": "Extract all pricing tiers with their names, prices, and features"
  }

→ Returns structured JSON with pricing data
```

### Example: Discover and Use Any Tool

```
User: "I need to scan a website for security info"

Claude uses enact_search: "web scanner security"
→ Finds: enact/scanner/whatweb

Claude uses enact_learn: "enact/scanner/whatweb"
→ Gets input schema and documentation

Claude uses enact_run with:
  tool: "enact/scanner/whatweb"
  args: {"url": "https://example.com"}

→ Returns CMS, frameworks, servers detected
```

### Why MCP + Enact?

- **Dynamic Discovery** — Agents find the right tool for any task at runtime
- **No Pre-configuration** — Tools run on-demand without installation
- **Sandboxed Execution** — Every tool runs in an isolated container
- **Verified Tools** — Sigstore-based signing ensures tool authenticity

---

## Enact Registry

**[https://enact.tools](https://enact.tools)** is the official Enact registry where you can:

- **Browse tools** — Explore the catalog of published tools
- **Sign up** — Create an account to start publishing your own tools
- **Publish tools** — Push your tools to the registry with `enact publish`
- **Manage your profile** — Track your published tools and usage

```bash
# Login to the registry
enact login

# Publish your tool
enact publish
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
* **API Reference:** [docs/API.md](./docs/API.md)
* **Trust System:** [docs/TRUST.md](./docs/TRUST.md)
* **Protocol Spec:** [docs/SPEC.md](./docs/SPEC.md)

---

## Developer Guide

See [DEV-SETUP.md](./DEV-SETUP.md) for full instructions.


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

MCP server enabling AI agents to discover and invoke tools via the Model Context Protocol.
**Status:** Complete with search, learn, run, and install meta-tools.

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

* **Website:** [https://enact.tools](https://enact.tools)
* **Registry API:** [https://siikwkfgsmouioodghho.supabase.co/functions/v1](https://siikwkfgsmouioodghho.supabase.co/functions/v1)
* **Issues:** [https://github.com/EnactProtocol/enact-cli-2.0/issues](https://github.com/EnactProtocol/enact-cli-2.0/issues)
* **Discussions:** [https://github.com/EnactProtocol/enact-cli-2.0/discussions](https://github.com/EnactProtocol/enact-cli-2.0/discussions)


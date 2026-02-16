# Enact

[![Discord](https://img.shields.io/discord/1312642330502627348?color=5865F2&logo=discord&logoColor=white&label=Discord)](https://discord.com/invite/mMfxvMtHyS)

A package manager for agent skills. See the registry: **[enact.tools](https://enact.tools)**

Enact is a skills registry with containerized execution, cryptographic verification, and native MCP support. Publish once, run anywhere — securely.

## Why Enact

AI agents shouldn't come preloaded with every tool they might need. They should discover capabilities at runtime — search for what they need, read the docs, and run it. Enact makes that possible.

- **Self-hosted** — Run your own registry with a single command. No external dependencies.
- **Semantic Discovery** — Skills are indexed with vector embeddings. Agents find what they need by capability, not just keyword matches.
- **Trust** — Cryptographic signing and verification on every package.
- **Portable Execution** — Skills declare what they need. You decide where they run.

## Where Enact Sits in the Stack

Enact is not just a registry. It is a **policy-enforcing execution layer** for AI agents.

```
Model (Claude, GPT, etc.)
    ↓
Host (Claude Code, Cursor, VS Code, etc.)
    ↓
Tool Call (MCP or CLI)
    ↓
Enact Runtime
    ├── Package resolution
    ├── Signature verification (Sigstore)
    ├── Trust policy enforcement
    ├── Backend selection (local / docker / remote)
    └── Secret injection
    ↓
Isolated execution
```

The model decides *what* to run. Enact decides *whether and how* it runs.

### Why This Matters

**Without Enact:**
- Tools are pre-wired
- Trust is implicit
- Execution environment is ad hoc
- Secrets handling is custom

**With Enact:**
- Skills are signed and verified
- Trust policies are configurable
- Execution is portable and isolated
- Secrets never pass through the agent
- The runtime enforces policy — not the model

Enact shifts control from prompt discipline to **runtime guarantees**.

### Not Just MCP

Enact works:
- Via **MCP** (structured tool calls)
- Via **CLI** invocation
- Via **SDK**
- Against **self-hosted registries**

MCP is the transport. Enact is the execution authority.

### A Better Mental Model

Enact is to AI agents what `apt` + `Docker` + `Sigstore` are to servers — but unified behind a single agent-native interface. It's a package manager, trust layer, and execution engine designed for autonomous systems.

> Agents should request capabilities. The runtime should enforce trust. Enact makes that boundary explicit.

## What's a Skill Package?

A skill package is a directory with two key files — `SKILL.md` for agent-facing documentation and `skill.package.yml` for package metadata — plus your code:

```
my-scraper/
├── SKILL.md          # Agent-facing documentation
├── skill.package.yml        # Package manifest (identity, execution, secrets)
├── requirements.txt
└── scrape.py
```

**skill.package.yml** defines identity, execution, and secrets:

```yaml
enact: "2.0.0"
name: acme/scraper
version: "1.0.0"
description: Scrape URLs and convert web pages to clean markdown
from: python:3.12-slim

hooks:
  build:
    - pip install -r requirements.txt

env:
  API_KEY:
    secret: true

scripts:
  scrape: "python /workspace/scrape.py {{url}}"
```

**SKILL.md** teaches the agent how to use it:

```markdown
# Web Scraper

Scrape URLs and convert web pages to clean markdown.

## Usage

Scrape a single URL:

  enact run acme/scraper -a '{"url": "https://example.com"}'

Returns the page content as clean markdown.
```

## Quick Start

```bash
# Install
npm install -g @enactprotocol/cli

# Find a tool
enact search scraper

# Read its documentation
enact learn enact/firecrawl

# Run it
enact run enact/firecrawl:scrape -a '{"url": "https://example.com"}'
```

## MCP Integration

Enact has native [Model Context Protocol](https://modelcontextprotocol.io/) support so AI agents can discover and run tools from the registry.

**Setup for Claude Code:**

```bash
claude mcp add enact -- npx -y @enactprotocol/mcp-server
```

Run `enact mcp install` for setup instructions for Claude Desktop, Cursor, VS Code, and other clients.

Once connected, agents get four tools:

| Tool | Description |
|------|-------------|
| `enact_search` | Find tools by keyword or capability |
| `enact_learn` | Read a tool's documentation and usage |
| `enact_run` | Execute a tool from the registry |
| `enact_install` | Install a tool for faster subsequent runs |

The agent workflow is: **search → learn → run**. No preloading, no static config. The agent discovers what it needs, when it needs it.

**Example:**

```
User: "Scrape the Anthropic homepage and summarize it"

Agent searches → finds enact/firecrawl
Agent learns  → reads docs, sees it needs FIRECRAWL_API_KEY
Agent runs    → enact/firecrawl:scrape with url: "https://anthropic.com"
Agent summarizes the returned markdown
```

## Create a Skill

```bash
# Scaffold a new skill
enact init

# Test it locally
enact run ./

# Login and publish
enact login
enact publish
```

## Host Your Own Registry

```bash
# Start a local registry
enact serve

# Or with options
enact serve --port 8080 --data ./registry-data
```

That's it. SQLite + local file storage. No external dependencies. Point your CLI at it:

```bash
enact config set registry http://localhost:8080
```

Now `enact publish`, `enact search`, and `enact run` all work against your private registry.

A public registry is available at [enact.tools](https://enact.tools) as a curated starter library you can pull from or mirror.

## Execution

Skills declare what they need. The execution backend is up to you.

The same skill works across any backend without changes:

| Backend | When to use |
|---------|-------------|
| **Local** | Trusted skills, simple scripts, fastest execution |
| **Docker** | Isolation for untrusted skills, reproducible environments |
| **Dagger** | Smart local/remote execution with transparent context streaming |
| **Remote** | No local container runtime, hosted execution |

Configure your default:

```yaml
# ~/.enact/config.yaml
execution:
  default: docker
  fallback: remote
  trusted_scopes: ["my-org/*"]
```

When a skill is from a trusted scope, it runs locally. Otherwise, it runs in a container. If no container runtime is available, Enact falls back to remote execution transparently.

## Secrets

Secrets are first-class. Skills declare what they need in the manifest — secrets are injected at runtime without being exposed in logs, manifests, or to the agent.

Declare in `skill.package.yml`:

```yaml
env:
  FIRECRAWL_API_KEY:
    secret: true
```

Configure locally:

```bash
enact env set FIRECRAWL_API_KEY fc-your-key --secret --namespace enact
```

At runtime, secrets are read from local secure storage and injected into the execution environment. The skill sees a normal environment variable. The agent never sees the value.

## Trust & Signing

Every published package is cryptographically signed via [Sigstore](https://www.sigstore.dev/). Verification happens automatically — before a skill runs, Enact checks:

- **Publisher identity** — who signed this package
- **Integrity** — the package hasn't been tampered with since publishing
- **Transparency** — signatures are logged to a public transparency ledger

Configure trust policies per your environment:

```yaml
# ~/.enact/config.yaml
trust:
  policy: enforce
  auditors: ["my-org"]
```

## Addressing

Packages are `scope/name`. Scripts within a package are `scope/name:script`.

## Documentation

- **[Getting Started](./GETTING-STARTED.md)** — Installation and first skill
- **[Protocol Spec](./docs/SPEC.md)** — The `skill.package.yml` format and execution semantics
- **[API Reference](./docs/API.md)** — Registry API
- **[Trust & Signing](./docs/TRUST.md)** — Sigstore-based verification
- **[Dev Setup](./DEV-SETUP.md)** — Contributing to Enact

## Architecture

```
packages/
├── api           # Registry API client
├── cli           # Command-line interface
├── execution     # Pluggable execution backends (local, docker, dagger, remote)
├── mcp-server    # MCP server for AI agents
├── registry      # Self-hosted registry backend (SQLite)
├── secrets       # Secure credential storage
├── shared        # Core types, manifest parsing, config
├── trust         # Sigstore signing and verification
└── web           # Web UI (enact.tools)
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Run `bun run lint` and `bun test`
4. Submit a pull request

See [DEV-SETUP.md](./DEV-SETUP.md) for full instructions.

## License

Apache-2.0 — see [LICENSE](./LICENSE).

## Community

- **Registry:** [enact.tools](https://enact.tools)
- **Discord:** [discord.gg/mMfxvMtHyS](https://discord.gg/mMfxvMtHyS)
- **Issues:** [GitHub](https://github.com/EnactProtocol/enact/issues)

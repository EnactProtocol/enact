# Enact

**Runtime and Registry for Agent Skills**

[![Discord](https://img.shields.io/discord/1312642330502627348?color=5865F2&logo=discord&logoColor=white&label=Discord)](https://discord.com/invite/mMfxvMtHyS)

Discover, verify, and execute capabilities on demand.

Enact packages tools as portable skill bundles and runs them securely — locally, in containers, or remotely — with policy enforcement and cryptographic verification.

**[Browse Skills](https://enact.tools)** · **[Get Started](./GETTING-STARTED.md)**

---

## Built for Autonomous Agents

Agents shouldn't ship with every tool preinstalled. They should acquire capabilities when needed.

**Discover by capability** — Search the registry for skills that solve the task:

```bash
enact search "resize images"
```

**Run instantly** — Execute without manual setup or environment wiring:

```bash
enact run alice/resizer:resize -a '{"width": 800}'
```

**Know what's available** — Agents and developers can inspect installed capabilities:

```bash
enact list
```

---

## A Runtime — Not Just a Registry

Traditional package managers deliver code to developers. Enact delivers capabilities to autonomous systems with guarantees.

| Without Enact | With Enact |
|---|---|
| Manual integration | Drop-in execution |
| Implicit trust | Verified signatures |
| Environment drift | Reproducible runtime |
| Secrets in code | Secure injection |
| Static installs | On-demand capabilities |

> npx launches code. A runtime governs execution.

---

## Policy-Enforced Execution

The model decides what to run. Enact decides **whether and how** it runs.

```
Model (Claude, GPT, etc.)
    ↓
Host (Claude Code, Cursor, VS Code, etc.)
    ↓
Tool Call (MCP or CLI)
    ↓
Enact Runtime
    ├── Signature verification (Sigstore)
    ├── Trust policy enforcement
    ├── Backend selection (local / docker / remote)
    ├── Secret injection
    └── Isolated execution
```

Before execution, Enact:

- **Verifies signatures** via [Sigstore](https://www.sigstore.dev/)
- **Applies trust policies** per your configuration
- **Selects an execution backend** based on policy and environment
- **Injects secrets securely** without exposing them to the agent
- **Runs in isolation** when needed

---

## Run Anywhere

Skills are portable across environments. Write once, run anywhere.

| Backend | When to use |
|---------|-------------|
| **Local** | Fast, trusted workflows |
| **Docker** | Isolation for untrusted code, reproducible environments |
| **Remote** | No local runtime required |

Enact automatically chooses the safest available option based on policy and environment.

```yaml
# ~/.enact/config.yaml
execution:
  default: docker
  fallback: remote
  trusted_scopes: ["my-org/*"]
```

---

## Simple Skill Packages

A skill is just agent-facing documentation, a runtime manifest, and implementation code. No special framework required.

```
my-skill/
├── SKILL.md              # Agent-facing documentation
├── skill.package.yml     # Runtime manifest
└── code/
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

**SKILL.md** teaches the agent how to use the skill — plain markdown, no special syntax.

Package anything from a small script to a full application.

---

## Built-In Trust

Every published skill is cryptographically signed and transparently verified.

- **Publisher identity validation** — who signed this package
- **Tamper detection** — the package hasn't been modified since publishing
- **Transparency logs** — signatures are logged to a public ledger
- **Configurable trust policies** — enforce, warn, or skip per your needs

```yaml
# ~/.enact/config.yaml
trust:
  policy: enforce
  auditors: ["my-org"]
```

Use public registries, private registries, or fully self-hosted deployments.

---

## Secrets

Skills declare what they need in the manifest — secrets are injected at runtime without being exposed in logs, manifests, or to the agent.

```yaml
# skill.package.yml
env:
  FIRECRAWL_API_KEY:
    secret: true
```

```bash
enact env set FIRECRAWL_API_KEY fc-your-key --secret --namespace enact
```

The skill sees a normal environment variable. The agent never sees the value.

---

## Native Agent Integration

Enact integrates with the [Model Context Protocol](https://modelcontextprotocol.io/), allowing AI clients to discover and execute skills dynamically through a standardized interface. No preconfiguration required.

**Setup for Claude Code:**

```bash
claude mcp add enact -- npx -y @enactprotocol/mcp-server
```

Run `enact mcp install` for setup instructions for Claude Desktop, Cursor, VS Code, and other clients.

Agents can:

- **Search** for capabilities
- **Read** documentation
- **Execute** tools
- **Install** frequently used skills

| Tool | Description |
|------|-------------|
| `enact_search` | Find skills by keyword or capability |
| `enact_learn` | Read a skill's documentation and usage |
| `enact_run` | Execute a skill from the registry |
| `enact_install` | Cache a skill locally for faster runs |

**Example:**

```
User: "Scrape the Anthropic homepage and summarize it"

Agent searches → finds enact/firecrawl
Agent learns  → reads docs, sees it needs FIRECRAWL_API_KEY
Agent runs    → enact/firecrawl:scrape with url: "https://anthropic.com"
Agent summarizes the returned markdown
```

---

## CLI

Manage skills from the terminal.

```bash
enact search "pdf parser"      # Find skills
enact learn alice/parser       # Read docs
enact run alice/parser:parse   # Execute
enact install alice/parser     # Cache locally
enact publish                  # Share your skill
```

### Create a Skill

```bash
enact init          # Scaffold a new skill
enact run ./        # Test locally
enact login         # Authenticate
enact publish       # Publish to registry
```

---

## Self-Host or Use the Public Registry

Run your own registry with a single command, or use the public ecosystem.

```bash
enact serve --port 8080 --data ./registry-data
```

```bash
enact config set registry http://localhost:8080
```

- No external dependencies — SQLite + local file storage
- Local or private deployments
- Mirror or curate skills
- Full control over trust policies

A public registry is available at **[enact.tools](https://enact.tools)**.

---

## Why Enact

| | |
|---|---|
| **Portable** | Skills run across environments without modification |
| **Secure by default** | Verification and policy enforcement before execution |
| **Agent-native** | Designed for dynamic capability discovery |
| **Flexible** | Works locally, in containers, or remotely |
| **Open** | Self-host, extend, or integrate into your stack |

---

## Get Started

Install the CLI and run your first skill in seconds.

```bash
npm install -g @enactprotocol/cli
enact search scraper
enact run enact/firecrawl:scrape -a '{"url":"https://example.com"}'
```

**[Read the Docs](./GETTING-STARTED.md)** · **[Browse Skills](https://enact.tools)**

---

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

# Enact FAQ

Common questions and discussions about Enact's approach to portable AI tools.

---

## What is Enact?

Enact is a protocol and registry for defining, discovering, and executing containerized tools designed for AI agents. It uses a simple manifest file (`SKILL.md`) that defines everything an agent needs: the interface, runtime, dependencies, and execution command.

---

## How does Enact relate to MCP?

Enact doesn't replace MCP's client/server architecture—it's a different unit of composition. Rather than building full MCP servers, you're building individual tools that can be dynamically loaded into an MCP server.

Enact provides an MCP server that exposes registry tools (`enact_search`, `enact_learn`, `enact_run`, `enact_install`), allowing any MCP-compatible agent to discover and execute Enact tools on the fly.

---

## How is this different from distributing containerized MCP servers?

You could distribute containerized stdio servers, but Enact offers:

- **Granular composition**: Install only the tools you need, from different authors. Not "install this server and get all 20 of its tools whether you want them or not."
- **Simpler authoring**: A `SKILL.md` manifest is easier to write than implementing a full MCP server.
- **On-demand execution**: Tools run when needed, not as persistent servers.
- **Single portable artifact**: The `SKILL.md` defines runtime, dependencies, and interface together.

---

## How is this different from Agent Skills?

Enact shares similar goals with [Agent Skills](https://agentskills.io/) but takes a more constrained, container-first approach:

| Aspect | Agent Skills | Enact |
|--------|-------------|-------|
| Execution | Flexible, runs in host environment | Always containerized (Docker/Dagger) |
| Dependencies | Host-dependent | Declared in manifest, isolated |
| Interface | Flexible code contracts | Strict JSON Schema |
| Portability | Depends on environment | Guaranteed by container |

The tradeoff: Agent Skills are more flexible, but that flexibility means no guarantees about dependencies or cross-machine compatibility. Enact trades some flexibility for portability and isolation.

---

## Why not just use FastMCP or single-file MCP servers?

FastMCP and similar tools are great for building MCP servers quickly. Enact solves a different problem:

- **Discovery**: How does an agent find a tool it doesn't know about?
- **Trust**: How do you verify a tool's provenance before executing it?
- **Isolation**: How do you safely run untrusted code?

Enact could be seen as infrastructure for building and distributing tools that *could* be wrapped as MCP servers.

---

## Why would organizations trust agents executing arbitrary registry code?

This is a valid concern. Enact addresses it through:

1. **Containerized execution**: Tools run in isolated containers, not on the host
2. **Sigstore integration**: Tools can be cryptographically signed with verifiable identity
3. **Trust policies**: Users define which publishers they trust
4. **Attestations**: Provenance metadata (similar to npm provenance) can be attached to tools

That said, security is an ongoing concern for any system that executes remote code.

---

## What problems does Enact solve that MCP doesn't?

MCP defines how clients and servers communicate. It doesn't address:

- **Tool discovery**: How does an agent find tools it doesn't have?
- **Tool distribution**: How do you package and share tools?
- **Runtime portability**: How do you ensure tools work across environments?
- **Dynamic tool loading**: How do agents acquire new capabilities at runtime?

Enact fills these gaps while remaining MCP-compatible.

---

## Should this be part of the MCP specification?

Probably not as a core part of MCP. Enact works well as a complementary technology that integrates with MCP through its server implementation. The MCP specification focuses on the communication protocol; tool packaging and distribution can exist as a separate layer.

---

## What's the simplest Enact tool?

A single `SKILL.md` file with an inline command—no separate code files needed:

```
my-tool/
└── SKILL.md
```

**SKILL.md:**
```yaml
---
name: username/hello
version: 1.0.0
description: A simple greeting

from: alpine:latest
command: echo "Hello, ${name}!"

inputSchema:
  type: object
  properties:
    name:
      type: string
      default: World
---

# Hello

Prints a greeting.
```

That's it. Run it with `enact run .` or publish it.

For tools with actual logic, add code files:

```
my-tool/
├── SKILL.md
└── main.py
```

---

## How do I handle dependencies?

Use the `build` field:

```yaml
from: python:3.12-slim

build:
  - pip install requests beautifulsoup4
  - apt-get update && apt-get install -y curl
```

---

## How do I handle secrets/API keys?

Use the `env` field with `secret: true`:

```yaml
env:
  FIRECRAWL_API_KEY:
    secret: true
```

Users configure secrets locally using `enact env set`, and they're injected at runtime without being exposed in logs or manifests:

```bash
enact env set FIRECRAWL_API_KEY fc-your-key --secret --namespace enact
```

---

## Why do shell-based skills break?

Traditional skills that rely on shell commands (curl, jq, etc.) are fragile because:

- **Environment dependencies**: Scripts assume tools exist that may not be installed
- **Shell escaping nightmares**: Variable substitution in pipelines causes quoting issues
- **Cross-platform differences**: Windows, macOS, and Linux behave differently
- **No automated testing**: You can't easily verify skills work across environments

Enact solves this by packaging the environment with the skill. Instead of hoping `curl` exists, you define `from: python:3.12-slim` and use proper Python code with `requests`.

---

## What's the container overhead?

Containers add startup time—a few seconds compared to milliseconds for a shell command. For rapid-fire API calls, this matters.

But for most AI agent workflows (scraping pages, processing documents, calling external services), a few seconds is negligible compared to the reliability you gain.

Enact also caches container builds aggressively. After the first run, subsequent executions reuse the built image.

---

## What programming languages are supported?

Any language with an interpreter or compiler that runs in Docker. The `from` field specifies the base image:

```yaml
from: python:3.12-slim    # Python
from: node:20-alpine      # JavaScript/TypeScript
from: rust:1.75-slim      # Rust
from: golang:1.21-alpine  # Go
from: debian:bookworm-slim # Install anything via apt
```

We've even built a working MCP tool in Brainfuck to prove the point—if it has an interpreter, it can be an Enact tool.

---

## How does Claude Code integration work?

Two options:

**Option 1: MCP Server (recommended)**
```bash
claude mcp add enact --transport stdio -- npx -y @enactprotocol/mcp-server
```

This gives Claude access to `enact_search`, `enact_learn`, `enact_run`, and `enact_install` as native MCP tools.

**Option 2: CLAUDE.md instruction file**
```bash
enact init --claude
```

This creates a `CLAUDE.md` file that teaches Claude how to use Enact via shell commands.

Either way, Claude can now discover and execute any tool from the registry autonomously.

---

## Can I keep tools private?

Yes. Enact supports three visibility levels:

- **Private (default)**: Only visible to you, requires authentication
- **Unlisted**: Not in search, but accessible via direct link
- **Public**: Visible to everyone in search and browse

```bash
enact publish           # Private (default)
enact publish --unlisted
enact publish --public
```

---

## What's the vision for the future?

Agents that can dynamically discover, evaluate, and execute tools they've never seen before—safely and without pre-configuration. An agent that needs to scrape a website but doesn't have a scraper can:

1. Search the registry for "web scraping"
2. Find `enact/firecrawl`
3. Read its schema and documentation
4. Execute it in an isolated container
5. Use the results

Whether this future arrives depends on advances in agent autonomy and trust systems.

---

## Where can I learn more?

- **Website**: [enact.tools](https://enact.tools)
- **GitHub**: [github.com/EnactProtocol/enact](https://github.com/EnactProtocol/enact)
- **Discord**: [discord.gg/mMfxvMtHyS](https://discord.gg/mMfxvMtHyS)

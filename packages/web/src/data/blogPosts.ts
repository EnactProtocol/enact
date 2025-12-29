export interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  date: string;
  author: string;
  slug: string;
  content: string;
  tags: string[];
}

export const blogPosts: BlogPost[] = [
  {
    id: "8",
    title: "Web Scraping for AI Agents: Firecrawl + Enact",
    excerpt:
      "Give your AI agent the ability to scrape websites, crawl documentation, search the web, and extract structured data. All with a single tool.",
    date: "2024-12-29",
    author: "Enact Team",
    slug: "firecrawl-enact",
    tags: ["tutorial", "firecrawl", "web-scraping", "tools"],
    content: `
AI agents need to access the web. Whether it's scraping documentation, extracting product data, or searching for current information, web access is a core capability.

[Firecrawl](https://firecrawl.dev) is one of the best APIs for this. It handles anti-bot mechanisms, JavaScript rendering, and returns clean markdown. But integrating it into your agent workflow usually means writing custom code, handling API keys, and dealing with environment setup.

With Enact, you can give your agent full Firecrawl capabilities in under 2 minutes.

## Quick Setup

### 1. Install the CLI

\`\`\`bash
npm install -g enact-cli
\`\`\`

### 2. Get a Firecrawl API Key

Sign up at [firecrawl.dev](https://firecrawl.dev) and grab your API key.

### 3. Store Your API Key Securely

\`\`\`bash
enact env set FIRECRAWL_API_KEY fc-your-api-key --secret --namespace enact
\`\`\`

This stores your key in your OS keyring (macOS Keychain, Windows Credential Manager, or Linux Secret Service). Never written to disk or exposed in logs.

That's it. You're ready to scrape.

## Five Capabilities, One Tool

The \`enact/firecrawl\` tool supports five actions:

### 1. Scrape: Single Page to Markdown

\`\`\`bash
enact run enact/firecrawl --args '{"url": "https://docs.anthropic.com", "action": "scrape"}'
\`\`\`

Returns clean markdown, perfect for feeding into an LLM context window.

### 2. Crawl: Entire Sites

\`\`\`bash
enact run enact/firecrawl --args '{"url": "https://docs.anthropic.com", "action": "crawl", "limit": 20}'
\`\`\`

Automatically discovers and scrapes all subpages. Great for ingesting entire documentation sites.

### 3. Map: Fast URL Discovery

\`\`\`bash
enact run enact/firecrawl --args '{"url": "https://example.com", "action": "map"}'
\`\`\`

Returns all URLs on a site without scraping content. Lightning fast for understanding site structure.

### 4. Search: Web Search with Scraping

\`\`\`bash
enact run enact/firecrawl --args '{"url": "latest Claude API updates", "action": "search", "limit": 5}'
\`\`\`

Searches the web and returns scraped content from the top results. Perfect for current information.

### 5. Extract: AI-Powered Structured Data

\`\`\`bash
enact run enact/firecrawl --args '{
  "url": "https://news.ycombinator.com",
  "action": "extract",
  "prompt": "Extract the top 10 headlines with URLs and point counts"
}'
\`\`\`

Uses AI to extract exactly the data you need, in structured JSON format.

## Real Example: Extract Hacker News Headlines

Let's see extract in action:

\`\`\`bash
enact run enact/firecrawl --args '{
  "url": "https://news.ycombinator.com",
  "action": "extract",
  "prompt": "Extract the top 5 news headlines with their URLs and point counts"
}'
\`\`\`

**Output:**
\`\`\`json
{
  "success": true,
  "data": {
    "topNews": [
      {
        "headline": "GOG is getting acquired by its original co-founder",
        "url": "https://www.gog.com/blog/...",
        "points": 285
      },
      {
        "headline": "Static Allocation with Zig",
        "url": "https://nickmonad.blog/...",
        "points": 91
      }
    ]
  }
}
\`\`\`

No parsing HTML. No writing extractors. Just describe what you want.

## Using with Claude Code

If you're using Claude Code, just tell it about the tool:

> "Use enact/firecrawl to scrape the React documentation and summarize the hooks API"

Claude will:
1. Run \`enact search firecrawl\` to find the tool
2. Run \`enact learn enact/firecrawl\` to understand its parameters
3. Execute the scrape with the right arguments
4. Summarize the results

## Why Enact vs. Direct API Calls?

You could call Firecrawl directly with curl or Python. But:

- **Secret management**: API keys stored securely in OS keyring, not in scripts
- **Containerized execution**: Runs in Docker, no dependency conflicts
- **Consistent interface**: Same \`enact run\` pattern for all tools
- **Agent-friendly**: Structured JSON input/output, discoverable via search

## What Else Can You Build?

The Firecrawl tool is just one example. Enact has a growing registry of tools:

- **\`enact/playwright\`**: Browser automation, screenshots
- **\`enact/scanner/whatweb\`**: Technology detection

Or build your own. A tool is just a \`SKILL.md\` file and some code:

\`\`\`bash
enact init my-tool
# Edit SKILL.md
enact publish
\`\`\`

---

**Get started:**

\`\`\`bash
npm install -g enact-cli
enact env set FIRECRAWL_API_KEY <your-key> --secret --namespace enact
enact run enact/firecrawl --args '{"url": "https://example.com", "action": "scrape"}'
\`\`\`

---

Enact is fully open source. Check out the code, file issues, or contribute at [github.com/enactprotocol/enact](https://github.com/enactprotocol/enact).

---

*Published on December 29, 2024*
    `,
  },
  {
    id: "7",
    title: "Why Claude Code Skills Are Broken (And How to Fix Them)",
    excerpt:
      "Skills that depend on curl, jq, or local toolchains are fragile. Environment differences, escaping bugs, and untestable integrations make them unreliable. Here's a better approach.",
    date: "2024-12-29",
    author: "Enact Team",
    slug: "why-skills-break",
    tags: ["skills", "claude", "reliability"],
    content: `
A Reddit user recently described a problem that resonated deeply:

> "I've written many skills to enable Claude Code to support various APIs (Firecrawl, Hacker News, fal.ai). I found that making Claude Code use skills stably is a challenging thing."

They went on to list the pain points:

- **Environment dependencies**: Scripts rely on tools that may not exist on every machine. So you end up limiting yourself to "safe" toolchains like curl-only, which makes skills verbose and fragile.
- **Shell escaping nightmares**: Claude Code has quirks with variable substitution in pipelines. You end up wrapping everything in \`bash -c\` with nested escaping that's impossible to debug.
- **No automated testing**: Without tests, you can't know when upstream APIs change. Your skill silently breaks.

This isn't a skill-writing problem. It's an environment problem.

## The Root Cause

Skills today are just instructions. They tell Claude *what* to do, but they assume *how* is already solved: that the right tools are installed, that shell behavior is consistent, that the environment matches what the skill author had.

Obviously, that's not always a safe assumption to make.

Consider a skill that calls the Firecrawl API:

\`\`\`bash
curl -X POST https://api.firecrawl.dev/v1/scrape \\
  -H "Authorization: Bearer $FIRECRAWL_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"url": "'"$TARGET_URL"'", "formats": ["markdown"]}'
\`\`\`

This is a simple example . But:

- What if \`curl\` isn't installed? (Some minimal containers don't have it.)
- What if \`$TARGET_URL\` contains special characters that break the JSON?
- What if the user is on Windows with different shell quoting rules?
- What if the API changes its response format?

Every one of these is a silent failure waiting to happen.

## The Fix: Package the Environment

The solution is not to write more defensive shell scripts. It's to **stop depending on the host environment entirely**.

This is where Enact comes in. Enact extends the [SKILL.md standard](https://github.com/anthropics/skills/issues/157) with fields for containerized execution (\`from\`, \`build\`, and \`command\`) so skills can define their own runtime. Think of it as npm for AI: a registry to share tools, plus a runtime to execute them in containers.

Instead of skills being just instructions that hope the right tools exist, an Enact skill specifies everything needed to run. We just published \`enact/firecrawl\`, a full-featured Firecrawl tool that handles scraping, crawling, searching, and AI-powered extraction:

\`\`\`yaml
---
name: enact/firecrawl
version: 1.1.0
description: Scrape, crawl, search, and extract structured data from websites
from: python:3.12-slim
build:
  - pip install requests
env:
  FIRECRAWL_API_KEY:
    description: Your Firecrawl API key
    secret: true
command: python /workspace/firecrawl.py \${action} \${url} \${formats} \${limit} \${only_main_content} \${prompt} \${schema}
inputSchema:
  type: object
  properties:
    action:
      type: string
      enum: [scrape, crawl, map, search, extract]
      default: scrape
    url:
      type: string
      description: URL to process or search query
    prompt:
      type: string
      description: For extract - what to extract from the page
  required: [url]
---
\`\`\`

Now the skill author controls everything:
- The base image (\`python:3.12-slim\`)
- The dependencies (\`pip install requests\`)
- The secrets (\`FIRECRAWL_API_KEY\` marked as sensitive)
- The execution command with proper parameter handling

The skill runs identically everywhere because it carries its environment with it.

## Real Power: Five Actions, One Tool

The \`enact/firecrawl\` tool is not just a scraper. It's a complete web data toolkit:

\`\`\`bash
# Scrape a single page to markdown
enact run enact/firecrawl --url "https://example.com" --action scrape

# Crawl an entire documentation site
enact run enact/firecrawl --url "https://docs.example.com" --action crawl --limit 20

# Map all URLs on a site (lightning fast)
enact run enact/firecrawl --url "https://example.com" --action map

# Search the web
enact run enact/firecrawl --url "latest AI news" --action search --limit 5

# Extract structured data with AI
enact run enact/firecrawl --url "https://news.ycombinator.com" --action extract \\
  --prompt "Extract the top 10 headlines with URLs and point counts"
\`\`\`

Each action runs in the same containerized environment. No setup, no dependencies to install, no environment variables to configure on the host.

## Escaping Issues? Eliminated.

Remember the \`bash -c\` escaping nightmare? With a proper runtime, you write real code:

\`\`\`python
# firecrawl.py
import os
import json
import requests

def scrape(url, formats, only_main_content, api_key):
    response = requests.post(
        "https://api.firecrawl.dev/v1/scrape",
        headers={"Authorization": f"Bearer {api_key}"},
        json={"url": url, "formats": formats, "onlyMainContent": only_main_content}
    )
    return response.json()
\`\`\`

No escaping. No quoting issues. No \`bash -c\` wrapper. Just straightforward code in a language with proper string handling.

## Testing Becomes Possible

When your skill is a containerized unit, testing is straightforward:

\`\`\`bash
# Test locally
enact run enact/firecrawl --url "https://example.com" --action scrape

# Run in CI
- name: Test Firecrawl skill
  run: enact run enact/firecrawl --url "https://example.com" --action scrape
\`\`\`

The container is the same in development, CI, and production. If it works locally, it works everywhere.

## The Tradeoff

Containers add overhead. A curl command runs in milliseconds; spinning up a container takes seconds. For rapid-fire API calls, this matters.

But for most AI agent workflows, where you're doing meaningful work like scraping pages, processing documents, or calling external services, a few seconds of container startup is negligible compared to the reliability you gain.

And Enact caches container builds aggressively. After the first run, subsequent executions reuse the built image.

## From Fragile to Portable

The Reddit user asked: "Curious if others have found better patterns for writing stable skills."

The pattern is this: **don't write shell scripts that assume an environment. Package the environment with the skill.**

This is what Enact does. Every skill is a self-contained unit that includes its runtime, dependencies, and execution logic. Share it with anyone, and it runs the same way.

No more curl compatibility issues. No more escaping bugs. No more silent failures when APIs change.

Just portable, discoverable, testable, reliable skills.

---

Ready to try it? Check out [enact.tools](https://enact.tools) or run:

\`\`\`bash
npm install -g enact-cli
enact run enact/firecrawl --url "https://example.com" --action scrape
\`\`\`

---

Enact is fully open source. Check out the code, file issues, or contribute at [github.com/enactprotocol/enact](https://github.com/enactprotocol/enact).

*Published on December 29, 2024*
    `,
  },
  {
    id: "6",
    title: "Give Claude Code Superpowers in 5 Minutes",
    excerpt:
      "Enact is npm for AI tools. Connect it to Claude Code in 2 minutes and let Claude browse the web, take screenshots, and scan websites, just by asking.",
    date: "2024-12-28",
    author: "Enact Team",
    slug: "claude-code-superpowers",
    tags: ["tutorial", "claude", "getting-started"],
    content: `
Claude Code is powerful out of the box. It can read files, write code, and run shell commands. But what if you want it to browse the web, take screenshots, or scan a website's tech stack?

That's where Enact comes in.

## What is Enact?

Enact is a tool registry and runtime for AI agents. Think of it as **npm for AI**. It lets you package, share, and run complex capabilities (like web browsers or security scanners) in sandboxed containers that any AI agent can use.

Each tool runs in a Docker container, which means:
- **No installation headaches**: Dependencies are bundled (Playwright needs Chromium? It's included.)
- **Safe execution**: Tools run isolated from your system
- **Works everywhere**: Same behavior on any machine

## What Can Claude Do With Enact?

With Enact connected, Claude gains access to a growing library of containerized tools. Instead of you manually running commands, Claude discovers and uses tools on its own:

- "Take a screenshot of this website" → Claude finds and runs a Playwright-based tool
- "What tech stack is this site running?" → Claude finds a web scanner and reports back
- "Extract all the links from this page" → Claude finds the right tool and handles it

You ask in plain English. Claude figures out which tool to use.

## Setup (2 minutes)

### Step 1: Install Enact

\`\`\`bash
npm install -g enact-cli
\`\`\`

### Step 2: Initialize Your Project

In your project folder, run:

\`\`\`bash
enact init --claude
\`\`\`

This creates a \`CLAUDE.md\` file that teaches Claude Code how to use Enact tools. Claude reads this file and immediately knows how to discover and run containerized tools.

> **Note:** This doesn't change your code. It just adds a small instruction file that acts as a "manual" for Claude.

That's it. You're ready.

## See It In Action

Now just talk to Claude. Here's what a real conversation looks like:

---

**You:** "Take a screenshot of https://enact.tools and describe what you see."

**Claude:** Let me find a tool that can do that.

*Claude runs \`enact search screenshot\` and finds enact/playwright*

*Then runs \`enact learn enact/playwright\` to understand how to use it*

*Then executes:*
\`\`\`bash
enact run enact/playwright --args '{"url": "https://enact.tools", "action": "screenshot"}'
\`\`\`

"Here's what I found on the Enact homepage:
- A clean hero section with the tagline 'The npm for AI tools'
- Navigation links: Browse Tools, Docs, GitHub, Blog, Discord
- A search bar for discovering tools
- The page emphasizes safe, containerized tool execution"

---

**You:** "What tech stack is github.com running?"

**Claude:** Let me search for a tool that can detect web technologies.

*Claude runs \`enact search scanner\` and finds enact/scanner/whatweb*

*Then runs \`enact learn enact/scanner/whatweb\` to see the available options*

*Then executes:*
\`\`\`bash
enact run enact/scanner/whatweb --args '{"url": "https://github.com"}'
\`\`\`

"GitHub.com is using:
- Custom HTTP server (GitHub.com)
- Strict security headers (HSTS, X-Frame-Options: deny)
- Ruby on Rails backend indicators
- Fastly CDN for content delivery"

---

## How It Works (Behind the Scenes)

When you ask Claude to do something like "take a screenshot," here's what happens:

1. Claude reads the \`CLAUDE.md\` file you created and learns about Enact
2. It searches for relevant tools using \`enact search screenshot\`
3. It learns the tool's interface with \`enact learn enact/playwright\`
4. It runs the tool in an isolated Docker container
5. It parses the output and explains the results to you

**Claude doesn't just run a script. It decides which tool it needs.** It performs its own discovery (search) and reads the documentation (learn) before executing. You never type a single Enact command. Claude handles everything autonomously.

## Example Tools

| Tool | What it does |
|------|--------------|
| \`enact/playwright\` | Screenshots, text extraction, HTML scraping |
| \`enact/scanner/whatweb\` | Detect web technologies, servers, frameworks |

Browse the full registry at [enact.tools](https://enact.tools)

---

## TL;DR

**Enact** = npm for AI tools. Containerized, safe, zero-config.

**Setup**: \`npm install -g enact-cli && enact init --claude\`

**Result**: Claude Code can now browse the web, take screenshots, scan sites, and more. Just by asking.

---

*Published on December 28, 2024*

*Updated December 28, 2024: Restructured based on feedback from u/dagger378 on Reddit - thanks for the detailed suggestions!*
    `,
  },
  {
    id: "5",
    title: "Skills Are All You Need",
    excerpt:
      "MCP standardizes how agents communicate with tools. But MCP is for communication, not distribution. Enact makes tools as portable as the protocols that describe them.",
    date: "2024-12-27",
    author: "Enact Team",
    slug: "skills-are-all-you-need",
    tags: ["vision", "mcp", "skills"],
    content: `
# Making Skills Executable

We have abundant intelligence. We have big context windows. But we still have an *action* problem.

For an AI agent to actually *do* something (deploy an app, scan a codebase for secrets, or resize an image), it needs tools. The [Model Context Protocol (MCP)](https://modelcontextprotocol.io) standardizes how agents communicate with tools. But MCP is for communication, not distribution. It defines how to talk to a server, not how to package, share, or deploy one.

If we want agents to be truly autonomous, we need tools that are as portable as the protocols that describe them.

## What Actually Is a Skill?

Think of a Skill not as a piece of code, but as **an onboarding guide for a new team member**.

If you were hiring a junior developer to "run the weekly security scan," you wouldn't just give them a Python script. You would give them:

1. **The Context:** "This scans for exposed credentials before we deploy."
2. **The Instructions:** "Run it against the repo, review the output, escalate anything critical."
3. **The Tools:** The actual scripts, credentials, and environment needed to do the job.

A Skill packages all of this together. At its simplest, a skill is just a single \`SKILL.md\` file, a Markdown document with YAML frontmatter that defines the schema, instructions, and optionally the execution environment:

\`\`\`
code-reviewer/
└── SKILL.md    # Schema + instructions (no code required)
\`\`\`

Some skills are pure instructions for an LLM to follow. Others execute code in containers. Both are treated the same by the system: transparent, filesystem-based units of capability that an agent can read, understand, and execute.

## The Portability Problem

MCP gives us a standard way to *describe* tools. But to actually *run* an MCP server, you download code from GitHub, install dependencies, configure credentials, and hope it works. The spec supports running servers over stdio, which means many integrations instruct users to download and execute arbitrary code on their local machines.

This creates two problems:

1. **No portability.** The tool interface is portable, but the tool itself is not. Clone the repo, install Python 3.11 (not 3.9), pip install the right packages, configure the environment variables. If it works on their machine but not yours, good luck debugging.

2. **No trust.** You're running someone else's code with access to your filesystem, your credentials, your everything. There's no verification, no sandboxing, no audit trail.

Enact fixes both. The skill definition includes its own runtime: the container, the dependencies, the command. Share a skill, and the recipient can run it immediately in a sandboxed environment. No setup, no environment mismatch, no blind trust.

## The Skill *Is* The Executable

In Enact, a Skill is not just a definition. It is a self-contained, executable unit.

For skills that run code, the folder includes source files and dependencies:

\`\`\`
secret-scanner/
├── SKILL.md           # Manifest, schema, and execution config
├── requirements.txt   # Dependencies
└── src/
    └── scan.py        # Implementation code
\`\`\`

The \`SKILL.md\` file bundles the **contract** (the MCP schema) with the **execution config** (the container image, build steps, and command):

\`\`\`yaml
---
name: secops/secret-scanner
version: 2.1.0
description: Scans codebases for exposed secrets, API keys, and credentials
from: python:3.12-slim
build:
  - pip install detect-secrets
command: detect-secrets scan \${path} --all-files
inputSchema:
  type: object
  properties:
    path:
      type: string
      description: Directory to scan for secrets
      default: "."
---

# Secret Scanner

Scans your codebase for accidentally committed secrets using
detect-secrets. Identifies API keys, passwords, private keys,
and other sensitive data that shouldn't be in version control.
\`\`\`

When you run this (whether on your MacBook, a Linux server, or inside a CI pipeline), Enact uses [Dagger](https://dagger.io) to spin up the exact container environment defined in the skill. It mounts your code, runs the command, and captures the output.

**No dependency issues. No "works on my machine." Just pure, portable capability.**

## The npm Moment for AI

We are building the Enact Registry to be the npm for the AI era.

Imagine an agent that doesn't just rely on the tools you hard-coded for it. Imagine an agent that realizes it needs to scan for secrets, searches the registry for \`secops/secret-scanner\`, verifies the cryptographic signature to ensure it's from a trusted publisher, and executes it instantly.

This enables **progressive discovery**:

1. **Search:** The agent finds tools by semantic description
2. **Introspect:** It reads the JSON schema to understand inputs
3. **Learn:** It reads the Markdown documentation for usage nuances
4. **Execute:** It runs the tool in a secure, sandboxed container

The registry is local-first. You can build and run tools entirely offline. The network is optional. When you do publish, hierarchical naming (\`org/category/tool\`) prevents collisions while enabling discovery.

## Trust Without Blind Faith

Executable code from the internet is dangerous. Enact takes this seriously.

Every published tool can be signed using [Sigstore](https://sigstore.dev), the same infrastructure securing npm and PyPI. But Enact goes further. It supports a trust model built on identity:

\`\`\`yaml
# ~/.enact/config.yaml
trust:
  auditors:
    - github:alice
    - github:my-company
  policy: require_attestation
  minimum_attestations: 1
\`\`\`

When you run a tool, Enact verifies:

* The bundle hash matches what was signed
* The signature is valid in Sigstore's transparency log
* The signer is in your trusted auditors list

This is not just author verification. Third-party auditors can attest to tools they've reviewed. A security team can sign off on tools approved for production use. The trust graph is explicit and auditable.

## The MCP Bridge

Because Enact skills use MCP's schema conventions, bridging is trivial:

\`\`\`bash
enact mcp start
\`\`\`

Every Enact skill becomes an MCP tool. The mapping is direct:

| Enact SKILL.md | MCP Tool |
| --- | --- |
| \`name\` | \`name\` |
| \`description\` | \`description\` |
| \`inputSchema\` | \`inputSchema\` |
| \`outputSchema\` | \`outputSchema\` |

The agent sees standard MCP tools. It doesn't know or care that execution happens in a container. Claude, GPT, or any MCP-compatible client can invoke Enact skills without Enact-specific integration.

## Composing the Future

The future of AI isn't just about smarter models. It's about smarter plumbing.

By standardizing how we package, publish, and run agentic tools, we unlock composition. A security audit agent can chain a \`git/clone\` skill, a \`secops/trivy-scan\` skill, and a \`slack/notify\` skill. These can come from three different authors, yet they work together seamlessly because they share a common protocol.

**Composition becomes trivial.** An agent can chain tools without understanding their internals.

**Sharing becomes frictionless.** Found a useful tool? Run it. Want to share yours? Publish it.

**Trust becomes explicit.** Cryptographic verification against identities you've chosen to trust.

**The Self-Evolving Agent.** This is the paradigm shift. Because a Skill is just a file, an agent can *write* a \`SKILL.md\` at runtime. If it encounters a novel problem (e.g., "I need to decode this specific protobuf format"), it can generate the code, wrap it in a Skill definition, run \`enact run\` to test it, and then add it to its own library to be used by a network of agents. **Agents stop being limited by the tools we give them and start building the tools they need.**

## Getting Started

Create a skill:

\`\`\`bash
enact init --tool 

# Edit SKILL.md
enact run .
\`\`\`

Use a published skill:

\`\`\`bash
enact run enact/context7/docs --args '{"library_id": "/vercel/next.js"}'
\`\`\`

Publish your own:

\`\`\`bash
enact publish
enact sign .
\`\`\`

The registry is at [enact.tools](https://enact.tools). The CLI is \`npm install -g @enactprotocol/cli\`.

---

*Published on December 27, 2024*
    `,
  },
  {
    id: "1",
    title: "Introducing Enact: Containerized Tools for Everyone",
    excerpt:
      "Learn about Enact, a new protocol for publishing and executing containerized tools with cryptographic trust.",
    date: "2024-12-15",
    author: "Enact Team",
    slug: "introducing-enact",
    tags: ["announcement", "protocol"],
    content: `
# Introducing Enact: Containerized Tools for Everyone

We're excited to introduce **Enact**, a new protocol for publishing, discovering, and executing containerized tools with cryptographic trust. Enact makes it easy to share executable tools while ensuring they're secure, verifiable, and easy to use.

## The Problem

Today's software ecosystem faces several challenges:

- **Trust Issues**: How do you know a tool is safe to run?
- **Distribution Complexity**: Sharing tools often requires complex setup instructions
- **Version Management**: Keeping track of compatible versions is difficult
- **Execution Environment**: Users need to install dependencies and configure their environment

## The Enact Solution

Enact addresses these challenges with a simple, powerful approach:

### 1. Containerized Tools

Every Enact tool is packaged as a container, ensuring:
- Consistent execution across different environments
- No dependency conflicts
- Isolated execution for security

### 2. Cryptographic Verification

Tools are signed using [Sigstore](https://sigstore.dev), providing:
- Proof of authenticity
- Tamper detection
- Transparent audit logs

### 3. Simple CLI Interface

\`\`\`bash
# Search for tools
enact search <query>

# Install a tool
enact install owner/tool

# Run a tool
enact run owner/tool -- <args>

# Publish your own tool
enact publish
\`\`\`

### 4. AI Agent Friendly

Enact is designed with AI agents in mind. Agents can:
- Discover tools dynamically through search
- Install tools on-demand
- Execute tools with structured input/output
- Verify tool authenticity before execution

## Getting Started

1. **Install the CLI**:
   \`\`\`bash
   npm install -g @enactprotocol/cli
   \`\`\`

2. **Browse Available Tools**:
   Visit [enactprotocol.com/browse](https://enactprotocol.com/browse) to explore the registry

3. **Create Your First Tool**:
   \`\`\`bash
   mkdir my-tool
   cd my-tool
   enact init
   \`\`\`

## What's Next?

We're just getting started! Coming soon:
- Team collaboration features
- Enhanced search capabilities
- More language SDKs

Join us in building the future of tool distribution. Follow our progress on [GitHub](https://github.com/enactprotocol) and share your feedback!

---

*Published on December 15, 2024*
    `,
  },
  {
    id: "2",
    title: "Private Tools: Keep Your Work Secure",
    excerpt:
      "Announcing support for private and unlisted tools, giving you full control over who can access your published tools.",
    date: "2024-12-21",
    author: "Enact Team",
    slug: "private-tools",
    tags: ["feature", "security"],
    content: `
# Private Tools: Keep Your Work Secure

We're excited to announce a major new feature: **private and unlisted tools**. Now you can publish tools that are only accessible to you or your team, while still benefiting from Enact's cryptographic verification and easy distribution.

## Why Private Tools?

Not all tools need to be public. Common use cases include:

- **Internal Company Tools**: Utilities specific to your organization
- **Work-in-Progress**: Tools you're developing but not ready to share
- **Sensitive Operations**: Tools that handle confidential data or operations
- **Client-Specific Tools**: Custom tools for specific customers

## Visibility Options

Enact supports three visibility levels, with **private being the default**:

### Private (Default)
- Only visible to you
- Requires authentication to access
- Complete privacy control
- Ideal for internal tools
- **This is the default when you publish**

### Unlisted
- Not visible in search or browse
- Accessible via direct link
- Requires authentication to install
- Great for selective sharing

### Public
- Visible in search and browse
- Anyone can install and use
- Perfect for open-source tools

## How to Use

Publishing a private tool is simple. It's the default:

\`\`\`bash
# Publish as private (default)
enact publish

# Publish as unlisted
enact publish --unlisted

# Publish as public (visible to everyone)
enact publish --public

# Change visibility of an existing tool
enact visibility owner/tool public
\`\`\`

## Authentication

Private and unlisted tools require authentication:

\`\`\`bash
# Login to Enact
enact auth login

# Now you can install your private tools
enact install owner/private-tool
\`\`\`

## Best Practices

When working with private tools:

1. **Use Clear Naming**: Even private tools benefit from descriptive names
2. **Document Thoroughly**: Your team will thank you
3. **Version Carefully**: Private doesn't mean unversioned
4. **Review Permissions**: Regularly audit who has access

## Looking Ahead

This is just the beginning of our privacy and team collaboration features. Coming soon:

- **Team Workspaces**: Share private tools with your team
- **Fine-Grained Permissions**: Control who can view, install, and modify tools
- **Audit Logs**: Track access to your private tools
- **Organization Management**: Manage tools across your company

## Get Started

Ready to try private tools? [Sign up for Pro](https://enactprotocol.com/pricing) or check out our [documentation](https://enactprotocol.com/docs).

---

*Published on December 21, 2024*
    `,
  },
  {
    id: "3",
    title: "Building Your First Enact Tool",
    excerpt:
      "A step-by-step guide to creating, publishing, and sharing your first containerized tool with Enact.",
    date: "2024-12-10",
    author: "Sarah Chen",
    slug: "building-first-tool",
    tags: ["tutorial", "getting-started"],
    content: `
# Building Your First Enact Tool

Ready to create your first Enact tool? This tutorial will walk you through the entire process, from initialization to publication.

## What We'll Build

We'll create a simple tool called **greeter** that takes a name and returns a personalized greeting. Simple, but it demonstrates all the key concepts.

## Prerequisites

Make sure you have:
- Node.js 18+ installed
- Docker installed and running
- The Enact CLI: \`npm install -g @enactprotocol/cli\`

## Step 1: Initialize Your Tool

Create a new directory and initialize the tool:

\`\`\`bash
mkdir greeter
cd greeter
enact init
\`\`\`

This creates a \`SKILL.md\` manifest file. Let's edit it:

\`\`\`yaml
---
name: greeter
version: 1.0.0
description: A friendly greeting tool
author: your-username
license: MIT
runtime: node:20
---

# Greeter Tool

A simple tool that generates personalized greetings.

## Usage

\\\`\\\`\\\`bash
enact run your-username/greeter -- --name "World"
\\\`\\\`\\\`

## Parameters

- \\\`--name\\\`: The name to greet (required)
- \\\`--formal\\\`: Use formal greeting (optional)
\`\`\`

## Step 2: Create the Tool Logic

Create \`src/index.js\`:

\`\`\`javascript
#!/usr/bin/env node

const args = process.argv.slice(2);
const nameIndex = args.indexOf('--name');
const formal = args.includes('--formal');

if (nameIndex === -1 || nameIndex === args.length - 1) {
  console.error('Error: --name parameter is required');
  process.exit(1);
}

const name = args[nameIndex + 1];
const greeting = formal 
  ? \`Good day, \${name}. How may I assist you?\`
  : \`Hey \${name}! 👋\`;

console.log(greeting);
\`\`\`

## Step 3: Create the Dockerfile

Create a \`Dockerfile\`:

\`\`\`dockerfile
FROM node:20-alpine

WORKDIR /app
COPY src/index.js .

RUN chmod +x index.js

ENTRYPOINT ["node", "index.js"]
\`\`\`

## Step 4: Test Locally

Build and test your container:

\`\`\`bash
docker build -t greeter .
docker run greeter --name "Alice"
# Output: Hey Alice! 👋

docker run greeter --name "Bob" --formal
# Output: Good day, Bob. How may I assist you?
\`\`\`

## Step 5: Publish to Enact

First, login:

\`\`\`bash
enact auth login
\`\`\`

Then publish your tool:

\`\`\`bash
enact publish
\`\`\`

That's it! Your tool is now available at \`your-username/greeter\`.

## Step 6: Use Your Published Tool

Anyone can now use your tool:

\`\`\`bash
enact install your-username/greeter
enact run your-username/greeter -- --name "World"
\`\`\`

## Next Steps

Enhance your tool:

1. **Add JSON output** for better integration
2. **Support multiple languages** for greetings
3. **Add tests** to ensure reliability
4. **Version it** as you make improvements

## Tips for Better Tools

- **Clear Documentation**: Good docs in SKILL.md help users
- **Structured I/O**: Support JSON for machine consumption
- **Error Handling**: Provide helpful error messages
- **Semantic Versioning**: Use semver for version numbers
- **Examples**: Include usage examples in your docs

Check out more [examples](https://enactprotocol.com/browse) for inspiration!

---

*Published on December 10, 2024*
    `,
  },
  {
    id: "4",
    title: "How Enact Ensures Tool Security",
    excerpt:
      "Deep dive into Enact's security model, including Sigstore integration, container isolation, and verification processes.",
    date: "2024-12-05",
    author: "Michael Torres",
    slug: "security-model",
    tags: ["security", "technical"],
    content: `
# How Enact Ensures Tool Security

Security is at the heart of Enact. When you run a tool, you need to trust that it's authentic, unmodified, and safe. Here's how we make that possible.

## The Security Challenge

Running third-party code is inherently risky:

- **Malicious Code**: Tools could contain harmful scripts
- **Supply Chain Attacks**: Dependencies might be compromised
- **Tampering**: Tools could be modified after publication
- **Impersonation**: Attackers could pretend to be trusted authors

## Enact's Multi-Layer Security

### 1. Cryptographic Signing with Sigstore

Every Enact tool can be signed using [Sigstore](https://sigstore.dev):

- **Keyless Signing**: No need to manage private keys
- **Transparent Logs**: All signatures recorded publicly
- **Certificate-Based**: Tied to verified identities
- **Tamper-Proof**: Any modification invalidates the signature

When you install a tool:

\`\`\`bash
enact install owner/tool
# ✓ Verified signature from owner@example.com
# ✓ Published at 2024-12-05T10:30:00Z
# ✓ Certificate chain validated
\`\`\`

### 2. Container Isolation

Tools run in isolated Docker containers:

- **No Host Access**: Tools can't access your files by default
- **Resource Limits**: CPU and memory limits prevent abuse
- **Network Control**: Network access can be restricted
- **Clean Environment**: Each run starts fresh

\`\`\`bash
# Run with no network access
enact run owner/tool --no-network

# Run with limited resources
enact run owner/tool --memory 512m --cpu 0.5
\`\`\`

### 3. Immutable Versioning

Once published, a version never changes:

- **Content Addressing**: Each version has a unique hash
- **Historical Archive**: All versions preserved
- **Rollback Safety**: Can always revert to known-good versions

### 4. Attestation System

Users can attest to tools they trust:

\`\`\`bash
enact attest owner/tool "Reviewed and tested"
\`\`\`

Attestations help others make informed decisions:

- **Community Verification**: See who trusts a tool
- **Reputation Signals**: More attestations = more trust
- **Transparency**: Audit trail of trust decisions

## Best Practices for Tool Authors

1. **Always Sign Your Tools**:
   \`\`\`bash
   enact publish --sign
   \`\`\`

2. **Document Dependencies**: Be clear about what your tool uses

3. **Minimize Permissions**: Request only what you need

4. **Keep It Simple**: Less code = fewer vulnerabilities

5. **Version Carefully**: Use semantic versioning

## Best Practices for Tool Users

1. **Verify Signatures**:
   \`\`\`bash
   enact verify owner/tool
   \`\`\`

2. **Check Attestations**: See who else trusts this tool

3. **Review the Code**: Tools are transparent - look before running

4. **Use Specific Versions**: Pin to tested versions

5. **Limit Permissions**: Use flags like \`--no-network\`

## Security Roadmap

We're continuously improving security:

- **SBOM Generation**: Software bill of materials for every tool
- **Vulnerability Scanning**: Automated security checks
- **Sandboxing Enhancements**: Even stronger isolation
- **Compliance Support**: SOC2, ISO certifications

## Reporting Security Issues

Found a security issue? Please email security@enactprotocol.com

We take security seriously and respond to all reports within 24 hours.

---

*Published on December 5, 2024*
    `,
  },
];

export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((post) => post.slug === slug);
}

export function getAllBlogPosts(): BlogPost[] {
  return blogPosts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

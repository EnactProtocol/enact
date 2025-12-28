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
    id: "6",
    title: "Give Claude Code Superpowers in 5 Minutes",
    excerpt:
      "Learn how to give Claude Code the ability to browse the web, take screenshots, and analyze websites using Enact's containerized tools.",
    date: "2024-12-28",
    author: "Enact Team",
    slug: "claude-code-superpowers",
    tags: ["tutorial", "claude", "getting-started"],
    content: `
# Give Claude Code Superpowers in 5 Minutes

This guide shows you how to give Claude Code the ability to browse the web, take screenshots, and analyze websites - using Enact's containerized tools.

## Step 1: Install Enact

\`\`\`bash
npm install -g enact-cli
\`\`\`

## Step 2: Initialize Your Project

In your project folder, run:

\`\`\`bash
enact init --claude
\`\`\`

This creates an \`AGENTS.md\` file that teaches Claude Code how to use Enact tools. Claude reads this file and immediately knows how to discover and run containerized tools.

## Step 3: Start a Conversation

Now just talk to Claude. Here's a real example:

---

**You:** "Take a screenshot of https://enact.tools and describe what you see."

**Claude:** Let me find a tool that can do that.

*Claude runs \`enact search screenshot\` and finds enact/playwright*

*Then runs \`enact learn enact/playwright\` to understand how to use it*

*Then executes the tool with the screenshot action*

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

*Then executes the scan*

"GitHub.com is using:
- Custom HTTP server (GitHub.com)
- Strict security headers (HSTS, X-Frame-Options: deny)
- Ruby on Rails backend indicators
- Fastly CDN for content delivery"

---

## What Just Happened?

1. Claude read the \`AGENTS.md\` file and learned about Enact
2. It searched for relevant tools using \`enact search\`
3. It learned how to use them with \`enact learn\`
4. It ran the tools in isolated containers
5. It parsed the structured output and explained it to you

You never typed a single Enact command. Claude handled everything.

## Available Tools

| Tool | What it does |
|------|--------------|
| \`enact/playwright\` | Screenshots, text extraction, HTML scraping |
| \`enact/scanner/whatweb\` | Detect web technologies, servers, frameworks |

Browse more at [enact.tools](https://enact.tools)

## Why Containers?

- **No installation** - Playwright needs Chromium, WhatWeb needs Ruby. The containers include everything.
- **Safe execution** - Tools run isolated from your system
- **Consistent results** - Same environment every time

---

Ready? Install Enact, run \`enact init --claude\`, and start asking Claude to browse the web for you.

---

*Published on December 28, 2024*
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

For an AI agent to actually *do* something—deploy an app, scan a codebase for secrets, or resize an image—it needs tools. The [Model Context Protocol (MCP)](https://modelcontextprotocol.io) standardizes how agents communicate with tools. But MCP is for communication, not distribution. It defines how to talk to a server—not how to package, share, or deploy one.

If we want agents to be truly autonomous, we need tools that are as portable as the protocols that describe them.

## What Actually Is a Skill?

Think of a Skill not as a piece of code, but as **an onboarding guide for a new team member**.

If you were hiring a junior developer to "run the weekly security scan," you wouldn't just give them a Python script. You would give them:

1. **The Context:** "This scans for exposed credentials before we deploy."
2. **The Instructions:** "Run it against the repo, review the output, escalate anything critical."
3. **The Tools:** The actual scripts, credentials, and environment needed to do the job.

A Skill packages all of this together. At its simplest, a skill is just a single \`SKILL.md\` file—a Markdown document with YAML frontmatter that defines the schema, instructions, and optionally the execution environment:

\`\`\`
code-reviewer/
└── SKILL.md    # Schema + instructions (no code required)
\`\`\`

Some skills are pure instructions for an LLM to follow. Others execute code in containers. Both are treated the same by the system—transparent, filesystem-based units of capability that an agent can read, understand, and execute.

## The Portability Problem

MCP gives us a standard way to *describe* tools. But to actually *run* an MCP server, you download code from GitHub, install dependencies, configure credentials, and hope it works. The spec supports running servers over stdio, which means many integrations instruct users to download and execute arbitrary code on their local machines.

This creates two problems:

1. **No portability.** The tool interface is portable, but the tool itself is not. Clone the repo, install Python 3.11 (not 3.9), pip install the right packages, configure the environment variables—and if it works on their machine but not yours, good luck debugging.

2. **No trust.** You're running someone else's code with access to your filesystem, your credentials, your everything. There's no verification, no sandboxing, no audit trail.

Enact fixes both. The skill definition includes its own runtime—the container, the dependencies, the command. Share a skill, and the recipient can run it immediately in a sandboxed environment. No setup, no environment mismatch, no blind trust.

## The Skill *Is* The Executable

In Enact, a Skill isn't just a definition. It is a self-contained, executable unit.

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

When you run this—whether on your MacBook, a Linux server, or inside a CI pipeline—Enact uses [Dagger](https://dagger.io) to spin up the exact container environment defined in the skill. It mounts your code, runs the command, and captures the output.

**No dependency hell. No "works on my machine." Just pure, portable capability.**

## The npm Moment for AI

We are building the Enact Registry to be the npm for the AI era.

Imagine an agent that doesn't just rely on the tools you hard-coded for it. Imagine an agent that realizes it needs to scan for secrets, searches the registry for \`secops/secret-scanner\`, verifies the cryptographic signature to ensure it's from a trusted publisher, and executes it instantly.

This enables **progressive discovery**:

1. **Search:** The agent finds tools by semantic description
2. **Introspect:** It reads the JSON schema to understand inputs
3. **Learn:** It reads the Markdown documentation for usage nuances
4. **Execute:** It runs the tool in a secure, sandboxed container

The registry is local-first. You can build and run tools entirely offline—the network is optional. When you do publish, hierarchical naming (\`org/category/tool\`) prevents collisions while enabling discovery.

## Trust Without Blind Faith

Executable code from the internet is dangerous. Enact takes this seriously.

Every published tool can be signed using [Sigstore](https://sigstore.dev), the same infrastructure securing npm and PyPI. But Enact goes further—it supports a trust model built on identity:

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

This isn't just author verification. Third-party auditors can attest to tools they've reviewed. A security team can sign off on tools approved for production use. The trust graph is explicit and auditable.

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

Publishing a private tool is simple—it's the default:

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

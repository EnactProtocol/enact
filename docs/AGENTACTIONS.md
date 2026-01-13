# Agent Actions Specification

**Version: 0.1.1**

**Status: DRAFT**

*This specification is a work in progress and open for feedback.*

---

## Summary

This proposal introduces **Agent Actions** - a standard for defining executable actions that AI agents can discover, understand, and invoke. It extends the existing Skills specification with execution semantics, enabling skills to become directly runnable tools.

The proposal introduces:
1. **SKILL.md** - Agent-facing metadata and documentation (existing, unchanged)
2. **ACTIONS.yaml** - Execution configuration for runnable actions (new)

## Motivation

Current skills are documentation that agents interpret. This works, but has limitations:

- **No execution contract** - Agents rely on prose instructions for CLI syntax, argument formats, and expected outputs
- **No input validation** - Invalid parameters only fail at runtime
- **No secret management** - Credentials handled ad-hoc
- **No portability** - "Works on my machine" problems when sharing

By adding structured execution semantics, skills become **actions** - tools that clients can execute directly, with typed inputs, validated parameters, and secure credential handling.

## Proposed Changes

### 1. SKILL.md (Existing, Unchanged)

The skill manifest remains as-is, serving as agent-facing documentation:

```yaml
---
name: mendable/firecrawl
version: 1.0.0
description: Web scraping toolkit for AI agents
---

# Firecrawl

A suite of tools for scraping, crawling, and searching the web.

## Actions

- **scrape** - Extract content from a single URL
- **crawl** - Recursively discover and scrape pages
- **search** - Search the web and return scraped results

## Usage Tips

- Start with `search` if you don't have a URL
- Use `scrape` for single pages
- Use `crawl` with low depth (2-3) to avoid rate limits
```

### 2. ACTIONS.yaml (New)

A new file that defines how to execute actions. Contains an array of MCP-compatible tool definitions plus execution semantics:

```yaml
# Environment variables and secrets
env:
  API_KEY:
    description: API key for the service
    secret: true
    required: true
  DEBUG:
    description: Enable debug logging
    default: "false"

# Array of executable actions (MCP tool-compatible)
actions:
  - name: scrape
    description: Scrape a single URL to markdown
    command: ["python", "main.py", "scrape", "{{url}}"]
    inputSchema:
      type: object
      required: [url]
      properties:
        url:
          type: string
          description: URL to scrape
    outputSchema:
      type: object
      properties:
        content:
          type: string
        metadata:
          type: object
    annotations:
      anything: true

  - name: crawl
    description: Crawl a site recursively
    command: ["python", "main.py", "crawl", "{{url}}", "--depth", "{{depth}}"]
    inputSchema:
      type: object
      required: [url]
      properties:
        url:
          type: string
        depth:
          type: integer
          default: 2
    outputSchema:
      type: object
      properties:
        pages:
          type: array

  - name: search
    description: Search the web
    command: ["python", "main.py", "search", "{{query}}", "--limit", "{{limit}}"]
    inputSchema:
      type: object
      required: [query]
      properties:
        query:
          type: string
        limit:
          type: integer
          default: 5
```

### 3. Field Definitions

#### Top-Level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `env` | object | No | Environment variables and secrets |
| `actions` | array | Yes | Array of executable action definitions |
| `build` | string or array | No | Build commands (alternative to containerization for compiled projects) |

#### Environment Variable Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | string | No | Human-readable description |
| `secret` | boolean | No | If true, value should be stored securely and masked in logs |
| `required` | boolean | No | If true, execution fails if not set |
| `default` | string | No | Default value if not provided |

#### Action Fields (MCP Tool-Compatible)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Unique identifier for the action |
| `description` | string | Yes | Human-readable description |
| `command` | string or array | Yes | Execution command (see Command Syntax below) |
| `inputSchema` | object | Yes | JSON Schema defining expected parameters |
| `outputSchema` | object | No | JSON Schema defining expected output |
| `annotations` | object | No | MCP-compatible behavioral hints |

#### Command Syntax

Commands can be specified in two forms:

**String form** (simple commands without templates):
```yaml
command: python main.py --version
```

**Array form** (required when using `{{}}` templates):
```yaml
command: ["python", "main.py", "scrape", "{{url}}"]
```

**Template Substitution Requirements**

Clients MUST follow these rules when processing `{{}}` templates:

1. **Single argument substitution**: Each `{{var}}` MUST be replaced with the literal value as a single argument, regardless of content (spaces, quotes, metacharacters)
2. **No shell interpolation**: Template values MUST NOT be passed through a shell interpreter
3. **No argument splitting**: Values MUST NOT be split on whitespace or shell metacharacters
4. **String-form rejection**: Clients MUST reject string-form commands containing `{{}}` templates

This prevents injection attacks where malicious input like `https://evil.com; rm -rf /` could be exploited.

**Default Value Handling**

When a template variable references a property with a `default` value in the `inputSchema`:

1. Clients MUST apply defaults before template substitution
2. If a required property is missing and has no default, execution MUST fail with a validation error
3. If an optional property is missing and has no default, the template `{{var}}` MUST be replaced with an empty string

Examples:
```yaml
# Simple command - string is fine
command: python main.py --help

# With one template variable
command: ["python", "main.py", "scrape", "{{url}}"]

# With multiple template variables
command: ["python", "main.py", "crawl", "{{url}}", "--depth", "{{depth}}"]

# With flags
command: ["node", "cli.js", "--input", "{{file}}", "--format", "{{format}}"]
```

### 4. Execution Modes

**Containerized Execution (Recommended)**: If a `Containerfile` (or `Dockerfile`) is present, clients SHOULD execute commands inside a container. This provides isolation, portability, and security by default.

**Local Execution**: Commands run directly on the host system without sandboxing. This is inherently dangerous—actions have full access to the filesystem, network, and system resources. Clients SHOULD:
- Warn users before executing actions locally
- Require explicit user consent for local execution
- Provide sandboxing options (e.g., OS-level sandboxing, restricted permissions) when containerization isn't available

Clients are responsible for enforcing appropriate security boundaries based on trust level and user preferences.

**Build Step (Optional)**

For projects that require setup before execution, a `build` field can specify commands to run:

```yaml
# ACTIONS.yaml
build:
  - pip install -r requirements.txt
  - npm install
  - npm run build

actions:
  - name: analyze
    command: ["node", "dist/cli.js", "{{file}}"]
    inputSchema: ...
```

Build runs once per environment setup, not per action invocation. Build failures prevent action execution.

### 5. Output Semantics

Actions return results following MCP's tool result conventions.

#### Structured Content

Actions MUST output a JSON object to stdout conforming to `outputSchema`. Clients translate this to MCP's `structuredContent` field:

```json
{
  "structuredContent": {
    "temperature": 22.5,
    "conditions": "Partly cloudy"
  }
}
```

#### Output Validation

If `outputSchema` is provided:
- Clients MUST validate results against the schema
- Results that don't conform MUST be treated as errors

#### Error Handling

Actions use two error reporting mechanisms, following MCP conventions:

**1. Execution Errors** (non-zero exit code): Reported in tool results with `isError: true`:

```json
{
  "content": [
    {
      "type": "text",
      "text": "Failed to fetch weather data: API rate limit exceeded"
    }
  ],
  "isError": true
}
```

Use for: API failures, invalid input data, business logic errors, timeouts.

**2. Protocol Errors**: Standard JSON-RPC errors for infrastructure issues:

```json
{
  "error": {
    "code": -32602,
    "message": "Unknown action: invalid_action_name"
  }
}
```

Use for: Unknown actions, schema validation failures, missing required secrets.

#### Stderr and Logging

- Stderr is captured as logs, not included in the result
- Clients MAY surface stderr separately for debugging purposes

### 6. File Structure

#### Simple Skill (Single Action)
```
my-skill/
├── SKILL.md         # Documentation
├── ACTIONS.yaml     # Execution config
└── main.py          # Implementation
```

#### Multi-Action Skill
```
my-toolkit/
├── SKILL.md           # Skill documentation
├── ACTIONS.yaml       # Multiple actions defined
├── Containerfile      # Optional container definition
├── src/
│   ├── main.py
│   ├── scraper.py
│   └── utils.py
├── package.json
└── requirements.txt
```

### 7. MCP Integration

Actions defined in ACTIONS.yaml map directly to MCP tools:

```
ACTIONS.yaml → MCP Server → MCP Tools
```

Each action becomes an MCP tool with:
- `name` → tool name
- `description` → tool description  
- `inputSchema` → tool parameters
- `outputSchema` → expected response shape
- `annotations` → behavioral hints

This enables automatic exposure of actions as MCP tools without additional configuration.

### 8. Secret Management

The `env` field with `secret: true` integrates with secure credential storage. Clients are responsible for securely storing and injecting secrets at execution time.

Secrets should be:
- Stored securely (e.g., OS keyring, encrypted vault)
- Never written to disk in plaintext or logged
- Validated before execution (if `required: true`)
- Injected into the environment at runtime

### 9. Namespacing and Discovery

Skills use namespaced identifiers (`owner/skill`) to enable discovery and installation from registries. Actions within a skill are referenced as `owner/skill/action`.

Examples:
```
mendable/firecrawl           # The skill
mendable/firecrawl/scrape    # A specific action
mendable/firecrawl/crawl     # Another action
```

This enables clients to:
- **Discover** skills and their available actions
- **Install** skills from a registry for local or containerized execution
- **Run** specific actions by fully-qualified name

Example using [Enact](https://github.com/EnactProtocol/enact), a reference runtime:

```bash
# Learn about a skill and its actions
enact learn mendable/firecrawl

# Install a skill for execution
enact install mendable/firecrawl

# Run a specific action
enact run mendable/firecrawl/scrape --args '{"url": "https://example.com"}'

# Store secrets securely
enact env set FIRECRAWL_API_KEY "sk-xxx" --secret
```

## Backwards Compatibility

All changes are backwards compatible:

- **SKILL.md** remains unchanged - existing skills continue to work
- **ACTIONS.yaml** is optional - skills without it remain documentation-only
- **Containerization** is optional - actions can execute locally without Docker

## Examples

### Example 1: Simple Local Skill

**SKILL.md:**
```yaml
---
name: deploy
description: Deploy the application
---

# Deploy

Deploys to staging or production.
```

**ACTIONS.yaml:**
```yaml
env:
  AWS_ACCESS_KEY_ID:
    secret: true
    required: true
  AWS_SECRET_ACCESS_KEY:
    secret: true
    required: true

actions:
  - name: deploy
    description: Deploy the application
    command: ["./deploy.sh", "{{environment}}"]
    inputSchema:
      type: object
      required: [environment]
      properties:
        environment:
          type: string
          enum: [staging, production]
    outputSchema:
      type: object
      properties:
        url:
          type: string
        version:
          type: string
```

### Example 2: Containerized Multi-Action Skill

**SKILL.md:**
```yaml
---
name: mendable/firecrawl
version: 1.0.0
description: Web scraping toolkit
---

# Firecrawl

Scrape, crawl, and search the web.
```

**Containerfile:**
```dockerfile
FROM python:3.12-slim
WORKDIR /workspace
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
```

**ACTIONS.yaml:**
```yaml
env:
  FIRECRAWL_API_KEY:
    description: Firecrawl API key
    secret: true
    required: true

actions:
  - name: scrape
    description: Scrape a URL to markdown
    command: ["python", "main.py", "scrape", "{{url}}"]
    inputSchema:
      type: object
      required: [url]
      properties:
        url:
          type: string
    outputSchema:
      type: object
      properties:
        content:
          type: string
        metadata:
          type: object

  - name: crawl
    description: Crawl a site
    command: ["python", "main.py", "crawl", "{{url}}", "--depth", "{{depth}}"]
    inputSchema:
      type: object
      required: [url]
      properties:
        url:
          type: string
        depth:
          type: integer
          default: 2

  - name: search
    description: Search the web
    command: ["python", "main.py", "search", "{{query}}"]
    inputSchema:
      type: object
      required: [query]
      properties:
        query:
          type: string
```

## Comparison: Before and After

| Capability | SKILL.md Only | SKILL.md + ACTIONS.yaml |
|------------|---------------|-------------------------|
| Agent reads docs | ✓ | ✓ |
| Typed inputs | ✗ | ✓ |
| Input validation | ✗ | ✓ |
| Structured output | ✗ | ✓ |
| Secret management | ✗ | ✓ |
| Direct execution | ✗ | ✓ |
| MCP tool generation | ✗ | ✓ |
| Containerization | ✗ | ✓ |

## The Progression

```
1. Start simple
   └── SKILL.md only (document your scripts)

2. Add execution
   └── SKILL.md + ACTIONS.yaml (typed inputs, direct execution)

3. Add portability  
   └── SKILL.md + ACTIONS.yaml + Containerfile (containerized)

4. Share publicly
   └── Publish to registry
```

## Prior Art

- **[Agent Skills](https://agentskills.io/)** - The skills specification this proposal extends
- **[MCP Tools](https://modelcontextprotocol.io/)** - Action schema aligns with MCP tool definitions
- **Containerfile/Dockerfile** - Standard container format for execution environment
- **OCI Annotations** - Inspiration for metadata conventions
- **just/make** - Task runner patterns for local execution

## Reference Implementation

[Enact](https://github.com/EnactProtocol/enact) implements this specification with:
- CLI for running actions locally and in containers
- MCP server for exposing actions to AI agents
- Registry for publishing and discovering actions
- Secure credential storage via OS keyring
- Sigstore-based signing and verification

## Feedback Welcome

This proposal aims to make skills executable without breaking existing functionality. We welcome feedback on:

- Field naming and structure
- MCP alignment
- Execution semantics
- Container integration
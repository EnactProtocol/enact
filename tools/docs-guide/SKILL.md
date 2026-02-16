# Enact LLM Guide

Enact: Containerized tools with structured I/O for AI agents.

## Commands

```bash
enact run ./tool --input "key=value"      # Run local tool
enact run ./tool --args '{"key":"value"}' # Run with JSON
enact run author/tool --input "x=y"       # Run installed tool
enact install author/tool                 # Install to project
enact install author/tool -g              # Install globally
enact search "query"                      # Find tools
enact sign ./tool && enact publish ./tool # Publish
```

## Tool Structure

Tools use a two-file model:

```
my-tool/
├── skill.package.yml   # Technical manifest (execution config)
├── SKILL.md     # Agent-facing documentation
└── main.py      # Your code (any language)
```

## skill.package.yml Template

```yaml
enact: "2.0.0"
name: "namespace/category/tool-name"
version: "1.0.0"
description: "What it does"
from: "python:3.12-slim"
build: "pip install requests pandas"
timeout: "30s"

scripts:
  run:
    command: "python /work/main.py {{input}}"
    inputSchema:
      type: object
      properties:
        input:
          type: string
          description: "Input description"
      required: [input]

outputSchema:
  type: object
  properties:
    result:
      type: string

env:
  API_KEY:
    description: "API key"
    secret: true
  LOG_LEVEL:
    description: "Log level"
    default: "info"

tags: [category, keywords]
```

## Field Reference

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | `namespace/category/tool` |
| `description` | Yes | What it does |
| `scripts` | No* | Named scripts with `{{param}}` substitution |
| `from` | No | Docker image (default: `alpine:latest`) |
| `build` | No | Build commands (string or array), cached |
| `inputSchema` | No | JSON Schema for inputs (under each script) |
| `outputSchema` | No | JSON Schema for outputs |
| `env` | No | Environment vars (`secret: true` for keyring) |
| `timeout` | No | Max runtime (default: `30s`) |
| `version` | No | Semver version |
| `tags` | No | Discovery keywords |

*Tools without `scripts` are LLM instruction tools (markdown interpreted by AI).

## Examples by Language

### Python
```yaml
from: "python:3.12-slim"
build: "pip install pandas"
scripts:
  run:
    command: "python /work/main.py {{input}}"
```

### Node.js
```yaml
from: "node:20-alpine"
build: "npm install"
scripts:
  run:
    command: "node /work/index.js {{input}}"
```

### Rust
```yaml
from: "rust:1.83-slim"
build: "rustc /work/main.rs -o /work/app"
scripts:
  run:
    command: "/work/app {{input}}"
```

### Go
```yaml
from: "golang:1.22-alpine"
build: "go build -o /work/app /work/main.go"
scripts:
  run:
    command: "/work/app {{input}}"
```

### Shell (no build)
```yaml
scripts:
  run: "echo {{name}}"
```

## Source Code Pattern

Always output JSON matching `outputSchema`:

```python
#!/usr/bin/env python3
import sys, json

input_val = sys.argv[1]
result = {"result": input_val.upper()}
print(json.dumps(result))
```

## Secrets

```yaml
env:
  API_KEY:
    description: "API key"
    secret: true  # Stored in OS keyring, not .env
```

User sets: `enact env set API_KEY --secret --namespace myorg/tools`

Access in code via environment variable: `os.environ['API_KEY']`

## Two Tool Types

1. **Container tools** (has `scripts`): Runs in Docker, deterministic
2. **Instruction tools** (no `scripts`): Markdown body interpreted by LLM

## Workflow

```bash
# 1. Create
mkdir my-tool && cd my-tool
# Create skill.package.yml, SKILL.md, and source files

# 2. Test
enact run . --input "test=value"

# 3. Publish
enact auth login
enact sign .
enact publish .
```

## Checklist

- [ ] `name`: namespace/category/tool format
- [ ] `description`: clear, searchable
- [ ] `scripts`: named scripts with `{{param}}` substitution
- [ ] `inputSchema`: validates inputs (under each script)
- [ ] `outputSchema`: documents output
- [ ] `from`: pinned image version (not `latest`)
- [ ] `build`: installs dependencies
- [ ] Source outputs valid JSON

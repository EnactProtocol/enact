/**
 * AGENTS.md template for tool development
 */
export const toolAgentsTemplate = `# Enact Tool Development Guide

Enact tools are containerized, cryptographically-signed executables. Each tool is defined by a \`SKILL.md\` file (YAML frontmatter + Markdown docs).

## Quick Reference

| Task | Command |
|------|---------|
| Run with JSON | \`enact run ./ --args '{"key": "value"}'\` |
| Run from file | \`enact run ./ --input-file inputs.json\` |
| Dry run | \`enact run ./ --args '{}' --dry-run\` |
| Sign & publish | \`enact sign ./ && enact publish ./\` |

## SKILL.md Structure

\`\`\`yaml
---
name: {{TOOL_NAME}}
description: What the tool does
version: 1.0.0
enact: "2.0.0"

from: python:3.12-slim            # Docker image (pin versions, not :latest)
build: pip install requests       # Build steps (cached by Dagger)
command: python /workspace/main.py \${input}
timeout: 30s

inputSchema:
  type: object
  properties:
    input:
      type: string
      description: "Input to process"
  required: [input]

outputSchema:
  type: object
  properties:
    result:
      type: string

env:
  API_KEY:
    description: "External API key"
    secret: true                  # Set via: enact env set API_KEY --secret
---
# Tool Name
Documentation here.
\`\`\`

## Field Reference

| Field | Description |
|-------|-------------|
| \`name\` | Hierarchical ID: \`org/category/tool\` |
| \`description\` | What the tool does |
| \`version\` | Semver version |
| \`from\` | Docker image |
| \`build\` | Build commands (string or array, cached) |
| \`command\` | Shell command with \`\${param}\` substitution |
| \`timeout\` | Max execution time (e.g., "30s", "5m") |
| \`inputSchema\` | JSON Schema for inputs |
| \`outputSchema\` | JSON Schema for outputs |
| \`env\` | Environment variables and secrets |

## Parameter Substitution

Enact auto-quotes parameters. **Never manually quote:**

\`\`\`yaml
# WRONG - causes double-quoting
command: python /workspace/main.py "\${input}"

# RIGHT - Enact handles quoting
command: python /workspace/main.py \${input}
\`\`\`

**Optional params:** Missing optional params become empty strings. Always provide defaults:
\`\`\`yaml
inputSchema:
  properties:
    greeting: 
      type: string
      default: "Hello"  # Recommended for optional params
\`\`\`

Or handle empty in shell:
\`\`\`yaml
command: "echo \${greeting:-Hello} \${name}"
\`\`\`

Modifiers:
- \`\${param}\` — auto-quoted (handles spaces, JSON, special chars)
- \`\${param:raw}\` — raw, no quoting (use carefully)

## Output

Output valid JSON to stdout when \`outputSchema\` is defined:

\`\`\`python
import json, sys

try:
    result = do_work()
    print(json.dumps({"status": "success", "result": result}))
except Exception as e:
    print(json.dumps({"status": "error", "message": str(e)}))
    sys.exit(1)  # non-zero = error
\`\`\`

## Build Steps by Language

**Python:**
\`\`\`yaml
from: python:3.12-slim
build: pip install requests pandas
\`\`\`

**Node.js:**
\`\`\`yaml
from: node:20-alpine
build:
  - npm install
  - npm run build
\`\`\`

**Rust:**
\`\`\`yaml
from: rust:1.83-slim
build: rustc /workspace/main.rs -o /workspace/tool
command: /workspace/tool \${input}
\`\`\`

**Go:**
\`\`\`yaml
from: golang:1.22-alpine
build: cd /workspace && go build -o tool main.go
command: /workspace/tool \${input}
\`\`\`

**System packages:**
\`\`\`yaml
build: apt-get update && apt-get install -y libfoo-dev
\`\`\`

Build steps are cached — first run slow, subsequent runs instant.

## File Access

Tools run in a container with \`/workspace\` as the working directory. All source files are copied there.

## Secrets

Declare in \`SKILL.md\`:
\`\`\`yaml
env:
  API_KEY:
    description: "API key for service"
    secret: true
\`\`\`

Set before running:
\`\`\`bash
enact env set API_KEY --secret --namespace {{TOOL_NAME}}
\`\`\`

Access in code:
\`\`\`python
import os
api_key = os.environ.get('API_KEY')
\`\`\`

## LLM Instruction Tools

Tools without a \`command\` field are interpreted by LLMs:

\`\`\`yaml
---
name: myorg/ai/reviewer
description: AI-powered code review
inputSchema:
  type: object
  properties:
    code: { type: string }
  required: [code]
outputSchema:
  type: object
  properties:
    issues: { type: array }
    score: { type: number }
---
# Code Reviewer

You are a senior engineer. Review the code for bugs, style, and security.
Return JSON: {"issues": [...], "score": 75}
\`\`\`

## Publishing Checklist

- [ ] \`name\` follows \`namespace/category/tool\` pattern
- [ ] \`version\` set (semver)
- [ ] \`description\` is clear and searchable
- [ ] \`inputSchema\` / \`outputSchema\` defined
- [ ] \`from\` uses pinned image version
- [ ] \`timeout\` set appropriately
- [ ] Tool tested locally with \`enact run ./\`

## Troubleshooting

\`\`\`bash
enact run ./ --args '{"x": "y"}' --verbose   # Verbose output
enact run ./ --args '{}' --dry-run             # Preview command
enact list                                      # List installed tools
\`\`\`
`;

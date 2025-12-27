# Enact LLM Agent Guide (Compact)

A concise guide for LLM agents to create, publish, and run Enact tools.

## Overview

Enact is a protocol for creating **containerized tools** that run in Docker via Dagger. Tools:

- Run in isolated containers with reproducible environments
- Support any language (Python, Rust, Node.js, Go, Ruby, etc.)
- Include cached build steps for dependencies
- Are cryptographically signed via Sigstore
- Have structured JSON schemas for inputs/outputs

## Quick Reference

| Task | Command |
|------|---------|
| Run local tool | `enact run ./my-tool --input "key=value"` |
| Run with JSON | `enact run ./my-tool --args '{"key": "value"}'` |
| Install from registry | `enact install author/category/tool` |
| Install globally | `enact install author/category/tool --global` |
| Sign for publishing | `enact sign ./my-tool` |
| Publish to registry | `enact publish ./my-tool` |
| Search tools | `enact search "query"` |
| Learn about a tool | `enact learn author/category/tool` |

---

## Creating Tools

### Minimal Structure

```
my-tool/
└── SKILL.md
```

### The `SKILL.md` File

A Markdown file with YAML frontmatter (metadata) and body (documentation).

#### Minimal Example

```markdown
---
name: "myorg/utils/greeter"
description: "Greets a user by name"
command: "echo 'Hello, ${name}!'"
inputSchema:
  type: object
  properties:
    name:
      type: string
  required:
    - name
---

# Greeter

A simple tool that greets users.
```

#### Complete Example

```markdown
---
enact: "2.0.0"
name: "myorg/tools/data-processor"
version: "1.0.0"
description: "Processes CSV data and outputs JSON"
license: "MIT"

from: "python:3.12-slim"
build: "pip install pandas"
command: "python /workspace/process.py ${input_file} ${operation}"
timeout: "5m"

tags:
  - data
  - csv

inputSchema:
  type: object
  properties:
    input_file:
      type: string
      description: "Path to input CSV file"
    operation:
      type: string
      enum: ["summarize", "filter", "transform"]
      default: "summarize"
  required:
    - input_file

outputSchema:
  type: object
  properties:
    status:
      type: string
    result:
      type: object

env:
  LOG_LEVEL:
    description: "Logging verbosity"
    default: "info"
  API_KEY:
    description: "External API key"
    secret: true

annotations:
  readOnlyHint: false
  destructiveHint: false
  idempotentHint: true
  openWorldHint: true

authors:
  - name: "Your Name"
    email: "you@example.com"
---

# Data Processor

Processes CSV files and outputs structured JSON.
```

---

## Field Reference

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Hierarchical identifier: `org/category/tool-name` |
| `description` | string | What the tool does |

### Common Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enact` | string | `"2.0.0"` | Protocol version |
| `version` | string | `"0.0.0"` | Tool version (semver) |
| `command` | string | - | Shell command with `${param}` substitution |
| `from` | string | `"alpine:latest"` | Docker image |
| `build` | string/array | - | Build commands (cached) |
| `timeout` | string | `"30s"` | Max execution time |
| `license` | string | - | SPDX identifier |
| `tags` | array | `[]` | Discovery keywords |

### Schema Fields

| Field | Type | Description |
|-------|------|-------------|
| `inputSchema` | object | JSON Schema for inputs |
| `outputSchema` | object | JSON Schema for outputs |

### Environment Variables

```yaml
env:
  VARIABLE_NAME:
    description: "What this is for"
    secret: false          # false = .env file, true = OS keyring
    default: "value"       # Only for non-secrets
```

### Annotations

```yaml
annotations:
  title: "Display Name"
  readOnlyHint: true       # Doesn't modify environment
  destructiveHint: false   # Makes irreversible changes
  idempotentHint: true     # Same result on repeated runs
  openWorldHint: false     # Interacts with external systems
```

### Parameter Substitution

Enact auto-quotes parameters. **Don't add quotes in templates:**

```yaml
# WRONG - causes double-quoting
command: "python /workspace/main.py '${input}'"

# RIGHT - Enact handles quoting
command: "python /workspace/main.py ${input}"
```

**Modifiers:**
- `${param}` - Normal substitution with auto-quoting
- `${param:raw}` - Raw substitution, no quoting

---

## Tool Types

### Container-Executed Tools

Tools with a `command` field run in Docker containers.

**Use when:**
- Deterministic, reproducible execution needed
- Specific runtime required (Python, Node, Rust, etc.)
- External dependencies needed
- Heavy computation or file processing

**Example: Python Tool**

```
text-analyzer/
├── SKILL.md
└── analyze.py
```

**SKILL.md:**
```markdown
---
enact: "2.0.0"
name: "myorg/nlp/text-analyzer"
version: "1.0.0"
description: "Analyzes text for sentiment"
from: "python:3.12-slim"
build: "pip install textblob"
command: "python /workspace/analyze.py ${text}"
timeout: "2m"

inputSchema:
  type: object
  properties:
    text:
      type: string
  required:
    - text

outputSchema:
  type: object
  properties:
    sentiment:
      type: number
---

# Text Analyzer
```

**analyze.py:**
```python
#!/usr/bin/env python3
import sys
import json
from textblob import TextBlob

text = sys.argv[1]
blob = TextBlob(text)
print(json.dumps({"sentiment": blob.sentiment.polarity}))
```

### LLM-Driven Tools (Instruction Tools)

Tools **without** a `command` field are interpreted by LLMs.

**Use when:**
- Complex reasoning required
- Flexible, context-aware responses needed
- Multi-step workflows
- Human-like analysis needed

**Example: Code Reviewer**

```markdown
---
enact: "2.0.0"
name: "myorg/ai/code-reviewer"
version: "1.0.0"
description: "AI-powered code review"

inputSchema:
  type: object
  properties:
    code:
      type: string
    language:
      type: string
      default: "auto"
  required:
    - code

outputSchema:
  type: object
  properties:
    issues:
      type: array
    score:
      type: number

annotations:
  readOnlyHint: true
---

# Code Reviewer

You are a senior software engineer. Review the provided code for:

1. **Bugs**: Logic errors, null checks, edge cases
2. **Style**: Naming, organization, readability
3. **Performance**: Efficiency issues
4. **Security**: Injection, secrets, unsafe operations

Return JSON:
```json
{
  "issues": [{"severity": "error", "line": 5, "message": "...", "suggestion": "..."}],
  "score": 75
}
```
```

---

## Language Templates

### Python

```
my-tool/
├── SKILL.md
└── main.py
```

**SKILL.md:**
```markdown
---
name: "myorg/python/my-tool"
description: "A Python tool"
from: "python:3.12-slim"
build: "pip install requests"
command: "python /workspace/main.py ${input}"

inputSchema:
  type: object
  properties:
    input:
      type: string
  required:
    - input
---
```

**main.py:**
```python
#!/usr/bin/env python3
import sys, json
input_value = sys.argv[1]
print(json.dumps({"result": input_value.upper()}))
```

### Node.js

```
my-tool/
├── SKILL.md
└── index.js
```

**SKILL.md:**
```markdown
---
name: "myorg/node/my-tool"
description: "A Node.js tool"
from: "node:20-alpine"
command: "node /workspace/index.js ${input}"

inputSchema:
  type: object
  properties:
    input:
      type: string
  required:
    - input
---
```

**index.js:**
```javascript
const input = process.argv[2];
console.log(JSON.stringify({ result: input.toUpperCase() }));
```

### Rust

```
my-tool/
├── SKILL.md
└── main.rs
```

**SKILL.md:**
```markdown
---
name: "myorg/rust/my-tool"
description: "A Rust tool"
from: "rust:1.83-slim"
build: "rustc /workspace/main.rs -o /workspace/tool"
command: "/workspace/tool ${input}"

inputSchema:
  type: object
  properties:
    input:
      type: string
  required:
    - input
---
```

**main.rs:**
```rust
use std::env;
fn main() {
    let input = env::args().nth(1).unwrap_or_default();
    println!("{{\"result\": \"{}\"}}", input.to_uppercase());
}
```

### Go

```
my-tool/
├── SKILL.md
└── main.go
```

**SKILL.md:**
```markdown
---
name: "myorg/go/url-checker"
description: "Checks URL accessibility"
from: "golang:1.22-alpine"
build: "cd /work && go build -o checker main.go"
command: "/workspace/checker ${url}"
timeout: "30s"

inputSchema:
  type: object
  properties:
    url:
      type: string
  required:
    - url

outputSchema:
  type: object
  properties:
    url:
      type: string
    status:
      type: integer
    reachable:
      type: boolean

annotations:
  readOnlyHint: true
  openWorldHint: true
---
```

**main.go:**
```go
package main

import (
    "encoding/json"
    "fmt"
    "net/http"
    "os"
    "time"
)

type Result struct {
    URL       string `json:"url"`
    Status    int    `json:"status"`
    Reachable bool   `json:"reachable"`
    Error     string `json:"error,omitempty"`
}

func main() {
    url := os.Args[1]
    client := &http.Client{Timeout: 10 * time.Second}
    resp, err := client.Get(url)

    result := Result{URL: url}
    if err != nil {
        result.Error = err.Error()
    } else {
        result.Status = resp.StatusCode
        result.Reachable = resp.StatusCode >= 200 && resp.StatusCode < 400
        resp.Body.Close()
    }

    output, _ := json.Marshal(result)
    fmt.Println(string(output))
}
```

### Shell (No Dependencies)

```markdown
---
name: "myorg/utils/simple-tool"
description: "A simple shell tool"
command: "echo 'Hello, ${name}!'"

inputSchema:
  type: object
  properties:
    name:
      type: string
      default: "World"
---
```

---

## Working with Secrets

### Declaring Secrets

```yaml
env:
  API_KEY:
    description: "API key for external service"
    secret: true
```

### Setting Secrets (User Action)

```bash
enact env set API_KEY --secret --namespace myorg/tools
```

### Using in Code

Secrets are injected as environment variables:

```python
import os
api_key = os.environ.get('API_KEY')
```

### Namespace Inheritance

Secrets walk up the tool path:
```
Tool: myorg/api/slack/notifier
Lookup: myorg/api/slack → myorg/api → myorg
```

---

## Development Workflow

### 1. Create

```bash
mkdir my-tool && cd my-tool
# Create SKILL.md and source files
```

### 2. Test Locally

```bash
enact run . --input "name=Test"
enact run . --args '{"name": "Test"}'
enact run . --input "name=Test" --dry-run
```

### 3. Install Locally

```bash
enact install .              # Project-local
enact install . --global     # Global
enact run myorg/tools/my-tool --input "name=Test"
```

### 4. Sign and Publish

```bash
enact auth login
enact sign .
enact publish .
```

---

## Publishing Checklist

- [ ] `name` follows `namespace/category/tool` pattern
- [ ] `version` is set (semver)
- [ ] `description` is clear
- [ ] `inputSchema` validates all inputs
- [ ] `outputSchema` documents output
- [ ] `license` specified
- [ ] `tags` include keywords
- [ ] `from` uses pinned image version
- [ ] `timeout` set appropriately
- [ ] Tool tested locally

---

## Common Patterns

### Build Steps

Single command:
```yaml
build: "pip install pandas numpy"
```

Multiple commands:
```yaml
build:
  - "apt-get update && apt-get install -y libpq-dev"
  - "pip install -r requirements.txt"
```

### JSON I/O Pattern

```python
import sys, json

input_data = json.loads(sys.argv[1])
result = process(input_data)
print(json.dumps(result))
```

### Multi-Step Build

```yaml
from: "node:20-alpine"
build:
  - "npm install"
  - "npm run build"
command: "node /workspace/dist/index.js ${input}"
```

### Structured Output

```python
import json, sys

try:
    result = do_work()
    print(json.dumps({"status": "success", "data": result}))
except Exception as e:
    print(json.dumps({"status": "error", "message": str(e)}))
    sys.exit(1)
```

---

## Troubleshooting

### Tool Not Found

```bash
enact list
enact list --global
enact install author/tool --force
```

### Container Build Fails

```bash
enact run ./my-tool --input "x=y" --verbose
```

### Secrets Not Available

```bash
enact env get API_KEY --secret --namespace myorg/tools
enact env set API_KEY --secret --namespace myorg/tools
```

### Input Validation Errors

```bash
enact run ./my-tool --args '{"key": "value"}' --dry-run
```

---

## Best Practices

### Creating Tools

1. Always include `inputSchema` and `outputSchema`
2. Use descriptive names: `myorg/data/csv-parser` not `myorg/parser`
3. Add tags for discovery
4. Write clear documentation in the markdown body

### Running Tools

1. Validate inputs against schema before running
2. Handle errors gracefully
3. Use `--dry-run` to verify commands

### Publishing

1. Test thoroughly with various inputs
2. Pin image versions (not `latest`)
3. Sign tools for trust verification
4. Use semver for version updates

---

## Complete Examples

### URL Shortener

```markdown
---
enact: "2.0.0"
name: "examples/utils/url-shortener"
version: "1.0.0"
description: "Creates short URLs"
from: "python:3.12-slim"
build: "pip install requests"
command: "python /workspace/shorten.py ${url}"
timeout: "30s"

inputSchema:
  type: object
  properties:
    url:
      type: string
  required:
    - url

outputSchema:
  type: object
  properties:
    short_url:
      type: string
    original_url:
      type: string

env:
  SHORTENER_API_KEY:
    description: "API key for URL shortening service"
    secret: true

tags:
  - url
  - utility
---

# URL Shortener
```

### TypeScript Formatter

```
ts-formatter/
├── SKILL.md
├── package.json
├── tsconfig.json
└── src/index.ts
```

**SKILL.md:**
```markdown
---
enact: "2.0.0"
name: "myorg/dev/ts-formatter"
version: "1.0.0"
description: "Formats TypeScript code"
from: "node:20-alpine"
build:
  - "cd /work && npm install"
  - "cd /work && npm run build"
command: "node /workspace/dist/index.js ${code}"

inputSchema:
  type: object
  properties:
    code:
      type: string
  required:
    - code

outputSchema:
  type: object
  properties:
    formatted:
      type: string
    changes:
      type: boolean
---
```

**src/index.ts:**
```typescript
import * as prettier from 'prettier';

const code = process.argv[2];

async function format() {
  const formatted = await prettier.format(code, { parser: 'typescript' });
  console.log(JSON.stringify({ formatted, changes: formatted !== code }));
}

format();
```

### LLM Instruction Tool

```markdown
---
enact: "2.0.0"
name: "examples/ai/summarizer"
version: "1.0.0"
description: "Summarizes text into key points"

inputSchema:
  type: object
  properties:
    text:
      type: string
    max_points:
      type: integer
      default: 5
  required:
    - text

outputSchema:
  type: object
  properties:
    summary:
      type: string
    key_points:
      type: array
      items:
        type: string

annotations:
  readOnlyHint: true
---

# Text Summarizer

You are a summarization expert. Given text:

1. Read carefully
2. Identify main topic and key points
3. Create a brief summary paragraph
4. Extract up to `max_points` bullet points

Return JSON:
```json
{
  "summary": "Brief paragraph",
  "key_points": ["Point 1", "Point 2"]
}
```
```

---

## Summary

| Action | Command |
|--------|---------|
| Create | Write `SKILL.md` with YAML frontmatter |
| Test | `enact run ./my-tool --input "key=value"` |
| Install | `enact install .` or `enact install . --global` |
| Sign | `enact sign .` |
| Publish | `enact publish .` |
| Discover | `enact search "query"` |
| Run | `enact run author/tool --args '{...}'` |

**Key distinction:** Container tools have a `command` field. Instruction tools omit `command` and are interpreted by LLMs.

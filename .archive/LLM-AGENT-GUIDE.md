# Enact LLM Agent Guide

A comprehensive guide for LLM agents to create, publish, install, and run Enact tools.

## Overview

Enact is a protocol for creating **full, production-ready containerized tools** that can be built, executed, and distributed. Unlike simple CLI wrappers, Enact tools:

- **Run in isolated Docker containers** with reproducible environments
- **Support any programming language** (Python, Rust, Node.js, Go, Ruby, etc.)
- **Include build steps** that compile code, install dependencies, and prepare environments
- **Are cryptographically signed** for trust and verification
- **Can be discovered and shared** via a central registry at [enact.tools](https://enact.tools)
- **Have structured schemas** for inputs and outputs, enabling AI agents to use them reliably

**Enact tools are real software** - they can process files, call APIs, run ML models, compile code, and perform any task a containerized application can do.

As an LLM agent, you can:

1. **Create** tools by writing `SKILL.md` files with YAML frontmatter + source code
2. **Build and Run** tools in isolated containers with dependencies
3. **Sign** tools cryptographically for trust
4. **Publish** tools to the registry for discovery
5. **Install** tools from the registry
6. **Execute** tools with structured inputs and receive structured outputs

---

## What Can Enact Tools Do?

Enact tools are **real software** running in containers. They can:

### Computation & Processing
- Run ML/AI models (PyTorch, TensorFlow, scikit-learn)
- Process images, audio, video (ffmpeg, PIL, OpenCV)
- Parse and transform data (pandas, jq, custom parsers)
- Compile and execute code (any language)

### External Interactions
- Call REST/GraphQL APIs
- Query databases (PostgreSQL, MongoDB, Redis)
- Send notifications (Slack, email, webhooks)
- Interact with cloud services (AWS, GCP, Azure)

### File Operations
- Read and write files
- Generate documents (PDF, DOCX, images)
- Process archives (zip, tar, gzip)
- Convert between formats

### Development Tools
- Lint and format code
- Run tests
- Generate documentation
- Static analysis

### Examples of Real Tools
- **PDF Extractor**: Extracts text and tables from PDFs using Python + pdfplumber
- **Image Resizer**: Resizes images using Go + imaging library
- **API Client**: Calls external APIs with authentication
- **Code Formatter**: Formats code using language-specific tools (prettier, black, rustfmt)
- **Data Pipeline**: Transforms CSV → JSON using pandas
- **Sentiment Analyzer**: Analyzes text using NLP libraries

---

## What Makes Enact Different

Enact is **not** just a way to wrap shell commands. It's a complete tool distribution system:

| Feature | Description |
|---------|-------------|
| **Containerized Execution** | Tools run in Docker containers via Dagger, ensuring reproducibility |
| **Build Steps** | Compile Rust, install Python packages, run npm build - all cached for speed |
| **Any Language** | Python, Rust, Go, Node.js, Ruby, Java, C++ - if it runs in a container, it works |
| **Dependency Management** | Tools declare and install their own dependencies in isolation |
| **Structured I/O** | JSON Schema validates inputs/outputs for reliable AI integration |
| **Cryptographic Trust** | Sigstore signing ensures tools haven't been tampered with |
| **Registry Distribution** | Publish once, install anywhere with `enact install` |

### Example: A Real Tool

Here's a Rust tool that gets compiled and executed:

```
hello-rust/
├── SKILL.md      # Tool manifest
└── hello.rs      # Rust source code
```

**SKILL.md:**
```yaml
---
name: myorg/hello-rust
version: 1.0.0
description: A compiled Rust greeting tool
from: "rust:1.83-slim"
build: "rustc /workspace/hello.rs -o /workspace/hello"
command: "/workspace/hello ${name}"

inputSchema:
  type: object
  properties:
    name:
      type: string
      default: World
---

# Hello Rust

A simple Rust tool that greets you by name.
```

**hello.rs:**
```rust
use std::env;
fn main() {
    let name = env::args().nth(1).unwrap_or_else(|| "World".to_string());
    println!("Hello, {}! 🦀", name);
}
```

When you run `enact run ./hello-rust --args '{"name": "Alice"}'`:
1. Dagger pulls the `rust:1.83-slim` container
2. The `build` step compiles `hello.rs` → `hello` (cached for future runs)
3. The `command` executes the compiled binary with the input
4. Output is returned to you

**This is real compilation, real execution, in an isolated environment.**

---

## Quick Reference

| Task | Command |
|------|---------|
| Create new tool | `enact init --tool` |
| Run local tool | `enact run ./ --args '{"key": "value"}'` |
| Run from registry | `enact run author/tool --args '{"key": "value"}'` |
| Learn about a tool | `enact learn author/tool` |
| Search tools | `enact search "query"` |
| Install from registry | `enact install author/tool` |
| Install globally | `enact install author/tool --global` |
| Sign for publishing | `enact sign ./` |
| Publish to registry | `enact publish ./` |

---

## Part 1: Creating an Enact Tool

### Quick Start

The fastest way to create a new tool:

```bash
# Create a new tool in the current directory
enact init --tool

# This creates:
# - SKILL.md (tool manifest)
# - AGENTS.md (development guide for AI agents)
```

### Minimal Tool Structure

Every Enact tool needs at minimum:
```
my-tool/
├── SKILL.md          # Tool manifest (required)
└── main.py           # Your code (any language)
```

### The `SKILL.md` File

This is a Markdown file with YAML frontmatter. The frontmatter contains machine-readable metadata, and the body contains human-readable documentation.

> **Note:** `SKILL.md` is the primary format, aligned with Anthropic's Agent Skills. Legacy formats (`enact.md`, `enact.yaml`) are still supported.

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

#### Complete Example with All Fields

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
  - transformation

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
    description: "External API key for enrichment"
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

## Usage

```bash
enact run myorg/tools/data-processor --input "input_file=data.csv" --input "operation=summarize"
```

## Operations

- **summarize**: Generate statistics about the data
- **filter**: Filter rows based on criteria
- **transform**: Apply transformations to columns
```

---

## Part 2: Field Reference

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Hierarchical identifier: `org/category/tool-name` |
| `description` | string | What the tool does |

### Recommended Fields

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `enact` | string | Protocol version | `"2.0.0"` |
| `version` | string | Tool version (semver) | `"0.0.0"` |
| `command` | string | Shell command with `${param}` substitution (auto-quoted) | - |
| `from` | string | Docker image | `"alpine:latest"` |
| `build` | string/array | Build commands (cached) | - |
| `timeout` | string | Max execution time | `"30s"` |
| `license` | string | SPDX identifier | - |
| `tags` | array | Discovery keywords | `[]` |

### Schema Fields

| Field | Type | Description |
|-------|------|-------------|
| `inputSchema` | object | JSON Schema for inputs |
| `outputSchema` | object | JSON Schema for outputs |

### Environment Fields

```yaml
env:
  VARIABLE_NAME:
    description: "What this is for"
    secret: false          # false = .env file, true = OS keyring
    default: "value"       # Only for non-secrets
```

### Annotation Fields

```yaml
annotations:
  title: "Display Name"
  readOnlyHint: true       # Doesn't modify environment
  destructiveHint: false   # Makes irreversible changes
  idempotentHint: true     # Same result on repeated runs
  openWorldHint: false     # Interacts with external systems
```

### Parameter Substitution

Enact automatically shell-escapes parameter values to prevent injection and handle special characters like spaces, quotes, and JSON.

**Important: Do NOT add quotes around parameters in your command template:**

```yaml
# WRONG - causes double-quoting issues
command: "python /workspace/main.py '${input}'"

# RIGHT - Enact handles quoting automatically
command: "python /workspace/main.py ${input}"
```

**Modifiers:**
- `${param}` - Normal substitution with auto-quoting
- `${param:raw}` - Raw substitution, no quoting (use carefully for special cases)

**Examples:**
| Input Value | Template | Result |
|-------------|----------|--------|
| `hello` | `echo ${msg}` | `echo hello` |
| `hello world` | `echo ${msg}` | `echo 'hello world'` |
| `{"key":"value"}` | `echo ${json}` | `echo '{"key":"value"}'` |

---

## Part 3: Tool Types

### Type 1: Container-Executed Tools

Tools with a `command` field run in isolated Docker containers powered by Dagger. These are **real applications** that can:

- Compile and run any programming language
- Install and use any dependencies
- Process files, call APIs, run ML models
- Perform complex computations
- Access secrets securely

**When to use:**
- Deterministic, reproducible execution needed
- Tool requires specific runtime (Python, Node, Rust, Go, etc.)
- External dependencies needed (pip packages, npm modules, system libraries)
- Sandboxed execution required for security
- Heavy computation or file processing

**Example: Python ML Tool with Dependencies**

```markdown
---
enact: "2.0.0"
name: "myorg/ai/text-analyzer"
version: "1.0.0"
description: "Analyzes text for sentiment and entities"
from: "python:3.12-slim"
build: "pip install textblob spacy && python -m spacy download en_core_web_sm"
command: "python /workspace/analyze.py ${text}"
timeout: "2m"

inputSchema:
  type: object
  properties:
    text:
      type: string
      description: "Text to analyze"
  required:
    - text

outputSchema:
  type: object
  properties:
    sentiment:
      type: number
    entities:
      type: array
---

# Text Analyzer

Analyzes text using NLP.
```

With `analyze.py`:
```python
#!/usr/bin/env python3
import sys
import json
from textblob import TextBlob

text = sys.argv[1]
blob = TextBlob(text)

result = {
    "sentiment": blob.sentiment.polarity,
    "entities": []  # Add spacy NER here
}

print(json.dumps(result))
```

### Type 2: LLM-Driven Tools (Instruction Tools)

Tools **without** a `command` field are interpreted by LLMs.

**When to use:**
- Complex reasoning required
- Flexible, context-aware responses
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
      description: "Code to review"
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
3. **Performance**: Efficiency, unnecessary work
4. **Security**: Injection, secrets, unsafe operations

## Process

1. Identify the language
2. Understand the code's purpose
3. Find issues (error/warning/info severity)
4. Provide fix suggestions
5. Score 0-100

## Output Format

Return JSON:
```json
{
  "issues": [
    {"severity": "error", "line": 5, "message": "...", "suggestion": "..."}
  ],
  "score": 75
}
```
```

---

## Part 4: Real-World Tool Examples

### Python Tool with Dependencies

A complete Python tool that uses external libraries:

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
description: "Analyzes text for sentiment, entities, and key phrases"
from: "python:3.12-slim"
build:
  - "pip install textblob spacy"
  - "python -m spacy download en_core_web_sm"
command: "python /workspace/analyze.py ${text}"
timeout: "2m"

inputSchema:
  type: object
  properties:
    text:
      type: string
      description: "Text to analyze"
  required:
    - text

outputSchema:
  type: object
  properties:
    sentiment:
      type: number
      description: "Sentiment score from -1 (negative) to 1 (positive)"
    entities:
      type: array
      items:
        type: object
        properties:
          text:
            type: string
          label:
            type: string

tags:
  - nlp
  - sentiment
  - analysis
---

# Text Analyzer

Analyzes text using NLP libraries (TextBlob + spaCy).

## What It Does

1. Calculates sentiment polarity (-1 to 1)
2. Extracts named entities (people, places, organizations)
3. Returns structured JSON for further processing
```

**analyze.py:**
```python
#!/usr/bin/env python3
import sys
import json
import spacy
from textblob import TextBlob

# Load spaCy model
nlp = spacy.load("en_core_web_sm")

text = sys.argv[1]

# Sentiment analysis
blob = TextBlob(text)
sentiment = blob.sentiment.polarity

# Named entity recognition
doc = nlp(text)
entities = [{"text": ent.text, "label": ent.label_} for ent in doc.ents]

result = {
    "sentiment": sentiment,
    "entities": entities
}

print(json.dumps(result))
```

**Usage:**
```bash
enact run ./text-analyzer --input "text=Apple Inc. announced new products in California. Customers are excited!"
# Output: {"sentiment": 0.2, "entities": [{"text": "Apple Inc.", "label": "ORG"}, {"text": "California", "label": "GPE"}]}
```

### Node.js Tool with Build Step

A TypeScript tool that compiles before running:

```
ts-formatter/
├── SKILL.md
├── package.json
├── tsconfig.json
└── src/
    └── index.ts
```

**SKILL.md:**
```markdown
---
enact: "2.0.0"
name: "myorg/dev/ts-formatter"
version: "1.0.0"
description: "Formats TypeScript code using Prettier"
from: "node:20-alpine"
build:
  - "cd /work && npm install"
  - "cd /work && npm run build"
command: "node /workspace/dist/index.js ${code}"
timeout: "30s"

inputSchema:
  type: object
  properties:
    code:
      type: string
      description: "TypeScript code to format"
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

# TypeScript Formatter

Formats TypeScript code using Prettier with sensible defaults.
```

**src/index.ts:**
```typescript
import * as prettier from 'prettier';

const code = process.argv[2];

async function format() {
  const formatted = await prettier.format(code, { parser: 'typescript' });
  const changes = formatted !== code;
  console.log(JSON.stringify({ formatted, changes }));
}

format();
```

### Go Tool (Compiled Binary)

A Go tool that compiles to a native binary:

```
url-checker/
├── SKILL.md
└── main.go
```

**SKILL.md:**
```markdown
---
enact: "2.0.0"
name: "myorg/utils/url-checker"
version: "1.0.0"
description: "Checks if URLs are accessible and returns status codes"
from: "golang:1.22-alpine"
build: "cd /work && go build -o checker main.go"
command: "/workspace/checker ${url}"
timeout: "30s"

inputSchema:
  type: object
  properties:
    url:
      type: string
      description: "URL to check"
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
    error:
      type: string

annotations:
  readOnlyHint: true
  openWorldHint: true

tags:
  - http
  - utility
  - network
---

# URL Checker

Checks if a URL is reachable and returns the HTTP status code.
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
        result.Reachable = false
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

### Ruby Tool with Gems

```
markdown-to-html/
├── SKILL.md
└── convert.rb
```

**SKILL.md:**
```markdown
---
enact: "2.0.0"
name: "myorg/docs/markdown-to-html"
version: "1.0.0"
description: "Converts Markdown to HTML with syntax highlighting"
from: "ruby:3.3-slim"
build: "gem install kramdown rouge"
command: "ruby /workspace/convert.rb"
timeout: "30s"

inputSchema:
  type: object
  properties:
    markdown:
      type: string
      description: "Markdown content to convert"
  required:
    - markdown

outputSchema:
  type: object
  properties:
    html:
      type: string
---

# Markdown to HTML Converter

Converts Markdown to HTML using Kramdown with Rouge syntax highlighting.
```

**convert.rb:**
```ruby
#!/usr/bin/env ruby
require 'kramdown'
require 'rouge'
require 'json'

markdown = ARGV[0]
html = Kramdown::Document.new(markdown, syntax_highlighter: :rouge).to_html

puts JSON.generate({ html: html })
```

---

## Part 5: Language-Specific Quick Templates

These are minimal templates. See Part 4 for complete examples with build steps.

### Python Tool

```
my-python-tool/
├── SKILL.md
└── main.py
```

**SKILL.md:**
```markdown
---
enact: "2.0.0"
name: "myorg/python/my-tool"
version: "1.0.0"
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

# My Python Tool
```

**main.py:**
```python
#!/usr/bin/env python3
import sys
import json

input_value = sys.argv[1]
result = {"processed": input_value.upper()}
print(json.dumps(result))
```

### Node.js Tool

```
my-node-tool/
├── SKILL.md
└── index.js
```

**SKILL.md:**
```markdown
---
enact: "2.0.0"
name: "myorg/node/my-tool"
version: "1.0.0"
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

# My Node Tool
```

**index.js:**
```javascript
const input = process.argv[2];
console.log(JSON.stringify({ result: input.toUpperCase() }));
```

### Rust Tool (with build step)

```
my-rust-tool/
├── SKILL.md
└── main.rs
```

**SKILL.md:**
```markdown
---
enact: "2.0.0"
name: "myorg/rust/my-tool"
version: "1.0.0"
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

# My Rust Tool
```

**main.rs:**
```rust
use std::env;

fn main() {
    let input = env::args().nth(1).unwrap_or_default();
    println!("{{\"result\": \"{}\"}}", input.to_uppercase());
}
```

### Shell Tool (no dependencies)

```
my-shell-tool/
└── SKILL.md
```

**SKILL.md:**
```markdown
---
enact: "2.0.0"
name: "myorg/utils/simple-tool"
version: "1.0.0"
description: "A simple shell tool"
command: "echo 'Hello, ${name}!'"

inputSchema:
  type: object
  properties:
    name:
      type: string
      default: "World"
---

# Simple Tool
```

---

## Part 6: Working with Secrets

### Declaring Secrets

In `SKILL.md`:
```yaml
env:
  API_KEY:
    description: "API key for external service"
    secret: true
  DATABASE_URL:
    description: "Database connection string"
    secret: true
```

### Setting Secrets (User Action)

Users set secrets before running:
```bash
# Set a secret for a namespace
enact env set API_KEY --secret --namespace myorg/tools

# The secret is available to all tools under myorg/tools/*
```

### Using Secrets in Commands

Secrets are injected as environment variables:
```yaml
command: "python /workspace/main.py"
# In main.py, access via: os.environ.get('API_KEY')
```

### Namespace Inheritance

Secrets walk up the tool path:
```
Tool: myorg/api/slack/notifier
Lookup order:
  1. myorg/api/slack:API_KEY
  2. myorg/api:API_KEY  ← Found here
  3. myorg:API_KEY
```

---

## Part 7: Development Workflow

### Step 1: Create the Tool

```bash
mkdir my-tool && cd my-tool

# Option A: Use the init command (recommended)
enact init --tool

# Option B: Create SKILL.md manually
# Create SKILL.md and any source files
```

### Step 2: Test Locally

```bash
# Run from the tool directory
enact run ./ --args '{"name": "Test"}'

# Dry run to see what would execute
enact run ./ --args '{"name": "Test"}' --dry-run
```

### Step 3: Install Locally for Testing

```bash
# Install to project
enact install ./

# Or install globally
enact install ./ --global

# Now run by name
enact run myorg/tools/my-tool --args '{"name": "Test"}'
```

### Step 4: Sign and Publish

```bash
# Login first
enact auth login

# Sign the tool (uses Sigstore for keyless signing)
enact sign ./

# Publish to registry
enact publish ./

# View your published tool
enact learn myorg/tools/my-tool
```

---

## Part 8: Publishing Checklist

Before publishing, ensure:

- [ ] **name** follows `namespace/category/tool` pattern
- [ ] **version** is set (semver format)
- [ ] **description** is clear and searchable
- [ ] **inputSchema** validates all inputs
- [ ] **outputSchema** documents expected output
- [ ] **license** is specified (MIT, Apache-2.0, etc.)
- [ ] **tags** include relevant keywords
- [ ] **from** uses a pinned image version (not `latest`)
- [ ] **command** uses pinned tool versions
- [ ] **timeout** is set appropriately
- [ ] Tool is tested locally
- [ ] Documentation in the markdown body is complete

---

## Part 9: Common Patterns

### Pattern 1: Build Steps (The Key to Real Tools)

The `build` field is what makes Enact tools powerful. Build steps:
- Run **before** the command
- Are **cached** by Dagger (instant on subsequent runs)
- Can install dependencies, compile code, download models

**Single build command:**
```yaml
build: "pip install pandas numpy scikit-learn"
```

**Multiple build commands:**
```yaml
build:
  - "apt-get update && apt-get install -y libpq-dev"
  - "pip install -r requirements.txt"
  - "python -m nltk.downloader punkt"
```

**Compilation:**
```yaml
from: "rust:1.83-slim"
build: "cargo build --release"
command: "/workspace/target/release/my-tool ${input}"
```

### Pattern 2: JSON Input/Output

```yaml
command: "python /workspace/main.py"
# Pass input as JSON via stdin or file
```

```python
import sys
import json

# Read JSON from file or args
input_data = json.loads(sys.argv[1])

# Process
result = process(input_data)

# Output JSON
print(json.dumps(result))
```

### Pattern 3: File Processing

```yaml
inputSchema:
  type: object
  properties:
    file_content:
      type: string
      description: "Base64-encoded file content"
```

### Pattern 4: Multi-Step Build

```yaml
from: "node:20-alpine"
build:
  - "npm install"
  - "npm run build"
command: "node /workspace/dist/index.js ${input}"
```

### Pattern 5: Environment-Based Config

```yaml
env:
  MODE:
    description: "Operating mode"
    default: "production"
  DEBUG:
    description: "Enable debug logging"
    default: "false"

command: "python /workspace/main.py"
```

### Pattern 6: Structured Output

Always output valid JSON when `outputSchema` is defined:

```python
import json
import sys

try:
    result = do_work()
    print(json.dumps({"status": "success", "data": result}))
except Exception as e:
    print(json.dumps({"status": "error", "message": str(e)}))
    sys.exit(1)
```

---

## Part 10: Troubleshooting

### Tool Not Found

```bash
# Check if installed
enact list
enact list --global

# Try reinstalling
enact install author/tool --force
```

### Container Build Fails

```bash
# Run with verbose output
enact run ./my-tool --input "x=y" --verbose

# Check the build commands
# Ensure from: image has required tools
```

### Secrets Not Available

```bash
# Check if secret is set
enact env get API_KEY --secret --namespace myorg/tools

# Set if missing
enact env set API_KEY --secret --namespace myorg/tools
```

### Input Validation Errors

```bash
# Check your inputSchema matches the input format
# Use --dry-run to see what would be passed
enact run ./my-tool --args '{"key": "value"}' --dry-run
```

---

## Part 11: Best Practices for LLM Agents

### When Creating Tools

1. **Always include inputSchema** - Enables validation and helps other agents understand the tool
2. **Include outputSchema** - Documents what the tool returns
3. **Use descriptive names** - `myorg/data/csv-parser` not `myorg/parser`
4. **Add tags** - Helps with discovery
5. **Write clear documentation** - The markdown body helps humans and LLMs

### When Running Tools

1. **Validate inputs first** - Check against inputSchema before running
2. **Handle errors gracefully** - Tools may fail, timeout, or return errors
3. **Parse output** - Use outputSchema to understand the response
4. **Use --dry-run** - Verify commands before execution

### When Publishing

1. **Test thoroughly** - Run with various inputs
2. **Pin versions** - Use specific image tags and tool versions
3. **Sign your tools** - Enables trust verification
4. **Update versions** - Use semver for changes

---

## Appendix: Complete Working Examples

### Example A: URL Shortener

```markdown
---
enact: "2.0.0"
name: "examples/utils/url-shortener"
version: "1.0.0"
description: "Creates a short URL using a URL shortening service"
from: "python:3.12-slim"
build: "pip install requests"
command: "python /workspace/shorten.py ${url}"
timeout: "30s"

inputSchema:
  type: object
  properties:
    url:
      type: string
      description: "URL to shorten"
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

Shortens URLs using an external service.
```

### Example B: Markdown Formatter

```markdown
---
enact: "2.0.0"
name: "examples/text/markdown-formatter"
version: "1.0.0"
description: "Formats and prettifies Markdown text"
from: "node:20-alpine"
build: "npm install -g prettier"
command: "echo ${markdown} | prettier --parser markdown"

inputSchema:
  type: object
  properties:
    markdown:
      type: string
      description: "Markdown text to format"
  required:
    - markdown

outputSchema:
  type: string

annotations:
  readOnlyHint: true
  idempotentHint: true

tags:
  - markdown
  - formatting
  - text
---

# Markdown Formatter

Prettifies Markdown using Prettier.
```

### Example C: LLM Instruction Tool

```markdown
---
enact: "2.0.0"
name: "examples/ai/summarizer"
version: "1.0.0"
description: "Summarizes long text into key points"

inputSchema:
  type: object
  properties:
    text:
      type: string
      description: "Text to summarize"
    max_points:
      type: integer
      default: 5
      description: "Maximum number of bullet points"
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
    word_count:
      type: integer

annotations:
  readOnlyHint: true
  idempotentHint: false

tags:
  - ai
  - summarization
  - text
---

# Text Summarizer

You are a summarization expert. Given text, create a concise summary.

## Instructions

1. Read the input text carefully
2. Identify the main topic and key points
3. Create a brief summary paragraph
4. Extract up to `max_points` bullet points
5. Return structured JSON

## Output Format

```json
{
  "summary": "A brief paragraph summarizing the text",
  "key_points": [
    "First key point",
    "Second key point"
  ],
  "word_count": 150
}
```

## Guidelines

- Be concise but comprehensive
- Maintain the original meaning
- Use clear, simple language
- Order points by importance
```

---

## Summary

As an LLM agent working with Enact:

1. **Create** tools with `enact init --tool` or write `SKILL.md` files manually
2. **Test** locally with `enact run ./ --args '{"key": "value"}'`
3. **Learn** about tools with `enact learn author/tool`
4. **Install** with `enact install ./` (project) or `enact install ./ --global`
5. **Sign** with `enact sign ./` before publishing
6. **Publish** with `enact publish ./`
7. **Discover** tools with `enact search "query"`
8. **Run** published tools with `enact run author/tool --args '{...}'`

The key insight: **Container tools** have a `command` field and execute deterministically in Docker. **Instruction tools** omit `command` and are interpreted by LLMs using the markdown body.

## Resources

- **Registry**: [enact.tools](https://enact.tools)
- **CLI Help**: `enact --help` or `enact <command> --help`
- **GitHub**: [github.com/EnactProtocol/enact-cli](https://github.com/EnactProtocol/enact-cli)

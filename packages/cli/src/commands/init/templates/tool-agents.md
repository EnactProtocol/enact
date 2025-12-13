# AGENTS.md

Enact tool: containerized, signed executable. Manifest: `enact.md` (YAML frontmatter + Markdown docs).

## Commands
```bash
enact run ./ --args '{"name": "Test"}'  # Run locally
enact run ./ --args '{}' --dry-run      # Preview execution
enact sign ./ && enact publish ./       # Sign and publish
```

## enact.md Structure
```yaml
---
name: {{TOOL_NAME}}        # org/category/tool format
description: What it does
version: 1.0.0                    # semver
from: python:3.12-slim            # pin versions, not :latest
build: pip install requests       # cached by Dagger
command: python /work/main.py ${input}
timeout: 30s
inputSchema:
  type: object
  properties:
    input: { type: string }
  required: [input]
env:
  API_KEY:                        # declare secrets (set via: enact env set API_KEY --secret)
---
# Tool Name
Documentation here (usage examples, etc.)
```

## Parameter Substitution
- `${param}` — auto-quoted (handles spaces, JSON, special chars)
- `${param:raw}` — unquoted (use carefully)
- **Never manually quote**: `"${param}"` causes double-quoting

## Output
Always output valid JSON when `outputSchema` is defined:
```python
import json, sys
print(json.dumps({"result": data}))  # stdout = tool output
sys.exit(1)  # non-zero = error
```

## File Access
Tool runs in container with `/work` as working directory. Source files copied there.

## Adding Dependencies
- Python: `build: pip install package1 package2`
- Node: `build: ["npm install", "npm run build"]`
- System: `build: apt-get update && apt-get install -y libfoo`
- Compiled: `build: rustc /work/main.rs -o /work/tool`

Build steps are cached — first run slow, subsequent runs instant.

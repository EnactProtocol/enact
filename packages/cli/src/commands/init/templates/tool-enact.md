---
name: {{TOOL_NAME}}
description: A simple tool that echoes a greeting
version: 0.1.0
enact: "2.0"

from: alpine:latest

inputSchema:
  type: object
  properties:
    name:
      type: string
      description: Name to greet
      default: World
  required: []

command: |
  echo "Hello, ${name}!"
---

# {{TOOL_NAME}}

A simple greeting tool created with `enact init`.

## Usage

```bash
enact run ./ --args '{"name": "Alice"}'
```

## Customization

Edit this file to create your own tool:

1. Update the `name` and `description` in the frontmatter
2. Modify the `inputSchema` to define your tool's inputs
3. Change the `command` to run your desired shell commands
4. Update this documentation section

## Learn More

- [Enact Documentation](https://enact.dev/docs)
- [Tool Manifest Reference](https://enact.dev/docs/manifest)

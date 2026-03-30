---
name: hello-js
description: "Generates personalized greeting messages using Node.js. Use when the user asks for a JavaScript hello-world example, a simple Node.js starter project, or wants to test Enact tool execution with JavaScript."
---

# Hello JS

Prints a personalized greeting along with a timestamp and the Node.js runtime version. Accepts an optional `name` parameter (defaults to `"World"`).

## Usage

```bash
# Default greeting
enact run enact/hello-js
# Output:
# Hello, World! 👋
# Generated at: 2025-01-15T10:30:00.000Z
# Node version: v22.x.x

# Custom name
enact run enact/hello-js -a '{"name": "Alice"}'
# Output:
# Hello, Alice! 👋
# Generated at: 2025-01-15T10:30:00.000Z
# Node version: v22.x.x
```

## Parameters

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `name` | string | `"World"` | Name to greet |

## Runtime

Runs in `node:22-alpine` container via `node`.

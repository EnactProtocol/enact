---
name: hello-go
description: "Generates personalized greeting messages using Go. Use when the user asks for a Go hello-world example, a simple Go starter project, or wants to test Enact tool execution with Go."
---

# Hello Go

Prints a personalized greeting and the Go runtime version. Accepts an optional `name` parameter (defaults to `"World"`).

## Usage

```bash
# Default greeting
enact run enact/hello-go
# Output:
# Hello, World! 🐹
# Go version: go1.23.x

# Custom name
enact run enact/hello-go -a '{"name": "Alice"}'
# Output:
# Hello, Alice! 🐹
# Go version: go1.23.x
```

## Parameters

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `name` | string | `"World"` | Name to greet |

## Runtime

Runs in `golang:1.23-alpine` container via `go run`.

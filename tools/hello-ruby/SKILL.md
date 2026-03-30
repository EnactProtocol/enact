---
name: hello-ruby
description: "Generates personalized greeting messages using Ruby. Use when the user asks for a Ruby hello-world example, a simple Ruby starter project, or wants to test Enact tool execution with Ruby."
---

# Hello Ruby

Prints a personalized greeting and the Ruby runtime version. Accepts an optional `name` parameter (defaults to `"World"`).

## Usage

```bash
# Default greeting
enact run enact/hello-ruby
# Output:
# Hello, World! 💎
# Ruby version: 3.3.x

# Custom name
enact run enact/hello-ruby -a '{"name": "Alice"}'
# Output:
# Hello, Alice! 💎
# Ruby version: 3.3.x
```

## Parameters

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `name` | string | `"World"` | Name to greet |

## Runtime

Runs in `ruby:3.3-alpine` container via `ruby`.

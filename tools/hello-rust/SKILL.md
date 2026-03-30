---
name: hello-rust
description: "Generates personalized greeting messages using Rust. Use when the user asks for a Rust hello-world example, a simple Rust starter project, or wants to test Enact tool execution with Rust."
---

# Hello Rust

Prints a personalized greeting using a compiled Rust binary. Accepts an optional `name` parameter (defaults to `"World"`). Includes a build step that compiles `hello.rs` before execution.

## Usage

```bash
# Default greeting
enact run enact/hello-rust
# Output:
# Hello, World! 🦀

# Custom name
enact run enact/hello-rust -a '{"name": "Alice"}'
# Output:
# Hello, Alice! 🦀
```

## Parameters

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `name` | string | `"World"` | Name to greet |

## Runtime

Runs in `rust:1.83-slim` container. Compiles `hello.rs` with `rustc` during the build step, then executes the binary.

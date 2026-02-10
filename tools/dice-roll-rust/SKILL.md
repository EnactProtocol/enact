# Dice Roll (Rust)

A simple dice rolling tool written in Rust. Demonstrates how to create an Enact tool with Rust.

## Features

- Roll any number of dice with configurable sides
- Returns individual rolls and total sum
- Supports common dice types: d4, d6, d8, d10, d12, d20, d100

## Usage Examples

### Roll a single d6
```bash
enact run enact/dice-roll-rust
```

### Roll 2d6 (two six-sided dice)
```bash
enact run enact/dice-roll-rust -a '{"sides": 6, "count": 2}'
```

### Roll a d20
```bash
enact run enact/dice-roll-rust -a '{"sides": 20}'
```

### Roll 4d6 for D&D stats
```bash
enact run enact/dice-roll-rust -a '{"sides": 6, "count": 4}'
```

### MCP (for LLMs/Agents)

When using via MCP, call `enact__dice-roll-rust` with:
- `sides`: Number of sides per die (default: 6)
- `count`: Number of dice to roll (default: 1)

## Output

Returns JSON with:
- `rolls`: Array of individual die results
- `total`: Sum of all rolls
- `sides`: The die type used
- `count`: Number of dice rolled

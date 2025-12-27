---
name: examples/json-formatter
description: Format JSON files with configurable indentation
version: 1.0.0
enact: "2.0"

from: python:3.12-slim

inputSchema:
  type: object
  properties:
    indent:
      type: integer
      description: Number of spaces for indentation
      default: 2
    sort_keys:
      type: boolean
      description: Sort object keys alphabetically
      default: false
  required: []

command: |
  python /workspace/format.py --indent ${indent} --sort-keys ${sort_keys}
---

# JSON Formatter

A tool that formats JSON files in `/input` and writes prettified versions to `/output`.

## Usage

```bash
# Basic usage - format JSON files with default 2-space indent
enact run ./examples/tools/json-formatter --input ./data --output ./formatted

# Custom indentation
enact run ./examples/tools/json-formatter --input ./data --output ./formatted --input indent=4

# Sort keys alphabetically
enact run ./examples/tools/json-formatter --input ./data --output ./formatted --input sort_keys=true

# In-place formatting with --apply
enact run ./examples/tools/json-formatter --input ./src --output ./src --apply
```

## Container Layout

- `/workspace` - Tool source code (format.py)
- `/input` - Your JSON files to format
- `/output` - Formatted JSON files

## Parameters

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `indent` | integer | 2 | Number of spaces for indentation |
| `sort_keys` | boolean | false | Sort object keys alphabetically |

---
enact: "2.0.0"
name: acme/analyzer
description: Analyzes documentation for completeness
version: "1.2.0"
from: python:3.11-slim
timeout: 5m
license: Apache-2.0
tags:
  - documentation
  - analysis
scripts:
  analyze: "python analyze.py {{file}}"
outputSchema:
  type: object
  properties:
    score:
      type: number
    issues:
      type: array
      items:
        type: string
---

# Documentation Analyzer

A powerful tool for analyzing documentation quality and completeness.

## Usage

Provide a path to a documentation file and get a quality score along with
any issues found.

```bash
enact run acme/analyzer --file README.md
```

## Output

The tool returns a JSON object with:

- `score`: A quality score from 0-100
- `issues`: An array of strings describing any issues found

## Examples

### Basic Analysis

```bash
enact run acme/analyzer --file docs/api.md
```

### Integration with CI

You can use this tool in your CI pipeline to enforce documentation standards.

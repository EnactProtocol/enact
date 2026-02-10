---
enact: "2.0.0"
name: test/echo-tool
version: "1.0.0"
description: A tool that echoes its input for testing
from: alpine:latest
scripts:
  echo: "echo '{\"output\":\"{{text}}\"}'"
outputSchema:
  type: object
  properties:
    output:
      type: string
---

# Echo Tool

A simple tool that echoes back the input text. Used for testing.

## Usage

```bash
enact run test/echo-tool:echo --input text="Hello"
```

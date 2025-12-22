/**
 * CLAUDE.md template for Claude integration
 */
export const claudeTemplate = `# CLAUDE.md

This project uses Enact tools — containerized, signed executables you can run via CLI.

## Quick Reference
\`\`\`bash
enact run <tool> --args '{"key": "value"}'   # Run a tool
enact search "keyword"                        # Find tools
enact learn author/tool                       # View tool documentation
enact install author/tool                     # Install tool
enact list                                    # List installed tools
\`\`\`

## Running Tools
Tools take JSON input and return JSON output:
\`\`\`bash
# Run and capture output
result=$(enact run author/utils/formatter --args '{"code": "const x=1"}')

# Parse with jq
enact run tool --args '{}' | jq '.data'
\`\`\`

## Creating Tools
Create \`SKILL.md\` in a directory:
\`\`\`yaml
---
name: namespace/category/tool
description: Clear description for search
version: 1.0.0
from: python:3.12-slim            # Docker image
build: pip install requests       # Install dependencies (cached)
command: python /work/main.py \${input}
inputSchema:
  type: object
  properties:
    input: { type: string, description: "The input to process" }
  required: [input]
---
# Tool Name
Usage documentation here.
\`\`\`

Key points:
- \`\${param}\` is auto-quoted — never add manual quotes
- \`from:\` pin image versions (not \`:latest\`)
- \`build:\` steps are cached by Dagger
- Output JSON to stdout, errors to stderr
- Non-zero exit = failure

## Tool Development Workflow
\`\`\`bash
enact run ./ --args '{"input": "test"}'       # Test locally
enact run ./ --args '{}' --dry-run            # Preview command
enact sign ./ && enact publish ./             # Publish
\`\`\`

## Secrets
Declare in SKILL.md, set via CLI:
\`\`\`yaml
env:
  API_KEY:    # Declared but not set
\`\`\`
\`\`\`bash
enact env set API_KEY --secret --namespace author/tool
\`\`\`
`;

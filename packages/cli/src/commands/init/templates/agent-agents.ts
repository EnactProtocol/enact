/**
 * AGENTS.md template for projects that use Enact tools
 */
export const agentAgentsTemplate = `# AGENTS.md

This project uses Enact tools — containerized, cryptographically-signed executables.

## Running Tools
\`\`\`bash
enact run <tool-name> --args '{"key": "value"}'   # Run installed tool
enact run ./path/to/tool --args '{}'              # Run local tool
\`\`\`

## Finding & Installing Tools
\`\`\`bash
enact search "pdf extraction"                     # Search registry
enact info author/category/tool                   # View tool info
enact learn author/category/tool                  # View tool documentation
enact install author/category/tool                # Add to project (.enact/tools.json)
enact install author/category/tool --global       # Add globally
enact list                                        # List project tools
\`\`\`

## Tool Output
Tools output JSON to stdout. Parse with jq or your language's JSON parser:
\`\`\`bash
enact run tool --args '{}' | jq '.result'
\`\`\`

## Creating Local Tools
Create \`tools/<name>/SKILL.md\` with:
\`\`\`yaml
---
name: my-tool
description: What it does
command: echo "Hello \${name}"
inputSchema:
  type: object
  properties:
    name: { type: string }
---
# My Tool
Documentation here.
\`\`\`
Run with: \`enact run ./tools/<name> --args '{"name": "World"}'\`

## Environment & Secrets
\`\`\`bash
enact env set API_KEY --secret --namespace author/tool  # Set secret
enact env list                                          # List env vars
\`\`\`
`;

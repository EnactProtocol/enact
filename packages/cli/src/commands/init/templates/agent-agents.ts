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
enact run tool --args '{}' | jq '.result'               # Progress output is quiet by default
enact run tool --args '{}' | jq -r '.field'             # Extract a specific field as raw text
enact run tool --args '{}' --verbose | jq '.result'     # Use --verbose to see progress output
\`\`\`

## Creating Local Tools

**IMPORTANT: Always use \`enact init --tool\` to create new tools!**

This scaffolds a proper tool structure with SKILL.md and AGENTS.md templates:
\`\`\`bash
enact init --tool                                       # If logged in: uses username/my-tool automatically
enact init --tool --name my-tool                        # Simple name
enact init --tool --name username/my-tool               # Custom hierarchical name
\`\`\`

**Note:** When logged in, \`enact init --tool\` automatically uses your username as the namespace (e.g., \`enact/my-tool\`). When not logged in, it defaults to \`my-tool\`.

Then edit the generated \`SKILL.md\` file to define your tool's behavior.

### Tool Structure (for reference)
The \`enact init --tool\` command creates a \`SKILL.md\` file with this structure:
\`\`\`yaml
---
name: my-tool                                           # Simple name works
# OR
name: namespace/tool-name                               # Hierarchical names recommended for organization (e.g., fun/my-tool)
description: What it does
command: echo "Hello \${name}"                           # Shell command to execute
inputSchema:
  type: object
  properties:
    name: { type: string }
---
# My Tool
Documentation here.
\`\`\`

Run local tools with: \`enact run ./tools/<name> --args '{"key": "value"}'\`

## Environment & Secrets
\`\`\`bash
enact env set API_KEY --secret --namespace author/tool  # Set secret
enact env list                                          # List env vars
\`\`\`

## Getting Help
\`\`\`bash
enact help                                              # Show all commands
enact <command> --help                                  # Help for specific command
\`\`\`
`;

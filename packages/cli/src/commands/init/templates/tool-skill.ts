/**
 * SKILL.md template for new tool creation
 */
export const toolSkillTemplate = `---
name: {{TOOL_NAME}}
description: A simple tool that echoes a greeting
version: 0.1.0
enact: "2.0"

from: python:3.12-slim

# Install dependencies (cached by Dagger)
build: |
  pip install requests

# Environment variables (optional)
# env:
#   API_KEY:
#     secret: true
#     description: "Your API key"

inputSchema:
  type: object
  properties:
    name:
      type: string
      description: Name to greet
      default: World
  required: []

command: |
  echo "Hello, \${name}!"
---

# {{TOOL_NAME}}

A simple greeting tool created with \`enact init\`.

## Usage

\`\`\`bash
enact run ./ --args '{"name": "Alice"}'
\`\`\`

## Customization

Edit this file to create your own tool:

1. Update the \`name\` and \`description\` in the frontmatter
2. Change the \`from\` image to match your runtime (python, node, rust, etc.)
3. Add dependencies in the \`build\` section (pip install, npm install, etc.)
4. Uncomment and configure \`env\` for secrets/API keys
5. Modify the \`inputSchema\` to define your tool's inputs
6. Change the \`command\` to run your script or shell commands
7. Update this documentation section

## Environment Variables

To use secrets, uncomment the \`env\` section above, then set the value:

\`\`\`bash
enact env set API_KEY --secret --namespace {{TOOL_NAME}}
\`\`\`

Access in your code:
\`\`\`python
import os
api_key = os.environ.get('API_KEY')
\`\`\`

## Learn More

- [Enact Documentation](https://enact.dev/docs)
- [Tool Manifest Reference](https://enact.dev/docs/manifest)
`;

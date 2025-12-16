/**
 * enact init command
 *
 * Create a basic tool template in the current directory.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getSecret } from "@enactprotocol/secrets";
import type { Command } from "commander";
import type { CommandContext, GlobalOptions } from "../../types";
import { error, formatError, info, success, warning } from "../../utils";

/** Namespace for stored auth tokens */
const AUTH_NAMESPACE = "enact:auth";
const ACCESS_TOKEN_KEY = "access_token";
const AUTH_METHOD_KEY = "auth_method";

/** Supabase configuration */
const SUPABASE_URL = process.env.SUPABASE_URL || "https://siikwkfgsmouioodghho.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpaWt3a2Znc21vdWlvb2RnaGhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2MTkzMzksImV4cCI6MjA4MDE5NTMzOX0.kxnx6-IPFhmGx6rzNx36vbyhFMFZKP_jFqaDbKnJ_E0";

/**
 * Embedded templates (for single-binary compatibility)
 */
const TEMPLATES: Record<string, string> = {
  "tool-enact.md": `---
name: {{TOOL_NAME}}
description: A simple tool that echoes a greeting
version: 0.1.0
enact: "2.0"

from: alpine:latest

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
2. Modify the \`inputSchema\` to define your tool's inputs
3. Change the \`command\` to run your desired shell commands
4. Update this documentation section

## Learn More

- [Enact Documentation](https://enact.dev/docs)
- [Tool Manifest Reference](https://enact.dev/docs/manifest)
`,

  "tool-agents.md": `# Enact Tool Development Guide

Enact tools are containerized, cryptographically-signed executables. Each tool is defined by an \`enact.md\` file (YAML frontmatter + Markdown docs).

## Quick Reference

| Task | Command |
|------|---------|
| Run local tool | \`enact run ./ --input "key=value"\` |
| Run with JSON | \`enact run ./ --args '{"key": "value"}'\` |
| Dry run | \`enact run ./ --args '{}' --dry-run\` |
| Sign & publish | \`enact sign ./ && enact publish ./\` |

## enact.md Structure

\`\`\`yaml
---
name: {{TOOL_NAME}}
description: What the tool does
version: 1.0.0
enact: "2.0.0"

from: python:3.12-slim            # Docker image (pin versions, not :latest)
build: pip install requests       # Build steps (cached by Dagger)
command: python /work/main.py \${input}
timeout: 30s

inputSchema:
  type: object
  properties:
    input:
      type: string
      description: "Input to process"
  required: [input]

outputSchema:
  type: object
  properties:
    result:
      type: string

env:
  API_KEY:
    description: "External API key"
    secret: true                  # Set via: enact env set API_KEY --secret
---
# Tool Name
Documentation here.
\`\`\`

## Field Reference

| Field | Description |
|-------|-------------|
| \`name\` | Hierarchical ID: \`org/category/tool\` |
| \`description\` | What the tool does |
| \`version\` | Semver version |
| \`from\` | Docker image |
| \`build\` | Build commands (string or array, cached) |
| \`command\` | Shell command with \`\${param}\` substitution |
| \`timeout\` | Max execution time (e.g., "30s", "5m") |
| \`inputSchema\` | JSON Schema for inputs |
| \`outputSchema\` | JSON Schema for outputs |
| \`env\` | Environment variables and secrets |

## Parameter Substitution

Enact auto-quotes parameters. **Never manually quote:**

\`\`\`yaml
# WRONG - causes double-quoting
command: python /work/main.py "\${input}"

# RIGHT - Enact handles quoting
command: python /work/main.py \${input}
\`\`\`

Modifiers:
- \`\${param}\` — auto-quoted (handles spaces, JSON, special chars)
- \`\${param:raw}\` — raw, no quoting (use carefully)

## Output

Output valid JSON to stdout when \`outputSchema\` is defined:

\`\`\`python
import json, sys

try:
    result = do_work()
    print(json.dumps({"status": "success", "result": result}))
except Exception as e:
    print(json.dumps({"status": "error", "message": str(e)}))
    sys.exit(1)  # non-zero = error
\`\`\`

## Build Steps by Language

**Python:**
\`\`\`yaml
from: python:3.12-slim
build: pip install requests pandas
\`\`\`

**Node.js:**
\`\`\`yaml
from: node:20-alpine
build:
  - npm install
  - npm run build
\`\`\`

**Rust:**
\`\`\`yaml
from: rust:1.83-slim
build: rustc /work/main.rs -o /work/tool
command: /work/tool \${input}
\`\`\`

**Go:**
\`\`\`yaml
from: golang:1.22-alpine
build: cd /work && go build -o tool main.go
command: /work/tool \${input}
\`\`\`

**System packages:**
\`\`\`yaml
build: apt-get update && apt-get install -y libfoo-dev
\`\`\`

Build steps are cached — first run slow, subsequent runs instant.

## File Access

Tools run in a container with \`/work\` as the working directory. All source files are copied there.

## Secrets

Declare in \`enact.md\`:
\`\`\`yaml
env:
  API_KEY:
    description: "API key for service"
    secret: true
\`\`\`

Set before running:
\`\`\`bash
enact env set API_KEY --secret --namespace {{TOOL_NAME}}
\`\`\`

Access in code:
\`\`\`python
import os
api_key = os.environ.get('API_KEY')
\`\`\`

## LLM Instruction Tools

Tools without a \`command\` field are interpreted by LLMs:

\`\`\`yaml
---
name: myorg/ai/reviewer
description: AI-powered code review
inputSchema:
  type: object
  properties:
    code: { type: string }
  required: [code]
outputSchema:
  type: object
  properties:
    issues: { type: array }
    score: { type: number }
---
# Code Reviewer

You are a senior engineer. Review the code for bugs, style, and security.
Return JSON: {"issues": [...], "score": 75}
\`\`\`

## Publishing Checklist

- [ ] \`name\` follows \`namespace/category/tool\` pattern
- [ ] \`version\` set (semver)
- [ ] \`description\` is clear and searchable
- [ ] \`inputSchema\` / \`outputSchema\` defined
- [ ] \`from\` uses pinned image version
- [ ] \`timeout\` set appropriately
- [ ] Tool tested locally with \`enact run ./\`

## Troubleshooting

\`\`\`bash
enact run ./ --input "x=y" --verbose   # Verbose output
enact run ./ --args '{}' --dry-run     # Preview command
enact list                              # List installed tools
\`\`\`
`,

  "agent-agents.md": `# AGENTS.md

This project uses Enact tools — containerized, cryptographically-signed executables.

## Running Tools
\`\`\`bash
enact run <tool-name> --args '{"key": "value"}'   # Run installed tool
enact run ./path/to/tool --args '{}'              # Run local tool
\`\`\`

## Finding & Installing Tools
\`\`\`bash
enact search "pdf extraction"                     # Search registry
enact get author/category/tool                    # View tool info
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
Create \`tools/<name>/enact.md\` with:
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
`,

  "claude.md": `# CLAUDE.md

This project uses Enact tools — containerized, signed executables you can run via CLI.

## Quick Reference
\`\`\`bash
enact run <tool> --args '{"key": "value"}'   # Run a tool
enact search "keyword"                        # Find tools
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
Create \`enact.md\` in a directory:
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
Declare in enact.md, set via CLI:
\`\`\`yaml
env:
  API_KEY:    # Declared but not set
\`\`\`
\`\`\`bash
enact env set API_KEY --secret --namespace author/tool
\`\`\`
`,
};

interface InitOptions extends GlobalOptions {
  name?: string;
  force?: boolean;
  tool?: boolean;
  agent?: boolean;
  claude?: boolean;
}

/**
 * Load a template and replace placeholders
 */
function loadTemplate(templateName: string, replacements: Record<string, string> = {}): string {
  let content = TEMPLATES[templateName];
  if (!content) {
    throw new Error(`Template not found: ${templateName}`);
  }

  // Replace all {{PLACEHOLDER}} patterns
  for (const [key, value] of Object.entries(replacements)) {
    content = content.replaceAll(`{{${key}}}`, value);
  }

  return content;
}

/**
 * Get the current logged-in username
 */
async function getCurrentUsername(): Promise<string | null> {
  const accessToken = await getSecret(AUTH_NAMESPACE, ACCESS_TOKEN_KEY);
  if (!accessToken) {
    return null;
  }

  const authMethod = await getSecret(AUTH_NAMESPACE, AUTH_METHOD_KEY);

  if (authMethod === "supabase") {
    // Get user from Supabase
    try {
      const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: SUPABASE_ANON_KEY,
        },
      });

      if (!userResponse.ok) {
        return null;
      }

      const user = (await userResponse.json()) as {
        id: string;
        email?: string;
        user_metadata?: {
          user_name?: string;
          username?: string;
          full_name?: string;
        };
      };

      // Try to get profile username from database
      const profileResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=username`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            apikey: SUPABASE_ANON_KEY,
          },
        }
      );

      if (profileResponse.ok) {
        const profiles = (await profileResponse.json()) as Array<{ username: string }>;
        if (profiles[0]?.username) {
          return profiles[0].username;
        }
      }

      // Fall back to user_metadata
      return (
        user.user_metadata?.username ||
        user.user_metadata?.user_name ||
        user.user_metadata?.full_name ||
        user.email?.split("@")[0] ||
        null
      );
    } catch {
      return null;
    }
  }

  // Legacy API auth - use the API client
  try {
    const { createApiClient, getCurrentUser } = await import("@enactprotocol/api");
    const client = createApiClient();
    client.setAuthToken(accessToken);
    const user = await getCurrentUser(client);
    return user.username;
  } catch {
    return null;
  }
}

/**
 * Init command handler
 */
async function initHandler(options: InitOptions, ctx: CommandContext): Promise<void> {
  const targetDir = ctx.cwd;

  // Determine mode: --agent, --claude, or --tool (default)
  const isAgentMode = options.agent;
  const isClaudeMode = options.claude;
  // Default to tool mode if no flag specified

  // Handle --agent mode: create AGENTS.md for projects using Enact tools
  if (isAgentMode) {
    const agentsPath = join(targetDir, "AGENTS.md");
    if (existsSync(agentsPath) && !options.force) {
      warning(`AGENTS.md already exists at: ${agentsPath}`);
      info("Use --force to overwrite");
      return;
    }
    writeFileSync(agentsPath, loadTemplate("agent-agents.md"), "utf-8");
    success(`Created AGENTS.md: ${agentsPath}`);
    info("");
    info("This file helps AI agents understand how to use Enact tools in your project.");
    info("Run 'enact search <query>' to find tools, 'enact install <tool>' to add them.");
    return;
  }

  // Handle --claude mode: create CLAUDE.md
  if (isClaudeMode) {
    const claudePath = join(targetDir, "CLAUDE.md");
    if (existsSync(claudePath) && !options.force) {
      warning(`CLAUDE.md already exists at: ${claudePath}`);
      info("Use --force to overwrite");
      return;
    }
    writeFileSync(claudePath, loadTemplate("claude.md"), "utf-8");
    success(`Created CLAUDE.md: ${claudePath}`);
    info("");
    info("This file helps Claude understand how to use Enact tools in your project.");
    return;
  }

  // Handle --tool mode (default): create enact.md + AGENTS.md for tool development
  const manifestPath = join(targetDir, "enact.md");
  const agentsPath = join(targetDir, "AGENTS.md");

  if (existsSync(manifestPath) && !options.force) {
    warning(`Tool manifest already exists at: ${manifestPath}`);
    info("Use --force to overwrite");
    return;
  }

  // Get username for the tool name
  let toolName = options.name;

  if (!toolName) {
    const username = await getCurrentUsername();
    if (username) {
      toolName = `${username}/my-tool`;
      info(`Using logged-in username: ${username}`);
    } else {
      toolName = "my-tool";
      info("Not logged in - using generic tool name");
      info("Run 'enact auth login' to use your username in tool names");
    }
  }

  // Load templates with placeholder replacement
  const replacements = { TOOL_NAME: toolName };
  const manifestContent = loadTemplate("tool-enact.md", replacements);
  const agentsContent = loadTemplate("tool-agents.md", replacements);

  // Ensure directory exists
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  // Write enact.md
  writeFileSync(manifestPath, manifestContent, "utf-8");
  success(`Created tool manifest: ${manifestPath}`);

  // Write AGENTS.md (only if it doesn't exist or --force is used)
  if (!existsSync(agentsPath) || options.force) {
    writeFileSync(agentsPath, agentsContent, "utf-8");
    success(`Created AGENTS.md: ${agentsPath}`);
  } else {
    info("AGENTS.md already exists, skipping (use --force to overwrite)");
  }

  info("");
  info("Next steps:");
  info("  1. Edit enact.md to customize your tool");
  info("  2. Run 'enact run ./' to test your tool");
  info("  3. Run 'enact publish' to share your tool");
}

/**
 * Configure the init command
 */
export function configureInitCommand(program: Command): void {
  program
    .command("init")
    .description("Initialize Enact in the current directory")
    .option("-n, --name <name>", "Tool name (default: username/my-tool)")
    .option("-f, --force", "Overwrite existing files")
    .option("--tool", "Create a new Enact tool (default)")
    .option("--agent", "Create AGENTS.md for projects that use Enact tools")
    .option("--claude", "Create CLAUDE.md with Claude-specific instructions")
    .option("-v, --verbose", "Show detailed output")
    .action(async (options: InitOptions) => {
      const ctx: CommandContext = {
        cwd: process.cwd(),
        options,
        isCI: Boolean(process.env.CI),
        isInteractive: process.stdout.isTTY ?? false,
      };

      try {
        await initHandler(options, ctx);
      } catch (err) {
        error(formatError(err));
        process.exit(1);
      }
    });
}

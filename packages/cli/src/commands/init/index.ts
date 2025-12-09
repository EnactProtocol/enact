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

interface InitOptions extends GlobalOptions {
  name?: string;
  force?: boolean;
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
 * Generate the tool template content
 */
function generateToolTemplate(toolName: string): string {
  return `---
name: ${toolName}
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

# ${toolName}

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
`;
}

/**
 * Init command handler
 */
async function initHandler(options: InitOptions, ctx: CommandContext): Promise<void> {
  const targetDir = ctx.cwd;
  const manifestPath = join(targetDir, "enact.md");

  // Check if manifest already exists
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

  // Generate and write the template
  const content = generateToolTemplate(toolName);

  // Ensure directory exists
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  writeFileSync(manifestPath, content, "utf-8");

  success(`Created tool template: ${manifestPath}`);
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
    .description("Create a new tool template in the current directory")
    .option("-n, --name <name>", "Tool name (default: username/my-tool or my-tool)")
    .option("-f, --force", "Overwrite existing enact.md file")
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

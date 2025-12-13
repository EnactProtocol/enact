/**
 * enact init command
 *
 * Create a basic tool template in the current directory.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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

/** Get the templates directory path */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEMPLATES_DIR = join(__dirname, "templates");

interface InitOptions extends GlobalOptions {
  name?: string;
  force?: boolean;
  tool?: boolean;
  agent?: boolean;
  claude?: boolean;
}

/**
 * Load a template file and replace placeholders
 */
function loadTemplate(templateName: string, replacements: Record<string, string> = {}): string {
  const templatePath = join(TEMPLATES_DIR, templateName);
  let content = readFileSync(templatePath, "utf-8");

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

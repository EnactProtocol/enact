/**
 * enact init command
 *
 * Create a basic tool template in the current directory.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getSecret } from "@enactprotocol/secrets";
import { checkForUpdates } from "@enactprotocol/shared";
import type { Command } from "commander";
import { version } from "../../index";
import type { CommandContext, GlobalOptions } from "../../types";
import { error, formatError, info, success, warning } from "../../utils";
import {
  agentAgentsTemplate,
  claudeTemplate,
  defaultSkillPackageTemplate,
  defaultSkillScriptTemplate,
  toolAgentsTemplate,
  toolSkillTemplate,
} from "./templates";

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
 * Template mapping for loadTemplate function
 */
const TEMPLATES: Record<string, string> = {
  "tool-skill.md": toolSkillTemplate,
  "tool-agents.md": toolAgentsTemplate,
  "agent-agents.md": agentAgentsTemplate,
  "claude.md": claudeTemplate,
  "skill-package.yaml": defaultSkillPackageTemplate,
  "skill-script.py": defaultSkillScriptTemplate,
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
 * Create agents/skills.json for project skill tracking
 */
function createAgentsSkillsJson(targetDir: string, force: boolean): boolean {
  const agentsDir = join(targetDir, "agents");
  const skillsJsonPath = join(agentsDir, "skills.json");

  // Check if skills.json already exists
  if (existsSync(skillsJsonPath) && !force) {
    info("agents/skills.json already exists, skipping");
    return false;
  }

  // Create agents directory if it doesn't exist
  if (!existsSync(agentsDir)) {
    mkdirSync(agentsDir, { recursive: true });
  }

  // Write empty skills.json
  const skillsJson = { tools: {} };
  writeFileSync(skillsJsonPath, `${JSON.stringify(skillsJson, null, 2)}\n`, "utf-8");
  return true;
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

  // Determine mode: --tool, --claude, --agent, or default (skill)
  const isToolMode = options.tool;
  const isClaudeMode = options.claude;
  const isAgentMode = options.agent;

  // Handle --tool mode: create SKILL.md + AGENTS.md for tool development
  if (isToolMode) {
    const manifestPath = join(targetDir, "SKILL.md");
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
    const manifestContent = loadTemplate("tool-skill.md", replacements);
    const agentsContent = loadTemplate("tool-agents.md", replacements);

    // Ensure directory exists
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }

    // Write SKILL.md
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
    info("  1. Edit SKILL.md to customize your tool");
    info("  2. Run 'enact run ./' to test your tool");
    info("  3. Run 'enact publish' to share your tool");
    return;
  }

  // Handle --claude mode: create or append to CLAUDE.md
  if (isClaudeMode) {
    const claudePath = join(targetDir, "CLAUDE.md");
    const templateContent = loadTemplate("claude.md");

    if (existsSync(claudePath)) {
      const existingContent = readFileSync(claudePath, "utf-8");
      // Check if Enact content is already present
      if (existingContent.includes("This project uses Enact tools")) {
        if (options.force) {
          writeFileSync(claudePath, templateContent, "utf-8");
          success(`Overwrote CLAUDE.md: ${claudePath}`);
        } else {
          info("CLAUDE.md already contains Enact configuration, skipping");
          info("Use --force to overwrite");
        }
      } else {
        // Append Enact content to existing file
        const newContent = `${existingContent.trimEnd()}\n\n${templateContent}`;
        writeFileSync(claudePath, newContent, "utf-8");
        success(`Appended Enact configuration to existing CLAUDE.md: ${claudePath}`);
      }
    } else {
      writeFileSync(claudePath, templateContent, "utf-8");
      success(`Created CLAUDE.md: ${claudePath}`);
    }

    // Create agents/skills.json
    if (createAgentsSkillsJson(targetDir, options.force ?? false)) {
      success("Created agents/skills.json");
    }

    info("");
    info("This file helps Claude understand how to use Enact tools in your project.");
    return;
  }

  // Handle --agent mode: create or append to AGENTS.md for projects using Enact tools
  if (isAgentMode) {
    const agentsPath = join(targetDir, "AGENTS.md");
    const agentsTemplateContent = loadTemplate("agent-agents.md");

    if (existsSync(agentsPath)) {
      const existingContent = readFileSync(agentsPath, "utf-8");
      if (existingContent.includes("This project uses Enact tools")) {
        if (options.force) {
          writeFileSync(agentsPath, agentsTemplateContent, "utf-8");
          success(`Overwrote AGENTS.md: ${agentsPath}`);
        } else {
          info("AGENTS.md already contains Enact configuration, skipping");
          info("Use --force to overwrite");
        }
      } else {
        const newContent = `${existingContent.trimEnd()}\n\n${agentsTemplateContent}`;
        writeFileSync(agentsPath, newContent, "utf-8");
        success(`Appended Enact configuration to existing AGENTS.md: ${agentsPath}`);
      }
    } else {
      writeFileSync(agentsPath, agentsTemplateContent, "utf-8");
      success(`Created AGENTS.md: ${agentsPath}`);
    }

    if (createAgentsSkillsJson(targetDir, options.force ?? false)) {
      success("Created agents/skills.json");
    }

    info("");
    info("This file helps AI agents understand how to use Enact tools in your project.");
    info("Run 'enact search <query>' to find tools, 'enact learn <tool>' to view docs,");
    info("and 'enact install <tool>' to add them.");
    return;
  }

  // Handle default mode: create skill.package.yaml + hello.py
  const packagePath = join(targetDir, "skill.package.yaml");
  const scriptPath = join(targetDir, "hello.py");

  if (existsSync(packagePath) && !options.force) {
    warning(`skill.package.yaml already exists at: ${packagePath}`);
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
  const packageContent = loadTemplate("skill-package.yaml", replacements);
  const scriptContent = loadTemplate("skill-script.py");

  // Ensure directory exists
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  // Write skill.package.yaml
  writeFileSync(packagePath, packageContent, "utf-8");
  success(`Created skill.package.yaml: ${packagePath}`);

  // Write hello.py (only if it doesn't exist or --force is used)
  if (!existsSync(scriptPath) || options.force) {
    writeFileSync(scriptPath, scriptContent, "utf-8");
    success(`Created hello.py: ${scriptPath}`);
  } else {
    info("hello.py already exists, skipping (use --force to overwrite)");
  }

  info("");
  info("Next steps:");
  info("  1. Edit skill.package.yaml to customize your tool");
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
    .option("--tool", "Create a new Enact tool (SKILL.md + AGENTS.md)")
    .option("--agent", "Create AGENTS.md + agents/skills.json")
    .option("--claude", "Create CLAUDE.md + agents/skills.json")
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

        // Check for updates (non-blocking, after successful init)
        const updateInfo = await checkForUpdates(version);
        if (updateInfo) {
          info("");
          info(`Update available: ${updateInfo.currentVersion} → ${updateInfo.latestVersion}`);
          info(`Run: ${updateInfo.updateCommand}`);
        }
      } catch (err) {
        error(formatError(err));
        process.exit(1);
      }
    });
}

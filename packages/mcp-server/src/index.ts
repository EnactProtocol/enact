#!/usr/bin/env node

/**
 * @enactprotocol/mcp-server
 *
 * MCP protocol server for Enact tool integration.
 * Exposes Enact tools as native MCP tools for AI agents.
 *
 * Supports two transport modes:
 *   - stdio (default): For local integrations (Claude Desktop, etc.)
 *   - Streamable HTTP (--http): For remote/web integrations
 *
 * @see https://modelcontextprotocol.io/specification/2025-03-26/basic/transports
 */

import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { type IncomingMessage, type ServerResponse, createServer } from "node:http";
import { dirname, join } from "node:path";
import {
  createApiClient,
  downloadBundle,
  getToolInfo,
  getToolVersion,
  searchTools,
  verifyAllAttestations,
} from "@enactprotocol/api";
import {
  DaggerExecutionProvider,
  DockerExecutionProvider,
  ExecutionRouter,
  LocalExecutionProvider,
} from "@enactprotocol/execution";
import type { ExecutionResult } from "@enactprotocol/execution";
import { resolveSecret } from "@enactprotocol/secrets";
import {
  type ActionsManifest,
  type ToolManifest,
  addMcpTool,
  addToolToRegistry,
  applyDefaults,
  getActiveToolset,
  getMcpToolInfo,
  getMinimumAttestations,
  getToolCachePath,
  getTrustPolicy,
  isIdentityTrusted,
  listMcpTools,
  loadConfig,
  loadManifestWithActions,
  parseActionSpecifier,
  pathExists,
  validateInputs,
} from "@enactprotocol/shared";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";

export const version = "2.0.2";

/** Default HTTP port for streamable HTTP transport */
const DEFAULT_HTTP_PORT = 3000;

/** Convert Enact tool name to MCP-compatible name (replace slashes with double underscores) */
function toMcpName(enactName: string): string {
  return enactName.replace(/\//g, "__");
}

/** Convert MCP tool name back to Enact format */
function fromMcpName(mcpName: string): string {
  return mcpName.replace(/__/g, "/");
}

/**
 * Resolve secrets from the keyring for a tool's environment variables
 * Only resolves variables marked with secret: true in the manifest
 */
async function resolveManifestSecrets(
  toolName: string,
  manifest: ToolManifest
): Promise<Record<string, string>> {
  const envOverrides: Record<string, string> = {};

  if (!manifest.env) {
    return envOverrides;
  }

  for (const [envName, envDecl] of Object.entries(manifest.env)) {
    // Only resolve secrets (not regular env vars)
    if (envDecl && typeof envDecl === "object" && envDecl.secret) {
      const result = await resolveSecret(toolName, envName);
      if (result.found && result.value) {
        envOverrides[envName] = result.value;
      }
    }
  }

  return envOverrides;
}

/**
 * Get API client for registry access
 */
function getApiClient() {
  const config = loadConfig();
  const registryUrl =
    process.env.ENACT_REGISTRY_URL ??
    config.registry?.url ??
    "https://siikwkfgsmouioodghho.supabase.co/functions/v1";

  // Use anon key for unauthenticated access
  const authToken =
    config.registry?.authToken ??
    process.env.ENACT_AUTH_TOKEN ??
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpaWt3a2Znc21vdWlvb2RnaGhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2MTkzMzksImV4cCI6MjA4MDE5NTMzOX0.kxnx6-IPFhmGx6rzNx36vbyhFMFZKP_jFqaDbKnJ_E0";

  return createApiClient({
    baseUrl: registryUrl,
    authToken,
  });
}

/**
 * Extract a tar.gz bundle to a directory
 */
async function extractBundle(bundleData: ArrayBuffer, destPath: string): Promise<void> {
  const { tmpdir } = await import("node:os");
  const tempFile = join(tmpdir(), `enact-bundle-${Date.now()}.tar.gz`);
  mkdirSync(dirname(tempFile), { recursive: true });
  writeFileSync(tempFile, Buffer.from(bundleData));

  mkdirSync(destPath, { recursive: true });

  await new Promise<void>((resolve, reject) => {
    const proc = spawn("tar", ["-xzf", tempFile, "-C", destPath], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    proc.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Failed to extract bundle: ${stderr}`));
      } else {
        resolve();
      }
    });
  });

  try {
    unlinkSync(tempFile);
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Meta-tools for progressive discovery
 */
const META_TOOLS: Tool[] = [
  {
    name: "enact_search",
    description:
      "Search the Enact registry for tools by capability or keyword. Returns matching tools with names, descriptions, and relevance.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query (e.g., 'web scraping', 'pdf extraction', 'image processing')",
        },
        limit: {
          type: "number",
          description: "Maximum number of results (default: 10, max: 50)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "enact_learn",
    description:
      "Get detailed information about a tool including its input schema, output schema, environment variables, and documentation. Use this to understand how to call a tool correctly.",
    inputSchema: {
      type: "object",
      properties: {
        tool: {
          type: "string",
          description: "Tool name (e.g., 'enact/firecrawl')",
        },
        version: {
          type: "string",
          description: "Specific version (optional, defaults to latest)",
        },
      },
      required: ["tool"],
    },
  },
  {
    name: "enact_run",
    description:
      "Execute any Enact tool by name, even if not installed. The tool runs in a sandboxed container and returns the result.",
    inputSchema: {
      type: "object",
      properties: {
        tool: {
          type: "string",
          description: "Tool name (e.g., 'enact/firecrawl')",
        },
        args: {
          type: "object",
          description: "Arguments to pass to the tool (must match the tool's inputSchema)",
        },
      },
      required: ["tool"],
    },
  },
  {
    name: "enact_install",
    description:
      "Install a tool from the registry for faster subsequent executions. Installed tools appear as native MCP tools.",
    inputSchema: {
      type: "object",
      properties: {
        tool: {
          type: "string",
          description: "Tool name (e.g., 'enact/firecrawl')",
        },
        version: {
          type: "string",
          description: "Specific version (optional, defaults to latest)",
        },
      },
      required: ["tool"],
    },
  },
];

/**
 * Handle meta-tool calls
 */
async function handleMetaTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean } | null> {
  const client = getApiClient();

  switch (toolName) {
    case "enact_search": {
      const query = args.query as string;
      const limit = Math.min((args.limit as number) || 10, 50);

      try {
        const results = await searchTools(client, { query, limit });

        if (results.results.length === 0) {
          return {
            content: [{ type: "text", text: `No tools found for "${query}"` }],
          };
        }

        const formatted = results.results
          .map(
            (r, i) =>
              `${i + 1}. **${r.name}** (v${r.version})\n   ${r.description}\n   Tags: ${r.tags.join(", ") || "none"}`
          )
          .join("\n\n");

        return {
          content: [
            {
              type: "text",
              text: `Found ${results.total} tool(s) matching "${query}":\n\n${formatted}${results.hasMore ? `\n\n...and ${results.total - results.results.length} more` : ""}`,
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text",
              text: `Search failed: ${err instanceof Error ? err.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "enact_learn": {
      const toolNameArg = args.tool as string;
      const versionArg = args.version as string | undefined;

      try {
        // Get tool info
        const info = await getToolInfo(client, toolNameArg);
        const targetVersion = versionArg || info.latestVersion;

        // Get version details with manifest
        const versionInfo = await getToolVersion(client, toolNameArg, targetVersion);

        const manifest = versionInfo.manifest as Record<string, unknown>;
        const doc = versionInfo.rawManifest || "";

        // Format the response
        let response = `# ${toolNameArg}@${targetVersion}\n\n`;
        response += `**Description:** ${versionInfo.description}\n\n`;

        if (manifest.outputSchema) {
          response += `## Output Schema\n\`\`\`json\n${JSON.stringify(manifest.outputSchema, null, 2)}\n\`\`\`\n\n`;
        }

        if (manifest.env) {
          response += `## Environment Variables\n\`\`\`json\n${JSON.stringify(manifest.env, null, 2)}\n\`\`\`\n\n`;
        }

        // Extract markdown documentation from rawManifest (after frontmatter)
        if (doc) {
          const docMatch = doc.match(/---[\s\S]*?---\s*([\s\S]*)/);
          if (docMatch?.[1]?.trim()) {
            response += `## Documentation\n${docMatch[1].trim()}\n`;
          }
        }

        // Check for actions in the manifest
        const actionsManifest = manifest.actions as ActionsManifest | undefined;
        if (
          actionsManifest &&
          typeof actionsManifest.actions === "object" &&
          Object.keys(actionsManifest.actions).length > 0
        ) {
          response += "\n## Available Actions\n\n";
          response += `This tool supports the following actions. Run with \`enact_run\` using \`${toolNameArg}:<action>\` format.\n\n`;

          for (const [actionName, action] of Object.entries(actionsManifest.actions)) {
            response += `### ${actionName}\n`;
            if (action.description) {
              response += `${action.description}\n\n`;
            }
            if (action.inputSchema) {
              response += `**Input Schema:**\n\`\`\`json\n${JSON.stringify(action.inputSchema, null, 2)}\n\`\`\`\n\n`;
            }
          }
        }

        return {
          content: [{ type: "text", text: response }],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to get tool info: ${err instanceof Error ? err.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "enact_run": {
      const toolNameArg = args.tool as string;
      const toolArgs = (args.args as Record<string, unknown>) || {};

      // Parse action specifier (owner/skill/action or owner/skill)
      const { skillName, actionName } = parseActionSpecifier(toolNameArg);

      try {
        // Check if tool is already installed
        const toolInfo = getMcpToolInfo(skillName);
        let manifest: ToolManifest;
        let actionsManifest: ActionsManifest | undefined;
        let cachePath: string;
        let bundleHash: string | undefined;
        let toolVersion: string | undefined;

        const apiClient = getApiClient();

        if (toolInfo) {
          // Tool is installed, use cached version
          const loaded = loadManifestWithActions(toolInfo.cachePath);
          if (!loaded) {
            return {
              content: [{ type: "text", text: "Failed to load installed tool manifest" }],
              isError: true,
            };
          }
          manifest = loaded.manifest;
          actionsManifest = loaded.actionsManifest;
          cachePath = toolInfo.cachePath;
          toolVersion = toolInfo.version;

          // Get bundle hash for installed tool from registry
          try {
            const versionInfo = await getToolVersion(apiClient, skillName, toolVersion);
            bundleHash = versionInfo.bundle.hash;
          } catch {
            // Continue without hash - will skip verification
          }
        } else {
          // Tool not installed - fetch and install temporarily
          const info = await getToolInfo(apiClient, skillName);
          toolVersion = info.latestVersion;

          // Download bundle
          const bundleResult = await downloadBundle(apiClient, {
            name: skillName,
            version: info.latestVersion,
            verify: true,
          });
          bundleHash = bundleResult.hash;

          // Extract to cache
          cachePath = getToolCachePath(skillName, info.latestVersion);
          if (pathExists(cachePath)) {
            rmSync(cachePath, { recursive: true, force: true });
          }
          await extractBundle(bundleResult.data, cachePath);

          // Load manifest with actions
          const loaded = loadManifestWithActions(cachePath);
          if (!loaded) {
            return {
              content: [{ type: "text", text: "Failed to load downloaded tool manifest" }],
              isError: true,
            };
          }
          manifest = loaded.manifest;
          actionsManifest = loaded.actionsManifest;
        }

        // Verify attestations before execution
        let verificationStatus = "⚠️ UNVERIFIED";

        if (bundleHash && toolVersion) {
          try {
            const verified = await verifyAllAttestations(
              apiClient,
              skillName,
              toolVersion,
              bundleHash
            );

            if (verified.length > 0) {
              const auditorList = verified.map((v) => v.providerIdentity).join(", ");
              verificationStatus = `✅ VERIFIED by: ${auditorList}`;
            } else {
              verificationStatus = "⚠️ UNVERIFIED - No valid attestations found";
            }
          } catch (verifyErr) {
            verificationStatus = `⚠️ UNVERIFIED - Verification failed: ${verifyErr instanceof Error ? verifyErr.message : "Unknown error"}`;
          }
        } else {
          verificationStatus = "⚠️ UNVERIFIED - Could not determine bundle hash";
        }

        // Enforce trust policy
        const trustPolicy = getTrustPolicy();
        const minimumAttestations = getMinimumAttestations();

        // Count verified attestations from trusted auditors
        let verifiedCount = 0;
        if (bundleHash && toolVersion) {
          try {
            const verified = await verifyAllAttestations(
              apiClient,
              skillName,
              toolVersion,
              bundleHash
            );
            verifiedCount = verified.filter((v) => isIdentityTrusted(v.providerIdentity)).length;
          } catch {
            // Already handled above in verificationStatus
          }
        }

        // Check if trust requirements are met
        if (verifiedCount < minimumAttestations) {
          if (trustPolicy === "require_attestation") {
            return {
              content: [
                {
                  type: "text",
                  text: `Trust policy violation: Tool requires ${minimumAttestations} attestation(s) from trusted auditors, but only ${verifiedCount} found.\n\nConfigured trust policy: ${trustPolicy}\nTo run unverified tools, update your ~/.enact/config.yaml trust policy to 'allow' or 'prompt'.`,
                },
              ],
              isError: true,
            };
          }
          if (trustPolicy === "prompt") {
            // In MCP context, we can't prompt interactively, so we block with a clear message
            return {
              content: [
                {
                  type: "text",
                  text: `Trust policy violation: Tool requires ${minimumAttestations} attestation(s) from trusted auditors, but only ${verifiedCount} found.\n\nConfigured trust policy: ${trustPolicy}\nMCP server cannot prompt interactively. To run unverified tools via MCP, update your ~/.enact/config.yaml trust policy to 'allow'.`,
                },
              ],
              isError: true,
            };
          }
          // policy === 'allow' - continue execution with warning
        }

        // Resolve secrets from keyring
        const secretOverrides = await resolveManifestSecrets(skillName, manifest);

        // Execute the tool or action — select backend via execution router
        const execConfig = loadConfig();
        const router = new ExecutionRouter({
          default: execConfig.execution?.default,
          fallback: execConfig.execution?.fallback,
          trusted_scopes: execConfig.execution?.trusted_scopes,
        });
        router.registerProvider("local", new LocalExecutionProvider({ verbose: false }));
        router.registerProvider("docker", new DockerExecutionProvider({ verbose: false }));
        router.registerProvider("dagger", new DaggerExecutionProvider({ verbose: false }));

        const provider = await router.selectProvider(skillName);
        await provider.initialize();

        let result: ExecutionResult;

        // Check if we need to execute an action
        if (actionName && actionsManifest) {
          // Find the action in the manifest (map lookup)
          const action = actionsManifest.actions[actionName];
          if (!action) {
            const availableActions = Object.keys(actionsManifest.actions).join(", ");
            return {
              content: [
                {
                  type: "text",
                  text: `Action "${actionName}" not found in ${skillName}. Available actions: ${availableActions}`,
                },
              ],
              isError: true,
            };
          }

          // Use action's inputSchema for validation (optional, default to empty)
          const effectiveSchema = action.inputSchema ?? { type: "object" as const, properties: {} };
          const inputsWithDefaults = applyDefaults(toolArgs, effectiveSchema);

          const validation = validateInputs(inputsWithDefaults, effectiveSchema);
          if (!validation.valid) {
            const errors = validation.errors.map((err) => `${err.path}: ${err.message}`).join(", ");
            return {
              content: [{ type: "text", text: `Input validation failed: ${errors}` }],
              isError: true,
            };
          }

          const finalInputs = validation.coercedValues ?? inputsWithDefaults;

          // Execute the action
          result = await provider.executeAction(
            manifest,
            actionsManifest,
            actionName,
            action,
            { params: finalInputs, envOverrides: secretOverrides },
            { mountDirs: { [cachePath]: "/workspace" } }
          );
        } else {
          // Execute the tool normally (no per-script schema — pass params through)
          result = await provider.execute(
            manifest,
            { params: toolArgs, envOverrides: secretOverrides },
            { mountDirs: { [cachePath]: "/workspace" } }
          );
        }

        if (result.success) {
          const output = result.output?.stdout || "Tool executed successfully (no output)";
          return {
            content: [
              {
                type: "text",
                text: `[${verificationStatus}]\n\n${output}`,
              },
            ],
          };
        }
        return {
          content: [
            {
              type: "text",
              text: `[${verificationStatus}]\n\nTool execution failed: ${result.error?.message || "Unknown error"}\n\n${result.output?.stderr || ""}`,
            },
          ],
          isError: true,
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to run tool: ${err instanceof Error ? err.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "enact_install": {
      const toolNameArg = args.tool as string;
      const versionArg = args.version as string | undefined;

      try {
        const apiClient = getApiClient();
        const info = await getToolInfo(apiClient, toolNameArg);
        const targetVersion = versionArg || info.latestVersion;

        // Download bundle
        const bundleResult = await downloadBundle(apiClient, {
          name: toolNameArg,
          version: targetVersion,
          verify: true,
        });

        // Extract to cache
        const cachePath = getToolCachePath(toolNameArg, targetVersion);
        if (pathExists(cachePath)) {
          rmSync(cachePath, { recursive: true, force: true });
        }
        await extractBundle(bundleResult.data, cachePath);

        // Add to MCP tools registry
        addToolToRegistry(toolNameArg, targetVersion, "global");
        addMcpTool(toolNameArg, targetVersion);

        return {
          content: [
            {
              type: "text",
              text: `Successfully installed ${toolNameArg}@${targetVersion}. The tool is now available as a native MCP tool.`,
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to install tool: ${err instanceof Error ? err.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }

    default:
      return null; // Not a meta-tool
  }
}

/**
 * Create and configure the MCP server with Enact tool handlers
 */
function createMcpServer(): Server {
  const server = new Server(
    {
      name: "enact-mcp-server",
      version: version,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List all MCP-exposed tools (respects active toolset) plus meta-tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const mcpTools = listMcpTools();
    const activeToolset = getActiveToolset();

    // Start with meta-tools for progressive discovery
    const tools: Tool[] = [...META_TOOLS];

    // Add installed tools and their actions
    for (const tool of mcpTools) {
      const loaded = loadManifestWithActions(tool.cachePath);
      const manifest = loaded?.manifest;
      const actionsManifest = loaded?.actionsManifest;

      const toolsetNote = activeToolset ? ` [toolset: ${activeToolset}]` : "";

      // If the tool has actions, expose each action as a separate MCP tool
      if (
        actionsManifest &&
        typeof actionsManifest.actions === "object" &&
        Object.keys(actionsManifest.actions).length > 0
      ) {
        for (const [actionName, action] of Object.entries(actionsManifest.actions)) {
          // Action tool name format: owner__skill__action (uses colon internally but double underscore for MCP)
          const actionMcpName = toMcpName(`${tool.name}:${actionName}`);

          tools.push({
            name: actionMcpName,
            description:
              (action.description || `Action ${actionName} of ${tool.name}`) + toolsetNote,
            inputSchema: action.inputSchema
              ? (action.inputSchema as Tool["inputSchema"])
              : { type: "object", properties: {} },
          });
        }
      } else {
        // No actions, expose the tool itself
        const description = manifest?.description || `Enact tool: ${tool.name}`;

        tools.push({
          name: toMcpName(tool.name),
          description: description + toolsetNote,
          inputSchema: { type: "object", properties: {} },
        });
      }
    }

    return { tools };
  });

  // Execute tool requests
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const mcpToolName = request.params.name;
    const enactToolName = fromMcpName(mcpToolName);
    const args = (request.params.arguments as Record<string, unknown>) || {};

    // Check if this is a meta-tool first
    const metaResult = await handleMetaTool(mcpToolName, args);
    if (metaResult) {
      return metaResult;
    }

    // Parse action specifier (owner/skill/action or owner/skill)
    const { skillName, actionName } = parseActionSpecifier(enactToolName);

    // Find the tool in MCP registry (respects active toolset)
    const toolInfo = getMcpToolInfo(skillName);

    if (!toolInfo) {
      const activeToolset = getActiveToolset();
      const toolsetHint = activeToolset
        ? ` It may not be in the active toolset '${activeToolset}'.`
        : "";
      return {
        content: [
          {
            type: "text",
            text: `Error: Tool "${skillName}" not found.${toolsetHint} Use 'enact mcp add <tool>' to add it.`,
          },
        ],
        isError: true,
      };
    }

    // Load manifest with actions
    const loaded = loadManifestWithActions(toolInfo.cachePath);
    if (!loaded) {
      return {
        content: [
          {
            type: "text",
            text: `Error: Failed to load manifest for "${skillName}"`,
          },
        ],
        isError: true,
      };
    }

    const manifest = loaded.manifest;
    const actionsManifest = loaded.actionsManifest;

    // Resolve secrets from keyring
    const secretOverrides = await resolveManifestSecrets(skillName, manifest);

    // Execute the tool — select backend via execution router
    const execConfig2 = loadConfig();
    const router2 = new ExecutionRouter({
      default: execConfig2.execution?.default,
      fallback: execConfig2.execution?.fallback,
      trusted_scopes: execConfig2.execution?.trusted_scopes,
    });
    router2.registerProvider("local", new LocalExecutionProvider({ verbose: false }));
    router2.registerProvider("docker", new DockerExecutionProvider({ verbose: false }));
    router2.registerProvider("dagger", new DaggerExecutionProvider({ verbose: false }));

    const provider = await router2.selectProvider(skillName);

    try {
      await provider.initialize();

      let result: ExecutionResult;

      // Check if we need to execute an action
      if (actionName && actionsManifest) {
        // Find the action in the manifest (map lookup)
        const action = actionsManifest.actions[actionName];
        if (!action) {
          const availableActions = Object.keys(actionsManifest.actions).join(", ");
          return {
            content: [
              {
                type: "text",
                text: `Action "${actionName}" not found in ${skillName}. Available actions: ${availableActions}`,
              },
            ],
            isError: true,
          };
        }

        // Use action's inputSchema for validation (optional, default to empty)
        const effectiveSchema = action.inputSchema ?? { type: "object" as const, properties: {} };
        const inputsWithDefaults = applyDefaults(args, effectiveSchema);

        const validation = validateInputs(inputsWithDefaults, effectiveSchema);
        if (!validation.valid) {
          const errors = validation.errors.map((err) => `${err.path}: ${err.message}`).join(", ");
          return {
            content: [
              {
                type: "text",
                text: `Input validation failed: ${errors}`,
              },
            ],
            isError: true,
          };
        }

        const finalInputs = validation.coercedValues ?? inputsWithDefaults;

        // Execute the action
        result = await provider.executeAction(
          manifest,
          actionsManifest,
          actionName,
          action,
          { params: finalInputs, envOverrides: secretOverrides },
          { mountDirs: { [toolInfo.cachePath]: "/workspace" } }
        );
      } else {
        // Check if this is an instruction-based tool (no command)
        if (!manifest.command) {
          // Return the documentation/instructions for LLM interpretation
          const instructions = manifest.doc || manifest.description || "No instructions available.";
          return {
            content: [
              {
                type: "text",
                text: `[Instruction Tool: ${skillName}]\n\n${instructions}\n\nInputs provided: ${JSON.stringify(args, null, 2)}`,
              },
            ],
          };
        }

        // Execute the tool normally (no per-script schema — pass params through)
        result = await provider.execute(
          manifest,
          { params: args, envOverrides: secretOverrides },
          { mountDirs: { [toolInfo.cachePath]: "/workspace" } }
        );
      }

      if (result.success) {
        return {
          content: [
            {
              type: "text",
              text: result.output?.stdout || "Tool executed successfully (no output)",
            },
          ],
        };
      }
      return {
        content: [
          {
            type: "text",
            text: `Tool execution failed: ${result.error?.message || "Unknown error"}\n\n${result.output?.stderr || ""}`,
          },
        ],
        isError: true,
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `Tool execution error: ${err instanceof Error ? err.message : "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

/**
 * Start server with stdio transport (default mode)
 */
async function startStdioServer(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Enact MCP Server running on stdio");
}

/**
 * Start server with Streamable HTTP transport
 */
async function startHttpServer(port: number): Promise<void> {
  const server = createMcpServer();

  // Track sessions for stateful mode
  const sessions = new Map<string, StreamableHTTPServerTransport>();

  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // Enable CORS for browser-based clients
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Mcp-Session-Id");
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");

    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    // Only handle /mcp endpoint
    const url = new URL(req.url || "/", `http://localhost:${port}`);
    if (url.pathname !== "/mcp") {
      // Health check endpoint
      if (url.pathname === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", version }));
        return;
      }

      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not Found", path: url.pathname }));
      return;
    }

    // Get or create session
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (sessionId && sessions.has(sessionId)) {
      // Existing session
      const transport = sessions.get(sessionId)!;
      await transport.handleRequest(req, res);
    } else if (req.method === "POST") {
      // New session - create transport
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
      });

      // Set up cleanup on close
      transport.onclose = () => {
        if (transport.sessionId) {
          sessions.delete(transport.sessionId);
        }
      };

      // Connect server to transport (cast to satisfy exactOptionalPropertyTypes)
      await server.connect(transport as Parameters<typeof server.connect>[0]);

      // Handle the request
      await transport.handleRequest(req, res);

      // Store session if one was created
      if (transport.sessionId) {
        sessions.set(transport.sessionId, transport);
      }
    } else if (req.method === "DELETE" && sessionId) {
      // Session termination request for unknown session
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Session not found" }));
    } else {
      // Invalid request
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ error: "Bad Request", message: "Invalid request for MCP endpoint" })
      );
    }
  });

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.error("\nShutting down...");
    for (const transport of sessions.values()) {
      await transport.close();
    }
    httpServer.close();
    process.exit(0);
  });

  httpServer.listen(port, () => {
    console.error(`Enact MCP Server running on http://localhost:${port}/mcp`);
    console.error(`Health check: http://localhost:${port}/health`);
    console.error("\nSupported endpoints:");
    console.error("  POST /mcp - JSON-RPC requests");
    console.error("  GET  /mcp - SSE stream for server notifications");
    console.error("  DELETE /mcp - Terminate session");
  });
}

/**
 * Parse command line arguments
 */
function parseArgs(): { http: boolean; port: number } {
  const args = process.argv.slice(2);
  let http = false;
  let port = DEFAULT_HTTP_PORT;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--http") {
      http = true;
    } else if (arg === "--port" || arg === "-p") {
      const nextArg = args[i + 1];
      if (nextArg) {
        port = Number.parseInt(nextArg, 10);
        i++;
      }
    } else if (arg?.startsWith("--port=")) {
      port = Number.parseInt(arg.split("=")[1] || String(DEFAULT_HTTP_PORT), 10);
    }
  }

  return { http, port };
}

// Main entry point for MCP server
if (import.meta.main) {
  const { http, port } = parseArgs();

  if (http) {
    await startHttpServer(port);
  } else {
    await startStdioServer();
  }
}

// Export for programmatic use
export { createMcpServer, startStdioServer, startHttpServer };

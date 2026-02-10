#!/usr/bin/env bun
/**
 * Enact Demo Bot
 *
 * An autonomous agent loop powered by ChatGPT that discovers and runs
 * Enact skills. ChatGPT is given every discovered skill as a tool and
 * is forced to always call one (tool_choice: "required"), creating a
 * continuous loop of skill invocations.
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... bun run demo-bot.ts [--rounds 5] [--goal "do something fun"]
 */

import OpenAI from "openai";
import { execSync } from "child_process";
import { readdirSync, readFileSync, existsSync } from "fs";
import { resolve, join } from "path";
import { parse as parseYaml } from "yaml";

// ── Preflight ───────────────────────────────────────────────────────

if (!process.env.OPENAI_API_KEY) {
  console.error("Error: OPENAI_API_KEY is not set.\n");
  console.error("  OPENAI_API_KEY=sk-... bun run demo-bot.ts\n");
  process.exit(1);
}

// ── Config ──────────────────────────────────────────────────────────

const MAX_ROUNDS = parseInt(process.argv.find((_, i, a) => a[i - 1] === "--rounds") ?? "5", 10);
const GOAL =
  process.argv.find((_, i, a) => a[i - 1] === "--goal") ??
  "Explore all the available enact skills. Try each one with creative inputs and comment on the results. Have fun!";
const ENACT_CMD = process.env.ENACT_CMD ?? "enact-dev";
const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o";

// ── Skill Discovery ─────────────────────────────────────────────────

interface SkillInfo {
  name: string;
  description: string;
  path: string;
  source: "local" | "registry";
  inputSchema: Record<string, unknown>;
}

/**
 * Discover skills from the enact registry via `enact search --json`.
 * Registry tools are properly cached when fetched, so they work reliably.
 */
function discoverRegistrySkills(): SkillInfo[] {
  try {
    const raw = execSync(`${ENACT_CMD} search "*" --json`, {
      encoding: "utf-8",
      timeout: 15_000,
    });
    const data = JSON.parse(raw);
    return (data.results ?? []).map((r: any) => ({
      name: r.name.replace(/\/versions$/, ""),
      description: r.description ?? "No description",
      path: r.name.replace(/\/versions$/, ""),
      source: "registry" as const,
      inputSchema: { type: "object", properties: {} },
    }));
  } catch {
    return [];
  }
}

/**
 * Discover skills by scanning the examples/ directory for SKILL.md files,
 * parsing their YAML frontmatter to extract name, description, and inputSchema.
 */
function discoverLocalSkills(): SkillInfo[] {
  const examplesDir = resolve(import.meta.dir, "..");
  const skills: SkillInfo[] = [];

  for (const entry of readdirSync(examplesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name === "demo-bot") continue; // skip ourselves
    const skillPath = join(examplesDir, entry.name);
    const skillMd = join(skillPath, "SKILL.md");
    if (!existsSync(skillMd)) continue;

    const content = readFileSync(skillMd, "utf-8");
    const frontmatter = extractFrontmatter(content);
    if (!frontmatter) continue;
    if (!frontmatter.command) continue; // skip non-executable skills (e.g. guides)

    skills.push({
      name: frontmatter.name ?? entry.name,
      description: frontmatter.description ?? "No description",
      path: skillPath,
      source: "local",
      inputSchema: frontmatter.inputSchema ?? { type: "object", properties: {} },
    });
  }

  return skills;
}

function extractFrontmatter(md: string): Record<string, any> | null {
  const match = md.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  try {
    return parseYaml(match[1]);
  } catch {
    return null;
  }
}

// ── Trust Policy ────────────────────────────────────────────────────

let originalTrustPolicy: string | null = null;

function ensureTrustPolicyAllow(): void {
  try {
    const current = execSync(`${ENACT_CMD} config get trust.policy`, {
      encoding: "utf-8",
      timeout: 5_000,
    }).trim();
    // Parse "trust.policy: prompt" format
    originalTrustPolicy = current.split(":").pop()?.trim() ?? null;
  } catch {
    originalTrustPolicy = null;
  }

  if (originalTrustPolicy !== "allow") {
    try {
      execSync(`${ENACT_CMD} config set trust.policy allow`, { timeout: 5_000 });
      console.log(`  (trust policy set to "allow" for demo — will restore on exit)\n`);
    } catch {
      console.log("  (warning: could not set trust.policy to allow — registry tools may fail)\n");
    }
  }
}

function restoreTrustPolicy(): void {
  if (originalTrustPolicy && originalTrustPolicy !== "allow") {
    try {
      execSync(`${ENACT_CMD} config set trust.policy ${originalTrustPolicy}`, { timeout: 5_000 });
    } catch {
      // best-effort
    }
  }
}

// ── Enact Execution ─────────────────────────────────────────────────

function runEnactSkill(skill: SkillInfo, args: Record<string, unknown>): string {
  const argsJson = JSON.stringify(args);
  // Registry tools: use name directly. Local tools: use absolute path.
  const toolRef = skill.source === "registry" ? skill.path : JSON.stringify(skill.path);
  const cmd = `${ENACT_CMD} run ${toolRef} --args ${JSON.stringify(argsJson)} --json`;

  console.log(`\n  ⚡ ${cmd}\n`);

  try {
    const output = execSync(cmd, {
      encoding: "utf-8",
      timeout: 120_000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const parsed = JSON.parse(output);
    if (parsed.success) {
      return parsed.output?.stdout?.trim() || JSON.stringify(parsed.output);
    } else {
      return `Error: ${parsed.error?.message ?? "unknown"}\nstderr: ${parsed.output?.stderr ?? ""}`;
    }
  } catch (err: any) {
    const combined = (err.stdout ?? "") + (err.stderr ?? "");
    try {
      const parsed = JSON.parse(combined);
      return `Error: ${parsed.error?.message ?? "execution failed"}\nstderr: ${parsed.output?.stderr ?? ""}`;
    } catch {
      return `Execution failed: ${combined.slice(0, 500)}`;
    }
  }
}

// ── OpenAI Tool Conversion ──────────────────────────────────────────

function skillToOpenAITool(skill: SkillInfo): OpenAI.Chat.Completions.ChatCompletionTool {
  // OpenAI requires function names to match ^[a-zA-Z0-9_-]+$
  const safeName = skill.name.replace(/[^a-zA-Z0-9_-]/g, "_");

  const params = { ...skill.inputSchema } as Record<string, unknown>;
  if (!params.type) params.type = "object";
  if (!params.properties) params.properties = {};

  return {
    type: "function",
    function: {
      name: safeName,
      description: `[Enact Skill] ${skill.description}`,
      parameters: params,
    },
  };
}

// ── Agent Loop ──────────────────────────────────────────────────────

async function main() {
  const openai = new OpenAI();

  // Discover skills
  console.log("🔍 Discovering enact skills...\n");

  // Registry tools first (they work most reliably)
  const registrySkills = discoverRegistrySkills();
  const localSkills = discoverLocalSkills();

  // Merge: prefer local skills (they have real inputSchemas), dedup by name
  const seen = new Set<string>();
  const allSkills: SkillInfo[] = [];
  for (const skill of [...localSkills, ...registrySkills]) {
    if (seen.has(skill.name)) continue;
    seen.add(skill.name);
    allSkills.push(skill);
  }

  if (allSkills.length === 0) {
    console.error("No skills found! Make sure you have examples/ or a registry configured.");
    process.exit(1);
  }

  // Set trust policy to "allow" so registry tools can run without interactive prompts
  const hasRegistrySkills = allSkills.some((s) => s.source === "registry");
  if (hasRegistrySkills) {
    ensureTrustPolicyAllow();
  }

  // Restore trust policy on exit
  process.on("exit", restoreTrustPolicy);
  process.on("SIGINT", () => {
    restoreTrustPolicy();
    process.exit(130);
  });

  // Build lookup and OpenAI tools
  const skillMap = new Map<string, SkillInfo>();
  const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [];

  for (const skill of allSkills) {
    const tool = skillToOpenAITool(skill);
    skillMap.set(tool.function.name, skill);
    tools.push(tool);
  }

  console.log(`Found ${allSkills.length} skills:\n`);
  for (const skill of allSkills) {
    console.log(`  • ${skill.name} [${skill.source}] — ${skill.description}`);
  }

  // Start the agent loop
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: [
        "You are an autonomous demo bot that explores Enact skills.",
        "You MUST call exactly one skill tool on every turn. Pick whichever skill seems most interesting or relevant.",
        "After seeing a result, comment briefly on it, then call another skill.",
        "Be creative with your inputs — try different names, texts, data, etc.",
        "If a skill errors, note it and move on to a different skill.",
        "You have these skills available as tools. Try to use a variety!",
      ].join("\n"),
    },
    {
      role: "user",
      content: GOAL,
    },
  ];

  console.log(`\n${"═".repeat(60)}`);
  console.log(`  GOAL: ${GOAL}`);
  console.log(`  MODEL: ${MODEL}  |  ROUNDS: ${MAX_ROUNDS}`);
  console.log(`${"═".repeat(60)}\n`);

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    console.log(`\n── Round ${round}/${MAX_ROUNDS} ${"─".repeat(42)}\n`);

    let response: OpenAI.Chat.Completions.ChatCompletion;
    try {
      response = await openai.chat.completions.create({
        model: MODEL,
        messages,
        tools,
        tool_choice: "required",
      });
    } catch (err: any) {
      if (err?.status === 401) {
        console.error("Authentication failed — check your OPENAI_API_KEY.");
      } else {
        console.error(`OpenAI API error: ${err?.message ?? err}`);
      }
      process.exit(1);
    }

    const choice = response.choices[0];
    if (!choice?.message) {
      console.log("No response from ChatGPT. Stopping.");
      break;
    }

    const assistantMsg = choice.message;
    messages.push(assistantMsg);

    // Print any text the model said
    if (assistantMsg.content) {
      console.log(`🤖 ${assistantMsg.content}\n`);
    }

    // Process tool calls
    const toolCalls = assistantMsg.tool_calls ?? [];
    if (toolCalls.length === 0) {
      console.log("No tool call made. Stopping.");
      break;
    }

    for (const toolCall of toolCalls) {
      const fnName = toolCall.function.name;
      const skill = skillMap.get(fnName);

      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(toolCall.function.arguments || "{}");
      } catch {
        args = {};
      }

      console.log(`🎯 Calling: ${skill?.name ?? fnName}`);
      console.log(`   Args: ${JSON.stringify(args)}`);

      let result: string;
      if (skill) {
        result = runEnactSkill(skill, args);
      } else {
        result = `Unknown skill: ${fnName}`;
      }

      console.log(`   Result: ${result.slice(0, 500)}${result.length > 500 ? "..." : ""}`);

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: result,
      });
    }
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log("  Demo complete!");
  console.log(`${"═".repeat(60)}\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

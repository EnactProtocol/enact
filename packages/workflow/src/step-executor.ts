/**
 * Step executor — runs a single workflow step
 *
 * Adapts the enact run command's execution flow for non-interactive use.
 * Resolves tools locally first; falls back to registry fetch if not found.
 */

import { mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  createApiClient,
  downloadBundle,
  getAttestationList,
  getToolInfo,
  getToolVersion,
  verifyAllAttestations,
} from "@enactprotocol/api";
import {
  BinaryExecutionProvider,
  DaggerExecutionProvider,
  DockerExecutionProvider,
  type ExecutionProvider,
  type ExecutionResult,
  ExecutionRouter,
  LocalExecutionProvider,
} from "@enactprotocol/execution";
import { resolveSecrets, resolveToolEnv } from "@enactprotocol/secrets";
import {
  type EnactConfig,
  type ToolResolution,
  getCacheDir,
  getMinimumAttestations,
  getTrustPolicy,
  getTrustedAuditors,
  toolNameToPath,
  tryResolveTool,
} from "@enactprotocol/shared";
import { collectSecretRefs, evaluateCondition, expandObject } from "./expression.js";
import type { EvaluationContext, StepResult, WorkflowStep } from "./types.js";
import { WorkflowStepError } from "./types.js";

// ─── Tool spec parsing ─────────────────────────────────────────────────────

interface ParsedUses {
  skillName: string;
  actionName: string | undefined;
  version: string | undefined;
}

/**
 * Parse the `uses:` field: "owner/skill:action@version"
 */
function parseUses(uses: string): ParsedUses {
  // Split off version
  const atIdx = uses.lastIndexOf("@");
  let base = uses;
  let version: string | undefined;
  if (atIdx !== -1) {
    base = uses.slice(0, atIdx);
    version = uses.slice(atIdx + 1).replace(/^v/, "");
  }

  // Split off action
  const colonIdx = base.indexOf(":");
  let skillName = base;
  let actionName: string | undefined;
  if (colonIdx !== -1) {
    skillName = base.slice(0, colonIdx);
    actionName = base.slice(colonIdx + 1);
  }

  return { skillName, actionName, version };
}

// ─── Registry fetch ────────────────────────────────────────────────────────

/**
 * Non-interactive version of fetchAndCacheTool.
 * Respects trust policy but never prompts — throws on policy violations.
 */
async function fetchAndCacheToolForWorkflow(
  skillName: string,
  version: string | undefined,
  config: EnactConfig
): Promise<ToolResolution> {
  const registryUrl =
    process.env.ENACT_REGISTRY_URL ??
    config.registry?.url ??
    "https://siikwkfgsmouioodghho.supabase.co/functions/v1";

  const authToken =
    config.registry?.authToken ??
    process.env.ENACT_AUTH_TOKEN ??
    (registryUrl.includes("siikwkfgsmouioodghho.supabase.co")
      ? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpaWt3a2Znc21vdWlvb2RnaGhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2MTkzMzksImV4cCI6MjA4MDE5NTMzOX0.kxnx6-IPFhmGx6rzNx36vbyhFMFZKP_jFqaDbKnJ_E0"
      : undefined);

  const client = createApiClient({ baseUrl: registryUrl, authToken });

  const toolInfo = await getToolInfo(client, skillName);
  const targetVersion = version ?? toolInfo.latestVersion;

  if (!targetVersion) {
    throw new WorkflowStepError(skillName, `No published versions for ${skillName}`);
  }

  // Check cache first
  const cached = tryResolveTool(skillName, {
    skipProject: true,
    skipUser: true,
    version: targetVersion,
  });
  if (cached) return cached;

  const versionInfo = await getToolVersion(client, skillName, targetVersion);

  // Trust verification (non-interactive — throw on violations)
  const trustPolicy = getTrustPolicy();
  const minimumAttestations = getMinimumAttestations();
  const trustedAuditors = getTrustedAuditors();

  const attestationsResponse = await getAttestationList(client, skillName, targetVersion);
  const attestations = attestationsResponse.attestations;

  if (attestations.length === 0 && minimumAttestations > 0) {
    if (trustPolicy === "require_attestation") {
      throw new WorkflowStepError(
        skillName,
        `Trust policy requires attestations but ${skillName}@${targetVersion} has none.`
      );
    }
    // "allow" or "prompt" in non-interactive — warn and continue
    console.warn(
      `[workflow] Warning: ${skillName}@${targetVersion} has no attestations. Running anyway (trust policy: ${trustPolicy}).`
    );
  } else if (attestations.length > 0) {
    const verifiedAuditors = await verifyAllAttestations(
      client,
      skillName,
      targetVersion,
      versionInfo.bundle.hash ?? ""
    );

    const trustedVerified = verifiedAuditors.filter((a) =>
      trustedAuditors.includes(a.providerIdentity)
    );

    if (trustedVerified.length === 0 && trustPolicy === "require_attestation") {
      throw new WorkflowStepError(
        skillName,
        `Trust policy requires attestations from trusted identities, but none found for ${skillName}@${targetVersion}.`
      );
    }

    if (trustedVerified.length < minimumAttestations && trustPolicy === "require_attestation") {
      throw new WorkflowStepError(
        skillName,
        `Trust policy requires ${minimumAttestations} trusted attestation(s) but only ${trustedVerified.length} found for ${skillName}@${targetVersion}.`
      );
    }
  }

  // Download and extract
  const bundleResult = await downloadBundle(client, {
    name: skillName,
    version: targetVersion,
    verify: true,
    acknowledgeYanked: versionInfo.yanked,
  });

  if (versionInfo.bundle.hash) {
    const downloaded = bundleResult.hash.replace("sha256:", "");
    const expected = versionInfo.bundle.hash.replace("sha256:", "");
    if (downloaded !== expected) {
      throw new WorkflowStepError(
        skillName,
        `Bundle hash mismatch for ${skillName}@${targetVersion} — download may be corrupted.`
      );
    }
  }

  await extractToCache(bundleResult.data, skillName, targetVersion);

  const resolution = tryResolveTool(skillName, {
    skipProject: true,
    skipUser: true,
    version: targetVersion,
  });

  if (!resolution) {
    throw new WorkflowStepError(skillName, `Failed to resolve cached tool ${skillName}`);
  }

  return resolution;
}

async function extractToCache(
  bundleData: ArrayBuffer,
  toolName: string,
  _version: string
): Promise<string> {
  const cacheDir = getCacheDir();
  const toolPath = toolNameToPath(toolName);
  const destDir = join(cacheDir, toolPath);

  const tempFile = join(cacheDir, `bundle-${Date.now()}.tar.gz`);
  mkdirSync(dirname(tempFile), { recursive: true });
  writeFileSync(tempFile, Buffer.from(bundleData));

  mkdirSync(destDir, { recursive: true });

  const proc = Bun.spawn(["tar", "-xzf", tempFile, "-C", destDir], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const exitCode = await proc.exited;

  try {
    unlinkSync(tempFile);
  } catch {
    // ignore cleanup errors
  }

  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`Failed to extract bundle: ${stderr}`);
  }

  return destDir;
}

// ─── Output extraction ─────────────────────────────────────────────────────

/**
 * Extract step outputs from execution result.
 * Priority: parsed JSON object → JSON.parse(stdout) → { text: stdout }
 */
function extractOutputs(stdout: string, parsed: unknown): Record<string, unknown> {
  if (parsed !== undefined && parsed !== null && typeof parsed === "object") {
    return parsed as Record<string, unknown>;
  }
  if (stdout.trim()) {
    try {
      const json = JSON.parse(stdout);
      if (json !== null && typeof json === "object") {
        return json as Record<string, unknown>;
      }
    } catch {
      // not JSON
    }
    return { text: stdout };
  }
  return {};
}

// ─── Main executor ─────────────────────────────────────────────────────────

export interface StepExecutorOptions {
  forceLocal?: boolean | undefined;
  verbose?: boolean | undefined;
  cwd?: string | undefined;
}

/**
 * Execute a single workflow step.
 */
export async function executeStep(
  step: WorkflowStep,
  ctx: EvaluationContext,
  config: EnactConfig,
  options: StepExecutorOptions = {}
): Promise<StepResult> {
  const startTime = Date.now();
  const cwd = options.cwd ?? process.cwd();

  // Evaluate if: condition
  if (step.if !== undefined) {
    const shouldRun = evaluateCondition(step.if, ctx);
    if (!shouldRun) {
      return {
        stepId: step.id,
        stepName: step.name,
        status: "skipped",
        outputs: {},
        durationMs: Date.now() - startTime,
      };
    }
  }

  if (!step.uses) {
    // Model steps are not handled by this executor yet
    return {
      stepId: step.id,
      stepName: step.name,
      status: "skipped",
      outputs: {},
      durationMs: Date.now() - startTime,
      error: `Step "${step.id}" has no 'uses' field — model steps are not yet supported by the runner`,
    };
  }

  // Parse uses field
  const { skillName, actionName, version } = parseUses(step.uses);

  try {
    // Resolve tool locally first
    let resolution = tryResolveTool(skillName, {
      startDir: cwd,
      ...(version !== undefined ? { version } : {}),
    });

    // Fetch from registry if not found locally and local mode not forced
    if (!resolution && !options.forceLocal) {
      resolution = await fetchAndCacheToolForWorkflow(skillName, version, config);
    }

    if (!resolution) {
      throw new WorkflowStepError(
        step.id,
        `Tool "${skillName}" not found locally. Install it with: enact install ${skillName}`
      );
    }

    const { manifest, sourceDir } = resolution;

    // Expand step inputs and env through expression evaluator
    const expandedWith = step.with ? expandObject(step.with, ctx) : {};
    const expandedEnv = step.env ? expandObject(step.env, ctx) : {};

    // Resolve manifest-declared env vars (non-secrets, from .env files)
    const { resolved: toolEnvResolved } = resolveToolEnv(manifest.env ?? {}, cwd);
    const envVars: Record<string, string> = {};
    for (const [key, resolution] of toolEnvResolved) {
      envVars[key] = resolution.value;
    }

    // Resolve manifest-declared secrets
    const secretDeclarations = Object.entries(manifest.env ?? {})
      .filter(([, v]) => v.secret)
      .map(([k]) => k);

    if (secretDeclarations.length > 0) {
      const namespace = manifest.name.split("/").slice(0, -1).join("/") || manifest.name;
      const secretResults = await resolveSecrets(namespace, secretDeclarations);
      for (const [key, result] of secretResults) {
        if (result.found && result.value) {
          envVars[key] = result.value;
        }
      }
    }

    // Resolve secrets referenced in step.env (e.g. SLACK_TOKEN: ${{ secrets.SLACK_TOKEN }})
    // These are already expanded above via expandObject using ctx.secrets
    // Just merge expandedEnv over tool-level env
    for (const [key, value] of Object.entries(expandedEnv)) {
      envVars[key] = value;
    }

    // Resolve action from actionsManifest on the resolution object
    const actionsManifest = resolution.actionsManifest;
    let resolvedAction = actionsManifest?.actions[actionName ?? ""] ?? undefined;

    // Fall back to default action if no explicit action specified
    if (!resolvedAction && !actionName && actionsManifest?.actions?.default) {
      resolvedAction = actionsManifest.actions.default;
    }

    if (actionName && !resolvedAction) {
      const available = Object.keys(actionsManifest?.actions ?? {}).join(", ");
      throw new WorkflowStepError(
        step.id,
        `Action "${actionName}" not found in ${skillName}. Available: ${available || "none"}`
      );
    }

    // Validate that the tool has something to execute
    if (!resolvedAction && !manifest.command) {
      throw new WorkflowStepError(
        step.id,
        `Tool "${skillName}" has no command or action to execute`
      );
    }

    // Select execution provider
    let provider: ExecutionProvider;
    const providerConfig: {
      defaultTimeout?: number;
      verbose?: boolean;
    } = {};
    if (step.timeout !== undefined) {
      providerConfig.defaultTimeout = parseTimeout(step.timeout);
    }
    if (options.verbose !== undefined) {
      providerConfig.verbose = options.verbose;
    }

    if (manifest.binaries) {
      provider = new BinaryExecutionProvider(providerConfig);
    } else {
      const router = new ExecutionRouter({
        default: config.execution?.default,
        fallback: config.execution?.fallback,
        trusted_scopes: config.execution?.trusted_scopes,
      });
      router.registerProvider("local", new LocalExecutionProvider(providerConfig));
      router.registerProvider("docker", new DockerExecutionProvider(providerConfig));
      router.registerProvider("dagger", new DaggerExecutionProvider(providerConfig));

      provider = await router.selectProvider(
        manifest.name,
        options.forceLocal ? { forceLocal: true } : {}
      );
    }

    // Execute — use executeAction for action-based skills, execute for command-based
    let result: ExecutionResult;
    if (resolvedAction && actionsManifest && (actionName ?? actionsManifest.actions.default)) {
      const effectiveActionName = actionName ?? "default";
      result = await provider.executeAction(
        manifest,
        actionsManifest,
        effectiveActionName,
        resolvedAction,
        {
          params: expandedWith as Record<string, unknown>,
          envOverrides: envVars,
        },
        {
          mountDirs: { [sourceDir]: "/workspace" },
        }
      );
    } else {
      result = await provider.execute(
        manifest,
        {
          params: expandedWith as Record<string, unknown>,
          envOverrides: envVars,
        },
        {
          mountDirs: { [sourceDir]: "/workspace" },
        }
      );
    }

    const success = result.success;
    const outputs = extractOutputs(result.output.stdout, result.output.parsed);

    return {
      stepId: step.id,
      stepName: step.name,
      status: success ? "success" : "failure",
      outputs,
      executionResult: result,
      durationMs: Date.now() - startTime,
      error: success
        ? undefined
        : (result.error?.message ?? `Step failed with exit code ${result.output.exitCode}`),
    };
  } catch (err) {
    if (err instanceof WorkflowStepError) {
      return {
        stepId: step.id,
        stepName: step.name,
        status: "failure",
        outputs: {},
        durationMs: Date.now() - startTime,
        error: err.message,
      };
    }
    return {
      stepId: step.id,
      stepName: step.name,
      status: "failure",
      outputs: {},
      durationMs: Date.now() - startTime,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function parseTimeout(timeout: string): number {
  const match = timeout.match(/^(\d+)(s|m|h)?$/);
  if (!match) return 30000;
  const value = Number.parseInt(match[1] ?? "30", 10);
  const unit = match[2] ?? "s";
  const multipliers: Record<string, number> = { s: 1000, m: 60000, h: 3600000 };
  return value * (multipliers[unit] ?? 1000);
}

export { collectSecretRefs };

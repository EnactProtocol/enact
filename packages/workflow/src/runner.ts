/**
 * WorkflowRunner — orchestrates execution of a complete workflow
 *
 * Handles:
 * - Secret pre-collection and resolution
 * - DAG-ordered step execution
 * - EvaluationContext threading between steps
 * - continue-on-error handling
 */

import { resolveSecrets } from "@enactprotocol/secrets";
import { type EnactConfig, loadConfig } from "@enactprotocol/shared";
import { topologicalSort } from "./dag.js";
import { collectSecretRefs } from "./expression.js";
import type { StepExecutorOptions } from "./step-executor.js";
import { executeStep } from "./step-executor.js";
import type {
  EvaluationContext,
  StepResult,
  WorkflowDefinition,
  WorkflowResult,
  WorkflowStep,
} from "./types.js";
import { WorkflowStepError } from "./types.js";

export interface WorkflowRunOptions {
  /** Only resolve tools locally, no registry fetch */
  forceLocal?: boolean | undefined;
  /** Show verbose output */
  verbose?: boolean | undefined;
  /** Working directory for tool resolution */
  cwd?: string | undefined;
  /** Dry run — return planned execution without running */
  dryRun?: boolean | undefined;
  /** Config override (defaults to loadConfig()) */
  config?: EnactConfig | undefined;
}

export class WorkflowRunner {
  private readonly config: EnactConfig;

  constructor(config?: EnactConfig) {
    this.config = config ?? loadConfig();
  }

  /**
   * Run a complete workflow definition.
   *
   * @param workflow - Parsed and validated WorkflowDefinition
   * @param inputs - Input values (overrides workflow defaults)
   * @param options - Runtime options
   */
  async run(
    workflow: WorkflowDefinition,
    inputs: Record<string, unknown> = {},
    options: WorkflowRunOptions = {}
  ): Promise<WorkflowResult> {
    const startTime = Date.now();
    const cwd = options.cwd ?? process.cwd();

    // Apply workflow default inputs
    const resolvedInputs: Record<string, unknown> = {};
    for (const [key, spec] of Object.entries(workflow.on?.manual?.inputs ?? {})) {
      if (inputs[key] !== undefined) {
        resolvedInputs[key] = inputs[key];
      } else if (spec.default !== undefined) {
        resolvedInputs[key] = spec.default;
      } else if (spec.required) {
        throw new WorkflowStepError("input", `Required input "${key}" not provided`);
      }
    }
    // Also pass through any extra inputs not declared in the schema
    for (const [key, value] of Object.entries(inputs)) {
      if (resolvedInputs[key] === undefined) {
        resolvedInputs[key] = value;
      }
    }

    // Collect all steps across all jobs (MVP: flatten all jobs into one sequence)
    const allSteps: WorkflowStep[] = [];
    for (const job of Object.values(workflow.jobs)) {
      allSteps.push(...job.steps);
    }

    // Topological sort respecting needs: dependencies
    const orderedSteps = topologicalSort(allSteps);

    // Pre-collect all secret references across all steps and resolve them upfront
    const allEnvMaps = allSteps.flatMap((s) => [s.env]);
    const secretNames = collectSecretRefs(allEnvMaps);

    const resolvedSecrets: Record<string, string> = {};
    if (secretNames.length > 0) {
      // Use workflow name as namespace for secret lookup
      const namespace = workflow.name.toLowerCase().replace(/\s+/g, "-");
      const secretResults = await resolveSecrets(namespace, secretNames);
      for (const [key, result] of secretResults) {
        if (result.found && result.value) {
          resolvedSecrets[key] = result.value;
        }
      }
    }

    // Build initial evaluation context
    const ctx: EvaluationContext = {
      inputs: resolvedInputs,
      steps: {},
      secrets: resolvedSecrets,
      env: { ...(workflow.env ?? {}), ...(process.env as Record<string, string>) },
    };

    // Dry run — return plan without executing
    if (options.dryRun) {
      const dryRunSteps: StepResult[] = orderedSteps.map((step) => ({
        stepId: step.id,
        stepName: step.name,
        status: "pending" as const,
        outputs: {},
        durationMs: 0,
      }));
      return {
        workflowName: workflow.name,
        success: true,
        steps: dryRunSteps,
        totalDurationMs: 0,
      };
    }

    const stepExecutorOptions: StepExecutorOptions = {
      forceLocal: options.forceLocal,
      verbose: options.verbose,
      cwd,
    };

    const results: StepResult[] = [];
    let workflowFailed = false;

    for (const step of orderedSteps) {
      if (options.verbose) {
        console.log(`[workflow] Running step: ${step.name ?? step.id}`);
      }

      const result = await executeStep(step, ctx, this.config, stepExecutorOptions);
      results.push(result);

      // Update context with step outputs
      ctx.steps[step.id] = {
        outputs: result.outputs,
        status: result.status,
      };

      if (result.status === "failure") {
        if (step.continueOnError) {
          if (options.verbose) {
            console.warn(
              `[workflow] Step "${step.id}" failed (continue-on-error): ${result.error}`
            );
          }
        } else {
          workflowFailed = true;
          if (options.verbose) {
            console.error(`[workflow] Step "${step.id}" failed: ${result.error}`);
          }
          // Mark remaining steps as skipped
          for (const remaining of orderedSteps.slice(orderedSteps.indexOf(step) + 1)) {
            results.push({
              stepId: remaining.id,
              stepName: remaining.name,
              status: "skipped",
              outputs: {},
              durationMs: 0,
            });
          }
          break;
        }
      }
    }

    return {
      workflowName: workflow.name,
      success: !workflowFailed,
      steps: results,
      totalDurationMs: Date.now() - startTime,
    };
  }
}

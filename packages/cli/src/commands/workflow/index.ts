/**
 * enact workflow command
 *
 * Run GitHub Actions-style workflow YAML files that chain enact skills together.
 *
 * Usage:
 *   enact workflow run <file> [--input key=value...] [--verbose] [--dry-run] [--json] [--local]
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  WorkflowRunner,
  WorkflowStepError,
  WorkflowValidationError,
  parseWorkflow,
  validateWorkflowLogic,
} from "@enactprotocol/workflow";
import type { WorkflowDefinition, WorkflowResult } from "@enactprotocol/workflow";
import type { Command } from "commander";
import type { CommandContext, GlobalOptions } from "../../types";
import {
  EXIT_EXECUTION_ERROR,
  EXIT_VALIDATION_ERROR,
  dim,
  error,
  handleError,
  info,
  json,
  newline,
  success,
  symbols,
} from "../../utils";

interface WorkflowRunOptions extends GlobalOptions {
  input?: string[];
  local?: boolean;
  dryRun?: boolean;
}

/**
 * Parse --input key=value flags into a Record
 */
function parseInputFlags(flags: string[] | undefined): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const flag of flags ?? []) {
    const eqIdx = flag.indexOf("=");
    if (eqIdx === -1) {
      result[flag] = true;
    } else {
      const key = flag.slice(0, eqIdx);
      const value = flag.slice(eqIdx + 1);
      // Try JSON parse for structured values
      try {
        result[key] = JSON.parse(value);
      } catch {
        result[key] = value;
      }
    }
  }
  return result;
}

async function workflowRunHandler(
  file: string,
  options: WorkflowRunOptions,
  ctx: CommandContext
): Promise<void> {
  const filePath = resolve(ctx.cwd, file);

  // Read and parse workflow file
  let yamlText: string;
  try {
    yamlText = readFileSync(filePath, "utf-8");
  } catch {
    error(`Cannot read workflow file: ${filePath}`);
    process.exit(EXIT_VALIDATION_ERROR);
  }

  let workflow: WorkflowDefinition;
  try {
    workflow = parseWorkflow(yamlText);
    validateWorkflowLogic(workflow);
  } catch (err) {
    if (err instanceof WorkflowValidationError) {
      error(err.message);
      process.exit(EXIT_VALIDATION_ERROR);
    }
    throw err;
  }

  const inputs = parseInputFlags(options.input);

  // Dry run — show plan
  if (options.dryRun) {
    const runner = new WorkflowRunner();
    const result = await runner.run(workflow, inputs, { dryRun: true });

    info(`Workflow: ${workflow.name}`);
    newline();
    info("Execution plan:");
    for (const step of result.steps) {
      dim(`  ${symbols.bullet} ${step.stepName ?? step.stepId}`);
    }
    newline();
    info(`${result.steps.length} step(s) would run`);
    return;
  }

  if (!options.json && options.verbose) {
    info(`Running workflow: ${workflow.name}`);
    newline();
  }

  const runner = new WorkflowRunner();

  let result: WorkflowResult;
  try {
    result = await runner.run(workflow, inputs, {
      forceLocal: options.local,
      verbose: options.verbose,
      cwd: ctx.cwd,
    });
  } catch (err) {
    if (err instanceof WorkflowStepError || err instanceof WorkflowValidationError) {
      error(err.message);
      process.exit(EXIT_EXECUTION_ERROR);
    }
    throw err;
  }

  // Output results
  if (options.json) {
    json(result);
    if (!result.success) process.exit(EXIT_EXECUTION_ERROR);
    return;
  }

  // Human-readable output
  newline();
  for (const step of result.steps) {
    const icon =
      step.status === "success"
        ? symbols.success
        : step.status === "skipped"
          ? symbols.info
          : step.status === "failure"
            ? symbols.error
            : symbols.bullet;

    const label = step.stepName ?? step.stepId;
    const duration = `${step.durationMs}ms`;

    if (step.status === "success") {
      success(`${icon} ${label} (${duration})`);
    } else if (step.status === "skipped") {
      dim(`${icon} ${label} — skipped`);
    } else if (step.status === "failure") {
      error(`${icon} ${label} — ${step.error ?? "failed"}`);
    } else {
      dim(`${icon} ${label}`);
    }

    // Show outputs if verbose
    if (options.verbose && Object.keys(step.outputs).length > 0) {
      for (const [key, value] of Object.entries(step.outputs)) {
        dim(`     ${key}: ${JSON.stringify(value)}`);
      }
    }
  }

  newline();
  if (result.success) {
    success(`Workflow completed in ${result.totalDurationMs}ms`);
  } else {
    error(`Workflow failed after ${result.totalDurationMs}ms`);
    process.exit(EXIT_EXECUTION_ERROR);
  }
}

export function configureWorkflowCommand(program: Command): void {
  const workflow = program
    .command("workflow")
    .description("Run GitHub Actions-style workflow pipelines of chained skills");

  workflow
    .command("run <file>")
    .description("Execute a workflow YAML file")
    .option("-i, --input <value...>", "Input values as key=value pairs")
    .option("-v, --verbose", "Show step-by-step progress and outputs")
    .option("--dry-run", "Validate workflow and show execution plan without running")
    .option("--json", "Output result as JSON")
    .option("--local", "Only resolve skills from local sources (no registry fetch)")
    .action(async (file: string, options: WorkflowRunOptions) => {
      const ctx: CommandContext = {
        cwd: process.cwd(),
        options,
        isCI: Boolean(process.env.CI),
        isInteractive: process.stdout.isTTY ?? false,
      };
      try {
        await workflowRunHandler(file, options, ctx);
      } catch (err) {
        handleError(err);
      }
    });
}

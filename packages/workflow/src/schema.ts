/**
 * Workflow YAML schema validation
 *
 * Parses and validates GitHub Actions-style workflow YAML files.
 */

import yaml from "js-yaml";
import { z } from "zod/v4";
import type { WorkflowDefinition } from "./types.js";
import { WorkflowValidationError } from "./types.js";

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const WorkflowInputSchema = z.object({
  description: z.string().optional(),
  required: z.boolean().optional(),
  default: z.string().optional(),
});

const ManualTriggerSchema = z.object({
  inputs: z.record(z.string(), WorkflowInputSchema).optional(),
});

const WorkflowOnSchema = z.object({
  manual: ManualTriggerSchema.optional(),
});

const WorkflowStepSchema = z
  .object({
    id: z.string().min(1, "Step id is required"),
    name: z.string().optional(),
    // Skill step fields
    uses: z.string().optional(),
    with: z.record(z.string(), z.string()).optional(),
    // Model step fields
    model: z.string().optional(),
    prompt: z.string().optional(),
    tools: z.array(z.string()).optional(),
    // Shared fields
    env: z.record(z.string(), z.string()).optional(),
    needs: z.array(z.string()).optional(),
    if: z.string().optional(),
    continueOnError: z.boolean().optional(),
    timeout: z.string().optional(),
  })
  .refine((s) => s.uses !== undefined || s.model !== undefined, {
    message: "Step must have either 'uses' (skill step) or 'model' (model step)",
  });

const WorkflowJobSchema = z.object({
  steps: z.array(WorkflowStepSchema).min(1, "Job must have at least one step"),
});

const WorkflowDefinitionSchema = z.object({
  name: z.string().min(1, "Workflow name is required"),
  on: WorkflowOnSchema,
  jobs: z
    .record(z.string(), WorkflowJobSchema)
    .refine((jobs) => Object.keys(jobs).length > 0, "Workflow must have at least one job"),
  env: z.record(z.string(), z.string()).optional(),
});

// ─── Parse & Validate ────────────────────────────────────────────────────────

/**
 * Parse workflow YAML text into a validated WorkflowDefinition.
 * Throws WorkflowValidationError on parse or schema errors.
 */
export function parseWorkflow(yamlText: string): WorkflowDefinition {
  let raw: unknown;
  try {
    raw = yaml.load(yamlText);
  } catch (err) {
    throw new WorkflowValidationError(
      `Failed to parse workflow YAML: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (!raw || typeof raw !== "object") {
    throw new WorkflowValidationError("Workflow YAML must be a non-empty object");
  }

  const result = WorkflowDefinitionSchema.safeParse(raw);
  if (!result.success) {
    const messages = result.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
    throw new WorkflowValidationError(`Invalid workflow definition:\n${messages.join("\n")}`);
  }

  return result.data as WorkflowDefinition;
}

/**
 * Validate a workflow definition, checking for logical errors beyond schema:
 * - Referenced step IDs in needs: must exist
 * - Step IDs must be unique within a job
 */
export function validateWorkflowLogic(workflow: WorkflowDefinition): void {
  for (const [jobName, job] of Object.entries(workflow.jobs)) {
    const stepIds = new Set<string>();
    for (const step of job.steps) {
      if (stepIds.has(step.id)) {
        throw new WorkflowValidationError(`Duplicate step id "${step.id}" in job "${jobName}"`);
      }
      stepIds.add(step.id);
    }

    for (const step of job.steps) {
      for (const dep of step.needs ?? []) {
        if (!stepIds.has(dep)) {
          throw new WorkflowValidationError(
            `Step "${step.id}" in job "${jobName}" needs unknown step "${dep}"`
          );
        }
      }
    }
  }
}

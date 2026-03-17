/**
 * Type definitions for Enact workflow system
 *
 * Uses GitHub Actions-compatible YAML syntax for chaining skills together.
 */

import type { ExecutionResult } from "@enactprotocol/shared";

// ─── Trigger ─────────────────────────────────────────────────────────────────

export interface WorkflowInput {
  description?: string | undefined;
  required?: boolean | undefined;
  default?: string | undefined;
}

export interface ManualTrigger {
  inputs?: Record<string, WorkflowInput> | undefined;
}

export interface WorkflowOn {
  manual?: ManualTrigger | undefined;
}

// ─── Step ─────────────────────────────────────────────────────────────────────

export interface WorkflowStep {
  /** Unique step identifier (used for output references: steps.<id>.outputs.<field>) */
  id: string;
  /** Human-readable name for display */
  name?: string | undefined;
  /** Skill reference: "owner/skill@version" or "owner/skill:action@version". Required for skill steps. */
  uses?: string | undefined;
  /** Model to use for model steps. Use "agent" to delegate to the running agent, or a specific model ID
   *  e.g. "claude-sonnet-4-6". Mutually exclusive with uses. */
  model?: string | undefined;
  /** Prompt template for model steps. Supports ${{ }} expressions. */
  prompt?: string | undefined;
  /** Skill references available as tools for model steps (e.g. ["enact/search:query"]) */
  tools?: string[] | undefined;
  /** Expression-expanded key-value inputs passed to the skill (skill steps) */
  with?: Record<string, string> | undefined;
  /** Expression-expanded environment variable overrides */
  env?: Record<string, string> | undefined;
  /** Step IDs this step depends on (for DAG ordering) */
  needs?: string[] | undefined;
  /** Expression string — step is skipped when this evaluates falsy */
  if?: string | undefined;
  /** Continue workflow when this step fails (default: false) */
  continueOnError?: boolean | undefined;
  /** Timeout override for this step (e.g. "30s", "5m") */
  timeout?: string | undefined;
}

// ─── Job ─────────────────────────────────────────────────────────────────────

export interface WorkflowJob {
  steps: WorkflowStep[];
}

// ─── Workflow ─────────────────────────────────────────────────────────────────

export interface WorkflowDefinition {
  name: string;
  on: WorkflowOn;
  jobs: Record<string, WorkflowJob>;
  /** Workflow-level env vars (available as ${{ env.VAR }}) */
  env?: Record<string, string> | undefined;
}

// ─── Runtime ──────────────────────────────────────────────────────────────────

export type StepStatus = "pending" | "running" | "success" | "failure" | "skipped";

export interface StepResult {
  stepId: string;
  stepName?: string | undefined;
  status: StepStatus;
  outputs: Record<string, unknown>;
  executionResult?: ExecutionResult | undefined;
  durationMs: number;
  error?: string | undefined;
}

export interface WorkflowResult {
  workflowName: string;
  success: boolean;
  steps: StepResult[];
  totalDurationMs: number;
}

// ─── Expression context ───────────────────────────────────────────────────────

export interface EvaluationContext {
  inputs: Record<string, unknown>;
  steps: Record<string, { outputs: Record<string, unknown>; status: StepStatus }>;
  secrets: Record<string, string>;
  env: Record<string, string>;
}

// ─── Errors ───────────────────────────────────────────────────────────────────

export class WorkflowValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowValidationError";
  }
}

export class WorkflowStepError extends Error {
  constructor(
    public readonly stepId: string,
    message: string
  ) {
    super(message);
    this.name = "WorkflowStepError";
  }
}

export class ExpressionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExpressionError";
  }
}

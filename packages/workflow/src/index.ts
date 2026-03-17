/**
 * @enactprotocol/workflow
 *
 * GitHub Actions-style workflow runner for Enact skills.
 * Chain skills together with YAML-defined pipelines.
 */

export type {
  WorkflowDefinition,
  WorkflowJob,
  WorkflowOn,
  WorkflowInput,
  WorkflowStep,
  WorkflowResult,
  StepResult,
  StepStatus,
  EvaluationContext,
} from "./types.js";

export {
  WorkflowValidationError,
  WorkflowStepError,
  ExpressionError,
} from "./types.js";

export { WorkflowRunner } from "./runner.js";
export type { WorkflowRunOptions } from "./runner.js";

export { parseWorkflow, validateWorkflowLogic } from "./schema.js";

export {
  evaluateExpression,
  expandObject,
  evaluateCondition,
  collectSecretRefs,
} from "./expression.js";

export { topologicalSort } from "./dag.js";

export { executeStep } from "./step-executor.js";
export type { StepExecutorOptions } from "./step-executor.js";

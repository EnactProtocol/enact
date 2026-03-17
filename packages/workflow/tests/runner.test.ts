import { describe, expect, test } from "bun:test";
import { topologicalSort } from "../src/dag";
import { WorkflowRunner } from "../src/runner";
import { parseWorkflow, validateWorkflowLogic } from "../src/schema";
import type { EvaluationContext, StepResult, WorkflowDefinition, WorkflowStep } from "../src/types";
import { WorkflowStepError, WorkflowValidationError } from "../src/types";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeWorkflow(
  steps: Array<{
    id: string;
    uses?: string;
    needs?: string[];
    if?: string;
    continueOnError?: boolean;
  }>
): WorkflowDefinition {
  return {
    name: "Test Workflow",
    on: { manual: { inputs: { msg: { description: "test input", default: "hello" } } } },
    jobs: {
      pipeline: {
        steps: steps.map((s) => ({
          id: s.id,
          uses: s.uses ?? `enact/${s.id}@1.0`,
          needs: s.needs,
          if: s.if,
          continueOnError: s.continueOnError,
        })),
      },
    },
  };
}

function makeStepResult(
  stepId: string,
  status: StepResult["status"] = "success",
  outputs: Record<string, unknown> = {}
): StepResult {
  return {
    stepId,
    status,
    outputs,
    durationMs: 10,
    error: status === "failure" ? "step failed" : undefined,
  };
}

// ─── Dry-run mode ──────────────────────────────────────────────────────────────

describe("WorkflowRunner dry-run", () => {
  const runner = new WorkflowRunner();

  test("returns pending steps without executing", async () => {
    const wf = makeWorkflow([{ id: "a" }, { id: "b" }]);
    const result = await runner.run(wf, {}, { dryRun: true });
    expect(result.success).toBe(true);
    expect(result.steps).toHaveLength(2);
    for (const s of result.steps) {
      expect(s.status).toBe("pending");
      expect(s.durationMs).toBe(0);
    }
  });

  test("dry-run respects DAG ordering", async () => {
    const wf = makeWorkflow([{ id: "c", needs: ["b"] }, { id: "b", needs: ["a"] }, { id: "a" }]);
    const result = await runner.run(wf, {}, { dryRun: true });
    const stepIds = result.steps.map((s) => s.stepId);
    expect(stepIds.indexOf("a")).toBeLessThan(stepIds.indexOf("b"));
    expect(stepIds.indexOf("b")).toBeLessThan(stepIds.indexOf("c"));
  });

  test("dry-run returns workflow name", async () => {
    const wf = makeWorkflow([{ id: "a" }]);
    wf.name = "My Named Workflow";
    const result = await runner.run(wf, {}, { dryRun: true });
    expect(result.workflowName).toBe("My Named Workflow");
  });

  test("dry-run totalDurationMs is 0", async () => {
    const wf = makeWorkflow([{ id: "a" }, { id: "b" }]);
    const result = await runner.run(wf, {}, { dryRun: true });
    expect(result.totalDurationMs).toBe(0);
  });

  test("dry-run with needs: includes all steps", async () => {
    const wf = makeWorkflow([
      { id: "a" },
      { id: "b", needs: ["a"] },
      { id: "c", needs: ["a"] },
      { id: "d", needs: ["b", "c"] },
    ]);
    const result = await runner.run(wf, {}, { dryRun: true });
    expect(result.steps).toHaveLength(4);
  });
});

// ─── Input resolution ─────────────────────────────────────────────────────────

describe("WorkflowRunner input resolution", () => {
  const runner = new WorkflowRunner();

  test("uses provided input values", async () => {
    const wf: WorkflowDefinition = {
      name: "Test",
      on: { manual: { inputs: { url: { required: true } } } },
      jobs: { pipeline: { steps: [{ id: "a", uses: "enact/a@1.0" }] } },
    };
    // dry-run just validates, doesn't fail on missing tool
    const result = await runner.run(wf, { url: "https://example.com" }, { dryRun: true });
    expect(result.success).toBe(true);
  });

  test("applies default values for undeclared inputs", async () => {
    const wf: WorkflowDefinition = {
      name: "Test",
      on: {
        manual: {
          inputs: {
            count: { default: "10" },
          },
        },
      },
      jobs: { pipeline: { steps: [{ id: "a", uses: "enact/a@1.0" }] } },
    };
    const result = await runner.run(wf, {}, { dryRun: true });
    expect(result.success).toBe(true);
  });

  test("throws when required input is missing", async () => {
    const wf: WorkflowDefinition = {
      name: "Test",
      on: { manual: { inputs: { url: { required: true } } } },
      jobs: { pipeline: { steps: [{ id: "a", uses: "enact/a@1.0" }] } },
    };
    try {
      await runner.run(wf, {}, { dryRun: true });
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(WorkflowStepError);
      expect((err as Error).message).toContain("url");
    }
  });

  test("passes through extra inputs not declared in schema", async () => {
    const wf: WorkflowDefinition = {
      name: "Test",
      on: { manual: {} },
      jobs: { pipeline: { steps: [{ id: "a", uses: "enact/a@1.0" }] } },
    };
    const result = await runner.run(wf, { extra: "value" }, { dryRun: true });
    expect(result.success).toBe(true);
  });
});

// ─── DAG ordering in full run ─────────────────────────────────────────────────

describe("topologicalSort integration", () => {
  test("sorts a diamond dependency correctly", () => {
    const steps: WorkflowStep[] = [
      { id: "d", uses: "enact/d@1.0", needs: ["b", "c"] },
      { id: "c", uses: "enact/c@1.0", needs: ["a"] },
      { id: "b", uses: "enact/b@1.0", needs: ["a"] },
      { id: "a", uses: "enact/a@1.0" },
    ];
    const sorted = topologicalSort(steps);
    const idx = (id: string) => sorted.findIndex((s) => s.id === id);
    expect(idx("a")).toBeLessThan(idx("b"));
    expect(idx("a")).toBeLessThan(idx("c"));
    expect(idx("b")).toBeLessThan(idx("d"));
    expect(idx("c")).toBeLessThan(idx("d"));
  });

  test("detects a cycle and throws", () => {
    const wf = makeWorkflow([
      { id: "a", needs: ["b"] },
      { id: "b", needs: ["a"] },
    ]);
    const steps = wf.jobs.pipeline?.steps ?? [];
    expect(() => topologicalSort(steps)).toThrow(WorkflowValidationError);
  });
});

// ─── Schema + logic validation integration ───────────────────────────────────

describe("parseWorkflow + validateWorkflowLogic integration", () => {
  test("valid complex workflow passes both checks", () => {
    const yaml = `
name: Complex Pipeline
on:
  manual:
    inputs:
      url:
        required: true
jobs:
  pipeline:
    steps:
      - id: fetch
        uses: enact/web-scrape@1.0
        with:
          url: \${{ inputs.url }}
      - id: process
        uses: enact/process@1.0
        needs: [fetch]
        with:
          data: \${{ steps.fetch.outputs.text }}
        if: \${{ steps.fetch.outputs.status == 'ok' }}
      - id: notify
        uses: enact/notify@1.0
        needs: [process]
        continueOnError: true
`;
    const wf = parseWorkflow(yaml);
    expect(() => validateWorkflowLogic(wf)).not.toThrow();
    expect(wf.jobs.pipeline?.steps).toHaveLength(3);
  });

  test("invalid needs reference fails validateWorkflowLogic", () => {
    const yaml = `
name: Bad Workflow
on:
  manual: {}
jobs:
  pipeline:
    steps:
      - id: step1
        uses: enact/tool@1.0
        needs: [ghost-step]
`;
    const wf = parseWorkflow(yaml);
    expect(() => validateWorkflowLogic(wf)).toThrow(WorkflowValidationError);
  });
});

// ─── WorkflowResult shape ─────────────────────────────────────────────────────

describe("WorkflowResult shape from dry-run", () => {
  const runner = new WorkflowRunner();

  test("result has required fields", async () => {
    const wf = makeWorkflow([{ id: "a" }]);
    const result = await runner.run(wf, {}, { dryRun: true });
    expect(result.workflowName).toBeDefined();
    expect(typeof result.success).toBe("boolean");
    expect(Array.isArray(result.steps)).toBe(true);
    expect(typeof result.totalDurationMs).toBe("number");
  });

  test("each step result has required fields", async () => {
    const wf = makeWorkflow([{ id: "a" }, { id: "b" }]);
    const result = await runner.run(wf, {}, { dryRun: true });
    for (const step of result.steps) {
      expect(step.stepId).toBeDefined();
      expect(step.status).toBeDefined();
      expect(step.outputs).toBeDefined();
      expect(typeof step.durationMs).toBe("number");
    }
  });
});

// ─── StepResult helpers ───────────────────────────────────────────────────────

describe("StepResult helper (unit)", () => {
  test("success result has no error", () => {
    const r = makeStepResult("fetch", "success", { text: "hello" });
    expect(r.status).toBe("success");
    expect(r.error).toBeUndefined();
    expect(r.outputs.text).toBe("hello");
  });

  test("failure result has error message", () => {
    const r = makeStepResult("fetch", "failure");
    expect(r.status).toBe("failure");
    expect(r.error).toBe("step failed");
  });

  test("skipped result", () => {
    const r: StepResult = {
      stepId: "fetch",
      status: "skipped",
      outputs: {},
      durationMs: 0,
    };
    expect(r.status).toBe("skipped");
  });
});

// ─── EvaluationContext threading ─────────────────────────────────────────────

describe("EvaluationContext threading (unit)", () => {
  test("steps context accumulates across steps", () => {
    const ctx: EvaluationContext = {
      inputs: {},
      steps: {},
      secrets: {},
      env: {},
    };

    // Simulate what runner does after step 1 completes
    ctx.steps.fetch = { outputs: { text: "hello" }, status: "success" };

    // Step 2 should be able to reference step 1's output
    const { evaluateExpression } = require("../src/expression");
    const result = evaluateExpression("${{ steps.fetch.outputs.text }}", ctx);
    expect(result).toBe("hello");
  });

  test("step status is available after execution", () => {
    const ctx: EvaluationContext = {
      inputs: {},
      steps: { fetch: { outputs: {}, status: "failure" } },
      secrets: {},
      env: {},
    };
    const { evaluateExpression } = require("../src/expression");
    expect(evaluateExpression("${{ steps.fetch.status }}", ctx)).toBe("failure");
  });
});

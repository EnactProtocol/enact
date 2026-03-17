import { describe, expect, test } from "bun:test";
import { topologicalSort } from "../src/dag";
import type { WorkflowStep } from "../src/types";
import { WorkflowValidationError } from "../src/types";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function step(id: string, needs?: string[]): WorkflowStep {
  return {
    id,
    uses: `enact/${id}@1.0`,
    needs,
  };
}

function ids(steps: WorkflowStep[]): string[] {
  return steps.map((s) => s.id);
}

// ─── topologicalSort ──────────────────────────────────────────────────────────

describe("topologicalSort", () => {
  describe("empty and single-step inputs", () => {
    test("returns empty array for empty input", () => {
      expect(topologicalSort([])).toEqual([]);
    });

    test("returns single step unchanged", () => {
      const steps = [step("a")];
      expect(ids(topologicalSort(steps))).toEqual(["a"]);
    });
  });

  describe("linear sequences (no needs)", () => {
    test("returns steps in original order when none have dependencies", () => {
      const steps = [step("a"), step("b"), step("c")];
      const result = topologicalSort(steps);
      expect(ids(result)).toEqual(["a", "b", "c"]);
    });
  });

  describe("simple linear dependency chains", () => {
    test("reorders when b needs a", () => {
      const steps = [step("b", ["a"]), step("a")];
      const result = ids(topologicalSort(steps));
      expect(result.indexOf("a")).toBeLessThan(result.indexOf("b"));
    });

    test("handles a → b → c chain", () => {
      const steps = [step("c", ["b"]), step("b", ["a"]), step("a")];
      const result = ids(topologicalSort(steps));
      expect(result.indexOf("a")).toBeLessThan(result.indexOf("b"));
      expect(result.indexOf("b")).toBeLessThan(result.indexOf("c"));
    });

    test("preserves already-correct order", () => {
      const steps = [step("a"), step("b", ["a"]), step("c", ["b"])];
      const result = ids(topologicalSort(steps));
      expect(result.indexOf("a")).toBeLessThan(result.indexOf("b"));
      expect(result.indexOf("b")).toBeLessThan(result.indexOf("c"));
    });
  });

  describe("DAG (multiple dependencies)", () => {
    test("diamond: a → b, a → c, b+c → d", () => {
      const steps = [step("d", ["b", "c"]), step("c", ["a"]), step("b", ["a"]), step("a")];
      const result = ids(topologicalSort(steps));
      expect(result.indexOf("a")).toBeLessThan(result.indexOf("b"));
      expect(result.indexOf("a")).toBeLessThan(result.indexOf("c"));
      expect(result.indexOf("b")).toBeLessThan(result.indexOf("d"));
      expect(result.indexOf("c")).toBeLessThan(result.indexOf("d"));
    });

    test("fan-out: a → b, c, d", () => {
      const steps = [step("d", ["a"]), step("c", ["a"]), step("b", ["a"]), step("a")];
      const result = ids(topologicalSort(steps));
      expect(result.indexOf("a")).toBeLessThan(result.indexOf("b"));
      expect(result.indexOf("a")).toBeLessThan(result.indexOf("c"));
      expect(result.indexOf("a")).toBeLessThan(result.indexOf("d"));
    });

    test("fan-in: a, b, c → d", () => {
      const steps = [step("d", ["a", "b", "c"]), step("c"), step("b"), step("a")];
      const result = ids(topologicalSort(steps));
      expect(result.indexOf("a")).toBeLessThan(result.indexOf("d"));
      expect(result.indexOf("b")).toBeLessThan(result.indexOf("d"));
      expect(result.indexOf("c")).toBeLessThan(result.indexOf("d"));
    });

    test("mixed: two independent chains", () => {
      // chain1: a → b; chain2: c → d (no dependencies between chains)
      const steps = [step("b", ["a"]), step("a"), step("d", ["c"]), step("c")];
      const result = ids(topologicalSort(steps));
      expect(result.indexOf("a")).toBeLessThan(result.indexOf("b"));
      expect(result.indexOf("c")).toBeLessThan(result.indexOf("d"));
    });
  });

  describe("preserves all steps", () => {
    test("output contains all input steps", () => {
      const steps = [step("a"), step("b", ["a"]), step("c", ["a"]), step("d", ["b", "c"])];
      const result = topologicalSort(steps);
      expect(result).toHaveLength(4);
      const resultIds = ids(result);
      for (const s of steps) {
        expect(resultIds).toContain(s.id);
      }
    });
  });

  describe("cycle detection", () => {
    test("throws WorkflowValidationError for direct cycle (a needs a)", () => {
      const steps = [step("a", ["a"])];
      expect(() => topologicalSort(steps)).toThrow(WorkflowValidationError);
    });

    test("throws WorkflowValidationError for two-step cycle (a→b, b→a)", () => {
      const steps = [step("a", ["b"]), step("b", ["a"])];
      expect(() => topologicalSort(steps)).toThrow(WorkflowValidationError);
    });

    test("throws WorkflowValidationError for three-step cycle", () => {
      const steps = [step("a", ["c"]), step("b", ["a"]), step("c", ["b"])];
      expect(() => topologicalSort(steps)).toThrow(WorkflowValidationError);
    });

    test("error message mentions the cyclic step IDs", () => {
      const steps = [step("a", ["b"]), step("b", ["a"])];
      try {
        topologicalSort(steps);
        expect.unreachable("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(WorkflowValidationError);
        expect((err as Error).message).toContain("Circular dependency");
      }
    });
  });

  describe("steps without needs field", () => {
    test("treats missing needs as no dependencies", () => {
      const steps = [
        { id: "a", uses: "enact/a@1.0" } as WorkflowStep,
        { id: "b", uses: "enact/b@1.0", needs: undefined } as WorkflowStep,
      ];
      const result = topologicalSort(steps);
      expect(result).toHaveLength(2);
    });

    test("treats empty needs array as no dependencies", () => {
      const steps = [step("a", []), step("b", [])];
      const result = topologicalSort(steps);
      expect(result).toHaveLength(2);
    });
  });
});

/**
 * DAG utilities for workflow step ordering
 *
 * Implements Kahn's algorithm for topological sort.
 * Detects cycles and throws WorkflowValidationError.
 */

import type { WorkflowStep } from "./types.js";
import { WorkflowValidationError } from "./types.js";

/**
 * Topologically sort workflow steps respecting `needs:` dependencies.
 * Steps without dependencies are returned first; steps with dependencies
 * come after all their dependencies.
 *
 * Throws WorkflowValidationError if a cycle is detected.
 */
export function topologicalSort(steps: WorkflowStep[]): WorkflowStep[] {
  if (steps.length === 0) return [];

  const stepMap = new Map<string, WorkflowStep>(steps.map((s) => [s.id, s]));

  // Build in-degree map and adjacency list (dependents)
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>(); // id → list of step IDs that depend on it

  for (const step of steps) {
    if (!inDegree.has(step.id)) inDegree.set(step.id, 0);
    if (!dependents.has(step.id)) dependents.set(step.id, []);
  }

  for (const step of steps) {
    for (const dep of step.needs ?? []) {
      inDegree.set(step.id, (inDegree.get(step.id) ?? 0) + 1);
      dependents.get(dep)?.push(step.id);
    }
  }

  // Queue steps with no dependencies
  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }

  const ordered: WorkflowStep[] = [];

  while (queue.length > 0) {
    const id = queue.shift()!;
    const step = stepMap.get(id)!;
    ordered.push(step);

    for (const dependentId of dependents.get(id) ?? []) {
      const newDegree = (inDegree.get(dependentId) ?? 1) - 1;
      inDegree.set(dependentId, newDegree);
      if (newDegree === 0) {
        queue.push(dependentId);
      }
    }
  }

  if (ordered.length !== steps.length) {
    // Find steps that are in a cycle (those with remaining in-degree > 0)
    const cycleIds = [...inDegree.entries()].filter(([, d]) => d > 0).map(([id]) => id);
    throw new WorkflowValidationError(
      `Circular dependency detected among steps: ${cycleIds.join(", ")}`
    );
  }

  return ordered;
}

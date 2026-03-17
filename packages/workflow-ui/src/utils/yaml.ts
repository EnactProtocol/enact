import type { Edge } from "@xyflow/react";
import yaml from "js-yaml";
import type { ModelNodeData, SkillNodeData, TriggerNodeData, WorkflowNode } from "../types";

// ─── Export ──────────────────────────────────────────────────────────────────

export function exportWorkflow(name: string, nodes: WorkflowNode[], edges: Edge[]): string {
  const triggerNode = nodes.find((n) => n.type === "trigger");

  // Build needs map from edges (all step nodes)
  const stepNodes = nodes.filter((n) => n.type === "skill" || n.type === "model");
  const needsMap: Record<string, string[]> = {};
  for (const edge of edges) {
    const targetNode = stepNodes.find((n) => n.id === edge.target);
    const sourceNode = stepNodes.find((n) => n.id === edge.source);
    if (targetNode && sourceNode) {
      const targetId = (targetNode.data as SkillNodeData | ModelNodeData).stepId;
      const sourceId = (sourceNode.data as SkillNodeData | ModelNodeData).stepId;
      if (!needsMap[targetId]) needsMap[targetId] = [];
      needsMap[targetId].push(sourceId);
    }
  }

  // Build workflow object
  const workflow: Record<string, unknown> = { name };

  // Build on.manual section
  const onSection: Record<string, unknown> = {};
  if (triggerNode) {
    const triggerData = triggerNode.data as TriggerNodeData;
    const inputs = triggerData.inputs;
    if (Object.keys(inputs).length > 0) {
      onSection.manual = { inputs };
    } else {
      onSection.manual = {};
    }
  } else {
    onSection.manual = {};
  }
  workflow.on = onSection;

  // Build steps (skill + model nodes, preserving canvas order via y position)
  const orderedSteps = [...stepNodes].sort((a, b) => a.position.y - b.position.y);

  const steps: Record<string, unknown>[] = [];
  for (const node of orderedSteps) {
    if (node.type === "skill") {
      const data = node.data as SkillNodeData;
      const step: Record<string, unknown> = {
        id: data.stepId,
        name: data.label,
        uses: data.uses,
      };
      if (Object.keys(data.inputs).length > 0) step.with = data.inputs;
      const needs = needsMap[data.stepId];
      if (needs && needs.length > 0) step.needs = needs;
      if (data.ifCondition) step.if = data.ifCondition;
      if (data.continueOnError) step["continue-on-error"] = true;
      steps.push(step);
    } else if (node.type === "model") {
      const data = node.data as ModelNodeData;
      const step: Record<string, unknown> = {
        id: data.stepId,
        name: data.label,
        model: data.model,
      };
      if (data.prompt) step.prompt = data.prompt;
      if (data.tools.length > 0) step.tools = data.tools;
      const needs = needsMap[data.stepId];
      if (needs && needs.length > 0) step.needs = needs;
      if (data.ifCondition) step.if = data.ifCondition;
      if (data.continueOnError) step["continue-on-error"] = true;
      steps.push(step);
    }
  }

  workflow.jobs = { pipeline: { steps } };

  return yaml.dump(workflow, { lineWidth: -1, quotingType: '"', noRefs: true });
}

// ─── Import ──────────────────────────────────────────────────────────────────

interface ParsedWorkflow {
  name?: string;
  on?: { manual?: { inputs?: Record<string, unknown> } };
  jobs?: {
    pipeline?: {
      steps?: Array<{
        id?: string;
        name?: string;
        uses?: string;
        with?: Record<string, string>;
        needs?: string[];
        if?: string;
        "continue-on-error"?: boolean;
      }>;
    };
  };
}

export function importWorkflow(yamlText: string): {
  name: string;
  nodes: WorkflowNode[];
  edges: Edge[];
} {
  const parsed = yaml.load(yamlText) as ParsedWorkflow;
  const workflowName = parsed?.name ?? "Imported Workflow";

  const nodes: WorkflowNode[] = [];
  const edges: Edge[] = [];

  // Create trigger node
  const triggerInputs: Record<string, { description: string; required: boolean }> = {};
  const rawInputs = parsed?.on?.manual?.inputs ?? {};
  for (const [key, val] of Object.entries(rawInputs)) {
    const v = val as Record<string, unknown>;
    triggerInputs[key] = {
      description: String(v?.description ?? ""),
      required: Boolean(v?.required ?? false),
    };
  }

  nodes.push({
    id: "trigger",
    type: "trigger",
    position: { x: 250, y: 50 },
    data: { label: "Manual Trigger", inputs: triggerInputs },
  } as WorkflowNode);

  // Create skill nodes
  const steps = parsed?.jobs?.pipeline?.steps ?? [];
  const stepIdToNodeId: Record<string, string> = {};
  const columns: Record<number, number> = {};

  for (const [i, step] of steps.entries()) {
    const nodeId = `step-${step.id ?? i}`;
    const stepId = step.id ?? `step${i}`;
    stepIdToNodeId[stepId] = nodeId;

    const col = i % 3;
    const row = Math.floor(i / 3);
    columns[col] = (columns[col] ?? 0) + 1;

    nodes.push({
      id: nodeId,
      type: "skill",
      position: { x: 80 + col * 320, y: 220 + row * 180 },
      data: {
        stepId,
        label: step.name ?? stepId,
        uses: step.uses ?? "",
        description: "",
        inputs: step.with ?? {},
        continueOnError: step["continue-on-error"] ?? false,
        ifCondition: step.if ?? "",
        color: "#694DFF",
      },
    } as WorkflowNode);
  }

  // Create edges from needs
  for (const step of steps) {
    if (!step.needs) continue;
    const targetNodeId = stepIdToNodeId[step.id ?? ""];
    if (!targetNodeId) continue;
    for (const need of step.needs) {
      const sourceNodeId = stepIdToNodeId[need];
      if (!sourceNodeId) continue;
      edges.push({
        id: `${sourceNodeId}-${targetNodeId}`,
        source: sourceNodeId,
        target: targetNodeId,
        animated: true,
      });
    }
  }

  return { name: workflowName, nodes, edges };
}

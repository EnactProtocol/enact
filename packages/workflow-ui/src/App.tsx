import { useEdgesState, useNodesState } from "@xyflow/react";
import type { Edge } from "@xyflow/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import Canvas from "./components/Canvas";
import Inspector from "./components/Inspector";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import YamlPanel from "./components/YamlPanel";

import type {
  ModelNodeData,
  SkillNodeData,
  SkillTemplate,
  TriggerNodeData,
  WorkflowNode,
} from "./types";
import { exportWorkflow, importWorkflow } from "./utils/yaml";

// ─── Default workflow (text-analysis demo) ───────────────────────────────────

const DEFAULT_NODES: WorkflowNode[] = [
  {
    id: "trigger",
    type: "trigger",
    position: { x: 280, y: 40 },
    data: {
      label: "Manual Trigger",
      inputs: {
        text: { description: "The text to analyze", required: true },
      },
    },
  },
  {
    id: "step-count",
    type: "skill",
    position: { x: 100, y: 220 },
    data: {
      stepId: "count",
      label: "Count Words",
      uses: "demo/word-counter:count",
      description: "Count words and characters in text",
      inputs: { text: "${{ inputs.text }}" },
      continueOnError: false,
      ifCondition: "",
      color: "#694DFF",
    },
  },
  {
    id: "step-report",
    type: "skill",
    position: { x: 420, y: 220 },
    data: {
      stepId: "report",
      label: "Generate Report",
      uses: "demo/report:generate",
      description: "Format stats into a readable report",
      inputs: {
        text: "${{ inputs.text }}",
        word_count: "${{ steps.count.outputs.word_count }}",
        char_count: "${{ steps.count.outputs.char_count }}",
      },
      continueOnError: false,
      ifCondition: "",
      color: "#2800FF",
    },
  },
];

const DEFAULT_EDGES: Edge[] = [
  {
    id: "e-trigger-count",
    source: "trigger",
    target: "step-count",
    animated: true,
    style: { stroke: "#5A78FF", strokeWidth: 2 },
  },
  {
    id: "e-count-report",
    source: "step-count",
    target: "step-report",
    animated: true,
    style: { stroke: "#5A78FF", strokeWidth: 2 },
  },
];

// ─── App ─────────────────────────────────────────────────────────────────────

let nodeCounter = 10;

export default function App() {
  const [workflowName, setWorkflowName] = useState("Text Analysis Pipeline");
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowNode>(DEFAULT_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(DEFAULT_EDGES);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showYaml, setShowYaml] = useState(true);

  // Derive selected node
  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId]
  );

  const hasTrigger = nodes.some((n) => n.type === "trigger");

  // ─── Listen for inline node data updates from TriggerNode component ───
  useEffect(() => {
    const handler = (e: Event) => {
      const { id, patch } = (e as CustomEvent<{ id: string; patch: Record<string, unknown> }>)
        .detail;
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id ? ({ ...n, data: { ...n.data, ...patch } } as WorkflowNode) : n
        )
      );
    };
    window.addEventListener("enact:updateNode", handler);
    return () => window.removeEventListener("enact:updateNode", handler);
  }, [setNodes]);

  // ─── Node operations ──────────────────────────────────────────────────

  const addTrigger = useCallback(() => {
    if (hasTrigger) return;
    const trigger: WorkflowNode = {
      id: "trigger",
      type: "trigger",
      position: { x: 200, y: 50 },
      data: { label: "Manual Trigger", inputs: {} } as TriggerNodeData,
    };
    setNodes((nds) => [...nds, trigger]);
  }, [hasTrigger, setNodes]);

  const addModelNode = useCallback(
    (modelOpt: { value: string; label: string }, position?: { x: number; y: number }) => {
      const id = `step-${++nodeCounter}`;
      const node: WorkflowNode = {
        id,
        type: "model",
        position: position ?? { x: 250, y: 300 + nodeCounter * 20 },
        data: {
          stepId: `model_${nodeCounter}`,
          label: modelOpt.label,
          model: modelOpt.value,
          prompt: "",
          tools: [],
          continueOnError: false,
          ifCondition: "",
        } as ModelNodeData,
      };
      setNodes((nds) => [...nds, node]);
    },
    [setNodes]
  );

  const addSkillNode = useCallback(
    (template: SkillTemplate, position: { x: number; y: number }) => {
      const id = `step-${++nodeCounter}`;
      const stepId =
        template.id === "custom"
          ? `step${nodeCounter}`
          : `${template.id.replace(/[^a-z0-9]/gi, "_")}`;

      const node: WorkflowNode = {
        id,
        type: "skill",
        position,
        data: {
          stepId,
          label: template.name,
          uses: template.uses,
          description: template.description,
          inputs: { ...template.defaultInputs },
          continueOnError: false,
          ifCondition: "",
          color: template.color,
        } as SkillNodeData,
      };
      setNodes((nds) => [...nds, node]);
    },
    [setNodes]
  );

  const updateNode = useCallback(
    (id: string, patch: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id ? ({ ...n, data: { ...n.data, ...patch } } as WorkflowNode) : n
        )
      );
    },
    [setNodes]
  );

  const deleteNode = useCallback(
    (id: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
      setSelectedNodeId(null);
    },
    [setNodes, setEdges]
  );

  const updateEdges = useCallback(
    (updater: (edges: Edge[]) => Edge[]) => {
      setEdges(updater);
    },
    [setEdges]
  );

  // ─── YAML export / import ─────────────────────────────────────────────

  const yamlText = useMemo(
    () => exportWorkflow(workflowName, nodes, edges),
    [workflowName, nodes, edges]
  );

  const handleExport = () => {
    const blob = new Blob([yamlText], { type: "text/yaml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${workflowName.toLowerCase().replace(/\s+/g, "-")}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (yaml: string) => {
    const { name, nodes: importedNodes, edges: importedEdges } = importWorkflow(yaml);
    setWorkflowName(name);
    setNodes(importedNodes);
    setEdges(importedEdges);
    setSelectedNodeId(null);
  };

  const handleRun = () => {
    const cmd = "enact workflow run workflow.yaml";
    alert(
      `To run this workflow:\n\n1. Export the YAML file\n2. Run:\n   ${cmd}\n\nOr copy the YAML and save it, then run the command.`
    );
  };

  // ─── Layout ───────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col w-full h-full bg-[#0d0d1a]">
      <TopBar
        workflowName={workflowName}
        onNameChange={setWorkflowName}
        onExport={handleExport}
        onImport={handleImport}
        onRun={handleRun}
        showYaml={showYaml}
        onToggleYaml={() => setShowYaml((s) => !s)}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          onAddTrigger={addTrigger}
          hasTrigger={hasTrigger}
          onAddModelNode={(m) => addModelNode(m)}
        />

        <Canvas
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onEdgesUpdate={updateEdges}
          onNodeSelect={setSelectedNodeId}
          onAddSkillNode={addSkillNode}
          onAddModelNode={addModelNode}
        />

        <Inspector node={selectedNode} onUpdateNode={updateNode} onDeleteNode={deleteNode} />
      </div>

      {showYaml && <YamlPanel yaml={yamlText} />}
    </div>
  );
}

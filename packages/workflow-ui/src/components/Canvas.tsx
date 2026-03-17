import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  addEdge,
  useReactFlow,
} from "@xyflow/react";
import type { Connection, Edge, NodeTypes, OnEdgesChange, OnNodesChange } from "@xyflow/react";
import { useCallback, useRef } from "react";
import type { DragEvent } from "react";
import "@xyflow/react/dist/style.css";

import type { SkillTemplate, WorkflowNode } from "../types";
import ModelNode from "./nodes/ModelNode";
import SkillNode from "./nodes/SkillNode";
import TriggerNode from "./nodes/TriggerNode";

// Must be defined outside component to prevent re-renders
const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  skill: SkillNode,
  model: ModelNode,
};

interface ModelOption {
  value: string;
  label: string;
  description: string;
}

interface CanvasProps {
  nodes: WorkflowNode[];
  edges: Edge[];
  onNodesChange: OnNodesChange<WorkflowNode>;
  onEdgesChange: OnEdgesChange;
  onEdgesUpdate: (updater: (edges: Edge[]) => Edge[]) => void;
  onNodeSelect: (nodeId: string | null) => void;
  onAddSkillNode: (template: SkillTemplate, position: { x: number; y: number }) => void;
  onAddModelNode: (model: ModelOption, position: { x: number; y: number }) => void;
}

export default function Canvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onEdgesUpdate,
  onNodeSelect,
  onAddSkillNode,
  onAddModelNode,
}: CanvasProps) {
  const { screenToFlowPosition } = useReactFlow();
  const flowRef = useRef<HTMLDivElement>(null);

  const onConnect = useCallback(
    (connection: Connection) => {
      onEdgesUpdate((eds) =>
        addEdge(
          { ...connection, animated: true, style: { stroke: "#5A78FF", strokeWidth: 2 } },
          eds
        )
      );
    },
    [onEdgesUpdate]
  );

  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });

      const skillRaw = e.dataTransfer.getData("application/enact-template");
      if (skillRaw) {
        onAddSkillNode(JSON.parse(skillRaw) as SkillTemplate, position);
        return;
      }

      const modelRaw = e.dataTransfer.getData("application/enact-model");
      if (modelRaw) {
        onAddModelNode(JSON.parse(modelRaw) as ModelOption, position);
      }
    },
    [screenToFlowPosition, onAddSkillNode, onAddModelNode]
  );

  return (
    <div ref={flowRef} className="flex-1 relative" onDragOver={onDragOver} onDrop={onDrop}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => onNodeSelect(node.id)}
        onPaneClick={() => onNodeSelect(null)}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        deleteKeyCode="Delete"
        proOptions={{ hideAttribution: true }}
        style={{ background: "#0d0d1a" }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#1e1e30" />
        <Controls className="!bg-[#1a1a2e] !border-[#2a2a40]" style={{ bottom: 20, left: 20 }} />
        <MiniMap
          nodeColor={(n) => {
            if (n.type === "trigger") return "#2800FF";
            if (n.type === "model") return "#05C276";
            return "#694DFF";
          }}
          maskColor="rgba(13,13,26,0.8)"
          style={{
            background: "#13131f",
            border: "1px solid #2a2a40",
            borderRadius: "8px",
          }}
        />
      </ReactFlow>

      {/* Empty state */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-4xl mb-3">✦</div>
            <p className="text-gray-600 text-sm">
              Add a <span className="text-[#5A78FF]">Manual Trigger</span> to start
            </p>
            <p className="text-gray-700 text-xs mt-1">Then drag skills from the sidebar</p>
          </div>
        </div>
      )}
    </div>
  );
}

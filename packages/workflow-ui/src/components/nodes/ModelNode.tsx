import { Handle, Position } from "@xyflow/react";
import type { Node, NodeProps } from "@xyflow/react";
import { BrainCircuit, Cpu } from "lucide-react";
import type { ModelNodeData } from "../../types";

type ModelNodeType = Node<ModelNodeData, "model">;

const MODEL_COLORS: Record<string, string> = {
  agent: "#05C276",
  "claude-opus-4-6": "#FF7698",
  "claude-sonnet-4-6": "#694DFF",
  "claude-haiku-4-5-20251001": "#5A78FF",
};

function modelColor(model: string) {
  return MODEL_COLORS[model] ?? "#694DFF";
}

function modelLabel(model: string) {
  if (model === "agent") return "Current Agent";
  if (model.includes("opus")) return "Opus";
  if (model.includes("sonnet")) return "Sonnet";
  if (model.includes("haiku")) return "Haiku";
  return model;
}

export default function ModelNode({ data, selected }: NodeProps<ModelNodeType>) {
  const color = modelColor(data.model);
  const isAgent = data.model === "agent";

  return (
    <div
      className={`bg-[#1a1a2e] rounded-xl overflow-hidden shadow-xl border-2 transition-all min-w-[260px] max-w-[300px] ${
        selected ? "border-[#5A78FF] shadow-[0_0_20px_rgba(90,120,255,0.3)]" : "border-[#2a2a40]"
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-[#694DFF] !border-2 !border-[#0d0d1a]"
      />

      {/* Header */}
      <div
        className="px-4 py-3 flex items-center gap-2"
        style={{ background: `linear-gradient(135deg, ${color}33, ${color}11)` }}
      >
        <div
          className="p-1.5 rounded-lg"
          style={{ backgroundColor: `${color}33`, border: `1px solid ${color}66` }}
        >
          {isAgent ? (
            <Cpu size={14} style={{ color }} />
          ) : (
            <BrainCircuit size={14} style={{ color }} />
          )}
        </div>
        <div>
          <div className="text-white font-semibold text-sm">{data.label}</div>
          <div className="text-xs font-mono" style={{ color: `${color}cc` }}>
            {modelLabel(data.model)}
          </div>
        </div>
        {isAgent && (
          <span
            className="ml-auto text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ backgroundColor: `${color}22`, color }}
          >
            agent
          </span>
        )}
      </div>

      {/* Prompt preview */}
      {data.prompt && (
        <div className="px-4 py-2">
          <p className="text-xs text-gray-500 leading-relaxed line-clamp-3">{data.prompt}</p>
        </div>
      )}

      {!data.prompt && (
        <div className="px-4 py-2">
          <p className="text-xs text-gray-600 italic">No prompt set</p>
        </div>
      )}

      {/* Tools */}
      {data.tools.length > 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1">
          {data.tools.map((tool) => (
            <span
              key={tool}
              className="text-xs bg-[#0d0d1a] text-gray-500 px-2 py-0.5 rounded font-mono border border-[#2a2a40]"
            >
              {tool.split(":")[0]}
            </span>
          ))}
        </div>
      )}

      {/* Footer badges */}
      <div className="px-4 py-2 border-t border-[#2a2a40] flex items-center gap-2">
        {data.continueOnError && (
          <span className="text-xs bg-yellow-900/40 text-yellow-400 px-2 py-0.5 rounded-full">
            continue on error
          </span>
        )}
        {!data.continueOnError && <span className="text-xs text-gray-600">model step</span>}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-[#5A78FF] !border-2 !border-[#0d0d1a]"
      />
    </div>
  );
}

import { Handle, Position } from "@xyflow/react";
import type { Node, NodeProps } from "@xyflow/react";
import { Box } from "lucide-react";
import type { SkillNodeData } from "../../types";

type SkillNodeType = Node<SkillNodeData, "skill">;

export default function SkillNode({ data, selected }: NodeProps<SkillNodeType>) {
  const inputEntries = Object.entries(data.inputs);

  return (
    <div
      className={`bg-[#1a1a2e] rounded-xl overflow-hidden shadow-xl border-2 transition-all min-w-[240px] max-w-[300px] ${
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
        style={{ background: `linear-gradient(135deg, ${data.color}cc, ${data.color}66)` }}
      >
        <div className="p-1.5 bg-white/20 rounded-lg">
          <Box size={14} className="text-white" />
        </div>
        <div className="min-w-0">
          <div className="text-white font-semibold text-sm truncate">{data.label}</div>
          <div className="text-white/60 text-xs font-mono truncate">
            {data.uses || "no skill set"}
          </div>
        </div>
      </div>

      {/* Inputs preview */}
      {inputEntries.length > 0 && (
        <div className="px-4 py-2 space-y-1">
          {inputEntries.map(([key, val]) => (
            <div key={key} className="flex items-start gap-2 text-xs">
              <span className="text-[#694DFF] font-mono shrink-0">{key}:</span>
              <span className="text-gray-400 truncate font-mono">{val || '""'}</span>
            </div>
          ))}
        </div>
      )}

      {inputEntries.length === 0 && (
        <div className="px-4 py-2 text-xs text-gray-600 italic">No inputs configured</div>
      )}

      {/* Status indicators */}
      <div className="px-4 py-2 border-t border-[#2a2a40] flex items-center gap-2">
        {data.continueOnError && (
          <span className="text-xs bg-yellow-900/40 text-yellow-400 px-2 py-0.5 rounded-full">
            continue on error
          </span>
        )}
        {data.ifCondition && (
          <span className="text-xs bg-purple-900/40 text-purple-400 px-2 py-0.5 rounded-full font-mono truncate">
            if: {data.ifCondition}
          </span>
        )}
        {!data.continueOnError && !data.ifCondition && (
          <span className="text-xs text-gray-600">skill step</span>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-[#5A78FF] !border-2 !border-[#0d0d1a]"
      />
    </div>
  );
}

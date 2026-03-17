import { Handle, Position } from "@xyflow/react";
import type { Node, NodeProps } from "@xyflow/react";
import { Plus, Trash2, Zap } from "lucide-react";
import { useState } from "react";
import type { TriggerNodeData } from "../../types";

type TriggerNodeType = Node<TriggerNodeData, "trigger">;

export default function TriggerNode({ data, selected, id }: NodeProps<TriggerNodeType>) {
  const [newKey, setNewKey] = useState("");

  const updateData = (patch: Partial<TriggerNodeData>) => {
    // Emit custom event to update node data from outside React Flow
    window.dispatchEvent(new CustomEvent("enact:updateNode", { detail: { id, patch } }));
  };

  const addInput = () => {
    const key = newKey.trim();
    if (!key || data.inputs[key]) return;
    updateData({
      inputs: {
        ...data.inputs,
        [key]: { description: "", required: true },
      },
    });
    setNewKey("");
  };

  const removeInput = (key: string) => {
    const next = { ...data.inputs };
    delete next[key];
    updateData({ inputs: next });
  };

  const updateInput = (key: string, field: "description" | "required", value: string | boolean) => {
    updateData({
      inputs: {
        ...data.inputs,
        [key]: { ...data.inputs[key], [field]: value },
      },
    });
  };

  return (
    <div
      className={`bg-[#1a1a2e] rounded-xl overflow-hidden shadow-xl border-2 transition-all min-w-[260px] ${
        selected ? "border-brand-light shadow-[0_0_20px_rgba(90,120,255,0.4)]" : "border-[#2a2a40]"
      }`}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-[#2800FF] to-[#694DFF] px-4 py-3 flex items-center gap-2">
        <div className="p-1.5 bg-white/20 rounded-lg">
          <Zap size={14} className="text-white" />
        </div>
        <div>
          <div className="text-white font-semibold text-sm">Manual Trigger</div>
          <div className="text-white/60 text-xs">Workflow entry point</div>
        </div>
      </div>

      {/* Inputs list */}
      <div className="px-4 py-3 space-y-2">
        {Object.entries(data.inputs).map(([key, def]) => (
          <div key={key} className="bg-[#0d0d1a] rounded-lg p-2 text-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[#5A78FF] font-mono font-semibold">{key}</span>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-gray-500 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={def.required}
                    onChange={(e) => updateInput(key, "required", e.target.checked)}
                    className="w-3 h-3 accent-[#5A78FF]"
                  />
                  <span>required</span>
                </label>
                <button
                  type="button"
                  onClick={() => removeInput(key)}
                  className="text-gray-600 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
            <input
              value={def.description}
              onChange={(e) => updateInput(key, "description", e.target.value)}
              placeholder="Description..."
              className="w-full bg-transparent text-gray-400 placeholder-gray-600 border-none outline-none text-xs"
            />
          </div>
        ))}

        {/* Add input */}
        <div className="flex gap-2">
          <input
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addInput()}
            placeholder="Add input..."
            className="flex-1 bg-[#0d0d1a] text-gray-300 placeholder-gray-600 text-xs px-2 py-1.5 rounded-lg border border-[#2a2a40] outline-none focus:border-[#5A78FF] transition-colors"
          />
          <button
            type="button"
            onClick={addInput}
            className="p-1.5 bg-[#5A78FF]/20 hover:bg-[#5A78FF]/40 text-[#5A78FF] rounded-lg transition-colors"
          >
            <Plus size={12} />
          </button>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-[#5A78FF] !border-2 !border-[#0d0d1a]"
      />
    </div>
  );
}

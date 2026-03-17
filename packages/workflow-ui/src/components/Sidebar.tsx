import { Box, BrainCircuit, Cpu, Globe, Puzzle, Settings, Sparkles, Zap } from "lucide-react";
import type { DragEvent, ReactNode } from "react";
import { MODEL_OPTIONS, SKILL_TEMPLATES } from "../types";
import type { SkillTemplate } from "../types";

const CATEGORY_ICONS: Record<string, ReactNode> = {
  Demo: <Box size={13} />,
  Web: <Globe size={13} />,
  AI: <Sparkles size={13} />,
  Integrations: <Puzzle size={13} />,
  Custom: <Settings size={13} />,
};

const CATEGORIES = ["Demo", "Web", "AI", "Integrations", "Custom"];

interface ModelTemplate {
  value: string;
  label: string;
  description: string;
}

interface SidebarProps {
  onAddTrigger: () => void;
  hasTrigger: boolean;
  onAddModelNode: (model: ModelTemplate) => void;
}

export default function Sidebar({ onAddTrigger, hasTrigger, onAddModelNode }: SidebarProps) {
  const handleDragStart = (e: DragEvent, template: SkillTemplate) => {
    e.dataTransfer.setData("application/enact-template", JSON.stringify(template));
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleModelDragStart = (e: DragEvent, model: ModelTemplate) => {
    e.dataTransfer.setData("application/enact-model", JSON.stringify(model));
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div className="w-64 bg-[#13131f] border-r border-[#2a2a40] flex flex-col overflow-hidden shrink-0">
      <div className="px-4 py-3 border-b border-[#2a2a40]">
        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Nodes</p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Trigger */}
        <div>
          <p className="text-xs text-gray-600 uppercase tracking-wider mb-2 px-1">Trigger</p>
          <button
            type="button"
            onClick={onAddTrigger}
            disabled={hasTrigger}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
              hasTrigger
                ? "opacity-40 cursor-not-allowed border-[#2a2a40] bg-[#1a1a2e]"
                : "border-[#2a2a40] bg-[#1a1a2e] hover:border-[#5A78FF] hover:bg-[#1e1e38] cursor-pointer"
            }`}
          >
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-[#2800FF] to-[#694DFF]">
              <Zap size={13} className="text-white" />
            </div>
            <div>
              <div className="text-sm text-white font-medium">Manual Trigger</div>
              <div className="text-xs text-gray-500">Workflow entry point</div>
            </div>
          </button>
        </div>

        {/* Model steps */}
        <div>
          <p className="text-xs text-gray-600 uppercase tracking-wider mb-2 px-1 flex items-center gap-1.5">
            <BrainCircuit size={13} />
            Model Steps
          </p>
          <div className="space-y-1.5">
            {MODEL_OPTIONS.map((m) => (
              // biome-ignore lint/a11y/useKeyWithClickEvents: draggable palette item
              <div
                key={m.value}
                draggable
                onDragStart={(e) => handleModelDragStart(e, m)}
                onClick={() => onAddModelNode(m)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-[#2a2a40] bg-[#1a1a2e] hover:border-[#3a3a60] hover:bg-[#1e1e38] cursor-grab active:cursor-grabbing transition-all"
              >
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${m.value === "agent" ? "bg-[#05C27622] border border-[#05C27666]" : "bg-[#694DFF22] border border-[#694DFF66]"}`}
                >
                  {m.value === "agent" ? (
                    <Cpu size={11} className="text-[#05C276]" />
                  ) : (
                    <BrainCircuit size={11} className="text-[#694DFF]" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-sm text-white font-medium truncate">{m.label}</div>
                  <div className="text-xs text-gray-500 truncate">{m.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Skills by category */}
        {CATEGORIES.map((cat) => {
          const templates = SKILL_TEMPLATES.filter((t) => t.category === cat);
          return (
            <div key={cat}>
              <p className="text-xs text-gray-600 uppercase tracking-wider mb-2 px-1 flex items-center gap-1.5">
                {CATEGORY_ICONS[cat]}
                {cat}
              </p>
              <div className="space-y-1.5">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, template)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-[#2a2a40] bg-[#1a1a2e] hover:border-[#3a3a60] hover:bg-[#1e1e38] cursor-grab active:cursor-grabbing transition-all"
                  >
                    <div
                      className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: `${template.color}33`,
                        border: `1px solid ${template.color}66`,
                      }}
                    >
                      <Box size={11} style={{ color: template.color }} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm text-white font-medium truncate">{template.name}</div>
                      <div className="text-xs text-gray-500 truncate">{template.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-3 border-t border-[#2a2a40]">
        <p className="text-xs text-gray-600 text-center">Drag skills onto the canvas</p>
      </div>
    </div>
  );
}

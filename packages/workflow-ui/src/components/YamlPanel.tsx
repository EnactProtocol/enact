import { Check, ChevronDown, ChevronUp, Copy } from "lucide-react";
import { useState } from "react";

interface YamlPanelProps {
  yaml: string;
  height?: number;
}

export default function YamlPanel({ yaml, height = 220 }: YamlPanelProps) {
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(yaml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="bg-[#0d0d1a] border-t border-[#2a2a40] flex flex-col shrink-0 transition-all"
      style={{ height: collapsed ? 40 : height }}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 h-10 border-b border-[#2a2a40] shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
            YAML Preview
          </span>
          <span className="text-xs text-gray-700">· live</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={copyToClipboard}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-gray-400 hover:text-gray-200 hover:bg-[#1a1a2e] transition-colors"
          >
            {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
            <span>{copied ? "Copied!" : "Copy"}</span>
          </button>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="p-1 text-gray-600 hover:text-gray-400 transition-colors"
          >
            {collapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Code */}
      {!collapsed && (
        <div className="flex-1 overflow-auto">
          <pre className="text-xs text-gray-300 font-mono p-4 leading-relaxed whitespace-pre">
            {yaml}
          </pre>
        </div>
      )}
    </div>
  );
}

import { Code2, Download, Play, Upload } from "lucide-react";
import { useRef } from "react";
import type { ChangeEvent } from "react";

interface TopBarProps {
  workflowName: string;
  onNameChange: (name: string) => void;
  onExport: () => void;
  onImport: (yaml: string) => void;
  onRun: () => void;
  showYaml: boolean;
  onToggleYaml: () => void;
}

export default function TopBar({
  workflowName,
  onNameChange,
  onExport,
  onImport,
  onRun,
  showYaml,
  onToggleYaml,
}: TopBarProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      onImport(text);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="h-14 bg-[#13131f] border-b border-[#2a2a40] flex items-center px-4 gap-4 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2 mr-2">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#2800FF] to-[#694DFF] flex items-center justify-center">
          <span className="text-white font-bold text-xs">E</span>
        </div>
        <span className="text-gray-400 text-sm font-medium">Workflow Studio</span>
      </div>

      <div className="w-px h-6 bg-[#2a2a40]" />

      {/* Workflow name */}
      <input
        value={workflowName}
        onChange={(e) => onNameChange(e.target.value)}
        className="bg-transparent text-white text-sm font-medium border-none outline-none w-52 placeholder-gray-600 hover:bg-[#1a1a2e] focus:bg-[#1a1a2e] px-2 py-1 rounded-lg transition-colors"
        placeholder="Workflow name..."
      />

      <div className="flex-1" />

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleYaml}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
            showYaml
              ? "bg-[#5A78FF]/20 text-[#5A78FF]"
              : "text-gray-400 hover:text-gray-200 hover:bg-[#1a1a2e]"
          }`}
        >
          <Code2 size={15} />
          <span>YAML</span>
        </button>

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-gray-200 hover:bg-[#1a1a2e] transition-colors"
        >
          <Upload size={15} />
          <span>Import</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".yaml,.yml"
          className="hidden"
          onChange={handleFileChange}
        />

        <button
          type="button"
          onClick={onExport}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-gray-200 hover:bg-[#1a1a2e] transition-colors"
        >
          <Download size={15} />
          <span>Export</span>
        </button>

        <button
          type="button"
          onClick={onRun}
          className="flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-[#2800FF] to-[#694DFF] hover:from-[#3a10ff] hover:to-[#7a5dff] text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-blue-900/30"
        >
          <Play size={14} fill="currentColor" />
          <span>Run</span>
        </button>
      </div>
    </div>
  );
}

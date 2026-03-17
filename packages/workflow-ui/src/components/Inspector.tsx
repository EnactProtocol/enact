import { Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import type { ModelNodeData, SkillNodeData, TriggerNodeData, WorkflowNode } from "../types";
import { MODEL_OPTIONS } from "../types";

interface InspectorProps {
  node: WorkflowNode | null;
  onUpdateNode: (id: string, patch: Record<string, unknown>) => void;
  onDeleteNode: (id: string) => void;
}

export default function Inspector({ node, onUpdateNode, onDeleteNode }: InspectorProps) {
  if (!node) {
    return (
      <div className="w-72 bg-[#13131f] border-l border-[#2a2a40] flex flex-col items-center justify-center shrink-0">
        <div className="text-center px-6">
          <div className="w-12 h-12 rounded-xl bg-[#1a1a2e] border border-[#2a2a40] flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">👆</span>
          </div>
          <p className="text-gray-500 text-sm">Select a node to configure it</p>
        </div>
      </div>
    );
  }

  if (node.type === "trigger") {
    return <TriggerInspector node={node} onUpdate={onUpdateNode} onDelete={onDeleteNode} />;
  }
  if (node.type === "model") {
    return <ModelInspector node={node} onUpdate={onUpdateNode} onDelete={onDeleteNode} />;
  }
  return <SkillInspector node={node} onUpdate={onUpdateNode} onDelete={onDeleteNode} />;
}

// ─── Trigger Inspector ───────────────────────────────────────────────────────

function TriggerInspector({
  node,
  onUpdate,
  onDelete,
}: {
  node: WorkflowNode;
  onUpdate: (id: string, patch: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
}) {
  const data = node.data as TriggerNodeData;
  const [newKey, setNewKey] = useState("");

  const addInput = () => {
    const key = newKey.trim();
    if (!key || data.inputs[key]) return;
    onUpdate(node.id, {
      inputs: { ...data.inputs, [key]: { description: "", required: true } },
    });
    setNewKey("");
  };

  const removeInput = (key: string) => {
    const next = { ...data.inputs };
    delete next[key];
    onUpdate(node.id, { inputs: next });
  };

  const updateInputField = (
    key: string,
    field: "description" | "required",
    value: string | boolean
  ) => {
    onUpdate(node.id, {
      inputs: { ...data.inputs, [key]: { ...data.inputs[key], [field]: value } },
    });
  };

  return (
    <InspectorShell
      title="Manual Trigger"
      subtitle="Workflow entry point"
      color="#2800FF"
      nodeId={node.id}
      onDelete={onDelete}
    >
      <Section title="Inputs">
        {Object.entries(data.inputs).map(([key, def]) => (
          <div key={key} className="bg-[#0d0d1a] rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[#5A78FF] font-mono text-xs font-semibold">{key}</span>
              <button
                type="button"
                onClick={() => removeInput(key)}
                className="text-gray-600 hover:text-red-400"
              >
                <X size={12} />
              </button>
            </div>
            <input
              value={def.description}
              onChange={(e) => updateInputField(key, "description", e.target.value)}
              placeholder="Description..."
              className="w-full bg-transparent text-gray-300 text-xs border-b border-[#2a2a40] outline-none pb-1 placeholder-gray-600"
            />
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={def.required}
                onChange={(e) => updateInputField(key, "required", e.target.checked)}
                className="w-3 h-3 accent-[#5A78FF]"
              />
              <span className="text-xs text-gray-500">Required</span>
            </label>
          </div>
        ))}
        <div className="flex gap-2">
          <input
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addInput()}
            placeholder="Input name..."
            className="flex-1 bg-[#0d0d1a] text-gray-300 text-xs px-3 py-2 rounded-lg border border-[#2a2a40] outline-none focus:border-[#5A78FF] placeholder-gray-600"
          />
          <button
            type="button"
            onClick={addInput}
            className="p-2 bg-[#5A78FF]/20 hover:bg-[#5A78FF]/40 text-[#5A78FF] rounded-lg"
          >
            <Plus size={13} />
          </button>
        </div>
      </Section>
    </InspectorShell>
  );
}

// ─── Skill Inspector ─────────────────────────────────────────────────────────

function SkillInspector({
  node,
  onUpdate,
  onDelete,
}: {
  node: WorkflowNode;
  onUpdate: (id: string, patch: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
}) {
  const data = node.data as SkillNodeData;
  const [newInputKey, setNewInputKey] = useState("");

  const addInputField = () => {
    const key = newInputKey.trim();
    if (!key) return;
    onUpdate(node.id, { inputs: { ...data.inputs, [key]: "" } });
    setNewInputKey("");
  };

  const removeInputField = (key: string) => {
    const next = { ...data.inputs };
    delete next[key];
    onUpdate(node.id, { inputs: next });
  };

  return (
    <InspectorShell
      title={data.label}
      subtitle={data.uses || "No skill set"}
      color={data.color}
      nodeId={node.id}
      onDelete={onDelete}
    >
      <Section title="Identity">
        <Field label="Step ID">
          <input
            value={data.stepId}
            onChange={(e) => onUpdate(node.id, { stepId: e.target.value })}
            className={INPUT_CLS}
          />
        </Field>
        <Field label="Display name">
          <input
            value={data.label}
            onChange={(e) => onUpdate(node.id, { label: e.target.value })}
            className={INPUT_CLS}
          />
        </Field>
        <Field label="Uses (skill:action)">
          <input
            value={data.uses}
            onChange={(e) => onUpdate(node.id, { uses: e.target.value })}
            className={INPUT_CLS}
            placeholder="owner/skill:action"
          />
        </Field>
      </Section>

      <Section title="Inputs (with:)">
        {Object.entries(data.inputs).map(([key, val]) => (
          <Field key={key} label={key}>
            <div className="flex gap-1">
              <input
                value={val}
                onChange={(e) =>
                  onUpdate(node.id, { inputs: { ...data.inputs, [key]: e.target.value } })
                }
                className={`${INPUT_CLS} flex-1`}
                placeholder={`\${{ inputs.${key} }}`}
              />
              <button
                type="button"
                onClick={() => removeInputField(key)}
                className="text-gray-600 hover:text-red-400 px-1"
              >
                <X size={11} />
              </button>
            </div>
          </Field>
        ))}
        <div className="flex gap-2">
          <input
            value={newInputKey}
            onChange={(e) => setNewInputKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addInputField()}
            placeholder="Add input key..."
            className="flex-1 bg-[#0d0d1a] text-gray-300 text-xs px-3 py-2 rounded-lg border border-[#2a2a40] outline-none focus:border-[#5A78FF] placeholder-gray-600"
          />
          <button
            type="button"
            onClick={addInputField}
            className="p-2 bg-[#5A78FF]/20 hover:bg-[#5A78FF]/40 text-[#5A78FF] rounded-lg"
          >
            <Plus size={13} />
          </button>
        </div>
      </Section>

      <Section title="Conditions">
        <Field label="Run if">
          <input
            value={data.ifCondition}
            onChange={(e) => onUpdate(node.id, { ifCondition: e.target.value })}
            className={INPUT_CLS}
            placeholder="e.g. steps.prev.outputs.ok == 'true'"
          />
        </Field>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={data.continueOnError}
            onChange={(e) => onUpdate(node.id, { continueOnError: e.target.checked })}
            className="w-3.5 h-3.5 accent-[#5A78FF]"
          />
          <span className="text-xs text-gray-400">Continue on error</span>
        </label>
      </Section>
    </InspectorShell>
  );
}

// ─── Model Inspector ─────────────────────────────────────────────────────────

function ModelInspector({
  node,
  onUpdate,
  onDelete,
}: {
  node: WorkflowNode;
  onUpdate: (id: string, patch: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
}) {
  const data = node.data as ModelNodeData;
  const [newTool, setNewTool] = useState("");

  const addTool = () => {
    const t = newTool.trim();
    if (!t || data.tools.includes(t)) return;
    onUpdate(node.id, { tools: [...data.tools, t] });
    setNewTool("");
  };

  const removeTool = (tool: string) => {
    onUpdate(node.id, { tools: data.tools.filter((t) => t !== tool) });
  };

  const modelLabel = MODEL_OPTIONS.find((m) => m.value === data.model)?.label ?? data.model;

  return (
    <InspectorShell
      title={data.label}
      subtitle={modelLabel}
      color={data.model === "agent" ? "#05C276" : "#694DFF"}
      nodeId={node.id}
      onDelete={onDelete}
    >
      <Section title="Identity">
        <Field label="Step ID">
          <input
            value={data.stepId}
            onChange={(e) => onUpdate(node.id, { stepId: e.target.value })}
            className={INPUT_CLS}
          />
        </Field>
        <Field label="Display name">
          <input
            value={data.label}
            onChange={(e) => onUpdate(node.id, { label: e.target.value })}
            className={INPUT_CLS}
          />
        </Field>
        <Field label="Model">
          <select
            value={data.model}
            onChange={(e) => onUpdate(node.id, { model: e.target.value })}
            className={`${INPUT_CLS} cursor-pointer`}
          >
            {MODEL_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      <Section title="Prompt">
        <textarea
          value={data.prompt}
          onChange={(e) => onUpdate(node.id, { prompt: e.target.value })}
          placeholder={
            "Describe what the model should do...\n\nYou can use ${{ inputs.x }} and ${{ steps.id.outputs.field }}"
          }
          rows={6}
          className={`${INPUT_CLS} resize-y leading-relaxed`}
        />
      </Section>

      <Section title="Available tools">
        <p className="text-xs text-gray-600">Skills the model can call during this step</p>
        {data.tools.map((tool) => (
          <div key={tool} className="flex items-center gap-2">
            <span className="flex-1 bg-[#0d0d1a] text-gray-400 text-xs px-3 py-1.5 rounded-lg border border-[#2a2a40] font-mono truncate">
              {tool}
            </span>
            <button
              type="button"
              onClick={() => removeTool(tool)}
              className="text-gray-600 hover:text-red-400"
            >
              <X size={11} />
            </button>
          </div>
        ))}
        <div className="flex gap-2">
          <input
            value={newTool}
            onChange={(e) => setNewTool(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTool()}
            placeholder="owner/skill:action"
            className="flex-1 bg-[#0d0d1a] text-gray-300 text-xs px-3 py-2 rounded-lg border border-[#2a2a40] outline-none focus:border-[#5A78FF] placeholder-gray-600 font-mono"
          />
          <button
            type="button"
            onClick={addTool}
            className="p-2 bg-[#5A78FF]/20 hover:bg-[#5A78FF]/40 text-[#5A78FF] rounded-lg"
          >
            <Plus size={13} />
          </button>
        </div>
      </Section>

      <Section title="Conditions">
        <Field label="Run if">
          <input
            value={data.ifCondition}
            onChange={(e) => onUpdate(node.id, { ifCondition: e.target.value })}
            className={INPUT_CLS}
            placeholder="e.g. steps.prev.outputs.ok == 'true'"
          />
        </Field>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={data.continueOnError}
            onChange={(e) => onUpdate(node.id, { continueOnError: e.target.checked })}
            className="w-3.5 h-3.5 accent-[#5A78FF]"
          />
          <span className="text-xs text-gray-400">Continue on error</span>
        </label>
      </Section>
    </InspectorShell>
  );
}

// ─── Shared sub-components ───────────────────────────────────────────────────

const INPUT_CLS =
  "w-full bg-[#0d0d1a] text-gray-300 text-xs px-3 py-2 rounded-lg border border-[#2a2a40] outline-none focus:border-[#5A78FF] placeholder-gray-600 font-mono";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-600 uppercase tracking-wider font-semibold">{title}</p>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-gray-500">{label}</p>
      {children}
    </div>
  );
}

function InspectorShell({
  title,
  subtitle,
  color,
  nodeId,
  onDelete,
  children,
}: {
  title: string;
  subtitle: string;
  color: string;
  nodeId: string;
  onDelete: (id: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="w-72 bg-[#13131f] border-l border-[#2a2a40] flex flex-col overflow-hidden shrink-0">
      <div
        className="px-4 py-4 border-b border-[#2a2a40]"
        style={{ background: `linear-gradient(135deg, ${color}22, transparent)` }}
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-white font-semibold text-sm">{title}</h3>
            <p className="text-gray-500 text-xs font-mono mt-0.5 truncate max-w-[180px]">
              {subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onDelete(nodeId)}
            className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-5">{children}</div>
    </div>
  );
}

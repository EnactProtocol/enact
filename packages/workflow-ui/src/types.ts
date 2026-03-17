import type { Node } from "@xyflow/react";

// ─── Node data types ────────────────────────────────────────────────────────

export interface TriggerInputDef {
  description: string;
  required: boolean;
  default?: string;
}

export interface TriggerNodeData extends Record<string, unknown> {
  label: string;
  inputs: Record<string, TriggerInputDef>;
}

export interface SkillNodeData extends Record<string, unknown> {
  stepId: string;
  label: string;
  uses: string;
  description: string;
  inputs: Record<string, string>;
  continueOnError: boolean;
  ifCondition: string;
  color: string;
}

export interface ModelNodeData extends Record<string, unknown> {
  stepId: string;
  label: string;
  /** "agent" = delegate to the running agent; any model ID for a direct API call */
  model: string;
  prompt: string;
  /** Skill references available as tools for this model step */
  tools: string[];
  continueOnError: boolean;
  ifCondition: string;
}

export type TriggerNode = Node<TriggerNodeData, "trigger">;
export type SkillNode = Node<SkillNodeData, "skill">;
export type ModelNode = Node<ModelNodeData, "model">;
export type WorkflowNode = TriggerNode | SkillNode | ModelNode;

export const MODEL_OPTIONS = [
  { value: "agent", label: "Current agent", description: "Delegate to the running agent" },
  { value: "claude-opus-4-6", label: "Claude Opus 4.6", description: "Most capable" },
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", description: "Balanced" },
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", description: "Fastest" },
];

// ─── Skill templates (sidebar palette) ──────────────────────────────────────

export interface SkillTemplate {
  id: string;
  name: string;
  uses: string;
  description: string;
  category: string;
  defaultInputs: Record<string, string>;
  color: string;
}

export const SKILL_TEMPLATES: SkillTemplate[] = [
  {
    id: "word-counter",
    name: "Word Counter",
    uses: "demo/word-counter:count",
    description: "Count words and characters in text",
    category: "Demo",
    defaultInputs: { text: "${{ inputs.text }}" },
    color: "#694DFF",
  },
  {
    id: "report",
    name: "Report Generator",
    uses: "demo/report:generate",
    description: "Format text analysis stats into a readable report",
    category: "Demo",
    defaultInputs: {
      text: "${{ inputs.text }}",
      word_count: "${{ steps.count.outputs.word_count }}",
      char_count: "${{ steps.count.outputs.char_count }}",
    },
    color: "#2800FF",
  },
  {
    id: "web-scrape",
    name: "Web Scraper",
    uses: "enact/web-scrape:scrape",
    description: "Scrape content from a URL",
    category: "Web",
    defaultInputs: { url: "${{ inputs.url }}" },
    color: "#05C276",
  },
  {
    id: "summarize",
    name: "Summarize",
    uses: "enact/summarize:summarize",
    description: "Summarize text using AI",
    category: "AI",
    defaultInputs: { content: "" },
    color: "#FF7698",
  },
  {
    id: "slack-send",
    name: "Slack Message",
    uses: "enact/slack-send:send",
    description: "Send a message to Slack",
    category: "Integrations",
    defaultInputs: {
      message: "",
      channel: "#general",
    },
    color: "#4A154B",
  },
  {
    id: "custom",
    name: "Custom Skill",
    uses: "",
    description: "Any enact skill by name",
    category: "Custom",
    defaultInputs: {},
    color: "#4F4F4F",
  },
];

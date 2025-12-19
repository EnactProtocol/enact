import {
  AlertTriangle,
  Book,
  ChevronRight,
  Download,
  Eye,
  FileText,
  Key,
  List,
  Lock,
  Menu,
  Package,
  Play,
  RotateCcw,
  Search,
  Settings,
  Shield,
  Terminal,
  Trash2,
  Upload,
  User,
  X,
  Zap,
} from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

interface CommandDoc {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  colorClass: string;
  dotColor: string;
  usage: string;
  options: { flag: string; description: string }[];
  examples: { command: string; description: string }[];
  category: "core" | "registry" | "trust" | "config";
}

// Using brand colors: blue (#2800FF), pink (#FEC1EE), green (#05F293), teal (#9BE7D8), red (#FF7698), yellow (#FFFF60)
const commands: CommandDoc[] = [
  // Core Commands
  {
    id: "run",
    name: "run",
    description:
      "Execute a tool with its manifest-defined command. Automatically fetches from registry if not found locally.",
    icon: <Play className="w-5 h-5" />,
    colorClass: "bg-brand-green text-gray-900",
    dotColor: "bg-brand-green",
    usage: "enact run <tool> [options]",
    category: "core",
    options: [
      { flag: "-a, --args <json>", description: "Input arguments as JSON string" },
      { flag: "-f, --input-file <path>", description: "Load input arguments from JSON file" },
      {
        flag: "-i, --input <value>",
        description:
          "Input: key=value for params, ./path for files/dirs, name=./path for named inputs",
      },
      {
        flag: "-o, --output <path>",
        description: "Export /output directory to this path after execution",
      },
      {
        flag: "--apply",
        description:
          "Apply output back to input directory atomically (for in-place transformations)",
      },
      { flag: "-t, --timeout <duration>", description: "Execution timeout (e.g., 30s, 5m)" },
      { flag: "--local", description: "Only resolve from local sources" },
      { flag: "--dry-run", description: "Show what would be executed without running" },
      { flag: "-v, --verbose", description: "Show detailed output" },
      { flag: "--json", description: "Output result as JSON" },
    ],
    examples: [
      {
        command: "enact run alice/resizer --args '{\"width\": 800}'",
        description: "Run with JSON args",
      },
      {
        command: "enact run ./formatter --input ./src --output ./dist",
        description: "Process files from ./src, export results to ./dist",
      },
      {
        command: "enact run ./formatter --input ./src --output ./src --apply",
        description: "In-place transformation with atomic apply",
      },
      {
        command: "enact run ./diff-tool --input left=./old --input right=./new",
        description: "Named inputs for multi-input tools",
      },
      {
        command: "enact run alice/resizer --dry-run",
        description: "Preview what would be executed",
      },
    ],
  },
  {
    id: "init",
    name: "init",
    description:
      "Initialize Enact in the current directory. Create tool templates or documentation files for AI agents.",
    icon: <FileText className="w-5 h-5" />,
    colorClass: "bg-brand-pink text-gray-900",
    dotColor: "bg-brand-pink",
    usage: "enact init [options]",
    category: "core",
    options: [
      { flag: "-n, --name <name>", description: "Tool name (default: username/my-tool)" },
      { flag: "-f, --force", description: "Overwrite existing files" },
      { flag: "--tool", description: "Create a new Enact tool (default)" },
      { flag: "--agent", description: "Create AGENTS.md for projects that use Enact tools" },
      { flag: "--claude", description: "Create CLAUDE.md with Claude-specific instructions" },
    ],
    examples: [
      {
        command: "enact init",
        description: "Create a new tool template with SKILL.md and AGENTS.md",
      },
      {
        command: "enact init --name myorg/utils/helper",
        description: "Create tool with custom name",
      },
      { command: "enact init --agent", description: "Create AGENTS.md for an existing project" },
      { command: "enact init --claude", description: "Create CLAUDE.md for Claude integration" },
    ],
  },
  {
    id: "install",
    name: "install",
    description:
      "Install a tool to the project or globally. Supports local paths and registry tools with verification.",
    icon: <Download className="w-5 h-5" />,
    colorClass: "bg-brand-blue text-white",
    dotColor: "bg-brand-blue",
    usage: "enact install [tool] [options]",
    category: "core",
    options: [
      { flag: "-g, --global", description: "Install globally (adds to ~/.enact/tools.json)" },
      { flag: "-f, --force", description: "Overwrite existing installation" },
      { flag: "--allow-yanked", description: "Allow installing yanked versions" },
      { flag: "-v, --verbose", description: "Show detailed output" },
      { flag: "--json", description: "Output result as JSON" },
    ],
    examples: [
      { command: "enact install alice/resizer", description: "Install to project" },
      { command: "enact install alice/resizer -g", description: "Install globally" },
      { command: "enact install alice/resizer@1.2.0", description: "Install specific version" },
      { command: "enact install ./my-tool", description: "Install from local path" },
      { command: "enact install", description: "Install all tools from .enact/tools.json" },
    ],
  },
  {
    id: "list",
    name: "list",
    description: "List installed tools from project or global tools.json registries.",
    icon: <List className="w-5 h-5" />,
    colorClass: "bg-blueLight-4 text-white",
    dotColor: "bg-blueLight-4",
    usage: "enact list [options]",
    category: "core",
    options: [
      { flag: "-g, --global", description: "List global tools (via ~/.enact/tools.json)" },
      { flag: "-v, --verbose", description: "Show detailed output including paths" },
      { flag: "--json", description: "Output as JSON" },
    ],
    examples: [
      { command: "enact list", description: "List project tools" },
      { command: "enact list -g", description: "List globally installed tools" },
      { command: "enact list --json | jq '.[].name'", description: "Get tool names as JSON" },
    ],
  },
  {
    id: "exec",
    name: "exec",
    description:
      "Execute an arbitrary command in a tool's container environment. Unlike run, allows any command.",
    icon: <Terminal className="w-5 h-5" />,
    colorClass: "bg-gray-600 text-white",
    dotColor: "bg-gray-600",
    usage: "enact exec <tool> <command> [options]",
    category: "core",
    options: [
      { flag: "-t, --timeout <duration>", description: "Execution timeout (e.g., 30s, 5m)" },
      { flag: "-v, --verbose", description: "Show detailed output" },
      { flag: "--json", description: "Output result as JSON" },
    ],
    examples: [
      {
        command: 'enact exec alice/resizer "ls -la /workspace"',
        description: "List files in container",
      },
      { command: 'enact exec ./my-tool "python --version"', description: "Check Python version" },
      { command: 'enact exec alice/resizer "pip list"', description: "List installed packages" },
    ],
  },

  // Registry Commands
  {
    id: "search",
    name: "search",
    description:
      "Search the Enact registry for tools. Supports semantic search and filtering by tags.",
    icon: <Search className="w-5 h-5" />,
    colorClass: "bg-brand-pink text-gray-900",
    dotColor: "bg-brand-pink",
    usage: "enact search <query> [options]",
    category: "registry",
    options: [
      { flag: "--local", description: "Search project tools instead of registry" },
      { flag: "-g, --global", description: "Search global tools instead of registry" },
      { flag: "-t, --tags <tags>", description: "Filter by tags (comma-separated)" },
      { flag: "-l, --limit <number>", description: "Maximum results (default: 20)" },
      { flag: "-o, --offset <number>", description: "Pagination offset" },
      {
        flag: "--threshold <number>",
        description: "Similarity threshold for semantic search (0.0-1.0)",
      },
      { flag: "--json", description: "Output as JSON" },
    ],
    examples: [
      { command: 'enact search "image processing"', description: "Search for image tools" },
      { command: "enact search pdf --tags utilities", description: "Search with tag filter" },
      { command: "enact search resize -g", description: "Search installed global tools" },
      { command: "enact search api --limit 50", description: "Get more results" },
    ],
  },
  {
    id: "info",
    name: "info",
    description:
      "Show detailed information about a tool including metadata, versions, signatures, and visibility.",
    icon: <Package className="w-5 h-5" />,
    colorClass: "bg-brand-teal text-gray-900",
    dotColor: "bg-brand-teal",
    usage: "enact info <tool> [options]",
    category: "registry",
    options: [
      { flag: "--ver <version>", description: "Show info for a specific version" },
      { flag: "-v, --verbose", description: "Show detailed output including full manifest" },
      { flag: "--json", description: "Output as JSON" },
    ],
    examples: [
      { command: "enact info alice/resizer", description: "Show tool info and metadata" },
      {
        command: "enact info alice/resizer --ver 1.2.0",
        description: "Show specific version info",
      },
      {
        command: "enact info alice/resizer --verbose",
        description: "Show full manifest and signatures",
      },
      {
        command: "enact info alice/resizer --json | jq '.visibility'",
        description: "Check tool visibility",
      },
    ],
  },
  {
    id: "publish",
    name: "publish",
    description:
      "Publish a tool to the Enact registry. Creates a bundle and uploads with verification. Tools are private by default.",
    icon: <Upload className="w-5 h-5" />,
    colorClass: "bg-brand-green text-gray-900",
    dotColor: "bg-brand-green",
    usage: "enact publish [path] [options]",
    category: "registry",
    options: [
      { flag: "--public", description: "Publish as public (visible to everyone, searchable)" },
      { flag: "--unlisted", description: "Publish as unlisted (accessible via direct link only)" },
      { flag: "-n, --dry-run", description: "Show what would be published without publishing" },
      { flag: "-t, --tag <tag>", description: "Add a release tag (e.g., latest, beta)" },
      { flag: "-v, --verbose", description: "Show detailed output" },
      { flag: "--skip-auth", description: "Skip authentication (for local development)" },
      { flag: "--json", description: "Output as JSON" },
    ],
    examples: [
      { command: "enact publish", description: "Publish as private (default)" },
      { command: "enact publish --public", description: "Publish as public (searchable)" },
      {
        command: "enact publish --unlisted",
        description: "Publish as unlisted (direct link only)",
      },
      { command: "enact publish ./my-tool", description: "Publish from specific path" },
      { command: "enact publish --dry-run", description: "Preview what would be published" },
    ],
  },
  {
    id: "learn",
    name: "learn",
    description: "Display tool documentation (SKILL.md file) from the registry.",
    icon: <Book className="w-5 h-5" />,
    colorClass: "bg-blueLight-1 text-brand-blue",
    dotColor: "bg-blueLight-4",
    usage: "enact learn <tool> [options]",
    category: "registry",
    options: [
      { flag: "--ver <version>", description: "Show docs for a specific version" },
      { flag: "--json", description: "Output as JSON" },
    ],
    examples: [
      { command: "enact learn alice/resizer", description: "Read tool documentation" },
      {
        command: "enact learn alice/resizer --ver 1.0.0",
        description: "Read specific version docs",
      },
    ],
  },
  {
    id: "cache",
    name: "cache",
    description: "Manage the local tool cache. List cached tools or clear the cache.",
    icon: <Trash2 className="w-5 h-5" />,
    colorClass: "bg-brand-red text-white",
    dotColor: "bg-brand-red",
    usage: "enact cache <command> [options]",
    category: "registry",
    options: [{ flag: "--json", description: "Output as JSON" }],
    examples: [
      { command: "enact cache list", description: "List all cached tools" },
      { command: "enact cache clear", description: "Clear the entire cache" },
      { command: "enact cache clear alice/resizer", description: "Clear specific tool from cache" },
    ],
  },
  {
    id: "visibility",
    name: "visibility",
    description:
      "Change the visibility of a published tool. Tools can be private (default), unlisted, or public.",
    icon: <Eye className="w-5 h-5" />,
    colorClass: "bg-brand-pink text-gray-900",
    dotColor: "bg-brand-pink",
    usage: "enact visibility <tool> <level> [options]",
    category: "registry",
    options: [{ flag: "--json", description: "Output as JSON" }],
    examples: [
      {
        command: "enact visibility alice/resizer public",
        description: "Make tool public (searchable)",
      },
      {
        command: "enact visibility alice/resizer private",
        description: "Make tool private (only you)",
      },
      {
        command: "enact visibility alice/resizer unlisted",
        description: "Make tool unlisted (direct link only)",
      },
    ],
  },
  {
    id: "yank",
    name: "yank",
    description: "Yank a published tool version from the registry. Yanked versions show warnings.",
    icon: <AlertTriangle className="w-5 h-5" />,
    colorClass: "bg-brand-yellow text-gray-900",
    dotColor: "bg-brand-yellow",
    usage: "enact yank <tool>@<version> [options]",
    category: "registry",
    options: [
      { flag: "-r, --reason <reason>", description: "Reason for yanking" },
      { flag: "--replacement <version>", description: "Recommended replacement version" },
      { flag: "--json", description: "Output as JSON" },
    ],
    examples: [
      {
        command: "enact yank alice/resizer@1.0.0 -r 'Security vulnerability'",
        description: "Yank with reason",
      },
      {
        command: "enact yank alice/resizer@1.0.0 --replacement 1.0.1",
        description: "Yank with replacement",
      },
    ],
  },
  {
    id: "unyank",
    name: "unyank",
    description: "Restore a previously yanked tool version.",
    icon: <RotateCcw className="w-5 h-5" />,
    colorClass: "bg-teal-400 text-gray-900",
    dotColor: "bg-teal-400",
    usage: "enact unyank <tool>@<version> [options]",
    category: "registry",
    options: [{ flag: "--json", description: "Output as JSON" }],
    examples: [
      { command: "enact unyank alice/resizer@1.0.0", description: "Restore yanked version" },
    ],
  },

  // Trust & Signing Commands
  {
    id: "sign",
    name: "sign",
    description:
      "Cryptographically sign a tool using Sigstore keyless signing. Creates an attestation and logs to Rekor.",
    icon: <Shield className="w-5 h-5" />,
    colorClass: "bg-brand-teal text-gray-900",
    dotColor: "bg-brand-teal",
    usage: "enact sign <path> [options]",
    category: "trust",
    options: [
      { flag: "-i, --identity <email>", description: "Sign with specific identity (uses OAuth)" },
      { flag: "-o, --output <path>", description: "Output path for signature bundle" },
      { flag: "--dry-run", description: "Show what would be signed without signing" },
      { flag: "--local", description: "Save signature locally only, do not submit to registry" },
      { flag: "-v, --verbose", description: "Show detailed output" },
      { flag: "--json", description: "Output result as JSON" },
    ],
    examples: [
      { command: "enact sign ./my-tool", description: "Sign local tool (not recommended)" },
      {
        command: "enact sign alice/resizer@1.0.0",
        description: "Sign published tool (recommended)",
      },
      { command: "enact sign alice/resizer@1.0.0 --dry-run", description: "Preview signing" },
    ],
  },
  {
    id: "trust",
    name: "trust",
    description:
      "Manage trusted identities for attestation verification. Control who you trust to vouch for tools.",
    icon: <Lock className="w-5 h-5" />,
    colorClass: "bg-brand-blue text-white",
    dotColor: "bg-brand-blue",
    usage: "enact trust [identity] [options]",
    category: "trust",
    options: [
      { flag: "-r, --remove", description: "Remove from trusted list instead of adding" },
      { flag: "-s, --sync", description: "Sync with registry (requires authentication)" },
      { flag: "--json", description: "Output as JSON" },
    ],
    examples: [
      { command: "enact trust github:alice", description: "Trust a GitHub user" },
      { command: "enact trust google:user@example.com", description: "Trust a Google account" },
      { command: "enact trust github:alice --remove", description: "Remove from trusted list" },
      { command: "enact trust", description: "List all trusted identities" },
      { command: "enact trust list --sync", description: "Show local and registry trust config" },
      {
        command: "enact trust check alice/resizer@1.0.0",
        description: "Check trust status of a tool",
      },
    ],
  },
  {
    id: "inspect",
    name: "inspect",
    description: "Open tool page in browser or download for local review.",
    icon: <Eye className="w-5 h-5" />,
    colorClass: "bg-blueLight-4 text-white",
    dotColor: "bg-blueLight-4",
    usage: "enact inspect <tool> [options]",
    category: "trust",
    options: [
      { flag: "--download", description: "Download tool for local inspection" },
      { flag: "-o, --output <path>", description: "Output directory for download" },
      { flag: "--json", description: "Output as JSON" },
    ],
    examples: [
      { command: "enact inspect alice/resizer", description: "Open in browser" },
      { command: "enact inspect alice/resizer --download", description: "Download for review" },
    ],
  },
  {
    id: "report",
    name: "report",
    description:
      "Report a security vulnerability. Creates a signed attestation with the vulnerability details.",
    icon: <AlertTriangle className="w-5 h-5" />,
    colorClass: "bg-brand-red text-white",
    dotColor: "bg-brand-red",
    usage: "enact report <tool>@<version> [options]",
    category: "trust",
    options: [
      {
        flag: "-s, --severity <level>",
        description: "Severity level (low, medium, high, critical)",
      },
      { flag: "-m, --message <text>", description: "Vulnerability description" },
      { flag: "--json", description: "Output as JSON" },
    ],
    examples: [
      {
        command: "enact report alice/resizer@1.0.0 -s high -m 'SQL injection in query handler'",
        description: "Report vulnerability",
      },
    ],
  },

  // Configuration Commands
  {
    id: "auth",
    name: "auth",
    description:
      "Manage authentication for the Enact registry. OAuth with GitHub, Google, or Microsoft.",
    icon: <User className="w-5 h-5" />,
    colorClass: "bg-brand-pink text-gray-900",
    dotColor: "bg-brand-pink",
    usage: "enact auth <command> [options]",
    category: "config",
    options: [
      {
        flag: "-p, --provider <provider>",
        description: "OAuth provider (github, google, microsoft)",
      },
      { flag: "--web", description: "Use web-based authentication (default)" },
      { flag: "--no-web", description: "Use direct API-based OAuth (legacy)" },
      { flag: "--json", description: "Output as JSON" },
    ],
    examples: [
      { command: "enact auth login", description: "Authenticate via browser" },
      { command: "enact auth logout", description: "Sign out" },
      { command: "enact auth status", description: "Check authentication status" },
      { command: "enact auth whoami", description: "Print current username" },
    ],
  },
  {
    id: "env",
    name: "env",
    description: "Manage environment variables and secrets for tools.",
    icon: <Key className="w-5 h-5" />,
    colorClass: "bg-brand-yellow text-gray-900",
    dotColor: "bg-brand-yellow",
    usage: "enact env <command> [options]",
    category: "config",
    options: [
      { flag: "-s, --secret", description: "Store as secret in OS keyring" },
      { flag: "-n, --namespace <namespace>", description: "Namespace for secret" },
      { flag: "-l, --local", description: "Use project .enact/.env instead of global" },
      { flag: "-g, --global", description: "Use global ~/.enact/.env" },
      { flag: "--json", description: "Output as JSON" },
    ],
    examples: [
      {
        command: "enact env set API_KEY --secret --namespace alice/api",
        description: "Set a secret",
      },
      {
        command: "enact env get API_KEY --secret --namespace alice/api",
        description: "Check if secret exists",
      },
      { command: "enact env list", description: "List all environment variables" },
      {
        command: "enact env list --secret --namespace alice/api",
        description: "List secrets for namespace",
      },
      {
        command: "enact env delete API_KEY --secret --namespace alice/api",
        description: "Delete a secret",
      },
    ],
  },
  {
    id: "config",
    name: "config",
    description: "Manage CLI configuration settings.",
    icon: <Settings className="w-5 h-5" />,
    colorClass: "bg-gray-500 text-white",
    dotColor: "bg-gray-500",
    usage: "enact config <command> [key] [value]",
    category: "config",
    options: [{ flag: "--json", description: "Output as JSON" }],
    examples: [
      { command: "enact config get", description: "Show all configuration" },
      { command: "enact config get registry.url", description: "Get specific setting" },
      {
        command: "enact config set trust.policy require_attestation",
        description: "Set trust policy",
      },
    ],
  },
  {
    id: "setup",
    name: "setup",
    description: "Interactive Enact configuration setup. Guides you through initial configuration.",
    icon: <Zap className="w-5 h-5" />,
    colorClass: "bg-brand-blue text-white",
    dotColor: "bg-brand-blue",
    usage: "enact setup",
    category: "config",
    options: [],
    examples: [{ command: "enact setup", description: "Run interactive setup wizard" }],
  },
];

const categories = [
  { id: "overview", name: "Overview", icon: <Book className="w-4 h-4" /> },
  { id: "getting-started", name: "Getting Started", icon: <Zap className="w-4 h-4" /> },
  { id: "core", name: "Core Commands", icon: <Terminal className="w-4 h-4" /> },
  { id: "registry", name: "Registry", icon: <Package className="w-4 h-4" /> },
  { id: "trust", name: "Trust & Signing", icon: <Shield className="w-4 h-4" /> },
  { id: "config", name: "Configuration", icon: <Settings className="w-4 h-4" /> },
  { id: "manifest", name: "Tool Manifest", icon: <FileText className="w-4 h-4" /> },
];

function CommandDetail({ command }: { command: CommandDoc }) {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div
          className={`w-12 h-12 ${command.colorClass} rounded-xl flex items-center justify-center shadow-lg`}
        >
          {command.icon}
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-600">enact {command.name}</h1>
          <p className="text-lg text-gray-500 mt-1">{command.description}</p>
        </div>
      </div>

      {/* Usage */}
      <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
        <div className="text-xs uppercase tracking-wider text-gray-400 mb-2">Usage</div>
        <code className="text-lg text-brand-green font-mono">{command.usage}</code>
      </div>

      {/* Options */}
      {command.options.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-gray-600 mb-4 flex items-center gap-2">
            <span className="w-8 h-8 bg-pink-100 rounded-lg flex items-center justify-center">
              <Settings className="w-4 h-4 text-pink-600" />
            </span>
            Options
          </h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <tbody>
                {command.options.map((opt, idx) => (
                  <tr key={opt.flag} className={idx % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                    <td className="px-4 py-3 font-mono text-sm text-brand-blue whitespace-nowrap">
                      {opt.flag}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{opt.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Examples */}
      <div>
        <h2 className="text-xl font-semibold text-gray-600 mb-4 flex items-center gap-2">
          <span className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
            <Play className="w-4 h-4 text-green-600" />
          </span>
          Examples
        </h2>
        <div className="space-y-3">
          {command.examples.map((ex) => (
            <div key={ex.command} className="bg-gray-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-700">
                <code className="text-brand-green font-mono text-sm">$ {ex.command}</code>
              </div>
              <div className="px-4 py-2 bg-gray-700">
                <p className="text-gray-300 text-sm">{ex.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Overview({ onNavigate }: { onNavigate: (section: string) => void }) {
  return (
    <div className="space-y-10">
      {/* Hero */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-blue rounded-2xl mb-6">
          <Terminal className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-4xl font-bold text-gray-600 mb-4">Enact Documentation</h1>
        <p className="text-xl text-gray-500 max-w-2xl mx-auto">
          The package manager for AI tools. Discover, run, and publish containerized tools with
          cryptographic verification.
        </p>
      </div>

      {/* What is Enact */}
      <div className="bg-white rounded-2xl border border-gray-200 p-8">
        <h2 className="text-2xl font-bold text-gray-600 mb-4">What is Enact?</h2>
        <p className="text-gray-500 mb-6">
          Enact is a tool registry and execution platform designed for AI agents and developers.
          Think of it as <strong>npm for AI tools</strong> - a way to package, share, and safely
          execute tools that AI agents can use to accomplish tasks.
        </p>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-brand-green rounded-xl flex items-center justify-center mx-auto mb-3">
              <Search className="w-6 h-6 text-gray-900" />
            </div>
            <h3 className="font-semibold text-gray-600 mb-1">Discover</h3>
            <p className="text-sm text-gray-500">
              Search and find tools from the registry using semantic search
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-brand-blue rounded-xl flex items-center justify-center mx-auto mb-3">
              <Play className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-semibold text-gray-600 mb-1">Execute</h3>
            <p className="text-sm text-gray-500">
              Run tools in isolated containers with consistent behavior
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-brand-teal rounded-xl flex items-center justify-center mx-auto mb-3">
              <Shield className="w-6 h-6 text-gray-900" />
            </div>
            <h3 className="font-semibold text-gray-600 mb-1">Verify</h3>
            <p className="text-sm text-gray-500">
              Cryptographically verify tool publishers and auditors
            </p>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div>
        <h2 className="text-2xl font-bold text-gray-600 mb-6">Explore the Docs</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => onNavigate("getting-started")}
            className="flex items-start gap-4 p-5 bg-brand-green/10 border border-brand-green/30 rounded-xl text-left hover:bg-brand-green/20 transition-colors"
          >
            <div className="w-10 h-10 bg-brand-green rounded-lg flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5 text-gray-900" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-600">Getting Started</h3>
              <p className="text-sm text-gray-500 mt-1">
                Install the CLI and run your first tool in minutes
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400 ml-auto self-center" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate("core")}
            className="flex items-start gap-4 p-5 bg-brand-blue/10 border border-brand-blue/30 rounded-xl text-left hover:bg-brand-blue/20 transition-colors"
          >
            <div className="w-10 h-10 bg-brand-blue rounded-lg flex items-center justify-center flex-shrink-0">
              <Terminal className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-600">Core Commands</h3>
              <p className="text-sm text-gray-500 mt-1">Run, install, list, and manage tools</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400 ml-auto self-center" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate("registry")}
            className="flex items-start gap-4 p-5 bg-brand-pink/20 border border-brand-pink/40 rounded-xl text-left hover:bg-brand-pink/30 transition-colors"
          >
            <div className="w-10 h-10 bg-brand-pink rounded-lg flex items-center justify-center flex-shrink-0">
              <Package className="w-5 h-5 text-gray-900" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-600">Registry</h3>
              <p className="text-sm text-gray-500 mt-1">
                Search, publish, and manage tools in the registry
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400 ml-auto self-center" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate("trust")}
            className="flex items-start gap-4 p-5 bg-brand-teal/20 border border-brand-teal/40 rounded-xl text-left hover:bg-brand-teal/30 transition-colors"
          >
            <div className="w-10 h-10 bg-brand-teal rounded-lg flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5 text-gray-900" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-600">Trust & Signing</h3>
              <p className="text-sm text-gray-500 mt-1">
                Cryptographic verification and attestations
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400 ml-auto self-center" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate("manifest")}
            className="flex items-start gap-4 p-5 bg-brand-yellow/20 border border-brand-yellow/40 rounded-xl text-left hover:bg-brand-yellow/30 transition-colors"
          >
            <div className="w-10 h-10 bg-brand-yellow rounded-lg flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-gray-900" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-600">Tool Manifest</h3>
              <p className="text-sm text-gray-500 mt-1">Learn how to write SKILL.md files</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400 ml-auto self-center" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate("config")}
            className="flex items-start gap-4 p-5 bg-gray-100 border border-gray-200 rounded-xl text-left hover:bg-gray-200 transition-colors"
          >
            <div className="w-10 h-10 bg-gray-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-600">Configuration</h3>
              <p className="text-sm text-gray-500 mt-1">
                Authentication, environment, and settings
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400 ml-auto self-center" />
          </button>
        </div>
      </div>

      {/* Architecture Overview */}
      <div className="bg-gray-800 rounded-2xl p-8 text-white">
        <h2 className="text-2xl font-bold mb-6">How It Works</h2>
        <div className="grid md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-brand-pink rounded-xl flex items-center justify-center mx-auto mb-3">
              <FileText className="w-6 h-6 text-gray-900" />
            </div>
            <div className="text-sm font-semibold mb-1">1. Define</div>
            <p className="text-xs text-gray-400">Write a SKILL.md manifest with YAML + Markdown</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-brand-green rounded-xl flex items-center justify-center mx-auto mb-3">
              <Upload className="w-6 h-6 text-gray-900" />
            </div>
            <div className="text-sm font-semibold mb-1">2. Publish</div>
            <p className="text-xs text-gray-400">Upload to the registry with enact publish</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-brand-teal rounded-xl flex items-center justify-center mx-auto mb-3">
              <Shield className="w-6 h-6 text-gray-900" />
            </div>
            <div className="text-sm font-semibold mb-1">3. Sign</div>
            <p className="text-xs text-gray-400">Optionally sign with Sigstore for verification</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-brand-blue rounded-xl flex items-center justify-center mx-auto mb-3">
              <Play className="w-6 h-6 text-white" />
            </div>
            <div className="text-sm font-semibold mb-1">4. Run</div>
            <p className="text-xs text-gray-400">Execute in isolated containers via Dagger</p>
          </div>
        </div>
      </div>

      {/* Use Cases */}
      <div>
        <h2 className="text-2xl font-bold text-gray-600 mb-6">Use Cases</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="text-2xl mb-3">🤖</div>
            <h3 className="font-semibold text-gray-600 mb-2">AI Agent Tools</h3>
            <p className="text-sm text-gray-500">
              Give AI agents access to verified, sandboxed tools they can discover and execute
              dynamically via MCP.
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="text-2xl mb-3">🔧</div>
            <h3 className="font-semibold text-gray-600 mb-2">Developer Utilities</h3>
            <p className="text-sm text-gray-500">
              Package and share CLI utilities, data transformations, or automation scripts with
              consistent behavior.
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="text-2xl mb-3">🏢</div>
            <h3 className="font-semibold text-gray-600 mb-2">Enterprise Tooling</h3>
            <p className="text-sm text-gray-500">
              Distribute internal tools with cryptographic verification and trust policies across
              teams.
            </p>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-gradient-to-r from-brand-blue to-blueLight-4 rounded-2xl p-8 text-white text-center">
        <h2 className="text-2xl font-bold mb-3">Ready to get started?</h2>
        <p className="text-blue-100 mb-6">
          Install the CLI and run your first tool in under a minute.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <button
            type="button"
            onClick={() => onNavigate("getting-started")}
            className="px-6 py-3 bg-white text-brand-blue font-semibold rounded-lg hover:bg-gray-100 transition-colors"
          >
            Get Started
          </button>
          <Link
            to="/browse"
            className="px-6 py-3 bg-white/20 text-white font-semibold rounded-lg hover:bg-white/30 transition-colors"
          >
            Browse Tools
          </Link>
        </div>
      </div>
    </div>
  );
}

function GettingStarted() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-600 mb-2">Getting Started</h1>
        <p className="text-lg text-gray-500">
          Enact is the npm for AI tools. Install, discover, and safely run containerized tools with
          cryptographic verification.
        </p>
      </div>

      {/* Installation */}
      <div className="bg-brand-blue rounded-2xl p-8 text-white shadow-xl">
        <h2 className="text-2xl font-bold mb-4">Installation</h2>
        <div className="bg-black/30 rounded-xl p-4 font-mono">
          <span className="text-gray-400">$</span> npm install -g enact-cli
        </div>
        <p className="mt-4 text-blue-100">
          Or use bun, yarn, or pnpm. Requires Node.js 18+ and Docker.
        </p>
      </div>

      {/* Quick Start Steps */}
      <div className="grid gap-6">
        <div className="flex gap-4 items-start">
          <div className="w-10 h-10 bg-brand-green rounded-xl flex items-center justify-center text-gray-900 font-bold shadow-lg flex-shrink-0">
            1
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-600 text-lg">Search for tools</h3>
            <p className="text-gray-500 mb-3">Find tools by keyword or description</p>
            <div className="bg-gray-800 rounded-lg p-3">
              <code className="text-brand-green font-mono text-sm">
                $ enact search "resize images"
              </code>
            </div>
          </div>
        </div>

        <div className="flex gap-4 items-start">
          <div className="w-10 h-10 bg-brand-blue rounded-xl flex items-center justify-center text-white font-bold shadow-lg flex-shrink-0">
            2
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-600 text-lg">Run a tool</h3>
            <p className="text-gray-500 mb-3">Execute any tool instantly - Enact handles caching</p>
            <div className="bg-gray-800 rounded-lg p-3">
              <code className="text-brand-green font-mono text-sm">
                $ enact run alice/resizer --args '&#123;"width": 800&#125;'
              </code>
            </div>
          </div>
        </div>

        <div className="flex gap-4 items-start">
          <div className="w-10 h-10 bg-brand-pink rounded-xl flex items-center justify-center text-gray-900 font-bold shadow-lg flex-shrink-0">
            3
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-600 text-lg">Install for your project</h3>
            <p className="text-gray-500 mb-3">Add tools to your project's .enact/tools.json</p>
            <div className="bg-gray-800 rounded-lg p-3">
              <code className="text-brand-green font-mono text-sm">
                $ enact install alice/resizer
              </code>
            </div>
          </div>
        </div>

        <div className="flex gap-4 items-start">
          <div className="w-10 h-10 bg-brand-teal rounded-xl flex items-center justify-center text-gray-900 font-bold shadow-lg flex-shrink-0">
            4
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-600 text-lg">Create your own tool</h3>
            <p className="text-gray-500 mb-3">Initialize a new tool with templates</p>
            <div className="bg-gray-800 rounded-lg p-3">
              <code className="text-brand-green font-mono text-sm">
                $ enact init --name myorg/my-tool
              </code>
            </div>
          </div>
        </div>
      </div>

      {/* Key Concepts */}
      <div>
        <h2 className="text-xl font-semibold text-gray-600 mb-4">Key Concepts</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-teal-100 border border-teal-200 rounded-xl p-5">
            <div className="w-10 h-10 bg-brand-teal rounded-lg flex items-center justify-center text-gray-900 mb-3">
              <Shield className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-gray-600 mb-1">Cryptographic Verification</h3>
            <p className="text-sm text-gray-500">
              Tools are signed using Sigstore keyless signing. Verify who published and audited
              tools before running them.
            </p>
          </div>
          <div className="bg-pink-100 border border-pink-200 rounded-xl p-5">
            <div className="w-10 h-10 bg-brand-pink rounded-lg flex items-center justify-center text-gray-900 mb-3">
              <Package className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-gray-600 mb-1">Containerized Execution</h3>
            <p className="text-sm text-gray-500">
              Every tool runs in an isolated container via Dagger. Consistent execution across any
              environment.
            </p>
          </div>
          <div className="bg-yellow-100 border border-yellow-200 rounded-xl p-5">
            <div className="w-10 h-10 bg-brand-yellow rounded-lg flex items-center justify-center text-gray-900 mb-3">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-gray-600 mb-1">Structured Manifests</h3>
            <p className="text-sm text-gray-500">
              Tools are defined by SKILL.md files with YAML frontmatter. JSON Schema for inputs and
              outputs.
            </p>
          </div>
          <div className="bg-primary-100 border border-primary-200 rounded-xl p-5">
            <div className="w-10 h-10 bg-brand-blue rounded-lg flex items-center justify-center text-white mb-3">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-gray-600 mb-1">AI-Ready</h3>
            <p className="text-sm text-gray-500">
              Built for AI agents with MCP integration. Agents can discover, install, and run tools
              dynamically.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ManifestReference() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-600 mb-2">Tool Manifest Reference</h1>
        <p className="text-lg text-gray-500">
          Enact tools are defined by an{" "}
          <code className="bg-pink-100 text-pink-600 px-2 py-0.5 rounded">SKILL.md</code> file with
          YAML frontmatter and Markdown documentation.
        </p>
      </div>

      {/* Full Example */}
      <div className="bg-gray-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="bg-gray-700 px-4 py-2 border-b border-gray-600 flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-brand-red" />
          <div className="w-3 h-3 rounded-full bg-brand-yellow" />
          <div className="w-3 h-3 rounded-full bg-brand-green" />
          <span className="text-gray-400 text-sm ml-2 font-mono">SKILL.md</span>
        </div>
        <pre className="p-6 text-sm overflow-x-auto">
          <code className="text-gray-100">
            {`---
`}
            <span className="text-brand-pink">name</span>
            {`: owner/category/tool
`}
            <span className="text-brand-pink">description</span>
            {`: What the tool does
`}
            <span className="text-brand-pink">version</span>
            {`: 1.0.0
`}
            <span className="text-brand-pink">enact</span>
            {`: "2.0"

`}
            <span className="text-brand-teal">from</span>
            {`: python:3.12-slim
`}
            <span className="text-brand-teal">build</span>
            {`: pip install requests pandas
`}
            <span className="text-brand-teal">command</span>
            {`: python /workspace/main.py \${input}
`}
            <span className="text-brand-teal">timeout</span>
            {`: 30s

`}
            <span className="text-brand-yellow">inputSchema</span>
            {`:
  type: object
  properties:
    input:
      type: string
      description: "Input to process"
  required: [input]

`}
            <span className="text-brand-yellow">outputSchema</span>
            {`:
  type: object
  properties:
    result:
      type: string

`}
            <span className="text-brand-green">env</span>
            {`:
  API_KEY:
    description: "External API key"
    secret: true
---
# Tool Name

Documentation here. This markdown content is shown
when users run \`enact learn owner/category/tool\`.

## Usage

\`\`\`bash
enact run owner/category/tool --args '{"input": "hello"}'
\`\`\``}
          </code>
        </pre>
      </div>

      {/* Field Reference */}
      <div className="grid gap-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-600 mb-4 flex items-center gap-2">
            <span className="w-8 h-8 bg-pink-100 rounded-lg flex items-center justify-center">
              <span className="text-pink-600 font-bold text-sm">*</span>
            </span>
            Required Fields
          </h2>
          <div className="bg-pink-100 border border-pink-200 rounded-xl overflow-hidden">
            <table className="w-full">
              <tbody>
                <tr className="border-b border-pink-200">
                  <td className="px-4 py-3 font-mono text-sm text-pink-600">name</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    Hierarchical ID (e.g.,{" "}
                    <code className="bg-pink-200 px-1 rounded">org/category/tool</code>)
                  </td>
                </tr>
                <tr className="border-b border-pink-200">
                  <td className="px-4 py-3 font-mono text-sm text-pink-600">description</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    What the tool does (used in search)
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-sm text-pink-600">version</td>
                  <td className="px-4 py-3 text-sm text-gray-600">Semver version (e.g., 1.0.0)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-600 mb-4 flex items-center gap-2">
            <span className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center">
              <Terminal className="w-4 h-4 text-teal-600" />
            </span>
            Execution Fields
          </h2>
          <div className="bg-teal-100 border border-teal-200 rounded-xl overflow-hidden">
            <table className="w-full">
              <tbody>
                <tr className="border-b border-teal-200">
                  <td className="px-4 py-3 font-mono text-sm text-teal-600">from</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    Docker image (pin versions, not :latest)
                  </td>
                </tr>
                <tr className="border-b border-teal-200">
                  <td className="px-4 py-3 font-mono text-sm text-teal-600">build</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    Build commands (string or array, cached by Dagger)
                  </td>
                </tr>
                <tr className="border-b border-teal-200">
                  <td className="px-4 py-3 font-mono text-sm text-teal-600">command</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    Shell command with{" "}
                    <code className="bg-teal-200 px-1 rounded">$&#123;param&#125;</code>{" "}
                    substitution
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-sm text-teal-600">timeout</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    Max execution time (e.g., 30s, 5m, 1h)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-600 mb-4 flex items-center gap-2">
            <span className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
              <FileText className="w-4 h-4 text-yellow-600" />
            </span>
            Schema Fields
          </h2>
          <div className="bg-yellow-100 border border-yellow-200 rounded-xl overflow-hidden">
            <table className="w-full">
              <tbody>
                <tr className="border-b border-yellow-200">
                  <td className="px-4 py-3 font-mono text-sm text-yellow-600">inputSchema</td>
                  <td className="px-4 py-3 text-sm text-gray-600">JSON Schema for tool inputs</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-sm text-yellow-600">outputSchema</td>
                  <td className="px-4 py-3 text-sm text-gray-600">JSON Schema for tool outputs</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Container Layout */}
        <div>
          <h2 className="text-xl font-semibold text-gray-600 mb-4 flex items-center gap-2">
            <span className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Package className="w-4 h-4 text-blue-600" />
            </span>
            Container Layout
          </h2>
          <p className="text-gray-500 mb-4">
            Tools run in containers with a standard directory layout. Use{" "}
            <code className="bg-gray-200 px-1 rounded">--input</code> and{" "}
            <code className="bg-gray-200 px-1 rounded">--output</code> to mount files and export
            results.
          </p>
          <div className="bg-blue-100 border border-blue-200 rounded-xl overflow-hidden">
            <table className="w-full">
              <tbody>
                <tr className="border-b border-blue-200">
                  <td className="px-4 py-3 font-mono text-sm text-blue-600">/workspace</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    Tool source code (your SKILL.md, scripts, etc.)
                  </td>
                </tr>
                <tr className="border-b border-blue-200">
                  <td className="px-4 py-3 font-mono text-sm text-blue-600">/input</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    User data from <code className="bg-blue-200 px-1 rounded">--input ./path</code>
                  </td>
                </tr>
                <tr className="border-b border-blue-200">
                  <td className="px-4 py-3 font-mono text-sm text-blue-600">
                    /inputs/&lt;name&gt;
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    Named inputs from{" "}
                    <code className="bg-blue-200 px-1 rounded">--input name=./path</code>
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-sm text-blue-600">/output</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    Results exported via{" "}
                    <code className="bg-blue-200 px-1 rounded">--output ./path</code>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <h4 className="font-semibold text-gray-600 mb-2">In-Place Transformations</h4>
            <p className="text-sm text-gray-500 mb-3">
              Use <code className="bg-blue-100 px-1 rounded">--apply</code> for tools that transform
              files in-place (formatters, linters, etc.):
            </p>
            <div className="bg-gray-800 rounded-lg p-3">
              <code className="text-brand-green font-mono text-sm">
                $ enact run ./formatter --input ./src --output ./src --apply
              </code>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Changes are applied atomically - if execution fails, the original directory is
              preserved.
            </p>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-600 mb-4 flex items-center gap-2">
            <span className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <Key className="w-4 h-4 text-green-600" />
            </span>
            Environment & Secrets
          </h2>
          <div className="bg-green-100 border border-green-200 rounded-xl overflow-hidden">
            <table className="w-full">
              <tbody>
                <tr className="border-b border-green-200">
                  <td className="px-4 py-3 font-mono text-sm text-green-600">env</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    Environment variables and secrets declaration
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-sm text-green-600">env.*.secret</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    Set to <code className="bg-green-200 px-1 rounded">true</code> for secrets
                    stored in OS keyring
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Tool Visibility */}
      <div>
        <h2 className="text-xl font-semibold text-gray-600 mb-4 flex items-center gap-2">
          <span className="w-8 h-8 bg-pink-100 rounded-lg flex items-center justify-center">
            <Eye className="w-4 h-4 text-pink-600" />
          </span>
          Tool Visibility
        </h2>
        <p className="text-gray-500 mb-4">
          Control who can access your tools. <strong>Tools are private by default</strong> for
          security.
        </p>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-gray-100 border-2 border-gray-300 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Lock className="w-5 h-5 text-gray-600" />
              <code className="text-gray-700 font-semibold">private</code>
              <span className="text-xs bg-gray-200 px-2 py-0.5 rounded-full text-gray-600">
                default
              </span>
            </div>
            <p className="text-sm text-gray-500">
              Only you can see and install. Not visible in search or browse.
            </p>
            <div className="mt-3 bg-gray-800 rounded-lg p-2">
              <code className="text-brand-green font-mono text-xs">$ enact publish</code>
            </div>
          </div>
          <div className="bg-yellow-100 border border-yellow-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Eye className="w-5 h-5 text-yellow-600" />
              <code className="text-yellow-700 font-semibold">unlisted</code>
            </div>
            <p className="text-sm text-gray-500">
              Anyone with the link can access. Not visible in search or browse.
            </p>
            <div className="mt-3 bg-gray-800 rounded-lg p-2">
              <code className="text-brand-green font-mono text-xs">$ enact publish --unlisted</code>
            </div>
          </div>
          <div className="bg-green-100 border border-green-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Search className="w-5 h-5 text-green-600" />
              <code className="text-green-700 font-semibold">public</code>
            </div>
            <p className="text-sm text-gray-500">
              Visible to everyone. Appears in search and browse results.
            </p>
            <div className="mt-3 bg-gray-800 rounded-lg p-2">
              <code className="text-brand-green font-mono text-xs">$ enact publish --public</code>
            </div>
          </div>
        </div>
        <div className="mt-4 p-4 bg-primary-50 border border-primary-200 rounded-xl">
          <h4 className="font-semibold text-gray-600 mb-2">Changing Visibility</h4>
          <p className="text-sm text-gray-500 mb-3">
            You can change a tool's visibility after publishing:
          </p>
          <div className="bg-gray-800 rounded-lg p-3 space-y-2">
            <div>
              <code className="text-gray-400 font-mono text-sm"># Make a private tool public</code>
            </div>
            <div>
              <code className="text-brand-green font-mono text-sm">
                $ enact visibility alice/resizer public
              </code>
            </div>
          </div>
        </div>
      </div>

      {/* Parameter Substitution */}
      <div className="bg-primary-100 border border-primary-200 rounded-xl p-6">
        <h3 className="font-semibold text-gray-600 mb-3">Parameter Substitution</h3>
        <p className="text-sm text-gray-500 mb-4">
          Enact auto-quotes parameters. <strong>Never manually quote:</strong>
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white border border-brand-red rounded-lg p-3">
            <div className="text-brand-red font-semibold text-sm mb-1">Wrong</div>
            <code className="text-sm text-gray-700">
              command: python main.py "$&#123;input&#125;"
            </code>
          </div>
          <div className="bg-white border border-brand-green rounded-lg p-3">
            <div className="text-green-600 font-semibold text-sm mb-1">Correct</div>
            <code className="text-sm text-gray-700">
              command: python main.py $&#123;input&#125;
            </code>
          </div>
        </div>
        <p className="text-sm text-gray-500 mt-4">
          Use <code className="bg-primary-200 px-1 rounded">$&#123;param:raw&#125;</code> for raw
          output without quoting (use carefully).
        </p>
      </div>

      {/* Trust Policies */}
      <div>
        <h2 className="text-xl font-semibold text-gray-600 mb-4 flex items-center gap-2">
          <span className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center">
            <Shield className="w-4 h-4 text-teal-600" />
          </span>
          Trust Policies
        </h2>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-green-100 border border-green-200 rounded-xl p-4">
            <code className="text-green-600 font-semibold">allow</code>
            <p className="text-sm text-gray-500 mt-2">Run any tool without verification warnings</p>
          </div>
          <div className="bg-yellow-100 border border-yellow-200 rounded-xl p-4">
            <code className="text-yellow-600 font-semibold">prompt</code>
            <p className="text-sm text-gray-500 mt-2">
              Ask before running unverified tools (default)
            </p>
          </div>
          <div className="bg-pink-100 border border-pink-200 rounded-xl p-4">
            <code className="text-pink-600 font-semibold">require_attestation</code>
            <p className="text-sm text-gray-500 mt-2">Only run tools with trusted attestations</p>
          </div>
        </div>
        <div className="mt-4 bg-gray-800 rounded-lg p-3">
          <code className="text-brand-green font-mono text-sm">
            $ enact config set trust.policy prompt
          </code>
        </div>
      </div>
    </div>
  );
}

export default function Docs() {
  const [activeSection, setActiveSection] = useState("overview");
  const [activeCommand, setActiveCommand] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Handle hash navigation
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      const cmd = commands.find((c) => c.id === hash);
      if (cmd) {
        setActiveSection(cmd.category);
        setActiveCommand(hash);
      } else if (categories.find((c) => c.id === hash)) {
        setActiveSection(hash);
        setActiveCommand(null);
      }
    }
  }, []);

  const handleNavClick = (sectionId: string, commandId: string | null = null) => {
    setActiveSection(sectionId);
    setActiveCommand(commandId);
    setMobileMenuOpen(false);
    window.history.pushState(null, "", commandId ? `#${commandId}` : `#${sectionId}`);
    window.scrollTo(0, 0);
  };

  const renderContent = () => {
    if (activeSection === "overview") {
      return <Overview onNavigate={(section) => handleNavClick(section)} />;
    }
    if (activeSection === "getting-started") {
      return <GettingStarted />;
    }
    if (activeSection === "manifest") {
      return <ManifestReference />;
    }
    if (activeCommand) {
      const cmd = commands.find((c) => c.id === activeCommand);
      if (cmd) return <CommandDetail command={cmd} />;
    }
    // Show category overview
    const categoryCommands = commands.filter((c) => c.category === activeSection);
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-600">
          {categories.find((c) => c.id === activeSection)?.name}
        </h1>
        <div className="grid gap-4">
          {categoryCommands.map((cmd) => (
            <button
              key={cmd.id}
              type="button"
              onClick={() => handleNavClick(cmd.category, cmd.id)}
              className="flex items-start gap-4 p-4 bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all text-left"
            >
              <div
                className={`w-10 h-10 ${cmd.colorClass} rounded-lg flex items-center justify-center flex-shrink-0`}
              >
                {cmd.icon}
              </div>
              <div>
                <h3 className="font-semibold text-gray-600">enact {cmd.name}</h3>
                <p className="text-sm text-gray-500 mt-1">{cmd.description}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 ml-auto flex-shrink-0 self-center" />
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-20 left-4 z-50">
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 bg-white rounded-lg shadow-lg border border-gray-200"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`
          fixed lg:sticky top-16 left-0 h-[calc(100vh-4rem)] w-72 bg-white border-r border-gray-200 overflow-y-auto z-40
          transform transition-transform duration-200 ease-in-out
          ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
        >
          <div className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 bg-brand-blue rounded-lg flex items-center justify-center">
                <Book className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-gray-600">Documentation</span>
            </div>

            <nav className="space-y-1">
              {categories.map((cat) => (
                <div key={cat.id}>
                  <button
                    type="button"
                    onClick={() => handleNavClick(cat.id)}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors
                      ${
                        activeSection === cat.id && !activeCommand
                          ? "bg-primary-100 text-brand-blue"
                          : "text-gray-600 hover:bg-gray-100"
                      }
                    `}
                  >
                    <span
                      className={activeSection === cat.id ? "text-brand-blue" : "text-gray-400"}
                    >
                      {cat.icon}
                    </span>
                    <span className="font-medium text-sm">{cat.name}</span>
                  </button>

                  {/* Show commands under category if it's a command category */}
                  {["core", "registry", "trust", "config"].includes(cat.id) &&
                    activeSection === cat.id && (
                      <div className="ml-7 mt-1 space-y-1 border-l-2 border-gray-200 pl-3">
                        {commands
                          .filter((c) => c.category === cat.id)
                          .map((cmd) => (
                            <button
                              key={cmd.id}
                              type="button"
                              onClick={() => handleNavClick(cat.id, cmd.id)}
                              className={`
                            w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm transition-colors
                            ${
                              activeCommand === cmd.id
                                ? "bg-primary-100 text-brand-blue"
                                : "text-gray-500 hover:text-gray-600 hover:bg-gray-50"
                            }
                          `}
                            >
                              <span className={`w-2 h-2 rounded-full ${cmd.dotColor}`} />
                              {cmd.name}
                            </button>
                          ))}
                      </div>
                    )}
                </div>
              ))}
            </nav>

            {/* Quick Links */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <div className="text-xs uppercase tracking-wider text-gray-400 mb-3">Quick Links</div>
              <div className="space-y-2">
                <Link
                  to="/browse"
                  className="flex items-center gap-2 text-sm text-gray-500 hover:text-brand-blue transition-colors"
                >
                  <Search className="w-4 h-4" />
                  Browse Tools
                </Link>
                <a
                  href="https://github.com/EnactProtocol/enact"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-gray-500 hover:text-brand-blue transition-colors"
                >
                  <Terminal className="w-4 h-4" />
                  GitHub
                </a>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          <div className="max-w-4xl mx-auto px-6 py-12 lg:px-12">{renderContent()}</div>
        </main>
      </div>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          onKeyDown={(e) => e.key === "Escape" && setMobileMenuOpen(false)}
          role="button"
          tabIndex={0}
          aria-label="Close menu"
        />
      )}
    </div>
  );
}

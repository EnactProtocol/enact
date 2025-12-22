import SearchBar from "@/components/ui/SearchBar";
import {
  ArrowRight,
  Bot,
  ChevronRight,
  Copy,
  Download,
  File,
  Folder,
  FolderOpen,
  Globe,
  List,
  Package,
  Play,
  Search,
  Shield,
  Terminal,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="section-gradient py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <img src="/black-logo.svg" alt="Enact" className="h-24 mx-auto mb-8 animate-float" />
            <h1 className="text-5xl md:text-6xl font-bold mb-6 text-gray-6">
              The npm for <span className="text-brand-blue">AI Tools</span>
            </h1>
            <p className="text-xl text-gray-5 mb-8 max-w-2xl mx-auto">
              Browse, discover, and safely run AI-executable tools with cryptographic verification.
              Built on Sigstore for transparency and trust.
            </p>
            <div className="max-w-2xl mx-auto mb-8">
              <SearchBar placeholder="Search for tools..." />
            </div>
            <div className="flex flex-wrap justify-center gap-4">
              <Link to="/browse" className="btn-primary">
                Browse Tools
              </Link>
              <a href="#quick-start" className="btn-secondary">
                Get Started
              </a>
            </div>
          </div>
        </div>
      </section>
      {/* Made for Agents Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Bot className="w-8 h-8 text-purple-600" />
              </div>
              <h2 className="text-3xl font-bold mb-4 text-gray-6">Made for Agents</h2>
              <p className="text-gray-5 max-w-2xl mx-auto">
                AI agents can discover, install, and run tools dynamically. Your agent gets the
                tools it needs, when it needs them.
              </p>
            </div>

            {/* Agent workflow demo */}
            <div className="grid lg:grid-cols-2 gap-8 mb-12">
              {/* Left side - Agent capabilities */}
              <div className="space-y-6">
                <div className="card border-l-4 border-purple-500">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Search className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-6 mb-1">Discover on the fly</h4>
                      <p className="text-sm text-gray-5">
                        Agents can search the registry to find the right tool for any task
                      </p>
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded mt-2 inline-block font-mono">
                        enact search "resize images"
                      </code>
                    </div>
                  </div>
                </div>

                <div className="card border-l-4 border-blue-500">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-blueLight-1 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Play className="w-5 h-5 text-brand-blue" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-6 mb-1">Run instantly</h4>
                      <p className="text-sm text-gray-5">
                        Execute any tool without pre-installation—Enact handles it automatically
                      </p>
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded mt-2 inline-block font-mono">
                        enact run alice/resizer --width 800
                      </code>
                    </div>
                  </div>
                </div>

                <div className="card border-l-4 border-teal-500">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <List className="w-5 h-5 text-teal-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-6 mb-1">See available tools</h4>
                      <p className="text-sm text-gray-5">
                        Agents know what tools are installed and ready to use
                      </p>
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded mt-2 inline-block font-mono">
                        enact list
                      </code>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right side - Terminal demo */}
              <div className="card bg-gray-900 text-gray-100 font-mono text-sm">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-700">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-gray-400 text-xs ml-2">agent-terminal</span>
                </div>
                <div className="space-y-3">
                  <div>
                    <span className="text-purple-400">agent</span>
                    <span className="text-gray-500"> $ </span>
                    <span>enact list</span>
                  </div>
                  <div className="text-gray-400 pl-4 border-l-2 border-gray-700">
                    <div className="flex items-center gap-2">
                      <FolderOpen className="w-4 h-4" />
                      <span>Project tools (.enact/tools.json)</span>
                    </div>
                    <div className="pl-6 text-gray-300 space-y-1">
                      <div>
                        <span className="text-teal-400">alice/resizer</span>
                        <span className="text-gray-500">@1.2.0</span>
                        <span className="text-gray-500 ml-2">
                          - Resize images to specified dimensions
                        </span>
                      </div>
                      <div>
                        <span className="text-teal-400">bob/pdf-parser</span>
                        <span className="text-gray-500">@2.1.0</span>
                        <span className="text-gray-500 ml-2">
                          - Extract text from PDF documents
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2">
                    <span className="text-purple-400">agent</span>
                    <span className="text-gray-500"> $ </span>
                    <span>enact list -g</span>
                  </div>
                  <div className="text-gray-400 pl-4 border-l-2 border-gray-700">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4" />
                      <span>Global tools (~/.enact/tools.json)</span>
                    </div>
                    <div className="pl-6 text-gray-300 space-y-1">
                      <div>
                        <span className="text-teal-400">openai/dalle</span>
                        <span className="text-gray-500">@3.0.0</span>
                        <span className="text-gray-500 ml-2">- Generate images from text</span>
                      </div>
                      <div>
                        <span className="text-teal-400">utils/json-validator</span>
                        <span className="text-gray-500">@1.5.2</span>
                        <span className="text-gray-500 ml-2">- Validate JSON against schema</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2">
                    <span className="text-purple-400">agent</span>
                    <span className="text-gray-500"> $ </span>
                    <span>
                      enact run alice/resizer --args '{"{"}width: 800{"}"}'
                    </span>
                  </div>
                  <div className="text-green-400">✓ Tool executed successfully</div>
                </div>
              </div>
            </div>

            {/* MCP integration note */}
            <div className="card bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm">
                  <Terminal className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-6">MCP Integration</h4>
                  <p className="text-sm text-gray-5">
                    Enact integrates with the Model Context Protocol, giving AI models direct access
                    to tools through a standardized interface.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}

      {/* npm for AI Tools Section */}
      <section className="py-20 bg-gray-1">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-4 text-gray-6">
              Like npm, but for AI Tools
            </h2>
            <p className="text-center text-gray-5 mb-6 max-w-2xl mx-auto">
              If you know npm, you already know Enact. Same familiar workflow, designed for AI
              agents.
            </p>

            <div className="grid md:grid-cols-3 mb-12 gap-6">
              <div className="text-center p-6">
                <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Download className="w-6 h-6 text-teal-600" />
                </div>
                <h4 className="font-semibold text-gray-6 mb-2">Install</h4>
                <p className="text-sm text-gray-5">
                  Download verified tools to your local cache, ready to run
                </p>
              </div>
              <div className="text-center p-6">
                <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Play className="w-6 h-6 text-pink-600" />
                </div>
                <h4 className="font-semibold text-gray-6 mb-2">Run</h4>
                <p className="text-sm text-gray-5">
                  Execute tools in isolated containers with structured I/O
                </p>
              </div>
              <div className="text-center p-6">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ArrowRight className="w-6 h-6 text-green-600" />
                </div>
                <h4 className="font-semibold text-gray-6 mb-2">Publish</h4>
                <p className="text-sm text-gray-5">
                  Share your tools with cryptographic signing via Sigstore
                </p>
              </div>
            </div>

            {/* Enact Commands */}
            <div className="card border-2 border-brand-blue mb-12">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-blueLight-1 rounded-lg flex items-center justify-center">
                  <Terminal className="w-5 h-5 text-brand-blue" />
                </div>
                <h3 className="text-xl font-semibold text-gray-6">Enact CLI</h3>
                <span className="text-sm text-brand-blue ml-auto">For AI Tools</span>
              </div>
              <div className="grid md:grid-cols-2 gap-4 font-mono text-sm">
                <div className="bg-blueLight-1/50 hover:bg-red-100 rounded-lg p-3 text-gray-6 transition-colors cursor-pointer">
                  <div className="flex items-center justify-between">
                    <span>
                      <span className="text-gray-4">$</span> enact search "resize images"
                    </span>
                  </div>
                  <p className="text-xs text-gray-5 mt-1 font-sans">Find tools in the registry</p>
                </div>
                <div className="bg-blueLight-1/50 hover:bg-red-100 rounded-lg p-3 text-gray-6 transition-colors cursor-pointer">
                  <div className="flex items-center justify-between">
                    <span>
                      <span className="text-gray-4">$</span> enact run alice/resizer
                    </span>
                  </div>
                  <p className="text-xs text-gray-5 mt-1 font-sans">Execute a tool instantly</p>
                </div>
                <div className="bg-blueLight-1/50 hover:bg-red-100 rounded-lg p-3 text-gray-6 transition-colors cursor-pointer">
                  <div className="flex items-center justify-between">
                    <span>
                      <span className="text-gray-4">$</span> enact install -g alice/resizer
                    </span>
                  </div>
                  <p className="text-xs text-gray-5 mt-1 font-sans">Add to your project</p>
                </div>
                <div className="bg-blueLight-1/50 hover:bg-red-100 rounded-lg p-3 text-gray-6 transition-colors cursor-pointer">
                  <div className="flex items-center justify-between">
                    <span>
                      <span className="text-gray-4">$</span> enact init
                    </span>
                  </div>
                  <p className="text-xs text-gray-5 mt-1 font-sans">Create a new tool template</p>
                </div>
                <div className="bg-blueLight-1/50 hover:bg-red-100 rounded-lg p-3 text-gray-6 transition-colors cursor-pointer">
                  <div className="flex items-center justify-between">
                    <span>
                      <span className="text-gray-4">$</span> enact publish
                    </span>
                  </div>
                  <p className="text-xs text-gray-5 mt-1 font-sans">
                    Share with cryptographic signing
                  </p>
                </div>
                <div className="bg-blueLight-1/50 hover:bg-red-100 rounded-lg p-3 text-gray-6 transition-colors cursor-pointer">
                  <div className="flex items-center justify-between">
                    <span>
                      <span className="text-gray-4">$</span> enact list
                    </span>
                  </div>
                  <p className="text-xs text-gray-5 mt-1 font-sans">See installed tools</p>
                </div>
              </div>
            </div>

            {/* Key differences */}
          </div>
        </div>
      </section>

      {/* Example Project Structure Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <div className="w-16 h-16 bg-teal-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <FolderOpen className="w-8 h-8 text-teal-600" />
              </div>
              <h2 className="text-3xl font-bold mb-4 text-gray-6">Simple Project Structure</h2>
              <p className="text-gray-5 max-w-2xl mx-auto">
                Enact tools are simple to create. Just a SKILL.md manifest and your code—that's it.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {/* Simple Tool */}
              <FileTreeCard
                title="Simple Tool"
                description="Minimal Python greeting tool"
                files={[
                  { name: "hello-python", type: "folder", depth: 0 },
                  { name: "SKILL.md", type: "file", depth: 1, highlight: true },
                  { name: "hello.py", type: "file", depth: 1 },
                ]}
              />

              {/* JavaScript Tool */}
              <FileTreeCard
                title="JavaScript Tool"
                description="Node.js JSON formatter"
                files={[
                  { name: "json-formatter", type: "folder", depth: 0 },
                  { name: "SKILL.md", type: "file", depth: 1, highlight: true },
                  { name: "format.js", type: "file", depth: 1 },
                ]}
              />

              {/* Multi-file Tool */}
              <FileTreeCard
                title="Multi-file Tool"
                description="Data pipeline with modules"
                files={[
                  { name: "data-pipeline", type: "folder", depth: 0 },
                  { name: "SKILL.md", type: "file", depth: 1, highlight: true },
                  { name: "src", type: "folder", depth: 1 },
                  { name: "extractors", type: "folder", depth: 2 },
                  { name: "utils", type: "folder", depth: 2 },
                  { name: "tests", type: "folder", depth: 1 },
                ]}
              />
            </div>

            <div className="mt-8 text-center">
              <p className="text-sm text-gray-5 mb-4">
                The{" "}
                <code className="bg-gray-100 px-2 py-1 rounded font-mono text-sm">SKILL.md</code>{" "}
                file defines your tool's metadata, inputs, outputs, and runtime.
              </p>
              <Link
                to="/browse"
                className="text-brand-blue hover:underline inline-flex items-center gap-1"
              >
                Browse example tools <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-gray-1">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12 text-gray-6">Why Enact?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="card-hover text-center">
              <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Shield className="w-6 h-6 text-teal-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-gray-6">Verified</h3>
              <p className="text-gray-5">
                Cryptographic verification with Sigstore ensures tools are authentic and trustworthy
              </p>
            </div>

            <div className="card-hover text-center">
              <div className="w-12 h-12 bg-pink-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Package className="w-6 h-6 text-pink-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-gray-6">Portable</h3>
              <p className="text-gray-5">
                Containerized execution ensures tools run consistently across any environment
              </p>
            </div>

            <div className="card-hover text-center">
              <div className="w-12 h-12 bg-blueLight-1 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Terminal className="w-6 h-6 text-brand-blue" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-gray-6">AI-Ready</h3>
              <p className="text-gray-5">
                Built for AI agents with structured manifests and MCP integration
              </p>
            </div>

            <div className="card-hover text-center">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Zap className="w-6 h-6 text-brand-green" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-gray-6">Fast</h3>
              <p className="text-gray-5">
                Quick discovery, installation, and execution with smart caching
              </p>
            </div>
          </div>
        </div>
      </section>
      {/* Quick Start Section */}
      <section id="quick-start" className="py-20 bg-gray-1">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-8 text-gray-6">Quick Start</h2>
            <div className="card">
              <div className="space-y-4">
                <CodeBlock title="1. Install the CLI" code="npm install -g enact-cli" />
                <CodeBlock title="2. Initialize your project" code="git init" />
                <CodeBlock
                  title="3. Ask Claude how to use Enact"
                  code='claude "explain how I can use enact"'
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

interface FileTreeItem {
  name: string;
  type: "file" | "folder";
  depth: number;
  highlight?: boolean;
}

function FileTreeCard({
  title,
  description,
  files,
}: {
  title: string;
  description: string;
  files: FileTreeItem[];
}) {
  return (
    <div className="card hover:shadow-lg transition-shadow">
      <div className="mb-4">
        <h4 className="font-semibold text-gray-6">{title}</h4>
        <p className="text-sm text-gray-5">{description}</p>
      </div>
      <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm">
        {files.map((file) => (
          <div
            key={`${file.depth}-${file.name}`}
            className={`flex items-center gap-2 py-1 ${file.highlight ? "text-brand-blue font-medium" : "text-gray-6"}`}
            style={{ paddingLeft: `${file.depth * 16}px` }}
          >
            {file.type === "folder" ? (
              <Folder className="w-4 h-4 text-amber-500" />
            ) : (
              <File className={`w-4 h-4 ${file.highlight ? "text-brand-blue" : "text-gray-400"}`} />
            )}
            <span>{file.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CodeBlock({ title, code }: { title: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <h3 className="font-semibold mb-2 text-gray-6">{title}</h3>
      <div className="relative group">
        <pre className="bg-gray-6 text-gray-1 p-4 rounded-lg overflow-x-auto">
          <code>{code}</code>
        </pre>
        <button
          type="button"
          onClick={handleCopy}
          className="absolute top-2 right-2 p-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors opacity-0 group-hover:opacity-100"
          aria-label="Copy code"
        >
          {copied ? (
            <span className="text-green-400 text-sm">Copied!</span>
          ) : (
            <Copy className="w-4 h-4 text-gray-300" />
          )}
        </button>
      </div>
    </div>
  );
}

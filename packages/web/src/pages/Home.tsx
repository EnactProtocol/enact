import SearchBar from "@/components/ui/SearchBar";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import {
  ArrowRight,
  Bot,
  Check,
  ChevronRight,
  Cloud,
  Container,
  Copy,
  Download,
  File,
  Folder,
  FolderOpen,
  Globe,
  Laptop,
  Layers,
  List,
  Lock,
  Package,
  Play,
  Plug,
  Search,
  Shield,
  Terminal,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

export default function Home() {
  const reveal = useScrollReveal();
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="section-gradient py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <img
              ref={reveal("fade-down")}
              src="/black-logo.svg"
              alt="Enact"
              className="h-24 mx-auto mb-8 animate-float"
            />
            <h1
              ref={reveal("fade-up", 100)}
              className="text-5xl md:text-6xl font-bold mb-6 text-gray-6"
            >
              The <span className="text-brand-blue">Agent Skills</span> Platform
            </h1>
            <p ref={reveal("fade-up", 200)} className="text-xl text-gray-5 mb-8 max-w-2xl mx-auto">
              Discover, verify, and execute capabilities on demand. Enact packages tools as portable
              skill bundles and runs them securely — locally, in containers, or remotely — with
              policy enforcement and cryptographic verification.
            </p>
            <div ref={reveal("fade-up", 300)} className="max-w-2xl mx-auto mb-8">
              <SearchBar placeholder="Search for tools..." />
            </div>
            <div ref={reveal("fade-up", 400)} className="flex flex-wrap justify-center gap-4">
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
              <div
                ref={reveal("zoom-in")}
                className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-6"
              >
                <Bot className="w-8 h-8 text-purple-600" />
              </div>
              <h2 ref={reveal("fade-up", 100)} className="text-3xl font-bold mb-4 text-gray-6">
                Built for Autonomous Agents
              </h2>
              <p ref={reveal("fade-up", 200)} className="text-gray-5 max-w-2xl mx-auto">
                Agents shouldn't ship with every tool preinstalled. They should acquire capabilities
                when needed.
              </p>
            </div>

            {/* Agent workflow demo */}
            <div className="grid lg:grid-cols-2 gap-8 mb-12">
              {/* Left side - Agent capabilities */}
              <div ref={reveal("fade-right")} className="space-y-6">
                <div className="card border-l-4 border-purple-500">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Search className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-6 mb-1">Discover by capability</h4>
                      <p className="text-sm text-gray-5">
                        Search the registry for skills that solve the task
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
                        Execute without manual setup or environment wiring
                      </p>
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded mt-2 inline-block font-mono">
                        enact run alice/resizer:resize --args '{"{"}width: 800{"}"}'
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
                      <h4 className="font-semibold text-gray-6 mb-1">Know what's available</h4>
                      <p className="text-sm text-gray-5">
                        Agents and developers can inspect installed capabilities
                      </p>
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded mt-2 inline-block font-mono">
                        enact list
                      </code>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right side - Terminal demo */}
              <div
                ref={reveal("fade-left", 150)}
                className="card bg-gray-900 text-gray-100 font-mono text-sm"
              >
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
                      enact run alice/resizer:resize --args '{"{"}width: 800{"}"}'
                    </span>
                  </div>
                  <div className="text-green-400">✓ Tool executed successfully</div>
                </div>
              </div>
            </div>

            {/* MCP integration note */}
            <div
              ref={reveal("fade-up", 100)}
              className="card bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm">
                  <Terminal className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-6">Native Agent Integration</h4>
                  <p className="text-sm text-gray-5">
                    Enact integrates with the Model Context Protocol, allowing AI clients to
                    discover and execute skills dynamically. No preconfiguration required.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Policy-Enforced Execution Section */}
      <section className="py-20 bg-gray-1">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <div
                ref={reveal("zoom-in")}
                className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6"
              >
                <Shield className="w-8 h-8 text-red-600" />
              </div>
              <h2 ref={reveal("fade-up", 100)} className="text-3xl font-bold mb-4 text-gray-6">
                Policy-Enforced Execution
              </h2>
              <p ref={reveal("fade-up", 200)} className="text-gray-5 max-w-2xl mx-auto">
                The model decides what to run. Enact decides <strong>whether and how</strong> it
                runs.
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
              {/* Stack diagram */}
              <div
                ref={reveal("fade-right")}
                className="card bg-gray-900 text-gray-100 font-mono text-sm"
              >
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-700">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-gray-400 text-xs ml-2">execution-stack</span>
                </div>
                <div className="space-y-2">
                  <div className="text-purple-400">
                    Model <span className="text-gray-500">(Claude, GPT, etc.)</span>
                  </div>
                  <div className="text-gray-500 pl-4">↓</div>
                  <div className="text-blue-400 pl-4">
                    Host <span className="text-gray-500">(Claude Code, Cursor, etc.)</span>
                  </div>
                  <div className="text-gray-500 pl-8">↓</div>
                  <div className="text-teal-400 pl-8">
                    Tool Call <span className="text-gray-500">(MCP or CLI)</span>
                  </div>
                  <div className="text-gray-500 pl-12">↓</div>
                  <div className="text-yellow-400 pl-12 font-bold">Enact Runtime</div>
                  <div className="text-gray-400 pl-16 space-y-1">
                    <div>├── Signature verification (Sigstore)</div>
                    <div>├── Trust policy enforcement</div>
                    <div>├── Backend selection</div>
                    <div>├── Secret injection</div>
                    <div>└── Isolated execution</div>
                  </div>
                </div>
              </div>

              {/* Before execution checklist */}
              <div ref={reveal("fade-left", 150)} className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-6">Before execution, Enact:</h3>
                <div className="space-y-3">
                  <div className="card border-l-4 border-red-400">
                    <div className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-red-500 flex-shrink-0" />
                      <div>
                        <span className="font-medium text-gray-6">Verifies signatures</span>
                        <span className="text-sm text-gray-5 ml-2">via Sigstore</span>
                      </div>
                    </div>
                  </div>
                  <div className="card border-l-4 border-orange-400">
                    <div className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-orange-500 flex-shrink-0" />
                      <div>
                        <span className="font-medium text-gray-6">Applies trust policies</span>
                        <span className="text-sm text-gray-5 ml-2">per your configuration</span>
                      </div>
                    </div>
                  </div>
                  <div className="card border-l-4 border-yellow-400">
                    <div className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                      <div>
                        <span className="font-medium text-gray-6">Selects execution backend</span>
                        <span className="text-sm text-gray-5 ml-2">
                          based on policy & environment
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="card border-l-4 border-green-400">
                    <div className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <div>
                        <span className="font-medium text-gray-6">Injects secrets securely</span>
                        <span className="text-sm text-gray-5 ml-2">never exposed to the agent</span>
                      </div>
                    </div>
                  </div>
                  <div className="card border-l-4 border-blue-400">
                    <div className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-blue-500 flex-shrink-0" />
                      <div>
                        <span className="font-medium text-gray-6">Runs in isolation</span>
                        <span className="text-sm text-gray-5 ml-2">when needed</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Run Anywhere Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <div
                ref={reveal("zoom-in")}
                className="w-16 h-16 bg-blueLight-1 rounded-2xl flex items-center justify-center mx-auto mb-6"
              >
                <Globe className="w-8 h-8 text-brand-blue" />
              </div>
              <h2 ref={reveal("fade-up", 100)} className="text-3xl font-bold mb-4 text-gray-6">
                Run Anywhere
              </h2>
              <p ref={reveal("fade-up", 200)} className="text-gray-5 max-w-2xl mx-auto">
                Skills are portable across environments. Write once, run anywhere. Enact
                automatically chooses the safest available option based on policy and environment.
              </p>
            </div>

            <div
              ref={reveal("fade-up", 300)}
              className="grid md:grid-cols-3 gap-6 scroll-reveal-stagger"
            >
              <div className="card-hover text-center">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Laptop className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-gray-6">Local</h3>
                <p className="text-gray-5">
                  Fast, trusted workflows. Direct execution for verified skills.
                </p>
              </div>

              <div className="card-hover text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Container className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-gray-6">Containerized</h3>
                <p className="text-gray-5">
                  Isolation for untrusted code. Reproducible environments every time.
                </p>
              </div>

              <div className="card-hover text-center">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Cloud className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-gray-6">Remote</h3>
                <p className="text-gray-5">
                  No local runtime required. Hosted execution when you need it.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* npm for AI Tools Section */}
      <section className="py-20 bg-gray-1">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <h2 ref={reveal("fade-up")} className="text-3xl font-bold text-center mb-4 text-gray-6">
              Like npm, but for AI Tools
            </h2>
            <p
              ref={reveal("fade-up", 100)}
              className="text-center text-gray-5 mb-6 max-w-2xl mx-auto"
            >
              If you know npm, you already know Enact. Same familiar workflow, designed for AI
              agents.
            </p>

            <div
              ref={reveal("fade-up", 200)}
              className="grid md:grid-cols-3 mb-12 gap-6 scroll-reveal-stagger"
            >
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
            <div ref={reveal("fade-up")} className="card border-2 border-brand-blue mb-12">
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
                      <span className="text-gray-4">$</span> enact run alice/resizer:resize
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
              <div
                ref={reveal("zoom-in")}
                className="w-16 h-16 bg-teal-100 rounded-2xl flex items-center justify-center mx-auto mb-6"
              >
                <FolderOpen className="w-8 h-8 text-teal-600" />
              </div>
              <h2 ref={reveal("fade-up", 100)} className="text-3xl font-bold mb-4 text-gray-6">
                Simple Skill Packages
              </h2>
              <p ref={reveal("fade-up", 200)} className="text-gray-5 max-w-2xl mx-auto">
                Each skill package is just a SKILL.md, a skill.package.yml, and your code—that's it.
              </p>
            </div>

            <div
              ref={reveal("fade-up", 300)}
              className="grid md:grid-cols-3 gap-6 scroll-reveal-stagger"
            >
              {/* Simple Tool */}
              <FileTreeCard
                title="Simple Tool"
                description="Minimal Python greeting tool"
                files={[
                  { name: "hello-python", type: "folder", depth: 0 },
                  {
                    name: "SKILL.md",
                    type: "file",
                    depth: 1,
                    highlight: true,
                    color: "text-teal-600",
                  },
                  {
                    name: "skill.package.yml",
                    type: "file",
                    depth: 1,
                    highlight: true,
                  },
                  { name: "hello.py", type: "file", depth: 1 },
                ]}
              />

              {/* JavaScript Tool */}
              <FileTreeCard
                title="JavaScript Tool"
                description="Node.js JSON formatter"
                files={[
                  { name: "json-formatter", type: "folder", depth: 0 },
                  {
                    name: "SKILL.md",
                    type: "file",
                    depth: 1,
                    highlight: true,
                    color: "text-teal-600",
                  },
                  {
                    name: "skill.package.yml",
                    type: "file",
                    depth: 1,
                    highlight: true,
                  },
                  { name: "format.js", type: "file", depth: 1 },
                ]}
              />

              {/* Multi-file Tool */}
              <FileTreeCard
                title="Multi-file Tool"
                description="Data pipeline with modules"
                files={[
                  { name: "data-pipeline", type: "folder", depth: 0 },
                  {
                    name: "SKILL.md",
                    type: "file",
                    depth: 1,
                    highlight: true,
                    color: "text-teal-600",
                  },
                  { name: "skill.package.yml", type: "file", depth: 1, highlight: true },
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
                defines your tool for AI agents, and{" "}
                <code className="bg-gray-100 px-2 py-1 rounded font-mono text-sm">
                  skill.package.yml
                </code>{" "}
                configures its runtime and execution.
              </p>
              <Link
                to="/browse"
                className="text-brand-blue hover:underline inline-flex items-center gap-1"
              >
                Browse skill packages <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-gray-1">
        <div className="container mx-auto px-4">
          <h2 ref={reveal("fade-up")} className="text-3xl font-bold text-center mb-12 text-gray-6">
            Why Enact?
          </h2>
          <div
            ref={reveal("fade-up", 150)}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 scroll-reveal-stagger"
          >
            <div className="card-hover text-center">
              <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Package className="w-6 h-6 text-teal-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-gray-6">Portable</h3>
              <p className="text-gray-5">Skills run across environments without modification</p>
            </div>

            <div className="card-hover text-center">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Shield className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-gray-6">Secure by Default</h3>
              <p className="text-gray-5">
                Verification and policy enforcement before every execution
              </p>
            </div>

            <div className="card-hover text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Bot className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-gray-6">Agent-Native</h3>
              <p className="text-gray-5">
                Designed for dynamic capability discovery by autonomous systems
              </p>
            </div>

            <div className="card-hover text-center">
              <div className="w-12 h-12 bg-blueLight-1 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Layers className="w-6 h-6 text-brand-blue" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-gray-6">Flexible</h3>
              <p className="text-gray-5">Works locally, in containers, or remotely — your choice</p>
            </div>

            <div className="card-hover text-center">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Lock className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-gray-6">Open</h3>
              <p className="text-gray-5">Self-host, extend, or integrate into your stack</p>
            </div>
          </div>
        </div>
      </section>

      {/* Using Enact with MCP Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <div
                ref={reveal("zoom-in")}
                className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-6"
              >
                <Plug className="w-8 h-8 text-purple-600" />
              </div>
              <h2 ref={reveal("fade-up", 100)} className="text-3xl font-bold mb-4 text-gray-6">
                Native Agent Integration
              </h2>
              <p ref={reveal("fade-up", 200)} className="text-gray-5 max-w-2xl mx-auto">
                Enact integrates with the Model Context Protocol, allowing AI clients to discover
                and execute skills dynamically through a standardized interface. No preconfiguration
                required.
              </p>
            </div>

            {/* Configuration Example */}
            <div className="grid lg:grid-cols-2 gap-8 mb-12">
              <div ref={reveal("fade-right")} className="card">
                <h3 className="text-xl font-semibold text-gray-6 mb-4">Claude Desktop Setup</h3>
                <p className="text-sm text-gray-5 mb-4">
                  Add Enact to your Claude Desktop configuration to give Claude access to all Enact
                  tools:
                </p>
                <div className="bg-gray-900 text-gray-100 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                  <pre>{`{
  "mcpServers": {
    "enact": {
      "command": "npx",
      "args": ["-y", "@enactprotocol/mcp-server"]
    }
  }
}`}</pre>
                </div>
                <p className="text-xs text-gray-4 mt-3">
                  Config location:{" "}
                  <code className="bg-gray-100 px-1 rounded">
                    ~/Library/Application Support/Claude/claude_desktop_config.json
                  </code>
                </p>
              </div>

              <div ref={reveal("fade-left", 150)} className="card">
                <h3 className="text-xl font-semibold text-gray-6 mb-4">Agent Capabilities</h3>
                <p className="text-sm text-gray-5 mb-4">
                  Agents can search, learn, execute, and install — all through MCP:
                </p>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Search className="w-4 h-4 text-purple-600" />
                    </div>
                    <div>
                      <code className="text-sm font-mono text-gray-6">enact_search</code>
                      <p className="text-xs text-gray-5">
                        Search the registry for tools by keyword
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <List className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <code className="text-sm font-mono text-gray-6">enact_learn</code>
                      <p className="text-xs text-gray-5">
                        Get detailed tool schema and documentation
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Play className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <code className="text-sm font-mono text-gray-6">enact_run</code>
                      <p className="text-xs text-gray-5">
                        Execute any tool in a sandboxed container
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Download className="w-4 h-4 text-teal-600" />
                    </div>
                    <div>
                      <code className="text-sm font-mono text-gray-6">enact_install</code>
                      <p className="text-xs text-gray-5">Install tools as native MCP tools</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* How it works */}
            <div
              ref={reveal("fade-up")}
              className="card bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200"
            >
              <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
                  <Bot className="w-6 h-6 text-purple-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-6 mb-2">Dynamic Capability Discovery</h4>
                  <p className="text-sm text-gray-5">
                    Agents acquire capabilities at runtime. Ask Claude to "find a tool for web
                    scraping" and it will search, learn, and run the right skill — all through MCP.
                    No preconfiguration required.
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <code className="text-xs bg-white/80 px-3 py-2 rounded-lg font-mono text-purple-700 block">
                    npm i -g @enactprotocol/mcp-server
                  </code>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Start Section */}
      <section id="quick-start" className="py-20 bg-gray-1">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h2 ref={reveal("fade-up")} className="text-3xl font-bold text-center mb-8 text-gray-6">
              Quick Start
            </h2>
            <div ref={reveal("fade-up", 150)} className="card">
              <div className="space-y-4">
                <CodeBlock title="1. Install the CLI" code="npm install -g enact-cli" />
                <CodeBlock title="2. Find a skill" code="enact search scraper" />
                <CodeBlock
                  title="3. Run it"
                  code='enact run enact/firecrawl:scrape -a &apos;{"url":"https://example.com"}&apos;'
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
  color?: string;
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
        {files.map((file) => {
          const color = file.color || (file.highlight ? "text-brand-blue" : "text-gray-6");
          return (
            <div
              key={`${file.depth}-${file.name}`}
              className={`flex items-center gap-2 py-1 ${color} ${file.highlight ? "font-medium" : ""}`}
              style={{ paddingLeft: `${file.depth * 16}px` }}
            >
              {file.type === "folder" ? (
                <Folder className="w-4 h-4 text-amber-500" />
              ) : (
                <File
                  className={`w-4 h-4 ${file.color || (file.highlight ? "text-brand-blue" : "text-gray-400")}`}
                />
              )}
              <span>{file.name}</span>
            </div>
          );
        })}
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

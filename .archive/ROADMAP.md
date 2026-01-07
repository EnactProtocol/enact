# Enact 2.0 Roadmap

This document outlines future work and planned features for Enact 2.0.

## Current Status (December 2025)

**✅ Completed:**
- Phase 1-9.5: Full CLI implementation with local execution, registry integration, trust system
- Phase 10.5: Local development infrastructure (Supabase + MinIO)
- 1120 tests passing across all packages
- Production-ready CLI for tool execution, publishing, and discovery

**🎯 Current Focus:**
- Building out real-world examples and tools
- Community adoption and feedback
- Performance optimizations

---

## Future Phases

### Phase 10: Build & Release System

**Status:** Planned
**Priority:** High
**Timeline:** Q1 2026

Prepare Enact for production deployment with proper CI/CD and distribution.

#### 10.1 Build Configuration
- [ ] Optimize Bun build for each package
- [ ] Improve build caching and performance
- [ ] Add watch mode for development (`bun run dev`)
- [ ] Add CLI binary bundling (single executable)
- [ ] Create platform-specific installers (macOS, Linux, Windows)

#### 10.2 CI/CD Pipeline (GitHub Actions)
- [ ] **Workflow: `test.yml`** - Run all tests on PR
  - Run tests across all packages
  - Check formatting/linting with Biome
  - TypeScript type checking
  - Report test coverage
  - Cross-platform testing (Ubuntu, macOS, Windows)
- [ ] **Workflow: `build.yml`** - Build validation
  - Build all packages
  - Validate package exports
  - Check for circular dependencies
  - Build CLI binaries
- [ ] **Workflow: `release.yml`** - Automated releases
  - Triggered on version tags
  - Build and publish to npm
  - Generate release notes
  - Create GitHub release with binaries
  - Publish to homebrew (macOS)

#### 10.3 Testing Infrastructure
- [ ] Configure test coverage reporting (lcov/html)
- [ ] Set coverage thresholds (>80%)
- [ ] Add integration test suite runner
- [ ] Add test result caching
- [ ] Performance benchmarking suite

#### 10.4 Release Automation
- [ ] Implement version bumping script
  - Support major/minor/patch bumps
  - Update all package.json files
  - Update CHANGELOG.md
- [ ] Changeset or similar for changelog generation
- [ ] npm publishing workflow with provenance
- [ ] GitHub release with binaries
- [ ] Docker images for CI/server environments

#### 10.5 Developer Experience
- [ ] Hot reload for CLI development
- [ ] Debug configuration for VS Code
- [ ] Add contributing guide (CONTRIBUTING.md)
- [ ] Improve developer onboarding docs

**Success Criteria:**
- CI/CD pipeline runs on all PRs and releases
- Automated npm publishing
- Cross-platform binaries available
- <5 minute build times
- >90% test coverage maintained

---

### Phase 11: Documentation & Examples

**Status:** Planned
**Priority:** High
**Timeline:** Q1 2026

Comprehensive documentation and real-world examples to accelerate adoption.

#### 11.1 Package Documentation
- [ ] **packages/shared/README.md** - Core API guide
  - Manifest parsing
  - Tool resolution
  - Configuration management
- [ ] **packages/secrets/README.md** - Secrets & env guide
  - Keyring integration
  - Namespace inheritance
  - .env file management
- [ ] **packages/cli/README.md** - CLI usage guide
  - Command reference with examples
  - Common workflows
  - Troubleshooting
- [ ] **packages/trust/README.md** - Trust system guide
  - Sigstore integration
  - Attestation verification
  - Trust policies
- [ ] **packages/api/README.md** - API client guide
  - Registry API usage
  - Search and discovery
  - Publishing workflow

#### 11.2 Examples
- [ ] **examples/hello-world/** - Basic tool
  - Simple command execution
  - Input/output schemas
  - Local testing
- [ ] **examples/pdf-extract/** - Tool with dependencies
  - Python environment
  - External libraries
  - File handling
- [ ] **examples/api-caller/** - Tool with secrets
  - API authentication
  - Secret management
  - Error handling
- [ ] **examples/workflow/** - Multi-step example
  - LLM-driven instructions
  - Multiple tool orchestration
  - Complex data processing
- [ ] **examples/rust-builder/** - Build step example
  - Compile-time dependencies
  - Build caching
  - Cross-compilation

#### 11.3 Guides
- [ ] **Getting Started Guide**
  - Installation
  - First tool execution
  - Basic concepts
- [ ] **Creating Your First Tool**
  - Manifest structure
  - Input validation
  - Testing locally
  - Publishing workflow
- [ ] **Managing Secrets Guide**
  - Keyring setup
  - Namespace patterns
  - Best practices
- [ ] **Trust and Security Guide**
  - Understanding Sigstore
  - Trust policies
  - Auditing tools
  - Reporting vulnerabilities
- [ ] **Publishing Tools Guide**
  - Signing workflow
  - Registry best practices
  - Versioning strategy
  - Yanking versions

**Success Criteria:**
- All packages have comprehensive READMEs
- 5+ real-world examples
- Complete user guides for all major workflows
- Video tutorials for key features

---

### Phase 12: MCP Server Package

**Status:** Planned (Deprioritized)
**Priority:** Medium
**Timeline:** Q2 2026

AI integration via Model Context Protocol - allows Claude and other AI assistants to discover and use Enact tools natively.

#### 12.1 MCP Protocol Server
- [ ] Set up MCP SDK integration (`@modelcontextprotocol/sdk`)
- [ ] Implement server initialization
- [ ] Configure stdio transport
- [ ] Add server metadata and capabilities
- [ ] Handle MCP protocol lifecycle (initialize, shutdown, ping)

#### 12.2 Tool Projection System
- [ ] Convert enact tools → MCP tools dynamically
- [ ] Map Enact input schemas → MCP tool schemas
- [ ] Dynamic tool discovery (scan ~/.enact/tools/, .enact/)
- [ ] Watch for tool changes (file system watching)
- [ ] Cache tool manifests for performance

#### 12.3 MCP Tool Implementations

**Meta-tools for Enact management:**
- [ ] `enact_search(query, tags)` - Search registry
- [ ] `enact_inspect(tool)` - Get tool details
- [ ] `enact_install(tool, global?)` - Install tool
- [ ] `enact_list(scope)` - List installed tools
- [ ] `enact_run(tool, args)` - Execute tool
- [ ] `enact_exec(tool, command)` - Run arbitrary command

**Background operation tracking:**
- [ ] Long-running tool execution tracking
- [ ] Operation status queries
- [ ] Cancellation support
- [ ] Progress reporting

#### 12.4 Configuration
- [ ] Add MCP server to Claude Desktop config automatically
- [ ] Support custom server configurations
- [ ] Environment variable handling
- [ ] Logging and debugging options

#### 12.5 Testing
- [ ] Unit tests for MCP protocol handling
- [ ] Integration tests with MCP SDK
- [ ] Mock tool scenarios
- [ ] E2E tests with Claude Desktop
- [ ] Performance benchmarks

#### 12.6 Documentation
- [ ] MCP server setup guide
- [ ] Claude Desktop integration guide
- [ ] Tool projection documentation
- [ ] Troubleshooting guide

**Success Criteria:**
- MCP server can be integrated with Claude Desktop
- All installed Enact tools are accessible via AI agents
- Dynamic tool discovery works reliably
- Background operations tracked properly
- Comprehensive documentation for AI integration

**Why Deprioritized:**
- CLI must be production-ready first
- Need real-world tool ecosystem before MCP integration
- Waiting for MCP SDK stability and broader adoption

---

## Future Feature Ideas

### Semantic Tool Search
- [ ] Vector embedding cache (`~/.enact/embeddings/`)
- [ ] Generate embeddings on tool install
- [ ] Local embeddings via `@xenova/transformers` (all-MiniLM-L6-v2)
- [ ] Optional API embeddings (OpenAI/Anthropic) for higher quality
- [ ] `enact search -g --semantic <query>` for similarity search
- [ ] `enact cache rebuild-embeddings` to regenerate cache
- [ ] Embedding provider config (`enact config set embeddings.provider local|openai`)
- [ ] Auto-update embeddings when tool manifest changes (hash-based invalidation)

### Performance Optimizations
- [ ] Parallel tool execution
- [ ] Smart manifest caching
- [ ] Incremental bundle downloads
- [ ] Container image pre-pulling

### Enhanced Trust System
- [ ] Community reputation scores
- [ ] Automated security scanning integration
- [ ] CVE database integration
- [ ] Tool deprecation workflow

### Registry Features
- [ ] Private registries for enterprises
- [ ] Tool collections/bundles
- [ ] Tool recommendations
- [ ] Usage analytics and metrics

### Developer Tools
- [ ] VS Code extension for tool development
- [ ] Tool scaffolding CLI (`enact init`)
- [ ] Local registry mode for testing
- [ ] Tool debugging tools

### Ecosystem
- [ ] Official tool repository (curated)
- [ ] Community tool showcase
- [ ] Tool of the month highlights
- [ ] Integration examples (GitHub Actions, Docker, etc.)

### Input/Execution Enhancements
- [ ] **Automatic TOOL_INPUT env var** - Pass `--args` JSON as `TOOL_INPUT` environment variable automatically, giving tools an alternative to string interpolation for complex inputs. Would enable:
  - Optional params naturally absent (not empty strings)
  - Complex nested data without shell escaping
  - Consistent pattern across all tools
  - See [docs/design/optional-parameters.md](docs/design/optional-parameters.md) for full exploration

---

## Version Milestones

### v1.0.0 - CLI Production Release (Target: Q1 2026)
- ✅ All CLI commands working
- ✅ Trust system complete
- ✅ Registry integration
- ✅ Local development infrastructure
- 🔜 CI/CD pipeline
- 🔜 Comprehensive documentation
- 🔜 Cross-platform binaries

### v1.1.0 - Enhanced Tooling (Target: Q2 2026)
- Performance optimizations
- Tool scaffolding
- VS Code extension
- Expanded examples

### v2.0.0 - AI Integration (Target: Q3 2026)
- MCP server package
- Claude Desktop integration
- Enhanced LLM-driven workflows
- AI tool recommendations

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to contribute to these roadmap items.

**Priority areas for community contribution:**
1. Real-world tool examples
2. Documentation improvements
3. Cross-platform testing
4. Performance optimizations
5. Registry tooling

---

## Feedback

Have ideas for the roadmap? Open an issue with the `roadmap` label or start a discussion in GitHub Discussions.

**Last Updated:** December 3, 2025

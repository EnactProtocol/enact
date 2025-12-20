# Getting Started with Enact

Enact is a verified, portable protocol for AI-executable tools. This guide will help you get started using Enact to discover, install, and run tools.

## Installation

### Prerequisites

- **[Bun](https://bun.sh)** or Node.js 20+ - JavaScript runtime
- **[Docker](https://www.docker.com/)** - For running containerized tools

### Install Enact CLI

```bash
# Install globally with npm
npm install -g enact-cli

# Or with bun
bun install -g enact-cli

# Or use npx without installing
npx enact-cli --help
```

## Quick Start

### 1. Set up your configuration

Run the setup wizard to configure Enact:

```bash
enact setup --global
```

When prompted, you can use the defaults:
- **Registry URL**: `https://siikwkfgsmouioodghho.supabase.co/functions/v1` (default)
- **Minimum attestations**: `1` (default)
- **Maximum cache size**: `1024` MB (default)
- **Default execution timeout**: `30s` (default)

This creates a configuration file at `~/.enact/config.yaml`.

### 2. Search for tools

Discover tools in the registry:

```bash
# Search by keyword
enact search "pdf"

# Search with tags
enact search "data" --tags csv,json

# List more results
enact search "api" --limit 50
```

### 3. Get tool information

View detailed information about a tool:

```bash
enact learn username/toolname
```

This shows:
- Description and tags
- Available versions
- Download statistics
- Trust information
- Installation command

### 4. Install a tool

Install tools globally or to your current project:

```bash
# Install globally (available everywhere)
enact install username/toolname --global

# Install to current project (creates .enact/tools.json)
enact install username/toolname

# Install specific version
enact install username/toolname@v1.2.0 --global
```

### 5. Run a tool

Execute an installed tool:

```bash
# Run with JSON arguments (recommended)
enact run username/toolname --args '{"input": "value"}'

# Run with arguments from a JSON file
enact run username/toolname --input-file params.json

# Run with timeout
enact run username/toolname --args '{}' --timeout 60s
```

**Note**: JSON input (`--args` or `--input-file`) is recommended, especially for complex values or when automating with agents. This avoids shell escaping issues and properly handles optional parameters.

## Common Workflows

### Installing from a project's tools.json

If you clone a project that uses Enact tools, install all dependencies:

```bash
cd my-project
enact install
```

This reads `.enact/tools.json` and installs all listed tools.

### Running tools with different commands

Tools define a default command, but you can run custom commands:

```bash
# Run the tool's default command
enact run toolname

# Execute a custom command in the tool's environment
enact exec toolname "npm test"

# Run a shell in the tool's container
enact exec toolname "/bin/bash"
```

### Managing installed tools

```bash
# List all installed tools
enact list

# List global tools only
enact list --global

# List project tools only
enact list --project

# Show what's in the cache
enact list --cache
```

### Managing environment variables

Tools can use environment variables and secrets:

```bash
# Set an environment variable
enact env set API_KEY --secret

# Set a non-secret variable
enact env set LOG_LEVEL info

# List all variables
enact env list

# Delete a variable
enact env delete API_KEY
```

## Trust and Security

Enact uses cryptographic verification to ensure tools are authentic and haven't been tampered with.

### Understanding attestations

Tools are verified through **attestations** - cryptographic signatures from trusted parties:
- **Publishers** attest when they publish
- **Auditors** attest after reviewing code
- **Build systems** attest to reproducible builds

### Configuring trust

Set your minimum attestation requirements:

```bash
# View current trust settings
enact trust list

# Require at least 2 attestations
enact config set trust.minimum_attestations 2

# Add a trusted auditor
enact trust add auditor username
```

### Inspecting tools

Before installing, inspect what a tool does:

```bash
# View tool manifest and files
enact inspect username/toolname

# See specific version
enact inspect username/toolname --version v1.0.0
```

## Configuration

### Configuration file

Enact stores configuration in YAML format:
- **Global**: `~/.enact/config.yaml`
- **Project**: `.enact/config.yaml`

Example configuration:

```yaml
version: 1.0.0
trust:
  minimum_attestations: 1
  trusted_auditors: []
cache:
  maxSizeMb: 1024
  ttlSeconds: 604800  # 7 days
execution:
  defaultTimeout: 30s
  verbose: false
registry:
  url: https://siikwkfgsmouioodghho.supabase.co/functions/v1
```

### Viewing and editing configuration

```bash
# View current configuration
enact config show

# Edit configuration interactively
enact setup --global

# Set specific values
enact config set execution.defaultTimeout 60s
```

### Cache management

Enact caches downloaded tools to speed up installation:

```bash
# View cache info
enact cache info

# Clean old cache entries
enact cache clean

# Clear entire cache
enact cache clean --all
```

## Publishing Tools

If you want to share your own tools:

### 1. Create a tool

Create a directory with:
- `enact.yaml` - Tool manifest
- `Dockerfile` - Container definition
- Source code and dependencies

Example `enact.yaml`:

```yaml
name: username/my-tool
version: 1.0.0
description: My awesome tool
tags: [utility, example]
image:
  build:
    context: .
    dockerfile: Dockerfile
command: ["node", "index.js"]
inputs:
  message:
    type: string
    description: Message to process
```

### 2. Sign your tool

Generate cryptographic attestations:

```bash
cd my-tool/
enact sign
```

This creates signed attestations in `.enact/attestations/`.

### 3. Publish to the registry

```bash
enact publish
```

You'll need to authenticate first:

```bash
enact auth login
```

## Getting Help

### Command help

```bash
# General help
enact --help

# Command-specific help
enact run --help
enact install --help
```

### Common issues

**"Tool not found"**
- Check spelling: `enact search toolname`
- Verify it's installed: `enact list`

**"Permission denied"**
- Run with appropriate permissions
- Check Docker is running

**"Execution timeout"**
- Increase timeout: `enact run tool --timeout 120s`
- Set default: `enact config set execution.defaultTimeout 120s`

**"Insufficient attestations"**
- View attestations: `enact get toolname`
- Lower requirements: `enact config set trust.minimum_attestations 0`
- Install anyway: `enact install toolname --allow-unverified`

### Resources

- **Documentation**: [github.com/EnactProtocol/enact-cli-2.0](https://github.com/EnactProtocol/enact-cli-2.0)
- **Registry**: [enact.tools](https://enact.tools)
- **Issues**: [github.com/EnactProtocol/enact-cli-2.0/issues](https://github.com/EnactProtocol/enact-cli-2.0/issues)

## Next Steps

- Browse tools at [enact.tools](https://enact.tools)
- Read the [CLI Commands Reference](docs/COMMANDS.md)
- Learn about [creating tools](docs/CREATING-TOOLS.md)
- Explore [example tools](examples/)

## Tips and Best Practices

### Project workflows

For projects using Enact tools:

1. Run `enact setup` in your project directory
2. Install tools: `enact install toolname`
3. Commit `.enact/tools.json` to version control
4. Team members run `enact install` to get all tools

### Performance

- Use `--global` for frequently used tools
- Run `enact cache clean` periodically
- Increase cache size for many tools: `enact config set cache.maxSizeMb 2048`

### Security

- Always inspect tools before first use: `enact inspect toolname`
- Keep minimum attestations at 1 or higher
- Only add trusted auditors: `enact trust add auditor username`
- Report suspicious tools: `enact report toolname --reason "description"`

### Automation

Use Enact in scripts and CI/CD:

```bash
# Non-interactive mode
enact install toolname --force --json

# Environment variables
export ENACT_REGISTRY_URL=https://siikwkfgsmouioodghho.supabase.co/functions/v1
export ENACT_AUTH_TOKEN=your-token

# Run without prompts
enact run toolname --args '{"input":"value"}' --json
```

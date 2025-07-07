# Dagger Integration for Enact CLI

## Overview

The Enact CLI now supports [Dagger](https://dagger.io) as an execution provider, enabling containerized execution of tools with enhanced security, isolation, and reproducibility.

## Benefits of Using Dagger

### 🔒 **Enhanced Security**
- **Complete isolation**: Tools run in containers, unable to access your host system
- **No privilege escalation**: Tools can't escape their sandbox
- **Network controls**: Optionally disable network access for sensitive operations

### 📦 **Reproducibility**
- **Consistent environments**: Same execution environment across all machines
- **Version pinning**: Lock specific tool versions and dependencies
- **Deterministic builds**: Identical results every time

### 🚀 **Performance**
- **Layer caching**: Dagger's intelligent caching speeds up repeated executions
- **Parallel execution**: Run multiple tools simultaneously
- **Resource management**: Control memory, CPU, and disk usage

### 🛠️ **Developer Experience**
- **Easy debugging**: Inspect container state and outputs
- **Local development**: Test tools in production-like environments
- **CI/CD ready**: Same execution model works locally and in CI

## Installation

### 1. Install Dagger

```bash
# macOS/Linux
curl -L https://dl.dagger.io/dagger/install.sh | sh

# Or via Homebrew (macOS)
brew install dagger/tap/dagger

# Windows
powershell -c "iwr https://dl.dagger.io/dagger/install.ps1 -useb | iex"
```

### 2. Install Dagger Dependencies for Enact

The Dagger SDK is automatically installed with the Enact CLI:

```bash
npm install -g enact-cli
# or
bun install -g enact-cli
```

## Configuration

### Interactive Setup

The easiest way to configure Dagger execution:

```bash
enact config setup
```

This will guide you through:
- Choosing execution provider (Direct vs Dagger)
- Configuring container settings
- Setting resource limits
- Network access preferences

### Manual Configuration

```bash
# Switch to Dagger execution
enact config set executionProvider dagger

# Configure base image
enact config set daggerOptions.baseImage ubuntu:22.04

# Enable/disable network access
enact config set daggerOptions.enableNetwork true

# Set memory limits
enact config set daggerOptions.maxMemory 2Gi

# View current configuration
enact config list
```

### Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `executionProvider` | `direct` | `direct` or `dagger` |
| `daggerOptions.baseImage` | `node:20-slim` | Base container image |
| `daggerOptions.enableNetwork` | `true` | Allow network access |
| `daggerOptions.enableHostFS` | `false` | Mount host filesystem |
| `daggerOptions.maxMemory` | - | Memory limit (e.g., `1Gi`, `512Mi`) |
| `daggerOptions.maxCPU` | - | CPU limit (e.g., `0.5`, `2`) |

## Usage Examples

### Basic Tool Execution

```bash
# Execute a tool with Dagger (once configured)
enact exec markdown-converter --input "# Hello World"

# Force Dagger execution for a single command
enact config set executionProvider dagger
enact exec data-processor --input data.json
```

### Advanced Container Configuration

```bash
# Use a specific base image for Python tools
enact config set daggerOptions.baseImage python:3.11-slim

# Execute a Python data analysis tool
enact exec data-analysis/pandas-processor --input dataset.csv

# Switch to a Node.js environment
enact config set daggerOptions.baseImage node:18-alpine
enact exec web-scraper --url https://example.com
```

### Security-Focused Execution

```bash
# Disable network access for sensitive operations
enact config set daggerOptions.enableNetwork false

# Execute a file processor without network access
enact exec file-encryptor --input secrets.txt

# Re-enable network access
enact config set daggerOptions.enableNetwork true
```

## Example: Markdown Processing Tool

Here's how a markdown processing tool would run with Dagger:

### Tool Definition (`markdown-processor.yaml`)

```yaml
name: "examples/markdown-processor"
description: "Convert markdown to HTML using containerized execution"
command: "npx markdown-it@14.0.0 ${input}"
timeout: "30s"
tags: ["markdown", "converter", "html"]

inputSchema:
  type: object
  properties:
    input:
      type: string
      description: "Markdown content to convert"
  required: ["input"]

outputSchema:
  type: string
  description: "Generated HTML content"
```

### Execution Flow with Dagger

1. **Container Initialization**
   ```bash
   # Dagger starts with node:20-slim image
   docker pull node:20-slim
   ```

2. **Input File Preparation**
   ```bash
   # Input markdown is written to /app/input.md in container
   echo "# Hello World\nThis is **bold** text." > /app/input.md
   ```

3. **Command Execution**
   ```bash
   # Command runs inside container
   cd /app && npx markdown-it@14.0.0 input.md
   ```

4. **Output Capture**
   ```bash
   # HTML output is captured and returned
   <h1>Hello World</h1>
   <p>This is <strong>bold</strong> text.</p>
   ```

### Comparison: Direct vs Dagger Execution

| Aspect | Direct Execution | Dagger Execution |
|--------|------------------|------------------|
| **Security** | Runs on host system | Isolated container |
| **Dependencies** | Must be installed locally | Included in container |
| **Reproducibility** | Varies by environment | Consistent everywhere |
| **Performance** | Faster startup | Cached layers improve subsequent runs |
| **Resource Control** | Limited | Full control over memory/CPU |
| **Network Access** | Full host access | Configurable isolation |

## Advanced Features

### Custom Base Images

Configure different base images for different tool types:

```bash
# For Python tools
enact config set daggerOptions.baseImage python:3.11-slim

# For Node.js tools  
enact config set daggerOptions.baseImage node:20-alpine

# For system tools
enact config set daggerOptions.baseImage ubuntu:22.04
```

### Resource Limits

Prevent tools from consuming excessive resources:

```bash
# Limit memory usage
enact config set daggerOptions.maxMemory 1Gi

# Limit CPU usage
enact config set daggerOptions.maxCPU 0.5
```

### File Handling

Dagger execution automatically handles different file types:

- **Text files**: Automatically detected and mounted
- **JSON/YAML**: Parsed and mounted with appropriate extensions
- **Binary data**: Handled via data URLs
- **Large files**: Efficiently streamed into containers

## Troubleshooting

### Common Issues

1. **Dagger not installed**
   ```
   Error: Dagger client not initialized
   ```
   **Solution**: Install Dagger using the installation instructions above.

2. **Permission errors**
   ```
   Error: Permission denied accessing Dagger
   ```
   **Solution**: Ensure your user has Docker permissions:
   ```bash
   sudo usermod -aG docker $USER
   newgrp docker
   ```

3. **Network connectivity issues**
   ```
   Error: Cannot pull base image
   ```
   **Solution**: Check internet connectivity and Docker daemon status:
   ```bash
   docker ps
   dagger version
   ```

4. **Memory/resource limits**
   ```
   Error: Container killed due to memory limit
   ```
   **Solution**: Increase memory limits:
   ```bash
   enact config set daggerOptions.maxMemory 4Gi
   ```

### Debugging

Enable verbose logging to see Dagger operations:

```bash
# Enable verbose output
enact exec my-tool --verbose --input data.json

# Check Dagger version and status
dagger version
```

### Performance Optimization

1. **Use smaller base images**:
   ```bash
   enact config set daggerOptions.baseImage node:20-alpine
   ```

2. **Enable caching**:
   ```bash
   # Dagger automatically caches layers
   # Repeated executions will be faster
   ```

3. **Parallel execution**:
   ```bash
   # Run multiple tools simultaneously
   enact exec tool1 --input data1.json &
   enact exec tool2 --input data2.json &
   wait
   ```

## Migration Guide

### From Direct to Dagger Execution

1. **Backup current configuration**:
   ```bash
   enact config list > backup-config.json
   ```

2. **Install Dagger**:
   ```bash
   curl -L https://dl.dagger.io/dagger/install.sh | sh
   ```

3. **Configure Enact for Dagger**:
   ```bash
   enact config set executionProvider dagger
   ```

4. **Test with a simple tool**:
   ```bash
   enact exec echo-tool --input "Hello Dagger!"
   ```

5. **Gradually migrate tools**:
   - Start with simple, stateless tools
   - Test tools that require specific dependencies
   - Configure custom base images as needed

### Rollback to Direct Execution

If you need to rollback:

```bash
enact config set executionProvider direct
```

## Best Practices

### Security

1. **Disable network access for sensitive tools**:
   ```bash
   enact config set daggerOptions.enableNetwork false
   ```

2. **Use minimal base images**:
   ```bash
   enact config set daggerOptions.baseImage alpine:latest
   ```

3. **Set resource limits**:
   ```bash
   enact config set daggerOptions.maxMemory 512Mi
   enact config set daggerOptions.maxCPU 0.5
   ```

### Performance

1. **Choose appropriate base images**:
   - Use `alpine` variants for smaller images
   - Use official language images for better compatibility
   - Use `slim` variants for a balance of size and features

2. **Leverage caching**:
   - Keep base images consistent
   - Install dependencies in a cacheable way
   - Use multi-stage builds for complex tools

### Development

1. **Test locally first**:
   ```bash
   enact config set executionProvider dagger
   enact exec your-tool --dry --verbose
   ```

2. **Use consistent environments**:
   - Pin specific image versions
   - Document required dependencies
   - Test across different platforms

3. **Monitor resource usage**:
   ```bash
   # Monitor during execution
   docker stats
   ```

## Contributing

The Dagger execution provider is part of the Enact CLI core. To contribute:

1. **File location**: `src/core/DaggerExecutionProvider.ts`
2. **Tests**: `tests/dagger-execution.test.ts`
3. **Documentation**: This file

### Adding New Features

To add new Dagger capabilities:

1. Extend the `DaggerExecutionOptions` interface
2. Update the `DaggerExecutionProvider` class
3. Add configuration options to `config.ts`
4. Update this documentation

## Future Roadmap

- **Multi-architecture support**: ARM64 and x86_64 containers
- **GPU acceleration**: Support for GPU-enabled containers
- **Custom registries**: Private container registry support
- **Workflow orchestration**: Multi-step tool execution
- **Cost monitoring**: Track resource usage and costs
- **Integration**: Kubernetes and cloud-native execution

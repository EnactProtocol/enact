# 🐳 Dagger Integration Quick Start

This guide shows you how to use Dagger with Enact CLI for containerized tool execution.

## What is Dagger Integration?

Dagger integration allows Enact tools to run in isolated containers instead of directly on your host system. This provides:

- **🔒 Enhanced Security**: Tools can't access your host system
- **📦 Reproducibility**: Same execution environment everywhere
- **🚀 Performance**: Intelligent caching speeds up repeated runs
- **🛠️ Easy Dependencies**: No need to install tool dependencies locally

## Quick Setup

### 1. Install Dagger

```bash
# macOS/Linux
curl -L https://dl.dagger.io/dagger/install.sh | sh

# macOS with Homebrew
brew install dagger/tap/dagger

# Verify installation
dagger version
```

### 2. Configure Enact for Dagger

```bash
# Interactive setup (recommended)
enact config setup

# Or manual setup
enact config set executionProvider dagger
enact config set daggerOptions.baseImage node:20-slim
```

### 3. Test with Example Tool

```bash
# Run the example markdown converter
enact exec examples/markdown-to-html --content "# Hello Dagger!"
```

## Example: Markdown to HTML Conversion

Let's see Dagger in action with a practical example:

### The Tool Definition

```yaml
# examples/markdown-to-html.yaml
name: "examples/markdown-to-html"
description: "Convert Markdown to HTML using containerized execution"
command: "npx markdown-it@14.0.0 /app/input.md"
timeout: "30s"

inputSchema:
  type: object
  properties:
    content:
      type: string
      description: "Markdown content to convert"
  required: ["content"]
```

### Execution

```bash
# Execute with Dagger
enact exec examples/markdown-to-html --content "# My Document

This is **bold** and this is *italic*.

## Features

- Clean HTML output
- No local dependencies
- Secure container execution"
```

### What Happens Behind the Scenes

1. **Container Creation**: Dagger creates a `node:20-slim` container
2. **File Preparation**: Your markdown content is written to `/app/input.md`
3. **Dependency Installation**: `npx` downloads and runs `markdown-it@14.0.0`
4. **Command Execution**: The conversion happens in the isolated container
5. **Output Capture**: HTML result is returned to your terminal

## Comparison: Direct vs Dagger Execution

| Feature | Direct Execution | Dagger Execution |
|---------|------------------|------------------|
| **Security** | Runs on host | Isolated container |
| **Dependencies** | Must install locally | Included in container |
| **Reproducibility** | Environment dependent | Consistent everywhere |
| **Setup** | Install each tool's deps | Just install Dagger |
| **Performance** | Fast startup | Cached layers speed up reruns |

## Advanced Configuration

### Custom Base Images

```bash
# For Python tools
enact config set daggerOptions.baseImage python:3.11-slim

# For system tools
enact config set daggerOptions.baseImage ubuntu:22.04

# For minimal tools
enact config set daggerOptions.baseImage alpine:latest
```

### Resource Limits

```bash
# Limit memory usage
enact config set daggerOptions.maxMemory 1Gi

# Limit CPU usage
enact config set daggerOptions.maxCPU 0.5
```

### Security Settings

```bash
# Disable network access for sensitive operations
enact config set daggerOptions.enableNetwork false

# Disable host filesystem access (default)
enact config set daggerOptions.enableHostFS false
```

## Common Use Cases

### 1. **Data Processing**
```bash
# Process CSV files with Python tools
enact config set daggerOptions.baseImage python:3.11-slim
enact exec data-processor --input data.csv
```

### 2. **Web Scraping**
```bash
# Scrape websites with Node.js tools
enact config set daggerOptions.baseImage node:18-alpine
enact exec web-scraper --url https://example.com
```

### 3. **Document Conversion**
```bash
# Convert documents without installing converters
enact exec pdf-converter --input document.md --output document.pdf
```

### 4. **Code Analysis**
```bash
# Analyze code without installing language tools
enact exec code-analyzer --path ./src --language typescript
```

## Troubleshooting

### Issue: "Dagger client not initialized"
**Solution**: Install Dagger first
```bash
curl -L https://dl.dagger.io/dagger/install.sh | sh
```

### Issue: "Permission denied"
**Solution**: Add your user to the docker group
```bash
sudo usermod -aG docker $USER
newgrp docker
```

### Issue: "Container killed due to memory limit"
**Solution**: Increase memory limit
```bash
enact config set daggerOptions.maxMemory 2Gi
```

## Migration from Direct Execution

1. **Backup current config**:
   ```bash
   enact config list > backup-config.json
   ```

2. **Install Dagger**:
   ```bash
   curl -L https://dl.dagger.io/dagger/install.sh | sh
   ```

3. **Switch to Dagger**:
   ```bash
   enact config set executionProvider dagger
   ```

4. **Test with simple tools first**:
   ```bash
   enact exec simple-tool --test-param value
   ```

## Best Practices

1. **Choose appropriate base images**:
   - Use `alpine` variants for smaller, faster containers
   - Use official language images for better compatibility
   - Use `slim` variants for a balance of size and features

2. **Set resource limits**:
   - Prevent runaway processes with memory limits
   - Use CPU limits for shared environments

3. **Disable network when not needed**:
   - Enhance security for file processing tools
   - Prevent data exfiltration

4. **Test tools in different environments**:
   - Verify tools work in containers
   - Test with different base images

## Next Steps

- Read the full [Dagger Integration Guide](DAGGER_INTEGRATION.md)
- Explore the [example tools](examples/)
- Check out [Dagger's documentation](https://docs.dagger.io)
- Join the [Enact community](https://enact.tools/community)

---

**💡 Pro Tip**: Start with `enact config setup` for an interactive configuration experience that guides you through all the options!

# Enact CLI Examples

This directory contains example Enact tool definitions that demonstrate various features and capabilities of the Enact CLI system.

## Available Examples

### 1. `basic-test.yaml` - Simple Greeting Tool
A minimal example that demonstrates:
- Basic parameter substitution
- Simple string output
- Input validation with defaults

**Usage:**
```bash
# CLI execution
enact exec ./examples/basic-test.yaml --input='{"name": "Alice", "message": "Hello!"}' --skip-verification

# Direct parameters
enact exec ./examples/basic-test.yaml name=Alice message="Hello!" --skip-verification
```

### 2. `hello-world.yaml` - Classic Hello World
A traditional Hello World example showing:
- Tool metadata (tags, version, license)
- Input schema with defaults
- Output schema definition
- Example usage documentation

**Usage:**
```bash
enact exec ./examples/hello-world.yaml --input='{"name": "World"}' --skip-verification
```

### 3. `enhanced-hello.yaml` - Advanced Features
Demonstrates advanced capabilities:
- Multi-line command execution
- Environment variable usage
- JSON output generation
- Multiple parameter types (string, integer)
- Resource requirements

**Usage:**
```bash
# Set environment variable
export ENVIRONMENT=production

# Execute with custom parameters
enact exec ./examples/enhanced-hello.yaml \
  --input='{"name": "Demo User", "message": "Advanced example!", "count": 42}' \
  --skip-verification
```

### 4. `nodejs-calculator.yaml` - JavaScript Execution
Shows JavaScript/Node.js integration:
- Dynamic script generation
- Error handling
- Mathematical operations
- Complex output validation

**Usage:**
```bash
# Basic addition
enact exec ./examples/nodejs-calculator.yaml \
  --input='{"operation": "add", "a": 15, "b": 25}' \
  --skip-verification

# Division example
enact exec ./examples/nodejs-calculator.yaml \
  --input='{"operation": "divide", "a": 100, "b": 4}' \
  --skip-verification
```

### 5. `simple-hello.yaml` - JSON Output
Focused on JSON output generation:
- Structured JSON response
- Timestamp generation
- Simple API-like behavior

## Tool Definition Structure

Each Enact tool follows this YAML structure:

```yaml
name: namespace/tool-name
description: Brief description of what the tool does
version: 1.0.0
enact: 1.0.0

# The command to execute (supports template substitution)
command: echo "Hello, ${name}!"

# Metadata
tags:
  - example
  - category

timeout: 30s

# Input parameters schema
inputSchema:
  type: object
  properties:
    name:
      type: string
      description: Parameter description
      default: Default value
  required:
    - name

# Expected output format
outputSchema:
  type: string
  description: Output description

# Environment variables (optional)
env:
  VAR_NAME:
    description: Variable description
    required: false
    default: default_value

# Usage examples
examples:
  - description: Example usage
    input:
      name: Example
    output: "Expected output"

# Safety annotations
annotations:
  readOnlyHint: true
  idempotentHint: true
  networkAccessHint: false
  destructiveHint: false

# Author information
authors:
  - name: Author Name
    email: author@example.com

license: MIT
```

## Testing Examples

### CLI Testing
```bash
# Test all examples
./complete-demo.sh

# Test specific example
enact exec ./examples/basic-test.yaml --input='{"name": "Test"}' --skip-verification
```

### MCP Testing
```bash
# Start MCP server
npm run start:mcp

# Or run the demo
node demo-mcp-execution-flow.mjs
```

### Validation Testing
```bash
# Dry run to see command substitution
enact exec ./examples/basic-test.yaml --input='{"name": "Test"}' --dry --skip-verification

# Verbose output for debugging
enact exec ./examples/basic-test.yaml --input='{"name": "Test"}' --verbose --skip-verification
```

## Security Notes

⚠️ **Important**: These examples use `--skip-verification` to bypass signature verification for demonstration purposes. In production:

1. **Never skip verification** unless you absolutely trust the tool source
2. **Use verification policies**: `--verify-policy enterprise` or `--verify-policy paranoid`
3. **Sign your tools** before distribution
4. **Validate environment variables** and inputs

```bash
# Production-safe execution (with proper signatures)
enact exec trusted-tool-name --verify-policy enterprise
```

## Advanced Features Demonstrated

### Template Substitution
```yaml
command: echo "Hello ${name}! Count: ${count}"
```
- Variables are safely escaped to prevent shell injection
- Supports complex variable expansion
- Validates required parameters

### Environment Variables
```yaml
env:
  API_KEY:
    description: Your API key
    required: true
    source: env
```
- Supports package-scoped and project-scoped variables
- Encrypted storage for sensitive values
- Web interface for management

### Multiple Output Formats
- Plain text strings
- Structured JSON objects
- File outputs (future feature)
- Streaming data (future feature)

## Creating Your Own Tools

1. **Start with a simple example**:
   ```bash
   cp examples/basic-test.yaml my-tool.yaml
   ```

2. **Edit the tool definition**:
   - Update name, description, and command
   - Define input/output schemas
   - Add examples and metadata

3. **Test locally**:
   ```bash
   enact exec ./my-tool.yaml --input='{}' --skip-verification
   ```

4. **Sign and publish** (when ready):
   ```bash
   # Sign the tool (requires setup)
   enact sign ./my-tool.yaml

   # Publish to registry
   enact publish ./my-tool.yaml
   ```

## Best Practices

1. **Keep tools focused**: One tool, one job
2. **Validate inputs**: Use comprehensive input schemas
3. **Handle errors gracefully**: Provide meaningful error messages
4. **Document thoroughly**: Include examples and clear descriptions
5. **Test extensively**: Test edge cases and error conditions
6. **Follow security guidelines**: Never execute untrusted code

## Getting Help

- **CLI Help**: `enact exec --help`
- **MCP Documentation**: See `MCP_USAGE.md`
- **Execution Flow**: See `COMPLETE_EXECUTION_FLOW.md`
- **Security Guide**: See security documentation

---

These examples provide a foundation for understanding and building Enact tools. Start with the basic examples and gradually explore more advanced features as you become comfortable with the system.

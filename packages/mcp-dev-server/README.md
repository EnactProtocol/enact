# Enact MCP Dev Server

A specialized MCP server for Enact tool development workflow. This server provides AI models with comprehensive tools for creating, testing, validating, signing, and publishing Enact tools.

## Features

### Complete Development Workflow

1. **📝 init-tool** - Create new Enact tools with templates
2. **🔍 validate-tool** - Validate tool definitions with comprehensive checks  
3. **🧪 test-tool** - Test tools with inputs and examples
4. **✍️ sign-tool** - Add cryptographic signatures
5. **🚀 publish-tool** - Publish tools to the registry
6. **📊 dev-status** - Overview of development workflow status

### Tool Templates

- **Minimal** - Basic 3-field tool definition
- **Basic** - Standard tool with timeout, tags, and license
- **Advanced** - Full-featured with input/output schemas and annotations
- **Containerized** - Docker-based tool with container isolation

### Validation Features

- Required field validation
- YAML syntax checking
- Security pattern detection
- Best practice recommendations
- SPDX license validation
- Semantic versioning checks
- Dependency analysis

### Testing Capabilities

- Manual input testing
- Predefined example execution
- Dry run mode
- Verbose output options
- Test result summaries
- Expected vs actual output comparison

## Usage

### Starting the Server

```bash
cd packages/mcp-dev-server
npm run dev
```

### Available Tools

#### 1. Initialize New Tool

```javascript
// Create a basic tool
{
  "name": "init-tool",
  "arguments": {
    "name": "my-org/text/processor",
    "description": "Processes text files",
    "command": "cat ${file} | wc -l",
    "template": "basic"
  }
}
```

#### 2. Validate Tool

```javascript
// Validate with strict checking
{
  "name": "validate-tool", 
  "arguments": {
    "toolPath": "./my-tool.yaml",
    "strict": true,
    "checkDependencies": true
  }
}
```

#### 3. Test Tool

```javascript
// Test with custom inputs
{
  "name": "test-tool",
  "arguments": {
    "toolPath": "./my-tool.yaml",
    "inputs": { "message": "Hello World" },
    "verbose": true
  }
}
```

#### 4. Sign Tool

```javascript
// Add signature
{
  "name": "sign-tool",
  "arguments": {
    "toolPath": "./my-tool.yaml",
    "signerName": "alice@company.com",
    "role": "author"
  }
}
```

#### 5. Publish Tool

```javascript
// Publish to registry
{
  "name": "publish-tool",
  "arguments": {
    "toolPath": "./my-tool.yaml",
    "dryRun": false,
    "validateFirst": true
  }
}
```

#### 6. Development Status

```javascript
// Check workflow status
{
  "name": "dev-status",
  "arguments": {
    "directory": "./tools",
    "detailed": true
  }
}
```

## Tool Templates

### Minimal Template
- 3 required fields only
- Quick prototyping
- Basic functionality

### Basic Template
- Standard production tool
- Includes timeout, tags, license
- Good for most use cases

### Advanced Template  
- Input/output schemas
- Behavior annotations
- Examples for testing
- Production-ready

### Containerized Template
- Docker-based execution
- Environment isolation
- Reproducible builds
- Enterprise-ready

## Validation Checks

### Required Fields
- `name` - Tool identifier
- `description` - Human-readable description  
- `command` - Execution command

### Recommended Fields
- `version` - Semantic version
- `license` - SPDX license identifier
- `tags` - Categorization tags
- `timeout` - Execution timeout

### Security Checks
- Dangerous command detection
- Version pinning recommendations
- Container image suggestions
- Environment variable validation

### Best Practices
- Hierarchical naming (org/category/tool)
- Semantic versioning
- SPDX license format
- Input/output schemas
- Behavior annotations

## Development Workflow

```
📝 init-tool
    ↓
🔍 validate-tool
    ↓
🧪 test-tool
    ↓
✍️ sign-tool (optional)
    ↓
🚀 publish-tool
```

## Integration

This server is designed to work alongside the main Enact MCP server:

- **Main Server** - Tool execution, search, environment management
- **Dev Server** - Tool creation, validation, testing, publishing

Both servers can run simultaneously, providing complementary functionality for AI models working with Enact tools.

## Examples

### Creating a Text Counter Tool

```javascript
// 1. Initialize
{
  "name": "init-tool",
  "arguments": {
    "name": "demo/text/counter",
    "description": "Counts words, lines, and characters in text",
    "template": "advanced"
  }
}

// 2. Validate
{
  "name": "validate-tool",
  "arguments": {
    "toolPath": "./demo-text-counter.yaml",
    "strict": true
  }
}

// 3. Test
{
  "name": "test-tool", 
  "arguments": {
    "toolPath": "./demo-text-counter.yaml",
    "inputs": { "text": "Hello world" },
    "useExamples": true
  }
}

// 4. Sign and Publish
{
  "name": "sign-tool",
  "arguments": {
    "toolPath": "./demo-text-counter.yaml",
    "role": "author"
  }
}

{
  "name": "publish-tool",
  "arguments": {
    "toolPath": "./demo-text-counter.yaml"
  }
}
```

## Configuration

Environment variables:
- `ENACT_API_URL` - Registry API endpoint
- `ENACT_AUTH_TOKEN` - Authentication token
- `ENACT_EXECUTION_PROVIDER` - Execution provider (dagger/direct)

## Dependencies

- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `@enactprotocol/shared` - Enact core functionality  
- `yaml` - YAML parsing and generation
- `fs-extra` - File system utilities
- `zod` - Schema validation

## License

MIT License - see LICENSE file for details.
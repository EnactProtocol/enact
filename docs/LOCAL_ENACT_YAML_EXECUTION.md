# Local Enact YAML Tool Execution

This document describes the new MCP functions that enable loading and executing local Enact YAML tool files directly through the MCP server.

## Overview

The Enact MCP Server now includes three powerful functions for working with local Enact YAML tool files:

1. **`execute-local-enact-tool`** - Load and execute an Enact tool from a local YAML file
2. **`list-local-enact-tools`** - List Enact YAML tool files in a directory
3. **`validate-local-enact-tool`** - Validate the structure and syntax of a local Enact YAML tool file

## Functions

### execute-local-enact-tool

Load and execute an Enact tool from a local YAML file.

**Parameters:**
- `filePath` (string, required): Path to the local YAML tool file
- `inputs` (object, optional): Input parameters for the tool
- `timeout` (string, optional): Execution timeout
- `verifyPolicy` (enum, optional): Verification policy ('permissive', 'enterprise', 'paranoid')
- `skipVerification` (boolean, optional): Skip signature verification (useful for local development)
- `force` (boolean, optional): Force execution
- `dryRun` (boolean, optional): Dry run mode
- `verbose` (boolean, optional): Verbose output
- `async` (boolean, optional): Run in background for long operations

**Examples:**

```javascript
// Execute a basic tool
{
  "filePath": "examples/basic-test.yaml",
  "inputs": {
    "name": "Developer",
    "message": "Hello from local YAML!"
  },
  "skipVerification": true
}

// Execute with async mode for long-running tools
{
  "filePath": "tools/long-running-task.yaml",
  "inputs": {},
  "async": true,
  "timeout": "300s",
  "skipVerification": true
}

// Execute with custom verification policy
{
  "filePath": "signed-tools/production-tool.yaml",
  "inputs": {},
  "verifyPolicy": "enterprise"
}
```

### list-local-enact-tools

List Enact YAML tool files in a directory.

**Parameters:**
- `directory` (string, optional): Directory to search (default: current directory)
- `recursive` (boolean, default: false): Search recursively in subdirectories
- `pattern` (string, optional): File pattern to match (default: *.yaml, *.yml)

**Examples:**

```javascript
// List tools in examples directory
{
  "directory": "examples"
}

// Recursive search for all YAML files
{
  "directory": ".",
  "recursive": true,
  "pattern": "*.yaml"
}

// Search specific pattern
{
  "directory": "tools",
  "recursive": false,
  "pattern": "*-tool.yaml"
}
```

### validate-local-enact-tool

Validate the structure and syntax of a local Enact YAML tool file.

**Parameters:**
- `filePath` (string, required): Path to the local YAML tool file to validate

**Example:**
```javascript
{
  "filePath": "examples/basic-test.yaml"
}
```

## YAML Tool File Structure

Local Enact YAML tool files should follow the standard Enact tool format:

```yaml
name: my-tool
description: Description of what the tool does
version: 1.0.0
enact: 1.0.0

command: 'echo "Hello ${name}!"'

inputSchema:
  type: object
  properties:
    name:
      type: string
      description: Name to greet
      default: World
  required:
    - name

outputSchema:
  type: string
  description: Greeting message

tags:
  - example
  - greeting

timeout: 30s

# Optional environment variables
env:
  CUSTOM_VAR:
    description: A custom environment variable
    required: false
    default: default_value

# Optional examples
examples:
  - description: Basic usage
    input:
      name: Alice
    output: "Hello Alice!"
```

## Features

### Development Mode
For local development, you can skip signature verification:

```javascript
{
  "filePath": "dev-tools/my-tool.yaml",
  "inputs": {},
  "skipVerification": true  // Skip signatures for development
}
```

### Production Mode
For production use, ensure tools are properly signed:

```javascript
{
  "filePath": "production-tools/signed-tool.yaml",
  "inputs": {},
  "verifyPolicy": "enterprise"  // Strict verification
}
```

### Async Execution
Long-running tools can be executed in the background:

```javascript
{
  "filePath": "tools/build-tool.yaml",
  "inputs": {},
  "async": true,
  "timeout": "600s"
}
```

Use the operation ID returned to check status with `check-operation-status`.

### Directory Discovery
Discover all Enact tools in a project:

```javascript
{
  "directory": ".",
  "recursive": true
}
```

## Error Handling

The system provides comprehensive error handling:

- **File not found**: Clear message when YAML file doesn't exist
- **Invalid YAML**: Detailed parsing error messages
- **Missing required fields**: Validation errors for tool structure
- **Environment variables**: Validation of required environment variables
- **Signature verification**: Security policy enforcement

## Integration Examples

### Claude Desktop Configuration

```json
{
  "mcpServers": {
    "enact": {
      "command": "bun",
      "args": ["run", "/path/to/enact-cli/src/mcp-server.ts"]
    }
  }
}
```

### Development Workflow

1. **Discover tools**: "List all Enact tools in my project"
2. **Validate**: "Validate the structure of my-tool.yaml"
3. **Test**: "Execute examples/basic-test.yaml with name=Alice"
4. **Deploy**: "Execute production-tools/deploy.yaml with environment=staging"

### Example Conversations with Claude

> **User**: "Can you list all the Enact tools in my examples directory?"
> 
> **Claude**: Uses `list-local-enact-tools` with directory="examples"

> **User**: "Execute the basic-test.yaml tool with name='Developer' and message='Testing local execution'"
> 
> **Claude**: Uses `execute-local-enact-tool` with the specified inputs and `skipVerification: true`

> **User**: "Validate my new tool file before I use it"
> 
> **Claude**: Uses `validate-local-enact-tool` to check the file structure

## Security Considerations

1. **Signature Verification**: By default, tools require valid signatures
2. **Development Override**: Use `skipVerification: true` for local development only
3. **Verification Policies**: Choose appropriate policy level (permissive/enterprise/paranoid)
4. **Environment Validation**: Required environment variables are validated before execution
5. **Timeout Protection**: All executions have configurable timeouts

## Testing

Test the functionality with the provided scripts:

```bash
# Test local Enact YAML execution
npm run test:mcp-enact-local

# Interactive demo
npm run demo:mcp-enact-local
```

## Benefits

✅ **Direct Execution**: Execute local YAML tools without CLI overhead  
✅ **Development Friendly**: Skip verification for local development  
✅ **Production Ready**: Full signature verification for production use  
✅ **Discovery**: Find and list tools in any directory structure  
✅ **Validation**: Validate tool structure before execution  
✅ **Async Support**: Background execution for long-running operations  
✅ **Error Handling**: Comprehensive error messages and validation  
✅ **Security**: Configurable verification policies and audit logging  

This feature bridges the gap between local tool development and AI-assisted execution, making it seamless to work with Enact tools in development environments while maintaining security for production use.

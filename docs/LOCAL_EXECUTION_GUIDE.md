# MCP Local Tool Execution

This document describes the local tool execution capabilities added to the Enact MCP Server.

## Overview

The Enact MCP Server now includes three powerful functions for executing local tools and scripts directly from the file system:

1. **`execute-local-tool`** - Execute any local command, script, or executable
2. **`list-local-tools`** - List available tools in the system PATH
3. **`check-local-tool`** - Check if a specific tool exists and get its information

## Functions

### execute-local-tool

Execute a local tool/script/executable on the file system.

**Parameters:**
- `command` (string, required): The command or tool to execute
- `args` (array of strings, optional): Arguments to pass to the command
- `workingDirectory` (string, optional): Working directory to execute the command in
- `timeout` (number, default: 30): Timeout in seconds
- `shell` (boolean, optional): Execute command through shell (allows pipes, redirects, etc.)
- `env` (object, optional): Environment variables to set for the command
- `async` (boolean, optional): Run in background for long operations

**Examples:**

```javascript
// Simple command execution
{
  "command": "ls",
  "args": ["-la", "/tmp"]
}

// Shell command with pipes
{
  "command": "find . -name '*.js' | head -10",
  "shell": true
}

// Custom environment variables
{
  "command": "echo",
  "args": ["Hello $NAME"],
  "shell": true,
  "env": {
    "NAME": "World"
  }
}

// Background execution for long-running tasks
{
  "command": "npm",
  "args": ["install"],
  "async": true,
  "timeout": 300
}
```

### list-local-tools

List available tools/executables in the system PATH.

**Parameters:**
- `filter` (string, optional): Filter tools by name pattern
- `limit` (number, default: 50): Maximum number of tools to return

**Example:**
```javascript
{
  "filter": "git",
  "limit": 10
}
```

### check-local-tool

Check if a local tool/executable exists and get its information.

**Parameters:**
- `tool` (string, required): Name of the tool to check

**Example:**
```javascript
{
  "tool": "git"
}
```

## Features

### Synchronous Execution
By default, commands are executed synchronously, blocking until completion:

```javascript
{
  "command": "echo",
  "args": ["Hello World"]
}
```

### Asynchronous Execution
For long-running operations, use async mode:

```javascript
{
  "command": "npm",
  "args": ["test"],
  "async": true
}
```

This returns an operation ID that you can use with `check-operation-status` to monitor progress.

### Shell Features
Enable shell mode for advanced features like pipes, redirects, and variable expansion:

```javascript
{
  "command": "ps aux | grep node | wc -l",
  "shell": true
}
```

### Custom Working Directory
Execute commands in a specific directory:

```javascript
{
  "command": "git",
  "args": ["status"],
  "workingDirectory": "/path/to/repo"
}
```

### Environment Variables
Inject custom environment variables:

```javascript
{
  "command": "env",
  "env": {
    "CUSTOM_VAR": "custom_value",
    "PATH": "/custom/bin:$PATH"
  },
  "shell": true
}
```

### Timeout Control
Set custom timeouts for commands:

```javascript
{
  "command": "long-running-task",
  "timeout": 300  // 5 minutes
}
```

## Security Considerations

1. **Command Validation**: Commands are validated to prevent malicious execution
2. **Working Directory Validation**: Directory paths are checked for existence
3. **Timeout Protection**: All commands have timeout limits to prevent hanging
4. **Error Handling**: Comprehensive error handling for missing commands, permissions, etc.

## Error Handling

The system provides detailed error messages for common issues:

- **Command not found**: Clear message when executable doesn't exist
- **Permission denied**: Helpful guidance for permission issues
- **Timeout**: Informative timeout messages with suggestions
- **Working directory issues**: Clear validation of directory paths

## Background Operations

When using async mode, operations are tracked and can be monitored:

1. Start an async operation with `execute-local-tool` and `async: true`
2. Receive an operation ID
3. Use `check-operation-status` with the operation ID to monitor progress
4. Use `list-operations` to see all background operations

## Testing

You can test the local execution features using the provided test scripts:

```bash
# Quick test
npm run test:mcp-local

# Comprehensive test
npm run test:mcp-local-full

# Interactive demo
npm run demo:mcp-local
```

## Integration with Claude Desktop

To use these features with Claude Desktop, add the Enact MCP server to your configuration:

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

Then you can ask Claude to execute local tools:

> "Can you list the files in my current directory?"
> "Please check if git is installed on my system"
> "Run npm test in the background and check the status"

## Examples

### Development Workflow
```javascript
// Check git status
{
  "name": "execute-local-tool",
  "arguments": {
    "command": "git",
    "args": ["status", "--short"]
  }
}

// Run tests in background
{
  "name": "execute-local-tool", 
  "arguments": {
    "command": "npm",
    "args": ["test"],
    "async": true
  }
}

// Build project
{
  "name": "execute-local-tool",
  "arguments": {
    "command": "npm",
    "args": ["run", "build"],
    "workingDirectory": "/path/to/project"
  }
}
```

### System Administration
```javascript
// Check disk usage
{
  "name": "execute-local-tool",
  "arguments": {
    "command": "df",
    "args": ["-h"]
  }
}

// Find large files
{
  "name": "execute-local-tool",
  "arguments": {
    "command": "find / -type f -size +100M 2>/dev/null | head -10",
    "shell": true
  }
}
```

### Data Processing
```javascript
// Process CSV data
{
  "name": "execute-local-tool",
  "arguments": {
    "command": "cat data.csv | cut -d',' -f1,3 | head -20",
    "shell": true
  }
}

// Convert files
{
  "name": "execute-local-tool", 
  "arguments": {
    "command": "pandoc",
    "args": ["input.md", "-o", "output.pdf"]
  }
}
```

This local execution capability greatly extends the power of the Enact MCP server, allowing seamless integration between AI conversations and local system operations.

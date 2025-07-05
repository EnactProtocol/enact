# Enact CLI MCP (Model Context Protocol) Execution Flow

This document provides a detailed walkthrough of how an MCP client (e.g., Claude Desktop, Continue.dev, or a custom client) calls the Enact MCP server to execute a tool by name, and how this request is routed through the Enact core and Dagger provider.

## Overview

The Enact CLI supports two execution models:
1. **CLI Execution**: Direct command-line tool execution via `enact exec tool-name`
2. **MCP Execution**: Tool execution via Model Context Protocol for AI assistant integration

## MCP Server Architecture

```
MCP Client (Claude Desktop, etc.)
        ↓ (JSON-RPC over stdio)
Enact MCP Server (src/mcp-server.ts)
        ↓ (Direct integration)
EnactCore (src/core/EnactCore.ts)
        ↓ (Provider delegation)
DaggerExecutionProvider (src/core/DaggerExecutionProvider.ts)
        ↓ (Container execution)
Tool Execution in Isolated Container
```

## Step-by-Step MCP Execution Flow

### 1. MCP Server Startup

**Entry Point**: `src/mcp-server.ts`

```typescript
// Server initialization
const enactCore = new EnactCore({
  apiUrl: process.env.ENACT_API_URL || 'https://enact.tools',
  supabaseUrl: process.env.ENACT_SUPABASE_URL || 'https://xjnhhxwxovjifdxdwzih.supabase.co',
  executionProvider: 'direct',  // Uses DirectExecutionProvider by default
  verificationPolicy: 'permissive',
  authToken: process.env.ENACT_AUTH_TOKEN,
  defaultTimeout: '120s'
});

const server = new McpServer({
  name: "enact-mcp-server",
  version: "3.0.0-direct",
});
```

**How it starts**:
- Can be started directly: `enact-mcp-server` (from package.json bin)
- Or via npm script: `npm run start:mcp`
- Connects via stdio transport for MCP communication

### 2. MCP Client Configuration

**Claude Desktop Example** (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "enact": {
      "command": "enact-mcp-server",
      "env": {
        "ENACT_AUTH_TOKEN": "your-token-here",
        "ENACT_VERIFY_POLICY": "permissive"
      }
    }
  }
}
```

### 3. Tool Execution Request Flow

#### A. MCP Client Initiates Tool Call

**Example Tool Call from Claude**:
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "execute-tool-by-name-async",
    "arguments": {
      "name": "nodejs-hello-world",
      "inputs": {
        "message": "Hello from MCP!"
      },
      "timeout": "60s",
      "verifyPolicy": "permissive",
      "async": false
    }
  },
  "id": 1
}
```

#### B. MCP Server Receives Request

**Handler**: `server.registerTool("execute-tool-by-name-async", ...)`

```typescript
async (params) => {
  const { name, inputs = {}, timeout, verifyPolicy, skipVerification, force, dryRun, verbose, async = false } = params;
  
  logger.info(`Executing tool ${name} via direct core library`);
  
  // 1. Get tool definition first
  let tool;
  try {
    tool = await enactCore.getToolByName(name);
    if (!tool) {
      return { content: [{ type: "text", text: `❌ Tool not found: ${name}` }], isError: true };
    }
  } catch (error) {
    return { content: [{ type: "text", text: `❌ Tool not found: ${name}` }], isError: true };
  }
  
  // 2. Validate environment variables
  const envValidation = await validateMcpToolEnvironmentVariables(name, tool.env);
  if (!envValidation.valid) {
    return { content: [{ type: "text", text: envValidation.errorMessage }], isError: true };
  }
  
  // 3. Check if long-running operation
  const isLongRunningTool = name.includes('dagger') || name.includes('docker') || name.includes('build') || async;
  
  if (isLongRunningTool) {
    // Start background execution with operation tracking
    const operationId = `${name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    // ... background execution logic
  } else {
    // Execute synchronously
    const result = await enactCore.executeToolByName(name, inputs, {
      timeout: timeout || '30s',
      verifyPolicy,
      skipVerification,
      force,
      dryRun,
      verbose
    });
  }
}
```

#### C. EnactCore Processes Request

**Method**: `enactCore.executeToolByName()`

```typescript
async executeToolByName(name: string, inputs: Record<string, any>, options: ExecutionOptions): Promise<ExecutionResult> {
  logger.info(`🔧 Executing tool: ${name}`);
  
  // 1. Load tool definition
  const tool = await this.getToolByName(name);
  if (!tool) {
    throw new Error(`Tool not found: ${name}`);
  }
  
  // 2. Verify tool signature (if required)
  if (!options.skipVerification) {
    const verification = await this.verifyTool(tool);
    if (!verification.valid && this.config.verificationPolicy !== 'permissive') {
      throw new Error(`Tool signature verification failed: ${verification.reason}`);
    }
  }
  
  // 3. Validate and resolve environment variables
  const { resolved: envVars } = await resolveToolEnvironmentVariables(name, tool.env || {});
  
  // 4. Delegate to execution provider
  return await this.executionProvider.executeDirectly(tool, {
    ...inputs,
    ...envVars
  }, options);
}
```

#### D. Execution Provider Handles Tool

**DaggerExecutionProvider** (if using Dagger) or **DirectExecutionProvider** (default):

```typescript
async executeDirectly(tool: any, inputs: Record<string, any>, options: ExecutionOptions): Promise<ExecutionResult> {
  // 1. Set up execution environment
  const workingDir = await this.createWorkingDirectory();
  
  // 2. Write tool files to working directory
  for (const [filename, content] of Object.entries(tool.files || {})) {
    await writeFile(join(workingDir, filename), content);
  }
  
  // 3. Prepare execution context
  const context = {
    inputs,
    env: process.env,
    workingDir,
    timeout: options.timeout || '30s'
  };
  
  // 4. Execute commands (with shell safety and template substitution)
  for (const command of tool.commands || []) {
    const processedCommand = this.processTemplate(command.run, inputs);
    const result = await this.executeCommand(processedCommand, context);
    
    if (!result.success) {
      return { success: false, error: result.error };
    }
  }
  
  // 5. Collect and return outputs
  const outputs = await this.collectOutputs(tool.outputs || [], workingDir);
  return { success: true, outputs };
}
```

### 4. Background Operations (Async Mode)

For long-running operations, the MCP server supports async execution:

#### A. Background Execution Tracking

```typescript
// Store for tracking long-running operations
const runningOperations = new Map<string, {
  id: string;
  name: string;
  startTime: Date;
  promise: Promise<any>;
  status: 'running' | 'completed' | 'failed';
  result?: any;
  error?: any;
}>();
```

#### B. Async Tool Call Response

```json
{
  "jsonrpc": "2.0",
  "result": {
    "content": [{
      "type": "text",
      "text": "🚀 Started background execution of tool: nodejs-hello-world\n\nOperation ID: nodejs-hello-world-1703123456789-abc123\nStarted: 2023-12-21T10:30:45.123Z\n\n⏳ This operation is running in the background. Use the \"check-operation-status\" tool with operation ID \"nodejs-hello-world-1703123456789-abc123\" to check progress."
    }]
  },
  "id": 1
}
```

#### C. Status Checking

**Tool**: `check-operation-status`

```typescript
async ({ operationId }) => {
  const operation = runningOperations.get(operationId);
  
  switch (operation.status) {
    case 'running':
      return { content: [{ type: "text", text: `⏳ Operation Status: RUNNING\n...` }] };
    case 'completed':
      return { content: [{ type: "text", text: `✅ Operation Status: COMPLETED\n\nResult:\n${safeJsonStringify(operation.result)}` }] };
    case 'failed':
      return { content: [{ type: "text", text: `❌ Operation Status: FAILED\n\nError: ${operation.error.message}` }], isError: true };
  }
}
```

### 5. Environment Variable Management

#### A. Environment Resolution

```typescript
async function validateMcpToolEnvironmentVariables(toolName: string, toolEnv?: Record<string, any>) {
  // 1. Resolve environment variables from Enact configuration
  const { resolved: envVars } = await resolveToolEnvironmentVariables(toolName, toolEnv);
  
  // 2. Validate required environment variables
  const validation = validateRequiredEnvironmentVariables(toolEnv, envVars);
  
  if (!validation.valid) {
    // 3. Generate helpful error message with configuration instructions
    let errorMessage = '❌ Missing required environment variables:\n\n';
    validation.missing.forEach(varName => {
      const config = toolEnv[varName];
      errorMessage += `  • ${varName} - ${config?.description || 'No description'}\n`;
    });
    
    errorMessage += '\n💡 You can set environment variables using:\n';
    errorMessage += '  • enact env set <package> <VAR_NAME> <value>\n';
    errorMessage += '  • enact env set <VAR_NAME> <value> --project\n';
    
    return { valid: false, errorMessage };
  }
  
  return { valid: true };
}
```

#### B. Web Interface Integration

The MCP server can launch a web interface for environment management:

```typescript
server.registerTool("launch-env-manager-server", {
  title: "Launch Environment Manager",
  description: "Start the web interface for managing environment variables",
  inputSchema: { port: z.number().optional() }
}, async ({ port = 0 }) => {
  if (!webServerInstance) {
    webServerInstance = await startEnvManagerServer(port);
    webServerPort = webServerInstance.address()?.port;
    return {
      content: [{
        type: "text",
        text: `🌐 Environment Manager started at http://localhost:${webServerPort}`
      }]
    };
  }
});
```

## Complete Request/Response Example

### Request: Execute a Node.js Tool

**MCP Client → MCP Server**:
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "execute-tool-by-name",
    "arguments": {
      "name": "nodejs-word-count",
      "inputs": {
        "text": "Hello world from MCP execution!",
        "format": "json"
      },
      "timeout": "30s"
    }
  },
  "id": 1
}
```

### Response: Successful Execution

**MCP Server → MCP Client**:
```json
{
  "jsonrpc": "2.0",
  "result": {
    "content": [{
      "type": "text",
      "text": "✅ Successfully executed tool nodejs-word-count\nOutput: {\n  \"success\": true,\n  \"outputs\": {\n    \"wordCount\": 5,\n    \"charCount\": 33,\n    \"lineCount\": 1,\n    \"result\": {\n      \"words\": 5,\n      \"characters\": 33,\n      \"lines\": 1\n    }\n  },\n  \"executionTime\": \"0.125s\",\n  \"tool\": \"nodejs-word-count\"\n}"
    }]
  },
  "id": 1
}
```

## Error Handling

### Environment Variable Missing

```json
{
  "jsonrpc": "2.0",
  "result": {
    "content": [{
      "type": "text",
      "text": "❌ Missing required environment variables:\n\n  • API_KEY [REQUIRED] - Your API key for the service\n  • DATABASE_URL - Database connection string\n\n💡 You can set environment variables using:\n  • enact env set <package> <VAR_NAME> <value>\n  • enact env set <VAR_NAME> <value> --project\n\n🌐 Or use the web interface to configure all missing variables:\n  http://localhost:3000/config?missing=API_KEY,DATABASE_URL&tool=my-tool"
    }],
    "isError": true
  },
  "id": 1
}
```

### Tool Not Found

```json
{
  "jsonrpc": "2.0",
  "result": {
    "content": [{
      "type": "text",
      "text": "❌ Tool not found: non-existent-tool"
    }],
    "isError": true
  },
  "id": 1
}
```

## Available MCP Tools

The Enact MCP server registers the following tools:

1. **`execute-tool-by-name-async`** - Execute tools with background support
2. **`execute-tool-by-name`** - Execute tools synchronously  
3. **`check-operation-status`** - Check background operation status
4. **`list-operations`** - List all background operations
5. **`enact-search-tools`** - Search for available tools
6. **`enact-get-tool-info`** - Get detailed tool information
7. **`enact-verify-tool`** - Verify tool signatures
8. **`launch-env-manager-server`** - Start web interface for environment management
9. **`enact-search-multiple-tools`** - Search for multiple tools with different intents

## Integration Notes

- **Authentication**: Uses `ENACT_AUTH_TOKEN` environment variable
- **Verification**: Supports configurable signature verification policies
- **Timeout Handling**: Different timeouts for sync vs async operations
- **Environment Management**: Integration with Enact's environment variable system
- **Web Interface**: Optional web UI for configuration and monitoring
- **Error Recovery**: Comprehensive error handling with helpful user guidance

This MCP integration allows AI assistants to seamlessly execute Enact tools while maintaining security, proper environment management, and excellent user experience through helpful error messages and async operation support.

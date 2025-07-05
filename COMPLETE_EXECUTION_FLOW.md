# Enact CLI Complete Execution Flow Summary

This document summarizes the complete execution flows for both CLI and MCP (Model Context Protocol) modes of the Enact CLI, demonstrating how tools are executed from different entry points but converge on the same core execution logic.

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐
│   CLI Client    │    │   MCP Client    │
│ (enact exec)    │    │ (Claude, etc.)  │
└─────────┬───────┘    └─────────┬───────┘
          │                      │
          ▼                      ▼
┌─────────────────┐    ┌─────────────────┐
│  CLI Commands   │    │   MCP Server    │
│ (src/commands/) │    │ (src/mcp-server)│
└─────────┬───────┘    └─────────┬───────┘
          │                      │
          └──────────┬───────────┘
                     ▼
            ┌─────────────────┐
            │   EnactCore     │
            │ (src/core/)     │
            └─────────┬───────┘
                      ▼
            ┌─────────────────┐
            │ Execution       │
            │ Provider        │
            │ (Dagger/Direct) │
            └─────────────────┘
```

## Execution Flow Comparison

### CLI Execution Flow

**Entry Point**: `enact exec tool-name --input=value`

1. **CLI Parser** (`src/index.ts`)
   - Parses command line arguments
   - Routes to `handleCoreExecCommand`

2. **Core Command Handler** (`src/commands/core.ts`)
   ```typescript
   export async function handleCoreExecCommand(args: string[], options: CoreExecOptions) {
     const toolName = args[0];
     const core = getConfiguredCore(options);
     
     // Collect parameters from CLI arguments
     const params = collectParametersFromArgs(args.slice(1));
     
     // Execute via core
     const result = await core.executeToolByName(toolName, params, {
       timeout: options.timeout,
       verifyPolicy: options.verifyPolicy,
       skipVerification: options.skipVerification,
       force: options.force,
       dryRun: options.dryRun,
       verbose: options.verbose
     });
   }
   ```

3. **EnactCore** (`src/core/EnactCore.ts`)
   - Loads tool definition
   - Validates signatures
   - Resolves environment variables
   - Delegates to execution provider

4. **Execution Provider** (Dagger or Direct)
   - Sets up execution environment
   - Processes templates with shell safety
   - Executes commands in isolated environment
   - Returns results

### MCP Execution Flow

**Entry Point**: MCP client calls `execute-tool-by-name` tool

1. **MCP Server** (`src/mcp-server.ts`)
   ```typescript
   server.registerTool("execute-tool-by-name", {
     title: "Execute Enact Tool",
     description: "Execute an Enact tool by its name",
     inputSchema: { /* ... */ }
   }, async (params) => {
     const { name, inputs, timeout, verifyPolicy } = params;
     
     // Validate environment variables
     const envValidation = await validateMcpToolEnvironmentVariables(name, tool.env);
     
     // Execute via core (same path as CLI)
     const result = await enactCore.executeToolByName(name, inputs, {
       timeout: timeout || '120s',
       verifyPolicy,
       skipVerification,
       force,
       dryRun,
       verbose
     });
   });
   ```

2. **EnactCore** (Same as CLI)
3. **Execution Provider** (Same as CLI)

## Key Differences

| Aspect | CLI Execution | MCP Execution |
|--------|---------------|---------------|
| **Input** | Command line arguments | JSON-RPC parameters |
| **Authentication** | Local auth tokens/config | Environment variables |
| **Timeouts** | 30s default | 120s default (longer) |
| **Error Handling** | Exit codes + stderr | JSON-RPC error responses |
| **Async Support** | Blocking execution | Background operations |
| **Environment** | User's shell environment | Controlled MCP environment |
| **Output Format** | Human-readable text | Structured JSON responses |

## Shared Core Components

Both execution paths share the same core logic:

### 1. Tool Loading (`EnactCore.getToolByName`)
```typescript
async getToolByName(name: string): Promise<any> {
  // 1. Try local tools first
  const localTool = await this.loadLocalTool(name);
  if (localTool) return localTool;
  
  // 2. Search remote tools
  const tools = await this.apiClient.searchTools({ query: name });
  const exactMatch = tools.find(t => t.name === name);
  
  if (!exactMatch) {
    throw new Error(`Tool not found: ${name}`);
  }
  
  return exactMatch;
}
```

### 2. Environment Resolution (`resolveToolEnvironmentVariables`)
```typescript
async function resolveToolEnvironmentVariables(toolName: string, toolEnv: Record<string, any>) {
  const resolved = {};
  
  for (const [varName, config] of Object.entries(toolEnv)) {
    // Try multiple sources in order:
    // 1. Process environment
    // 2. Enact project config (.env)
    // 3. Enact package config (encrypted storage)
    // 4. Default values
    
    const value = process.env[varName] || 
                  await getProjectEnvVar(varName) ||
                  await getPackageEnvVar(toolName, varName) ||
                  config.default;
    
    if (value) {
      resolved[varName] = value;
    }
  }
  
  return { resolved };
}
```

### 3. Security Verification (`verifyTool`)
```typescript
async verifyTool(tool: any): Promise<{ valid: boolean; reason?: string }> {
  if (!tool.signature) {
    return { valid: false, reason: 'No signature found' };
  }
  
  const publicKey = await this.getPublicKey(tool.author);
  const isValid = await verifySignature(tool.content, tool.signature, publicKey);
  
  return { valid: isValid, reason: isValid ? undefined : 'Invalid signature' };
}
```

### 4. Template Processing (Shell Safety)
```typescript
function processTemplate(template: string, inputs: Record<string, any>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
    const value = inputs[varName.trim()];
    if (value === undefined) {
      throw new Error(`Missing required input: ${varName}`);
    }
    
    // Shell escape the value to prevent injection
    return shellEscape(String(value));
  });
}
```

## Background Operations (MCP Only)

The MCP server supports background execution for long-running operations:

```typescript
// Store for tracking operations
const runningOperations = new Map<string, {
  id: string;
  name: string;
  startTime: Date;
  promise: Promise<any>;
  status: 'running' | 'completed' | 'failed';
  result?: any;
  error?: any;
}>();

// Start background operation
if (isLongRunningTool) {
  const operationId = `${name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const executionPromise = enactCore.executeToolByName(name, inputs, options);
  
  runningOperations.set(operationId, {
    id: operationId,
    name,
    startTime: new Date(),
    promise: executionPromise,
    status: 'running'
  });
  
  // Return immediately with operation ID
  return {
    content: [{
      type: "text",
      text: `🚀 Started background execution: ${operationId}`
    }]
  };
}
```

## Error Handling Strategies

### CLI Error Handling
```typescript
try {
  const result = await core.executeToolByName(toolName, params, options);
  if (!result.success) {
    console.error(`❌ ${result.error?.message}`);
    process.exit(1);
  }
  console.log(`✅ ${JSON.stringify(result.outputs, null, 2)}`);
} catch (error) {
  console.error(`❌ ${error.message}`);
  process.exit(1);
}
```

### MCP Error Handling
```typescript
try {
  const result = await enactCore.executeToolByName(name, inputs, options);
  return {
    content: [{
      type: "text",
      text: `✅ Successfully executed tool ${name}\nOutput: ${safeJsonStringify(result)}`
    }]
  };
} catch (error) {
  return {
    content: [{
      type: "text",
      text: `❌ Error executing tool: ${error.message}`
    }],
    isError: true
  };
}
```

## Environment Management Integration

Both CLI and MCP modes support the same environment management commands:

```bash
# CLI environment management
enact env set my-tool API_KEY "secret-key" --encrypt
enact env set DATABASE_URL "postgres://..." --project
enact env list my-tool

# MCP environment management (via web interface)
# Launched via: launch-env-manager-server tool
# Web UI at: http://localhost:3000
```

## Testing Integration

Both execution paths share the same test suite structure:

```typescript
// tests/dagger-execution.test.ts - Tests both CLI and MCP execution
describe('Tool Execution', () => {
  test('CLI execution', async () => {
    const core = new EnactCore({ executionProvider: 'direct' });
    const result = await core.executeToolByName('nodejs-word-count', { text: 'test' });
    expect(result.success).toBe(true);
  });
  
  test('MCP execution', async () => {
    // Same core logic, different entry point
    const { server } = await import('../src/mcp-server');
    // Test MCP tool calls...
  });
});
```

## Conclusion

The Enact CLI architecture successfully provides two distinct user interfaces (CLI and MCP) while maintaining a unified execution core. This design ensures:

1. **Consistency**: Same tool behavior across interfaces
2. **Maintainability**: Single codebase for core logic
3. **Flexibility**: Different interfaces for different use cases
4. **Security**: Unified signature verification and environment management
5. **Scalability**: Background operations for long-running tasks

The MCP integration allows AI assistants to seamlessly execute Enact tools while the CLI provides direct developer access, both leveraging the same robust execution infrastructure with proper security, environment management, and error handling.

# Enact CLI Direct Integration

This document explains how to use the Enact CLI directly in your MCP server without spawning external CLI processes.

## Overview

Instead of spawning the `enact` CLI as an external process, you can now use the Enact functionality directly within your MCP server. This provides several benefits:

- ⚡ **Performance**: No process spawning overhead
- 🔧 **Direct Control**: Access to all Enact features programmatically  
- 🛡️ **Security**: Better error handling and validation
- 📊 **Shared State**: Intelligent caching and state management

## Quick Start

### Option 1: Use the Pre-built MCP Server

The simplest way is to use our pre-built MCP server:

```bash
# Run the direct MCP server
node dist/mcp-direct.js

# Or use the entry point
enact-mcp
```

### Option 2: Use the Direct Library in Your Own MCP Server

```typescript
import { EnactDirect } from "./src/lib/enact-direct";

// Initialize Enact direct library
const enact = new EnactDirect({
  apiUrl: process.env.ENACT_API_URL,
  authToken: process.env.ENACT_AUTH_TOKEN,
  verificationPolicy: 'permissive' // or 'enterprise' / 'paranoid'
});

// Execute tools directly
const result = await enact.executeToolByName("my-org/data-processor", {
  input: "data to process",
  format: "json"
});

// Search for tools
const tools = await enact.searchTools({
  query: "data processing",
  tags: ["python", "csv"],
  limit: 10
});

// Get tool information
const toolInfo = await enact.getToolInfo("my-org/data-processor");

// Verify tool signatures
const verification = await enact.verifyTool("my-org/data-processor", "enterprise");
```

## API Reference

### EnactDirect Class

#### Constructor

```typescript
new EnactDirect(options?: {
  apiUrl?: string;              // Default: 'https://enact.tools'
  supabaseUrl?: string;         // Default: Enact's Supabase URL
  authToken?: string;           // For authenticated operations
  verificationPolicy?: string;  // 'permissive' | 'enterprise' | 'paranoid'
  defaultTimeout?: string;      // Default: '30s'
})
```

#### Core Methods

##### `executeToolByName(name, inputs, options)`

Execute a tool by its name.

```typescript
const result = await enact.executeToolByName(
  "my-org/tool-name",           // Tool name
  { input: "value" },           // Input parameters
  {
    timeout: "60s",             // Execution timeout
    dryRun: true,               // Validate but don't execute
    skipVerification: false,    // Skip signature verification
    force: false,               // Force execution even if unsafe
    verbose: true               // Enable verbose logging
  }
);
```

**Returns**: `ExecutionResult`
```typescript
{
  success: boolean;
  output?: any;                 // Tool output
  error?: {
    message: string;
    code: string;
    details?: any;
  };
  metadata: {
    executionId: string;
    toolName: string;
    executedAt: string;
    environment: string;
    command?: string;
  };
}
```

##### `searchTools(options)`

Search for tools in the Enact ecosystem.

```typescript
const tools = await enact.searchTools({
  query: "data processing",     // Search query
  limit: 20,                    // Max results
  tags: ["python", "csv"],      // Filter by tags
  author: "my-org",             // Filter by author
  format: "json"                // Output format
});
```

**Returns**: `EnactTool[]`

##### `getToolInfo(name, version?)`

Get detailed information about a tool.

```typescript
const tool = await enact.getToolInfo("my-org/tool-name", "1.0.0");
```

**Returns**: `EnactTool | null`

##### `verifyTool(name, policy?)`

Verify a tool's cryptographic signatures.

```typescript
const verification = await enact.verifyTool(
  "my-org/tool-name", 
  "enterprise"  // 'permissive' | 'enterprise' | 'paranoid'
);
```

**Returns**: 
```typescript
{
  verified: boolean;
  signatures: any[];
  policy: string;
  errors?: string[];
}
```

##### `executeRawTool(yaml, inputs, options)`

Execute a tool from raw YAML definition.

```typescript
const yamlTool = `
name: my-tool
description: A test tool
command: echo "Hello from {{input}}"
inputSchema:
  type: object
  properties:
    input:
      type: string
`;

const result = await enact.executeRawTool(yamlTool, { input: "YAML" });
```

##### `toolExists(name)`

Check if a tool exists in the registry.

```typescript
const exists = await enact.toolExists("my-org/tool-name");
```

**Returns**: `boolean`

##### `getTools(options)`

Get all tools with optional filtering.

```typescript
const tools = await enact.getTools({
  limit: 50,
  offset: 0,
  tags: ["python"],
  author: "my-org"
});
```

##### `getStatus()`

Get the current status of the Enact core.

```typescript
const status = await enact.getStatus();
```

**Returns**:
```typescript
{
  executionProvider: string;
  apiUrl: string;
  verificationPolicy: string;
  defaultTimeout: string;
  authenticated: boolean;
}
```

## MCP Server Integration Example

Here's a complete example of integrating Enact Direct into your MCP server:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { EnactDirect } from "./src/lib/enact-direct";

const enact = new EnactDirect();
const server = new McpServer({ name: "my-server", version: "1.0.0" });

// Add a tool to execute Enact tools
server.tool(
  "execute-enact-tool",
  "Execute any Enact tool",
  {
    toolName: z.string(),
    inputs: z.record(z.any()).optional(),
    dryRun: z.boolean().optional()
  },
  async ({ toolName, inputs = {}, dryRun }) => {
    const result = await enact.executeToolByName(toolName, inputs, { dryRun });
    
    return {
      content: [{
        type: "text",
        text: result.success 
          ? `✅ Success: ${JSON.stringify(result.output)}`
          : `❌ Error: ${result.error?.message}`
      }],
      isError: !result.success
    };
  }
);

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
```

## Environment Variables

Configure the library using environment variables:

```bash
# API Configuration
ENACT_API_URL=https://enact.tools
ENACT_SUPABASE_URL=https://your-supabase-url.com

# Authentication
ENACT_AUTH_TOKEN=your-auth-token

# Security
ENACT_VERIFY_POLICY=enterprise  # permissive | enterprise | paranoid

# Execution
ENACT_DEFAULT_TIMEOUT=30s
```

## Building and Running

```bash
# Build everything
npm run build

# Build just the MCP server
npm run build:mcp

# Build just the library
npm run build:lib

# Run the direct MCP server
npm run start:mcp

# Develop with hot reload
npm run dev:mcp
```

## Error Handling

The library provides comprehensive error handling:

```typescript
try {
  const result = await enact.executeToolByName("non-existent-tool", {});
  
  if (!result.success) {
    console.error("Tool execution failed:", result.error?.message);
    console.error("Error code:", result.error?.code);
    console.error("Details:", result.error?.details);
  }
} catch (error) {
  console.error("Unexpected error:", error);
}
```

## Security Features

- **Signature Verification**: All tools are cryptographically verified
- **Command Safety**: Commands are analyzed for dangerous patterns
- **Input Validation**: Tool inputs are validated against schemas
- **Environment Sanitization**: Environment variables are sanitized
- **Configurable Policies**: Choose from permissive, enterprise, or paranoid verification

## Performance Benefits

Compared to CLI spawning:

- 🚀 **50-90% faster execution** (no process overhead)
- 💾 **Lower memory usage** (shared state)
- 🔄 **Better caching** (persistent connections)
- 🛡️ **Enhanced error handling** (structured errors)
- 📊 **Real-time logging** (integrated with MCP)

## Migration from CLI Spawning

If you're currently using CLI spawning:

**Before** (CLI spawning):
```typescript
const { spawn } = require('child_process');

const proc = spawn('enact', ['exec', 'tool-name', '--params', JSON.stringify(inputs)]);
// Handle stdout/stderr parsing, error codes, etc.
```

**After** (Direct integration):
```typescript
import { EnactDirect } from './src/lib/enact-direct';

const enact = new EnactDirect();
const result = await enact.executeToolByName('tool-name', inputs);
// Structured response, better error handling, faster execution
```

## Troubleshooting

### Common Issues

1. **Missing Dependencies**: Ensure MCP SDK and zod are installed
   ```bash
   npm install @modelcontextprotocol/sdk zod
   ```

2. **Authentication Errors**: Set the `ENACT_AUTH_TOKEN` environment variable

3. **Network Issues**: Check `ENACT_API_URL` and network connectivity

4. **Signature Verification Failures**: Use `skipVerification: true` for testing or adjust the verification policy

### Debug Mode

Enable debug logging:

```bash
DEBUG=1 node your-mcp-server.js
# or
VERBOSE=1 node your-mcp-server.js
```

### Support

For issues or questions:

- GitHub Issues: https://github.com/EnactProtocol/enact-cli/issues
- Documentation: https://docs.enact.tools
- Community: https://discord.gg/enact

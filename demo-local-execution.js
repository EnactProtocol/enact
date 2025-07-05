#!/usr/bin/env node

/**
 * Example: Using MCP Local Tool Execution
 * 
 * This example demonstrates how to use the local tool execution
 * capabilities of our Enact MCP server.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function demonstrateLocalExecution() {
  console.log("🎯 MCP Local Tool Execution Demo");
  console.log("=" .repeat(50));

  const transport = new StdioClientTransport({
    command: "bun",
    args: ["run", "src/mcp-server.ts"]
  });

  const client = new Client({
    name: "local-execution-demo",
    version: "1.0.0"
  });

  try {
    await client.connect(transport);
    console.log("✅ Connected to MCP Server\n");

    // Demo 1: Simple file operations
    console.log("📁 Demo 1: File Operations");
    console.log("-".repeat(30));
    
    // Create a test file
    await client.callTool({
      name: "execute-local-tool",
      arguments: {
        command: "echo",
        args: ["Hello MCP Local Execution!"],
        shell: false
      }
    });

    // List current directory
    const lsResult = await client.callTool({
      name: "execute-local-tool", 
      arguments: {
        command: "ls",
        args: ["-la", "."],
        timeout: 5
      }
    });
    console.log("📋 Current directory listing:");
    console.log(lsResult.content[0].text.split('\n').slice(0, 10).join('\n') + '\n...\n');

    // Demo 2: Git operations
    console.log("🔀 Demo 2: Git Operations");
    console.log("-".repeat(30));
    
    const gitStatus = await client.callTool({
      name: "execute-local-tool",
      arguments: {
        command: "git",
        args: ["status", "--short"],
        timeout: 10
      }
    });
    console.log("Git status (short format):");
    console.log(gitStatus.content[0].text + '\n');

    // Demo 3: Shell features (pipes)
    console.log("🐚 Demo 3: Shell Features");
    console.log("-".repeat(30));
    
    const pipeResult = await client.callTool({
      name: "execute-local-tool",
      arguments: {
        command: "echo 'apple\nbanana\ncherry' | grep 'a' | wc -l",
        shell: true,
        timeout: 5
      }
    });
    console.log("Count of lines containing 'a':");
    console.log(pipeResult.content[0].text + '\n');

    // Demo 4: Environment variables
    console.log("🌍 Demo 4: Environment Variables");
    console.log("-".repeat(30));
    
    const envResult = await client.callTool({
      name: "execute-local-tool",
      arguments: {
        command: "echo",
        args: ["Custom env var: $DEMO_VAR"],
        shell: true,
        env: {
          DEMO_VAR: "Hello from custom environment!"
        }
      }
    });
    console.log("Custom environment variable:");
    console.log(envResult.content[0].text + '\n');

    // Demo 5: Async operation
    console.log("⏰ Demo 5: Async Operation");
    console.log("-".repeat(30));
    
    const asyncResult = await client.callTool({
      name: "execute-local-tool",
      arguments: {
        command: "sleep",
        args: ["2"],
        async: true
      }
    });
    
    console.log("Started async operation:");
    const operationId = asyncResult.content[0].text.match(/Operation ID: ([^\n]+)/)[1];
    console.log(`Operation ID: ${operationId}\n`);
    
    // Check status after a moment
    setTimeout(async () => {
      const statusResult = await client.callTool({
        name: "check-operation-status",
        arguments: { operationId }
      });
      console.log("Final status check:");
      console.log(statusResult.content[0].text.split('\n').slice(0, 6).join('\n') + '\n');
    }, 3000);

    console.log("🎉 Demo completed! The MCP server supports:");
    console.log("  • Synchronous and asynchronous command execution");
    console.log("  • Shell features (pipes, redirects, etc.)");
    console.log("  • Custom working directories");
    console.log("  • Environment variable injection");
    console.log("  • Error handling and timeout management");
    console.log("  • Background operation tracking");

  } catch (error) {
    console.error("❌ Demo failed:", error.message);
  } finally {
    setTimeout(async () => {
      await client.close();
      console.log("📡 Connection closed");
      process.exit(0);
    }, 4000);
  }
}

demonstrateLocalExecution().catch(console.error);

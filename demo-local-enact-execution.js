#!/usr/bin/env node

/**
 * Demo: Local Enact YAML Tool Execution
 * 
 * This demo shows the powerful new capability to execute
 * local Enact YAML tool files through the MCP server.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function demoLocalEnactExecution() {
  console.log("🎯 Demo: Local Enact YAML Tool Execution");
  console.log("=" .repeat(60));

  const transport = new StdioClientTransport({
    command: "bun",
    args: ["run", "src/mcp-server.ts"]
  });

  const client = new Client({
    name: "local-enact-demo-client",
    version: "1.0.0"
  });

  try {
    await client.connect(transport);
    console.log("✅ Connected to MCP Server\n");

    // Demo 1: List all available local tools
    console.log("📚 Available Local Enact Tools");
    console.log("-".repeat(40));
    
    const listResult = await client.callTool({
      name: "list-local-enact-tools",
      arguments: {
        directory: "examples"
      }
    });
    
    console.log("Tools found in examples directory:");
    console.log(listResult.content[0].text.split('\n').slice(0, 15).join('\n') + '\n...\n');

    // Demo 2: Execute basic-test.yaml with custom inputs
    console.log("🎮 Demo: Basic Test Tool");
    console.log("-".repeat(40));
    
    const basicTest = await client.callTool({
      name: "execute-local-enact-tool",
      arguments: {
        filePath: "examples/basic-test.yaml",
        inputs: {
          name: "Developer",
          message: "Local YAML tools are awesome!"
        },
        skipVerification: true
      }
    });
    
    console.log("✅ Basic test result:");
    console.log(JSON.parse(basicTest.content[0].text.split('Output: ')[1]).output.stdout);
    console.log("");

    // Demo 3: Execute hello-world.yaml
    console.log("👋 Demo: Hello World Tool");
    console.log("-".repeat(40));
    
    const helloWorld = await client.callTool({
      name: "execute-local-enact-tool",
      arguments: {
        filePath: "examples/hello-world.yaml",
        inputs: {
          name: "Local YAML User"
        },
        skipVerification: true
      }
    });
    
    console.log("✅ Hello world result:");
    console.log(JSON.parse(helloWorld.content[0].text.split('Output: ')[1]).output.stdout);
    console.log("");

    // Demo 4: Execute simple-hello.yaml (JSON output)
    console.log("📄 Demo: Simple Hello Tool (JSON Output)");
    console.log("-".repeat(40));
    
    const simpleHello = await client.callTool({
      name: "execute-local-enact-tool",
      arguments: {
        filePath: "examples/simple-hello.yaml",
        inputs: {
          name: "JSON User"
        },
        skipVerification: true
      }
    });
    
    console.log("✅ Simple hello result:");
    console.log(JSON.parse(simpleHello.content[0].text.split('Output: ')[1]).output.stdout);
    console.log("");

    // Demo 5: Validate a tool before execution
    console.log("🔍 Demo: Tool Validation");
    console.log("-".repeat(40));
    
    const validation = await client.callTool({
      name: "validate-local-enact-tool",
      arguments: {
        filePath: "examples/enhanced-hello.yaml"
      }
    });
    
    console.log("Validation for enhanced-hello.yaml:");
    console.log(validation.content[0].text.split('\n').slice(0, 8).join('\n') + '\n...\n');

    console.log("🎉 Demo completed!");
    console.log("\n✨ Key Benefits:");
    console.log("  🚀 Execute local Enact YAML tools without CLI overhead");
    console.log("  📋 List and discover tools in any directory");
    console.log("  🔍 Validate tool structure before execution");
    console.log("  ⚡ Full async/sync support with operation tracking");
    console.log("  🛡️ Security controls with signature verification options");
    console.log("  🎯 Perfect for development, testing, and automation workflows");

  } catch (error) {
    console.error("❌ Demo failed:", error.message);
  } finally {
    await client.close();
    console.log("📡 Connection closed");
  }
}

demoLocalEnactExecution().catch(console.error);

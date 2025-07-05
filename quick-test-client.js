#!/usr/bin/env node

/**
 * Simple MCP Client to test local tool execution
 * This is a minimal test client that connects to our MCP server
 * and tests the local execution capabilities.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function runQuickTest() {
  console.log("🚀 Quick Test: Local Tool Execution");
  console.log("=" .repeat(50));

  // Create transport to connect to our MCP server
  const transport = new StdioClientTransport({
    command: "bun",
    args: ["run", "src/mcp-server.ts"]
  });

  // Create client
  const client = new Client({
    name: "quick-test-client",
    version: "1.0.0"
  });

  try {
    console.log("📡 Connecting to MCP server...");
    await client.connect(transport);
    console.log("✅ Connected!");

    // Quick test: List local tools
    console.log("\n🔧 Testing manage-local-tools (list)...");
    const listResult = await client.callTool({
      name: "manage-local-tools",
      arguments: { action: "list" }
    });
    console.log("Result:", listResult.content[0].text.substring(0, 200) + "...");

    // Quick test: Get core status
    console.log("\n💻 Testing enact-core-status...");
    const statusResult = await client.callTool({
      name: "enact-core-status",
      arguments: {}
    });
    console.log("Result:", statusResult.content[0].text.substring(0, 200) + "...");

    console.log("\n✅ Quick test completed successfully!");

  } catch (error) {
    console.error("❌ Test failed:", error.message);
  } finally {
    await client.close();
    console.log("📡 Connection closed");
  }
}

runQuickTest().catch(console.error);

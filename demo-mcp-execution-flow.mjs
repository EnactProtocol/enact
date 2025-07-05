#!/usr/bin/env node

/**
 * Demo: MCP Execution Flow Simulation
 * 
 * This script simulates how an MCP client would interact with the Enact MCP server
 * to execute tools. It demonstrates the complete request/response lifecycle.
 */

import { spawn } from 'child_process';
import { EventEmitter } from 'events';

class MockMcpClient extends EventEmitter {
  constructor() {
    super();
    this.messageId = 1;
    this.server = null;
  }

  async startServer() {
    console.log('🚀 Starting Enact MCP Server...');
    
    // Start the MCP server process
    this.server = spawn('node', ['./dist/mcp-server.js'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.server.stdout.on('data', (data) => {
      try {
        const messages = data.toString().split('\n').filter(line => line.trim());
        for (const message of messages) {
          if (message.trim()) {
            try {
              const parsed = JSON.parse(message);
              this.emit('message', parsed);
            } catch (e) {
              console.log('📝 Server log:', message);
            }
          }
        }
      } catch (error) {
        console.log('📝 Server output:', data.toString());
      }
    });

    this.server.stderr.on('data', (data) => {
      console.log('⚠️ Server stderr:', data.toString().trim());
    });

    // Handle server process events
    this.server.on('error', (error) => {
      console.error('❌ Server process error:', error);
    });

    this.server.on('close', (code) => {
      console.log(`📝 Server process closed with code: ${code}`);
    });

    // Handle stdin errors (EPIPE, etc.)
    this.server.stdin.on('error', (error) => {
      if (error.code !== 'EPIPE') {
        console.error('❌ Server stdin error:', error);
      }
      // EPIPE is expected when server closes, ignore it
    });

    // Wait a moment for server to start
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Initialize the server
    try {
      await this.sendRequest({
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {}
          },
          clientInfo: {
            name: 'demo-mcp-client',
            version: '1.0.0'
          }
        }
      });
      console.log('✅ MCP Server started and initialized');
    } catch (error) {
      console.error('❌ Failed to initialize server:', error);
      throw error;
    }
  }

  async sendRequest(request) {
    return new Promise((resolve, reject) => {
      const id = this.messageId++;
      const message = {
        jsonrpc: '2.0',
        id,
        ...request
      };

      console.log('📤 Sending request:', JSON.stringify(message, null, 2));

      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 30000);

      const handleResponse = (response) => {
        if (response.id === id) {
          clearTimeout(timeout);
          this.off('message', handleResponse);
          console.log('📥 Received response:', JSON.stringify(response, null, 2));
          resolve(response);
        }
      };

      this.on('message', handleResponse);
      
      // Handle write errors gracefully
      try {
        if (this.server.stdin.writable) {
          this.server.stdin.write(JSON.stringify(message) + '\n');
        } else {
          reject(new Error('Server stdin is not writable'));
        }
      } catch (error) {
        if (error.code === 'EPIPE') {
          reject(new Error('Server connection closed'));
        } else {
          reject(error);
        }
      }
    });
  }

  async demonstrateToolExecution() {
    console.log('\n🔧 Demonstrating Tool Execution Flow...\n');

    try {
      // 1. List available tools
      console.log('1️⃣ Listing available MCP tools...');
      const toolsResponse = await this.sendRequest({
        method: 'tools/list',
        params: {}
      });

      if (toolsResponse.result?.tools) {
        console.log(`✅ Found ${toolsResponse.result.tools.length} MCP tools`);
        toolsResponse.result.tools.forEach(tool => {
          console.log(`   • ${tool.name}: ${tool.description}`);
        });
      }

      // 2. Execute a simple tool
      console.log('\n2️⃣ Executing a basic test tool...');
      const execResponse = await this.sendRequest({
        method: 'tools/call',
        params: {
          name: 'execute-tool-by-name',
          arguments: {
            name: 'examples/basic-test',
            inputs: {
              name: 'MCP Demo User',
              message: 'Hello from MCP execution flow!'
            },
            timeout: '30s',
            skipVerification: true  // Skip verification for demo
          }
        }
      });

      if (execResponse.result) {
        console.log('✅ Tool execution completed successfully');
      }

      // 3. Search for tools
      console.log('\n3️⃣ Searching for Node.js tools...');
      const searchResponse = await this.sendRequest({
        method: 'tools/call',
        params: {
          name: 'enact-search-tools',
          arguments: {
            query: 'nodejs',
            limit: 5,
            format: 'json'
          }
        }
      });

      if (searchResponse.result) {
        console.log('✅ Tool search completed successfully');
      }

      // 4. Get tool information
      console.log('\n4️⃣ Getting detailed tool information...');
      const infoResponse = await this.sendRequest({
        method: 'tools/call',
        params: {
          name: 'enact-get-tool-info',
          arguments: {
            name: 'examples/basic-test'
          }
        }
      });

      if (infoResponse.result) {
        console.log('✅ Tool info retrieval completed successfully');
      }

      // 5. Demonstrate async execution (if we had a long-running tool)
      console.log('\n5️⃣ Demonstrating async execution pattern...');
      const asyncResponse = await this.sendRequest({
        method: 'tools/call',
        params: {
          name: 'execute-tool-by-name-async',
          arguments: {
            name: 'examples/hello-world',
            inputs: {
              name: 'Async Demo User'
            },
            async: false,  // Keep it sync for demo
            skipVerification: true
          }
        }
      });

      if (asyncResponse.result) {
        console.log('✅ Async-capable tool execution completed successfully');
      }

    } catch (error) {
      console.error('❌ Error during demonstration:', error.message);
    }
  }

  async shutdown() {
    console.log('\n🛑 Shutting down MCP server...');
    if (this.server && !this.server.killed) {
      // Close stdin first to signal we're done
      try {
        this.server.stdin.end();
      } catch (error) {
        // Ignore errors when closing stdin
      }
      
      // Give the server a moment to close gracefully
      setTimeout(() => {
        if (!this.server.killed) {
          this.server.kill('SIGTERM');
        }
      }, 1000);
      
      // Force kill if still running after 3 seconds
      setTimeout(() => {
        if (!this.server.killed) {
          this.server.kill('SIGKILL');
        }
      }, 3000);
      
      await new Promise(resolve => {
        this.server.on('close', resolve);
        // Don't wait forever
        setTimeout(resolve, 5000);
      });
    }
    console.log('✅ MCP server shutdown complete');
  }
}

async function main() {
  console.log('🎬 Enact CLI MCP Execution Flow Demo');
  console.log('=====================================\n');

  const client = new MockMcpClient();

  try {
    await client.startServer();
    await client.demonstrateToolExecution();
  } catch (error) {
    console.error('❌ Demo failed:', error);
  } finally {
    await client.shutdown();
  }

  console.log('\n🎉 Demo completed!');
  console.log('\nThis demonstration showed:');
  console.log('• How MCP clients connect to the Enact MCP server');
  console.log('• The JSON-RPC protocol for tool execution requests');
  console.log('• Environment validation and error handling');
  console.log('• Synchronous and asynchronous execution patterns');
  console.log('• Tool discovery and information retrieval');
  console.log('\nFor production use, MCP clients like Claude Desktop, Continue.dev,');
  console.log('or custom applications would interact with the server in the same way.');
}

// Run if this is the main module
main().catch(console.error);

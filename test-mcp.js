#!/usr/bin/env node

// Simple test script to verify MCP server functionality
import { spawn } from 'child_process';

console.log('Testing MCP Server...');

const server = spawn('./dist/mcp-entry.js', [], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let output = '';
server.stdout.on('data', (data) => {
  output += data.toString();
});

server.stderr.on('data', (data) => {
  console.error('MCP Server Error:', data.toString());
});

// Send an initialize message
const initMessage = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: {
      name: "test-client",
      version: "1.0.0"
    }
  }
};

setTimeout(() => {
  console.log('Sending initialize message...');
  server.stdin.write(JSON.stringify(initMessage) + '\n');
}, 1000);

setTimeout(() => {
  console.log('Output received:');
  console.log(output);
  server.kill();
  process.exit(0);
}, 3000);

server.on('close', (code) => {
  console.log(`MCP server exited with code ${code}`);
});

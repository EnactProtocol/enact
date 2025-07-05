# 🚨 NOTICE: Demo Scripts Need Update

The demo scripts in this directory were created for the **legacy MCP server implementation** and use tool names that no longer exist in the **minimal implementation**.

## Affected Files:
- `demo-local-execution.js` - Uses old `execute-local-tool` 
- `demo-local-enact-execution.js` - Uses old `execute-local-enact-tool`
- `test-local-execution-client.js` - Uses old tool names
- `test-local-enact-execution.js` - Uses old tool names

## Current Status:
✅ **Working**: `quick-test-client.js` - Updated for minimal implementation
❌ **Needs Update**: Other demo/test scripts use legacy tool names

## Minimal Implementation Tool Names:
- `execute-tool-by-name-enhanced` (replaces multiple old execution tools)
- `manage-local-tools` (replaces list/check tools)
- `create-local-tool` (new tool creation)
- `enact-search-tools` (registry search)
- `check-operation-status` (background operations)
- `launch-env-manager-server` (environment management)
- `enact-core-status` (system status)

## Quick Fix for Demos:
You can reference the **legacy implementation** at `src/mcp-server-legacy.ts` if you need the old tool names temporarily, or update the demo scripts to use the new minimal tool names.

## Recommended Action:
Update demo scripts to showcase the **enhanced capabilities** of the minimal implementation:
- Smart tool resolution (local → cache → registry)
- Background execution for long-running operations  
- Local tool management and creation
- Environment variable management through web UI

The minimal implementation provides **better functionality** than the legacy tools, just with cleaner, more intuitive interfaces.

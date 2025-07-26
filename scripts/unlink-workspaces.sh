#!/bin/bash

# Unlink workspaces script for Enact CLI monorepo
# This script removes bun links and restores normal npm dependencies

set -e

echo "🔗 Unlinking workspace packages for Enact CLI..."

# Get the root directory
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "📁 Working in: $ROOT_DIR"

# Unlink in each package
echo "📦 Unlinking in CLI..."
cd packages/cli
bun unlink @enactprotocol/shared 2>/dev/null || echo "  (not linked)"

echo "🖥️  Unlinking in MCP server..."
cd ../mcp-server
bun unlink @enactprotocol/shared 2>/dev/null || echo "  (not linked)"

echo "🛠️  Unlinking in MCP dev server..."
cd ../mcp-dev-server
bun unlink @enactprotocol/shared 2>/dev/null || echo "  (not linked)"

# Unlink the shared package globally
echo "🌐 Unlinking @enactprotocol/shared globally..."
cd ../shared
bun unlink 2>/dev/null || echo "  (not linked globally)"

# Return to root and reinstall normal dependencies
cd "$ROOT_DIR"
echo "📦 Reinstalling normal dependencies..."
bun install

echo ""
echo "✅ Workspace unlinking complete!"
echo ""
echo "📋 Summary:"
echo "  • All packages now use published versions"
echo "  • Local links have been removed"
echo "  • Dependencies reinstalled from registry"
echo ""
echo "🔄 To re-link workspaces:"
echo "  ./scripts/link-workspaces.sh"

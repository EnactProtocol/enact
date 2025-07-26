#!/bin/bash

# Link workspaces script for Enact CLI monorepo
# This script sets up bun links between workspace packages for development

set -e

echo "🔗 Setting up workspace links for Enact CLI..."

# Get the root directory
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "📁 Working in: $ROOT_DIR"

# First, ensure all packages are built (needed for linking)
echo "🔨 Building packages..."
bun run build:shared

# Sync versions to ensure consistency during development
echo "🔄 Syncing package versions..."
bun run sync-versions

# Link the shared package globally
echo "🌐 Linking @enactprotocol/shared globally..."
cd packages/shared
bun link

# Link shared package in CLI
echo "📦 Linking shared in CLI..."
cd ../cli
bun link @enactprotocol/shared

# Link shared package in MCP server
echo "🖥️  Linking shared in MCP server..."
cd ../mcp-server
bun link @enactprotocol/shared

# Link shared package in MCP dev server
echo "🛠️  Linking shared in MCP dev server..."
cd ../mcp-dev-server
bun link @enactprotocol/shared

# Return to root
cd "$ROOT_DIR"

echo ""
echo "✅ Workspace linking complete!"
echo ""
echo "📋 Summary:"
echo "  • @enactprotocol/shared is linked globally"
echo "  • CLI package uses linked shared"
echo "  • MCP server package uses linked shared"
echo "  • MCP dev server package uses linked shared"
echo ""
echo "💡 To verify links are working:"
echo "  ls -la packages/*/node_modules/@enactprotocol/shared"
echo ""
echo "🔄 To unlink (if needed):"
echo "  bun unlink @enactprotocol/shared"
echo "  cd packages/shared && bun unlink"

#!/bin/bash

# Pre-publish preparation script
# This script prepares the workspace for publishing to npm

set -e

echo "📦 Preparing workspace for npm publishing..."

# Get the root directory
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "📁 Working in: $ROOT_DIR"

# 1. Unlink all workspace dependencies to avoid publishing with symlinks
echo "🔗 Unlinking workspace dependencies..."
./scripts/unlink-workspaces.sh

# 2. Sync all package versions to ensure consistency
echo "🔄 Syncing package versions..."
./scripts/sync-versions.sh

# 3. Install dependencies with exact versions (no symlinks)
echo "📦 Installing exact dependencies..."
bun install

# 4. Build all packages
echo "🔨 Building all packages..."
bun run build

# 5. Run tests to ensure everything works
echo "🧪 Running tests..."
bun run test

# 6. Verify no workspace references remain
echo "🔍 Verifying no workspace references..."
if grep -r "workspace:" packages/*/package.json; then
    echo "❌ Found workspace references! These must be removed before publishing."
    exit 1
else
    echo "✅ No workspace references found"
fi

# 7. Verify no symlinks in node_modules
echo "🔍 Checking for symlinks in dependencies..."
SYMLINKS=$(find packages/*/node_modules/@enactprotocol -type l 2>/dev/null || true)
if [ -n "$SYMLINKS" ]; then
    echo "❌ Found symlinked dependencies:"
    echo "$SYMLINKS"
    echo "Run 'bun run unlink' and 'bun install' to fix this."
    exit 1
else
    echo "✅ No symlinked dependencies found"
fi

echo ""
echo "✅ Workspace is ready for publishing!"
echo ""
echo "📋 Pre-publish checklist completed:"
echo "  ✅ Workspace dependencies unlinked"
echo "  ✅ Package versions synced"
echo "  ✅ Dependencies installed from registry"
echo "  ✅ All packages built successfully"
echo "  ✅ Tests passing"
echo "  ✅ No workspace references in package.json files"
echo "  ✅ No symlinked internal dependencies"
echo ""
echo "🚀 Ready to publish! Run:"
echo "  bun run deploy"
echo ""
echo "🔄 To return to development mode after publishing:"
echo "  bun run link"

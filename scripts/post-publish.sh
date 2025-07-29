#!/bin/bash

# Post-publish restoration script
# This script restores the development environment after publishing

set -e

echo "🔄 Restoring development environment..."

# Get the root directory
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "📁 Working in: $ROOT_DIR"

# 1. Clean all node_modules to ensure fresh start
echo "🧹 Cleaning node_modules..."
rm -rf node_modules packages/*/node_modules

# 2. Reinstall dependencies
echo "📦 Reinstalling dependencies..."
bun install

# 3. Restore workspace links for development
echo "🔗 Restoring workspace links..."
./scripts/link-workspaces.sh

# 4. Convert dependencies back to workspace references (after linking to avoid sync-versions overwriting)
echo "🔄 Converting dependencies to workspace references..."
PACKAGES=(
  "packages/cli/package.json"
  "packages/mcp-server/package.json"
  "packages/mcp-dev-server/package.json"
)

for package_file in "${PACKAGES[@]}"; do
  if [ -f "$package_file" ]; then
    echo "  📝 Updating $package_file"
    # Convert @enactprotocol/shared version to workspace reference
    sed -i.bak 's/"@enactprotocol\/shared": "[^"]*"/"@enactprotocol\/shared": "workspace:*"/g' "$package_file"
    rm -f "$package_file.bak"
  fi
done

# 5. Verify links are working
echo "🔍 Verifying workspace links..."
EXPECTED_LINKS="packages/cli/node_modules/@enactprotocol/shared packages/mcp-server/node_modules/@enactprotocol/shared packages/mcp-dev-server/node_modules/@enactprotocol/shared"

for link in $EXPECTED_LINKS; do
    if [ -L "$link" ]; then
        echo "  ✅ $link -> $(readlink $link)"
    else
        echo "  ❌ $link (not a symlink)"
    fi
done

echo ""
echo "✅ Development environment restored!"
echo ""
echo "📋 Post-publish checklist completed:"
echo "  ✅ Node modules cleaned"
echo "  ✅ Dependencies reinstalled"
echo "  ✅ Dependencies converted to workspace references"
echo "  ✅ Workspace links restored"
echo "  ✅ Ready for development"
echo ""
echo "💡 You can now continue development with linked packages"
echo "🧪 Run 'bun test' to verify everything is working"

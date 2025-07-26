#!/bin/bash

# Sync workspace package versions
# This script ensures all internal package references use the correct versions before publishing

set -e

echo "🔄 Syncing workspace package versions..."

# Get the root directory
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "📁 Working in: $ROOT_DIR"

# Read the current version of @enactprotocol/shared
SHARED_VERSION=$(node -p "require('./packages/shared/package.json').version")
echo "📦 Found @enactprotocol/shared version: $SHARED_VERSION"

# Function to update package.json dependencies
update_dependency() {
    local package_path=$1
    local package_name=$2
    
    if [ -f "$package_path/package.json" ]; then
        echo "  Updating $package_path..."
        
        # Use node to update the dependency version
        node -e "
            const fs = require('fs');
            const path = '$package_path/package.json';
            const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));
            
            if (pkg.dependencies && pkg.dependencies['@enactprotocol/shared']) {
                pkg.dependencies['@enactprotocol/shared'] = '$SHARED_VERSION';
                fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
                console.log('    ✅ Updated @enactprotocol/shared to $SHARED_VERSION');
            } else {
                console.log('    ⏭️  No @enactprotocol/shared dependency found');
            }
        "
    fi
}

# Update CLI package
echo "🖥️  Updating CLI package..."
update_dependency "packages/cli" "cli"

# Update MCP server package
echo "🖥️  Updating MCP server package..."
update_dependency "packages/mcp-server" "mcp-server"

# Update MCP dev server package
echo "🛠️  Updating MCP dev server package..."
update_dependency "packages/mcp-dev-server" "mcp-dev-server"

echo ""
echo "✅ Version sync complete!"
echo ""
echo "📋 Summary:"
echo "  • All packages now reference @enactprotocol/shared@$SHARED_VERSION"
echo ""
echo "🔍 To verify changes:"
echo "  grep -r '@enactprotocol/shared' packages/*/package.json"
echo ""
echo "⚠️  Note: External dependencies like @enactprotocol/security are left unchanged"
echo ""
echo "📦 Next steps for publishing:"
echo "  1. bun run sync-versions  (run this script)"
echo "  2. bun run build"
echo "  3. bun run test"
echo "  4. bun run deploy"

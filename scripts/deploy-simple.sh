#!/bin/bash

# Simple deploy script - just publish the packages
set -e

PACKAGES=("shared" "mcp-server" "mcp-dev-server" "cli")

echo "📤 Deploying packages to npm..."

# Switch to exact versions (no workspace references)
./scripts/unlink-workspaces.sh > /dev/null 2>&1 || true
./scripts/sync-versions.sh > /dev/null
bun install > /dev/null

# Publish each package
for package in "${PACKAGES[@]}"; do
    echo "Publishing @enactprotocol/$package..."
    cd "packages/$package"
    
    # Skip if version already exists
    PACKAGE_NAME=$(node -p "require('./package.json').name")
    VERSION=$(node -p "require('./package.json').version")
    
    if npm view "$PACKAGE_NAME@$VERSION" version &>/dev/null; then
        echo "  ⚠️  $PACKAGE_NAME@$VERSION already exists, skipping"
    else
        npm publish
        echo "  ✅ Published $PACKAGE_NAME@$VERSION"
    fi
    
    cd ../..
done

echo "✅ Deploy complete!"
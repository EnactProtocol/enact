#!/bin/bash

# Simple release script for Enact Protocol
# Usage: ./scripts/release-simple.sh [patch|minor|major]

set -e

VERSION_TYPE=${1:-patch}

echo "🚀 Simple Release: $VERSION_TYPE"
echo "================================"

# 1. Bump all versions
echo "📈 Bumping versions..."
./scripts/version-bump.sh $VERSION_TYPE

# 2. Build everything
echo "🔨 Building..."
npm run build

# 3. Deploy to npm
echo "📤 Deploying..."
./scripts/deploy-simple.sh

# 4. Restore workspace links
echo "🔗 Restoring workspace..."
./scripts/post-publish.sh

echo "✅ Release complete!"
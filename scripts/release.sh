#!/bin/bash
set -e

# Release script for Enact CLI
# Usage: ./scripts/release.sh <version>
# Example: ./scripts/release.sh 0.2.0

VERSION=$1
ROOT_DIR=$(pwd)

if [ -z "$VERSION" ]; then
  echo "Usage: ./scripts/release.sh <version>"
  echo "Example: ./scripts/release.sh 0.2.0"
  exit 1
fi

# Validate version format
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Error: Version must be in format X.Y.Z (e.g., 0.2.0)"
  exit 1
fi

echo "🚀 Releasing Enact v$VERSION"

# Ensure we're on main and up to date
BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "main" ]; then
  echo "Error: Must be on main branch (currently on $BRANCH)"
  exit 1
fi

echo "📥 Pulling latest changes..."
git pull origin main

# Run tests
echo "🧪 Running tests..."
bun run test

# Run lint
echo "🔍 Running lint..."
bun run lint

# Build
echo "🔨 Building..."
bun run build

# Update versions in all packages using node to modify package.json directly
# This avoids issues with npm version not liking workspace:* dependencies
echo "📝 Updating package versions to $VERSION..."

update_version() {
  local pkg_json="$1"
  if [ -f "$pkg_json" ]; then
    node -e "
      const fs = require('fs');
      const pkg = JSON.parse(fs.readFileSync('$pkg_json', 'utf8'));
      pkg.version = '$VERSION';
      fs.writeFileSync('$pkg_json', JSON.stringify(pkg, null, 2) + '\n');
    "
    echo "  ✓ Updated $(dirname $pkg_json)"
  fi
}

# Update all package versions
update_version "$ROOT_DIR/package.json"
update_version "$ROOT_DIR/packages/trust/package.json"
update_version "$ROOT_DIR/packages/secrets/package.json"
update_version "$ROOT_DIR/packages/shared/package.json"
update_version "$ROOT_DIR/packages/execution/package.json"
update_version "$ROOT_DIR/packages/api/package.json"
update_version "$ROOT_DIR/packages/cli/package.json"
# Note: mcp-server is not published to npm yet

# Also update the version constant in CLI index.ts
CLI_INDEX="$ROOT_DIR/packages/cli/src/index.ts"
if [ -f "$CLI_INDEX" ]; then
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/export const version = \".*\"/export const version = \"$VERSION\"/" "$CLI_INDEX"
  else
    sed -i "s/export const version = \".*\"/export const version = \"$VERSION\"/" "$CLI_INDEX"
  fi
  echo "  ✓ Updated CLI version constant"
fi

# Rebuild after version update
echo "🔨 Rebuilding with new version..."
bun run build

# Commit version bump
echo "📦 Committing version bump..."
git add -A
git commit -m "chore: release v$VERSION"

# Create and push tag
echo "🏷️ Creating tag v$VERSION..."
git tag -a "v$VERSION" -m "Release v$VERSION"

echo "📤 Pushing to origin..."
git push origin main
git push origin "v$VERSION"

echo ""
echo "✅ Release v$VERSION created and pushed!"
echo ""
echo "GitHub Actions will now:"
echo "  1. Run tests"
echo "  2. Build binaries for all platforms"
echo "  3. Publish to npm"
echo "  4. Create GitHub release with binaries"
echo ""
echo "Monitor progress at:"
echo "  https://github.com/EnactProtocol/enact-cli-2.0/actions"

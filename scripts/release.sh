#!/bin/bash
set -e

# Release script for Enact CLI
# Usage: ./scripts/release.sh <version>
# Example: ./scripts/release.sh 0.2.0

VERSION=$1

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

# Update versions in all packages
echo "📝 Updating package versions to $VERSION..."
cd packages/shared && npm version $VERSION --no-git-tag-version && cd ../..
cd packages/secrets && npm version $VERSION --no-git-tag-version && cd ../..
cd packages/trust && npm version $VERSION --no-git-tag-version && cd ../..
cd packages/api && npm version $VERSION --no-git-tag-version && cd ../..
cd packages/cli && npm version $VERSION --no-git-tag-version && cd ../..

# Update root package.json
npm version $VERSION --no-git-tag-version

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

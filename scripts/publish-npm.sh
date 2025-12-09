#!/bin/bash
#
# Manually publish @enactprotocol packages to npm
#
# Prerequisites:
#   - npm login (must be logged in with publish access to @enactprotocol)
#   - All packages built (bun run build)
#
# Usage:
#   ./scripts/publish-npm.sh [--dry-run]
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

DRY_RUN=""
if [[ "$1" == "--dry-run" ]]; then
  DRY_RUN="--dry-run"
  echo -e "${YELLOW}DRY RUN MODE - No packages will be published${NC}"
  echo ""
fi

# Get the version from root package.json
VERSION=$(node -p "require('./package.json').version")
echo -e "${GREEN}Publishing @enactprotocol packages v${VERSION}${NC}"
echo ""

# Check npm login
echo "Checking npm authentication..."
NPM_USER=$(npm whoami 2>/dev/null || echo "")
if [[ -z "$NPM_USER" ]]; then
  echo -e "${RED}Error: Not logged in to npm. Run 'npm login' first.${NC}"
  exit 1
fi
echo -e "Logged in as: ${GREEN}${NPM_USER}${NC}"
echo ""

# Build all packages first
echo "Building all packages..."
bun run build
echo ""

# Create a temporary directory for modified packages
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Packages in dependency order (dependencies first)
PACKAGES=(
  "trust"
  "secrets" 
  "shared"
  "execution"
  "api"
  "cli"
)

echo "Preparing packages for npm publish..."
echo ""

# Copy and prepare each package
for pkg in "${PACKAGES[@]}"; do
  PKG_DIR="packages/$pkg"
  TEMP_PKG_DIR="$TEMP_DIR/$pkg"
  
  echo -e "${YELLOW}Preparing @enactprotocol/${pkg}...${NC}"
  
  # Copy package to temp directory
  cp -r "$PKG_DIR" "$TEMP_PKG_DIR"
  
  # Replace workspace:* with actual version in package.json
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s/\"workspace:\*\"/\"${VERSION}\"/g" "$TEMP_PKG_DIR/package.json"
  else
    # Linux
    sed -i "s/\"workspace:\*\"/\"${VERSION}\"/g" "$TEMP_PKG_DIR/package.json"
  fi
  
  echo "  ✓ Converted workspace:* to ${VERSION}"
done

echo ""
echo "Publishing packages to npm..."
echo ""

# Publish each package
for pkg in "${PACKAGES[@]}"; do
  TEMP_PKG_DIR="$TEMP_DIR/$pkg"
  
  echo -e "${YELLOW}Publishing @enactprotocol/${pkg}@${VERSION}...${NC}"
  
  cd "$TEMP_PKG_DIR"
  
  if npm publish --access public $DRY_RUN 2>&1; then
    echo -e "  ${GREEN}✓ Published @enactprotocol/${pkg}@${VERSION}${NC}"
  else
    echo -e "  ${RED}✗ Failed to publish @enactprotocol/${pkg}${NC}"
    echo "    (May already exist at this version)"
  fi
  
  cd - > /dev/null
  echo ""
done

echo -e "${GREEN}Done!${NC}"
echo ""
echo "Published packages:"
for pkg in "${PACKAGES[@]}"; do
  echo "  - @enactprotocol/${pkg}@${VERSION}"
done

if [[ -n "$DRY_RUN" ]]; then
  echo ""
  echo -e "${YELLOW}This was a dry run. Run without --dry-run to actually publish.${NC}"
fi

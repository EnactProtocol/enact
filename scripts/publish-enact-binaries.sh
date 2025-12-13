#!/bin/bash
#
# Publish Enact CLI with platform-specific binaries to npm
#
# This script implements the optionalDependencies deployment strategy:
#   1. Publishes platform-specific binary packages (@enactprotocol/enact-darwin-arm64, etc.)
#   2. Publishes the main wrapper package (@enactprotocol/enact)
#
# Prerequisites:
#   - npm login (must be logged in with publish access to @enactprotocol)
#   - Binaries built for each platform (in packages/enact-*/bin/)
#   - All library packages already published at this version
#
# Usage:
#   ./scripts/publish-enact-binaries.sh [--dry-run] [--skip-lib]
#
# Options:
#   --dry-run    Show what would be published without actually publishing
#   --skip-lib   Skip publishing library packages (trust, secrets, etc.)
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

DRY_RUN=""
SKIP_LIB=""

for arg in "$@"; do
  case $arg in
    --dry-run)
      DRY_RUN="--dry-run"
      ;;
    --skip-lib)
      SKIP_LIB="true"
      ;;
  esac
done

if [[ -n "$DRY_RUN" ]]; then
  echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
  echo -e "${YELLOW}  DRY RUN MODE - No packages will actually be published${NC}"
  echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
  echo ""
fi

# Get the version from root package.json
VERSION=$(node -p "require('./package.json').version")
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Publishing @enactprotocol packages v${VERSION}${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Check npm login
echo "🔐 Checking npm authentication..."
NPM_USER=$(npm whoami 2>/dev/null || echo "")
if [[ -z "$NPM_USER" ]]; then
  echo -e "${RED}Error: Not logged in to npm. Run 'npm login' first.${NC}"
  exit 1
fi
echo -e "   Logged in as: ${GREEN}${NPM_USER}${NC}"
echo ""

# Create a temporary directory for modified packages
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Function to replace workspace:* with actual version
replace_workspace_version() {
  local file="$1"
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/\"workspace:\*\"/\"${VERSION}\"/g" "$file"
  else
    sed -i "s/\"workspace:\*\"/\"${VERSION}\"/g" "$file"
  fi
}

# Function to publish a package
publish_package() {
  local pkg_name="$1"
  local pkg_dir="$2"
  local temp_pkg_dir="$TEMP_DIR/$(basename $pkg_dir)"
  
  echo -e "${YELLOW}📦 Preparing ${pkg_name}@${VERSION}...${NC}"
  
  # Copy package to temp directory
  cp -r "$pkg_dir" "$temp_pkg_dir"
  
  # Replace workspace:* with actual version
  replace_workspace_version "$temp_pkg_dir/package.json"
  
  # Check if binary exists for platform packages
  if [[ "$pkg_name" == *"darwin"* ]] || [[ "$pkg_name" == *"linux"* ]] || [[ "$pkg_name" == *"win32"* ]]; then
    local bin_file="$temp_pkg_dir/bin/enact"
    if [[ "$pkg_name" == *"win32"* ]]; then
      bin_file="$temp_pkg_dir/bin/enact.exe"
    fi
    
    if [[ ! -f "$bin_file" ]]; then
      echo -e "   ${YELLOW}⚠ Binary not found at $bin_file${NC}"
      echo -e "   ${YELLOW}  Will publish with dev shim only${NC}"
    else
      local size=$(du -h "$bin_file" | cut -f1)
      echo -e "   ${GREEN}✓ Binary found ($size)${NC}"
    fi
  fi
  
  cd "$temp_pkg_dir"
  
  echo -e "   Publishing to npm..."
  if npm publish --access public $DRY_RUN 2>&1; then
    echo -e "   ${GREEN}✓ Published ${pkg_name}@${VERSION}${NC}"
    cd - > /dev/null
    return 0
  else
    echo -e "   ${YELLOW}⚠ May already exist at this version${NC}"
    cd - > /dev/null
    return 1
  fi
}

# # ============================================================
# # PHASE 1: Library packages (dependencies first)
# # ============================================================
# if [[ -z "$SKIP_LIB" ]]; then
#   echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
#   echo -e "${BLUE}  Phase 1: Publishing library packages${NC}"
#   echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
#   echo ""

#   LIB_PACKAGES=(
#     "trust"
#     "secrets"
#     "shared"
#     "execution"
#     "api"
#     "cli"
#   )

#   for pkg in "${LIB_PACKAGES[@]}"; do
#     publish_package "@enactprotocol/${pkg}" "packages/$pkg"
#     echo ""
#   done
# else
#   echo -e "${YELLOW}Skipping library packages (--skip-lib)${NC}"
#   echo ""
# fi

# ============================================================
# PHASE 2: Platform-specific binary packages
# ============================================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Phase 2: Publishing platform-specific binary packages${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

PLATFORM_PACKAGES=(
  "enact-darwin-arm64"
  "enact-darwin-x64"
  "enact-linux-arm64"
  "enact-linux-x64"
  "enact-win32-x64"
)

for pkg in "${PLATFORM_PACKAGES[@]}"; do
  publish_package "@enactprotocol/${pkg}" "packages/$pkg"
  echo ""
done

# ============================================================
# PHASE 3: Main enact wrapper package
# ============================================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Phase 3: Publishing main @enactprotocol/enact wrapper${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

publish_package "@enactprotocol/enact" "packages/enact"
echo ""

# ============================================================
# Summary
# ============================================================
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ Deployment complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "Published packages:"
if [[ -z "$SKIP_LIB" ]]; then
  for pkg in "${LIB_PACKAGES[@]}"; do
    echo "  📚 @enactprotocol/${pkg}@${VERSION}"
  done
fi
for pkg in "${PLATFORM_PACKAGES[@]}"; do
  echo "  💻 @enactprotocol/${pkg}@${VERSION}"
done
echo "  🎯 @enactprotocol/enact@${VERSION}"
echo ""

echo "Users can now install with:"
echo -e "  ${GREEN}npm install -g @enactprotocol/enact${NC}"
echo ""

if [[ -n "$DRY_RUN" ]]; then
  echo -e "${YELLOW}This was a dry run. Run without --dry-run to actually publish.${NC}"
fi

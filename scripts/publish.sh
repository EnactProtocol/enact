#!/bin/bash
#
# Publish all @enactprotocol packages to npm
#
# This script publishes:
#   1. Library packages (trust, secrets, shared, execution, api, cli)
#   2. Platform-specific binary packages (enact-darwin-arm64, etc.)
#   3. Main wrapper package (@enactprotocol/enact)
#
# Prerequisites:
#   - npm login (must be logged in with publish access to @enactprotocol)
#   - All packages built (bun run build)
#   - Binary built for current platform (bun run build:binary:local)
#
# Usage:
#   ./scripts/publish.sh [options]
#
# Options:
#   --dry-run       Show what would be published without actually publishing
#   --skip-lib      Skip publishing library packages
#   --skip-binary   Skip publishing platform binary packages
#   --only-lib      Only publish library packages
#   --only-binary   Only publish binary packages (platform + wrapper)
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Parse arguments
DRY_RUN=""
SKIP_LIB=""
SKIP_BINARY=""

for arg in "$@"; do
  case $arg in
    --dry-run)
      DRY_RUN="--dry-run"
      ;;
    --skip-lib)
      SKIP_LIB="true"
      ;;
    --skip-binary)
      SKIP_BINARY="true"
      ;;
    --only-lib)
      SKIP_BINARY="true"
      ;;
    --only-binary)
      SKIP_LIB="true"
      ;;
    --help|-h)
      echo "Usage: ./scripts/publish.sh [options]"
      echo ""
      echo "Options:"
      echo "  --dry-run       Show what would be published without actually publishing"
      echo "  --skip-lib      Skip publishing library packages"
      echo "  --skip-binary   Skip publishing platform binary packages"
      echo "  --only-lib      Only publish library packages"
      echo "  --only-binary   Only publish binary packages (platform + wrapper)"
      echo "  --help, -h      Show this help message"
      exit 0
      ;;
  esac
done

# Header
echo ""
echo -e "${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           Enact Package Publisher                         ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

if [[ -n "$DRY_RUN" ]]; then
  echo -e "${YELLOW}⚠  DRY RUN MODE - No packages will actually be published${NC}"
  echo ""
fi

# Get the version from root package.json
VERSION=$(node -p "require('./package.json').version")
echo -e "📦 Version: ${CYAN}${VERSION}${NC}"
echo ""

# Check npm login
echo "🔐 Checking npm authentication..."
NPM_USER=$(npm whoami 2>/dev/null || echo "")
if [[ -z "$NPM_USER" ]]; then
  echo -e "${RED}   ✗ Error: Not logged in to npm. Run 'npm login' first.${NC}"
  exit 1
fi
echo -e "   ✓ Logged in as: ${GREEN}${NPM_USER}${NC}"
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

# Track published packages for summary
PUBLISHED_PACKAGES=()
FAILED_PACKAGES=()

# Function to publish a package
publish_package() {
  local pkg_name="$1"
  local pkg_dir="$2"
  local temp_pkg_dir="$TEMP_DIR/$(basename $pkg_dir)"
  
  echo -e "${YELLOW}📦 ${pkg_name}@${VERSION}${NC}"
  
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
      echo -e "   ${YELLOW}⚠ No binary (will use fallback shim)${NC}"
    else
      local size=$(du -h "$bin_file" | cut -f1)
      echo -e "   ${GREEN}✓ Binary: ${size}${NC}"
    fi
  fi
  
  cd "$temp_pkg_dir"
  
  # Run npm publish directly (not captured) so it can prompt for browser auth
  if npm publish --access public $DRY_RUN; then
    if [[ -n "$DRY_RUN" ]]; then
      echo -e "   ${CYAN}✓ Would publish (dry-run)${NC}"
    else
      echo -e "   ${GREEN}✓ Published${NC}"
    fi
    PUBLISHED_PACKAGES+=("$pkg_name")
    cd - > /dev/null
    return 0
  else
    echo -e "   ${YELLOW}⚠ Failed or already exists at this version${NC}"
    FAILED_PACKAGES+=("$pkg_name")
    cd - > /dev/null
    return 1
  fi
}

# ============================================================
# PHASE 1: Library packages (dependencies first)
# ============================================================
if [[ -z "$SKIP_LIB" ]]; then
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}  Phase 1: Library Packages${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""

  LIB_PACKAGES=(
    "trust"
    "secrets"
    "shared"
    "execution"
    "api"
    "cli"
  )

  for pkg in "${LIB_PACKAGES[@]}"; do
    publish_package "@enactprotocol/${pkg}" "packages/$pkg" || true
    echo ""
  done
fi

# ============================================================
# PHASE 2: Platform-specific binary packages
# ============================================================
if [[ -z "$SKIP_BINARY" ]]; then
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}  Phase 2: Platform Binary Packages${NC}"
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
    publish_package "@enactprotocol/${pkg}" "packages/$pkg" || true
    echo ""
  done

  # ============================================================
  # PHASE 3: Main enact wrapper package
  # ============================================================
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}  Phase 3: Main Wrapper Package${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""

  publish_package "@enactprotocol/enact" "packages/enact" || true
  echo ""

  # ============================================================
  # PHASE 4: Publish as enact-cli alias (for easy discoverability)
  # ============================================================
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}  Phase 4: enact-cli Alias Package${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""

  # Create a temporary enact-cli package that mirrors @enactprotocol/enact
  ENACT_CLI_DIR="$TEMP_DIR/enact-cli"
  cp -r "packages/enact" "$ENACT_CLI_DIR"
  
  # Update package.json for enact-cli
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' 's/"name": "@enactprotocol\/enact"/"name": "enact-cli"/g' "$ENACT_CLI_DIR/package.json"
    sed -i '' "s/\"workspace:\*\"/\"${VERSION}\"/g" "$ENACT_CLI_DIR/package.json"
  else
    sed -i 's/"name": "@enactprotocol\/enact"/"name": "enact-cli"/g' "$ENACT_CLI_DIR/package.json"
    sed -i "s/\"workspace:\*\"/\"${VERSION}\"/g" "$ENACT_CLI_DIR/package.json"
  fi
  
  echo -e "${YELLOW}📦 enact-cli@${VERSION}${NC}"
  cd "$ENACT_CLI_DIR"
  
  if npm publish --access public $DRY_RUN; then
    if [[ -n "$DRY_RUN" ]]; then
      echo -e "   ${CYAN}✓ Would publish (dry-run)${NC}"
    else
      echo -e "   ${GREEN}✓ Published${NC}"
    fi
    PUBLISHED_PACKAGES+=("enact-cli")
  else
    echo -e "   ${YELLOW}⚠ Failed or already exists at this version${NC}"
    FAILED_PACKAGES+=("enact-cli")
  fi
  cd - > /dev/null
  echo ""
fi

# ============================================================
# Summary
# ============================================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [[ ${#PUBLISHED_PACKAGES[@]} -gt 0 ]]; then
  echo -e "${GREEN}✓ Published (${#PUBLISHED_PACKAGES[@]}):${NC}"
  for pkg in "${PUBLISHED_PACKAGES[@]}"; do
    echo "    ${pkg}@${VERSION}"
  done
  echo ""
fi

if [[ ${#FAILED_PACKAGES[@]} -gt 0 ]]; then
  echo -e "${YELLOW}⚠ Skipped/Failed (${#FAILED_PACKAGES[@]}):${NC}"
  for pkg in "${FAILED_PACKAGES[@]}"; do
    echo "    ${pkg}"
  done
  echo ""
fi

echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ Done!                                                  ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Install with:"
echo -e "  ${CYAN}npm install -g enact-cli${NC}"
echo "  or"
echo -e "  ${CYAN}npm install -g @enactprotocol/enact${NC}"
echo ""

if [[ -n "$DRY_RUN" ]]; then
  echo -e "${YELLOW}This was a dry run. Run without --dry-run to actually publish.${NC}"
  echo ""
fi

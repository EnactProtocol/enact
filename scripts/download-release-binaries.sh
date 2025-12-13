#!/usr/bin/env bash
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Get version from package.json
VERSION=$(grep '"version"' package.json | head -1 | sed 's/.*"version": "\(.*\)".*/\1/')

# Allow override
if [[ -n "$1" ]]; then
  VERSION="$1"
fi

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Download Release Binaries from GitHub                 ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "📦 Version: ${CYAN}${VERSION}${NC}"
echo ""

BASE_URL="https://github.com/EnactProtocol/enact/releases/download/v${VERSION}"

# Package directories and their corresponding release file names
PACKAGES="enact-darwin-arm64 enact-darwin-x64 enact-linux-arm64 enact-linux-x64 enact-win32-x64"

get_release_filename() {
  local pkg="$1"
  case "$pkg" in
    enact-win32-x64) echo "enact-windows-x64.exe" ;;
    *) echo "$pkg" ;;
  esac
}

get_bin_filename() {
  local pkg="$1"
  case "$pkg" in
    *win32*) echo "enact.exe" ;;
    *) echo "enact" ;;
  esac
}

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Downloading binaries from GitHub Releases${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

for pkg in $PACKAGES; do
  release_file=$(get_release_filename "$pkg")
  bin_file=$(get_bin_filename "$pkg")
  url="${BASE_URL}/${release_file}"
  output_file="packages/${pkg}/bin/${bin_file}"
  
  echo -e "${YELLOW}📥 ${pkg}${NC}"
  echo "   URL: ${url}"
  
  # Create bin directory if needed
  mkdir -p "packages/${pkg}/bin"
  
  # Download
  if curl -fSL --progress-bar -o "$output_file" "$url"; then
    # Make executable (not needed for Windows but doesn't hurt)
    chmod +x "$output_file"
    size=$(du -h "$output_file" | cut -f1)
    echo -e "   ${GREEN}✓ Downloaded (${size})${NC}"
  else
    echo -e "   ${RED}✗ Failed to download${NC}"
    # Remove any partial file
    rm -f "$output_file"
  fi
  echo ""
done

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo "Downloaded binaries:"
for pkg in $PACKAGES; do
  bin_file=$(get_bin_filename "$pkg")
  bin_path="packages/${pkg}/bin/${bin_file}"
  
  if [[ -f "$bin_path" ]]; then
    size=$(du -h "$bin_path" | cut -f1)
    echo -e "  ${GREEN}✓${NC} ${pkg}: ${size}"
  else
    echo -e "  ${RED}✗${NC} ${pkg}: not found"
  fi
done

echo ""
echo -e "${GREEN}Done!${NC} Now run ${CYAN}./scripts/publish.sh${NC} to publish."
echo ""

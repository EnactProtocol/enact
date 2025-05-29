#!/bin/bash

# Enact CLI Build and Install Script - Using Bun Binary Compilation
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
CLI_NAME="enact"
BUILD_DIR="./dist"
INSTALL_DIR="$HOME/.local/bin"
SOURCE_FILE="./src/index.ts"

echo -e "${BLUE}🔨 Building Enact CLI binary...${NC}"

# Check if Bun is installed
if ! command -v bun &> /dev/null; then
    echo -e "${RED}❌ Bun is not installed. Please install Bun first: https://bun.sh${NC}"
    exit 1
fi

# Create build directory
mkdir -p "$BUILD_DIR"

# Build standalone binary with Bun
echo -e "${YELLOW}📦 Compiling standalone binary...${NC}"
bun build "$SOURCE_FILE" --compile --outfile "$BUILD_DIR/$CLI_NAME"

# Verify the binary was created
if [[ ! -f "$BUILD_DIR/$CLI_NAME" ]]; then
    echo -e "${RED}❌ Binary compilation failed${NC}"
    exit 1
fi

# Make it executable (should already be, but just in case)
chmod +x "$BUILD_DIR/$CLI_NAME"

# Create install directory if it doesn't exist
mkdir -p "$INSTALL_DIR"

# Copy to install directory
echo -e "${YELLOW}📦 Installing to $INSTALL_DIR...${NC}"
cp "$BUILD_DIR/$CLI_NAME" "$INSTALL_DIR/$CLI_NAME"

# Check if install directory is in PATH
if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
    echo -e "${YELLOW}⚠️  $INSTALL_DIR is not in your PATH${NC}"
    echo -e "${BLUE}💡 Add this to your shell profile (~/.bashrc, ~/.zshrc, etc.):${NC}"
    echo -e "${GREEN}export PATH=\"\$PATH:$INSTALL_DIR\"${NC}"
    echo ""
    
    # Offer to add to common shell profiles
    for profile in ~/.bashrc ~/.zshrc ~/.profile; do
        if [[ -f "$profile" ]]; then
            read -p "Add to $profile? (y/n): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                echo "export PATH=\"\$PATH:$INSTALL_DIR\"" >> "$profile"
                echo -e "${GREEN}✅ Added to $profile${NC}"
                echo -e "${YELLOW}🔄 Restart your shell or run: source $profile${NC}"
                break
            fi
        fi
    done
else
    echo -e "${GREEN}✅ $INSTALL_DIR is already in your PATH${NC}"
fi

# Test the installation
echo -e "${BLUE}🧪 Testing installation...${NC}"
if "$INSTALL_DIR/$CLI_NAME" --version &> /dev/null; then
    echo -e "${GREEN}✅ Enact CLI installed successfully!${NC}"
    echo -e "${BLUE}💫 Try running: ${GREEN}$CLI_NAME --help${NC}"
else
    echo -e "${RED}❌ Installation test failed${NC}"
    exit 1
fi

# Show binary info
echo ""
echo -e "${BLUE}📊 Binary info:${NC}"
ls -lh "$BUILD_DIR/$CLI_NAME"
echo -e "${GREEN}✨ Standalone binary - no runtime dependencies!${NC}"

# Show next steps
echo ""
echo -e "${BLUE}🎉 Installation complete!${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo -e "  1. Restart your terminal or run: ${GREEN}source ~/.bashrc${NC} (or your shell profile)"
echo -e "  2. Test with: ${GREEN}$CLI_NAME --version${NC}"
echo -e "  3. Get started: ${GREEN}$CLI_NAME --help${NC}"
echo ""
echo -e "${BLUE}🚀 Pro tip: This binary can be distributed to any compatible system!${NC}"
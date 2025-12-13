#!/bin/bash
#
# Setup script to link the local enact CLI for testing
#
# Usage:
#   ./scripts/link-enact.sh        # Link the CLI
#   ./scripts/link-enact.sh --unlink  # Remove the link
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CLI_DIR="$PROJECT_ROOT/packages/cli"
# Use ~/.local/bin which doesn't require sudo
LINK_DIR="$HOME/.local/bin"
LINK_PATH="$LINK_DIR/enact-dev"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

info() {
    echo -e "${GREEN}✓${NC} $1"
}

warn() {
    echo -e "${YELLOW}!${NC} $1"
}

error() {
    echo -e "${RED}✗${NC} $1"
    exit 1
}

unlink_enact() {
    if [ -L "$LINK_PATH" ]; then
        rm "$LINK_PATH"
        info "Removed symlink at $LINK_PATH"
    else
        warn "No symlink found at $LINK_PATH"
    fi
}

link_enact() {
    # Build the CLI first
    echo "Building CLI packages..."

    cd "$PROJECT_ROOT"

    # Build dependencies in order
    echo "  Building shared..."
    bun --cwd packages/shared run build > /dev/null 2>&1

    echo "  Building api..."
    bun --cwd packages/api run build > /dev/null 2>&1

    echo "  Building secrets..."
    bun --cwd packages/secrets run build > /dev/null 2>&1

    echo "  Building execution..."
    bun --cwd packages/execution run build > /dev/null 2>&1

    echo "  Building cli..."
    bun --cwd packages/cli run build > /dev/null 2>&1

    info "All packages built successfully"

    # Create the wrapper script
    WRAPPER_SCRIPT="$CLI_DIR/enact-dev"
    cat > "$WRAPPER_SCRIPT" << 'EOF'
#!/bin/bash
# Wrapper script for local enact development
# Resolve symlinks to get the real script directory
SOURCE="${BASH_SOURCE[0]}"
while [ -L "$SOURCE" ]; do
  DIR="$(cd -P "$(dirname "$SOURCE")" && pwd)"
  SOURCE="$(readlink "$SOURCE")"
  [[ $SOURCE != /* ]] && SOURCE="$DIR/$SOURCE"
done
SCRIPT_DIR="$(cd -P "$(dirname "$SOURCE")" && pwd)"
exec bun run "$SCRIPT_DIR/dist/index.js" "$@"
EOF
    chmod +x "$WRAPPER_SCRIPT"

    # Ensure ~/.local/bin exists
    mkdir -p "$LINK_DIR"

    # Remove existing symlink if present
    if [ -L "$LINK_PATH" ]; then
        rm "$LINK_PATH"
    fi

    # Create symlink
    ln -s "$WRAPPER_SCRIPT" "$LINK_PATH"

    info "Created symlink: $LINK_PATH -> $WRAPPER_SCRIPT"
    echo ""

    # Check if ~/.local/bin is in PATH
    if [[ ":$PATH:" != *":$LINK_DIR:"* ]]; then
        warn "$LINK_DIR is not in your PATH"
        echo ""

        # Detect shell config file
        SHELL_CONFIG=""
        if [ -n "$ZSH_VERSION" ] || [ "$SHELL" = "/bin/zsh" ]; then
            SHELL_CONFIG="$HOME/.zshrc"
        elif [ -n "$BASH_VERSION" ] || [ "$SHELL" = "/bin/bash" ]; then
            SHELL_CONFIG="$HOME/.bashrc"
        fi

        if [ -n "$SHELL_CONFIG" ] && [ -f "$SHELL_CONFIG" ]; then
            echo "Would you like to add it to your PATH automatically? [y/N]"
            read -r response
            if [[ "$response" =~ ^[Yy]$ ]]; then
                echo "" >> "$SHELL_CONFIG"
                echo "# Added by enact link-enact.sh" >> "$SHELL_CONFIG"
                echo "export PATH=\"\$HOME/.local/bin:\$PATH\"" >> "$SHELL_CONFIG"
                info "Added to $SHELL_CONFIG"
                echo ""
                echo "Run this to update your current session:"
                echo "  source $SHELL_CONFIG"
            else
                echo "Add it manually by adding this to your $SHELL_CONFIG:"
                echo ""
                echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
            fi
        else
            echo "Add it to your PATH by adding this to your shell config:"
            echo ""
            echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
        fi
        echo ""
        echo "Or run directly with the full path:"
        echo "  $LINK_PATH --help"
    else
        echo "You can now use 'enact-dev' to test the local CLI:"
        echo ""
        echo "  enact-dev --help"
        echo "  enact-dev get <tool> --verbose"
        echo "  enact-dev search <query>"
    fi

    echo ""
    echo "To rebuild after changes:"
    echo "  bun run build  # from project root"
    echo ""
    echo "To remove the symlink:"
    echo "  ./scripts/link-enact.sh --unlink"
}

# Main
case "${1:-}" in
    --unlink|-u)
        unlink_enact
        ;;
    --help|-h)
        echo "Usage: $0 [--unlink]"
        echo ""
        echo "Sets up a symlink to test the local enact CLI."
        echo ""
        echo "Options:"
        echo "  --unlink, -u  Remove the symlink"
        echo "  --help, -h    Show this help"
        ;;
    *)
        link_enact
        ;;
esac

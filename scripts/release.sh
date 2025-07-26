#!/bin/bash

# Enact Protocol Release Script
# Usage: ./scripts/release.sh [patch|minor|major] [--dry-run]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
VERSION_TYPE="patch"
DRY_RUN=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        patch|minor|major)
            VERSION_TYPE="$1"
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [patch|minor|major] [--dry-run]"
            echo ""
            echo "Arguments:"
            echo "  patch|minor|major  Version bump type (default: patch)"
            echo "  --dry-run         Show what would be done without making changes"
            echo ""
            echo "Examples:"
            echo "  $0 patch           # Bump patch version and publish"
            echo "  $0 minor --dry-run # Show what minor bump would do"
            exit 0
            ;;
        *)
            echo -e "${RED}Error: Unknown argument '$1'${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

echo -e "${BLUE}🚀 Enact Protocol Release Script${NC}"
echo -e "${BLUE}=================================${NC}"
echo ""

if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}⚠️  DRY RUN MODE - No changes will be made${NC}"
    echo ""
fi

echo -e "${BLUE}📋 Release Configuration:${NC}"
echo -e "  Version bump: ${GREEN}$VERSION_TYPE${NC}"
echo -e "  Dry run: ${GREEN}$DRY_RUN${NC}"
echo ""

# Function to run command with dry-run support
run_cmd() {
    local cmd="$1"
    local description="$2"
    
    echo -e "${BLUE}▶️  $description${NC}"
    if [ "$DRY_RUN" = true ]; then
        echo -e "${YELLOW}   Would run: $cmd${NC}"
    else
        echo -e "${GREEN}   Running: $cmd${NC}"
        eval "$cmd"
    fi
    echo ""
}

# Function to check if we're in a git repository
check_git_repo() {
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        echo -e "${RED}❌ Error: Not in a git repository${NC}"
        exit 1
    fi
}

# Function to check for uncommitted changes
check_clean_working_tree() {
    if ! git diff-index --quiet HEAD --; then
        echo -e "${RED}❌ Error: You have uncommitted changes${NC}"
        echo -e "${YELLOW}Please commit or stash your changes before releasing${NC}"
        exit 1
    fi
}

# Function to check if on main branch
check_main_branch() {
    local current_branch=$(git branch --show-current)
    if [ "$current_branch" != "main" ]; then
        echo -e "${YELLOW}⚠️  Warning: You're on branch '$current_branch', not 'main'${NC}"
        if [ "$DRY_RUN" = false ]; then
            read -p "Continue anyway? (y/N): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                echo -e "${RED}❌ Release cancelled${NC}"
                exit 1
            fi
        fi
    fi
}

# Preflight checks
echo -e "${BLUE}🔍 Preflight Checks${NC}"
echo -e "${BLUE}==================${NC}"

check_git_repo
check_clean_working_tree
check_main_branch

echo -e "${GREEN}✅ All preflight checks passed${NC}"
echo ""

# Main release flow
echo -e "${BLUE}📦 Release Flow${NC}"
echo -e "${BLUE}===============${NC}"

# Step 1: Sync versions across all packages
run_cmd "./scripts/sync-versions.sh" "Sync versions across all packages"

# Step 2: Bump version
run_cmd "./scripts/version-bump.sh $VERSION_TYPE $([ "$DRY_RUN" = true ] && echo '--dry-run')" "Bump $VERSION_TYPE version"

# Step 3: Run tests
run_cmd "npm test" "Run test suite"

# Step 4: Build all packages
run_cmd "npm run build" "Build all packages"

# Step 5: Run pre-publish checks
run_cmd "./scripts/pre-publish.sh" "Run pre-publish checks"

# Step 6: Deploy to npm (only if not dry run)
if [ "$DRY_RUN" = false ]; then
    echo -e "${YELLOW}📤 Ready to deploy to npm${NC}"
    echo -e "${YELLOW}⚠️  This will publish to npm registry${NC}"
    read -p "Continue with npm publish? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        run_cmd "./scripts/deploy-npm.sh" "Deploy to npm registry"
        
        # Step 7: Run post-publish tasks
        run_cmd "./scripts/post-publish.sh" "Run post-publish tasks"
        
        echo -e "${GREEN}🎉 Release completed successfully!${NC}"
        
        # Show the new version
        NEW_VERSION=$(node -p "require('./package.json').version")
        echo -e "${GREEN}📦 Published version: $NEW_VERSION${NC}"
        
        # Suggest creating a git tag
        echo -e "${BLUE}💡 Suggested next steps:${NC}"
        echo -e "  git tag v$NEW_VERSION"
        echo -e "  git push origin v$NEW_VERSION"
    else
        echo -e "${YELLOW}❌ Deployment cancelled${NC}"
        echo -e "${BLUE}💡 To deploy later, run:${NC}"
        echo -e "  ./scripts/deploy-npm.sh"
    fi
else
    echo -e "${YELLOW}📤 Would deploy to npm registry${NC}"
    echo -e "${YELLOW}📝 Would run post-publish tasks${NC}"
    echo -e "${GREEN}✅ Dry run completed successfully!${NC}"
fi

echo ""
echo -e "${BLUE}📋 Summary${NC}"
echo -e "${BLUE}==========${NC}"
echo -e "  Version type: ${GREEN}$VERSION_TYPE${NC}"
echo -e "  Dry run: ${GREEN}$DRY_RUN${NC}"
if [ "$DRY_RUN" = false ]; then
    echo -e "  Status: ${GREEN}Released${NC}"
else
    echo -e "  Status: ${YELLOW}Simulated${NC}"
fi
echo ""
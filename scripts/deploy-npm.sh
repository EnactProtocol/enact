#!/bin/bash

# deploy-npm.sh - Comprehensive NPM deployment script for Enact Protocol monorepo
# Publishes @enactprotocol/shared, @enactprotocol/mcp-server, @enactprotocol/mcp-dev-server, and @enactprotocol/cli packages

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PACKAGES=("shared" "mcp-server" "mcp-dev-server" "cli")
DRY_RUN=false
SKIP_TESTS=false
SKIP_BUILD=false
TAG="latest"

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Deploy Enact Protocol packages to NPM

OPTIONS:
    --dry-run           Show what would be published without actually publishing
    --skip-tests        Skip running tests before publishing
    --skip-build        Skip building packages before publishing
    --tag TAG           NPM dist-tag to publish with (default: latest)
    --package PKG       Only publish specific package (shared|mcp-server|cli)
    --help              Show this help message

EXAMPLES:
    $0                          # Full deployment with tests and build
    $0 --dry-run                # Preview what would be published
    $0 --package cli            # Only publish CLI package
    $0 --tag beta               # Publish with 'beta' tag
    $0 --skip-tests --skip-build # Quick publish (not recommended)

PACKAGES:
    - @enactprotocol/shared     (Core libraries and utilities)
    - @enactprotocol/mcp-server (MCP server implementation)  
    - @enactprotocol/cli        (Command line interface)

EOF
}

check_npm_auth() {
    log_info "Checking NPM authentication..."
    if ! npm whoami &>/dev/null; then
        log_error "Not logged in to NPM. Run 'npm login' first."
        exit 1
    fi
    local npm_user=$(npm whoami)
    log_success "Logged in to NPM as: $npm_user"
}

check_git_status() {
    log_info "Checking git repository status..."
    
    if [[ -n $(git status --porcelain) ]]; then
        log_warning "There are uncommitted changes in the repository:"
        git status --short
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_error "Deployment cancelled due to uncommitted changes"
            exit 1
        fi
    fi
    
    local current_branch=$(git branch --show-current)
    log_success "Repository clean, on branch: $current_branch"
}

get_package_version() {
    local package_path="$1"
    node -p "require('./$package_path/package.json').version"
}

get_package_name() {
    local package_path="$1"
    node -p "require('./$package_path/package.json').name"
}

check_package_exists() {
    local package_name="$1"
    local version="$2"
    
    log_info "Checking if $package_name@$version already exists on NPM..."
    
    if npm view "$package_name@$version" version &>/dev/null; then
        log_error "$package_name@$version already exists on NPM"
        return 1
    fi
    
    log_success "$package_name@$version is available for publishing"
    return 0
}

run_tests() {
    if [[ "$SKIP_TESTS" == "true" ]]; then
        log_warning "Skipping tests (--skip-tests flag used)"
        return 0
    fi
    
    log_info "Running tests..."
    
    if ! bun run test; then
        log_error "Tests failed! Fix tests before deploying."
        exit 1
    fi
    
    log_success "All tests passed"
}

build_packages() {
    if [[ "$SKIP_BUILD" == "true" ]]; then
        log_warning "Skipping build (--skip-build flag used)"
        return 0
    fi
    
    log_info "Building all packages..."
    
    if ! bun run build; then
        log_error "Build failed! Fix build errors before deploying."
        exit 1
    fi
    
    log_success "All packages built successfully"
}

publish_package() {
    local package="$1"
    local package_path="packages/$package"
    
    if [[ ! -d "$package_path" ]]; then
        log_error "Package directory '$package_path' not found"
        return 1
    fi
    
    local package_name=$(get_package_name "$package_path")
    local version=$(get_package_version "$package_path")
    
    log_info "Publishing $package_name@$version..."
    
    # Check if version already exists
    if ! check_package_exists "$package_name" "$version"; then
        log_warning "Skipping $package_name (version already exists)"
        return 0
    fi
    
    # Navigate to package directory
    pushd "$package_path" > /dev/null
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would publish $package_name@$version with tag '$TAG'"
        npm pack --dry-run
    else
        # Actual publish
        if npm publish --tag "$TAG" --access public; then
            log_success "Published $package_name@$version"
        else
            log_error "Failed to publish $package_name@$version"
            popd > /dev/null
            return 1
        fi
    fi
    
    popd > /dev/null
    return 0
}

verify_published_packages() {
    if [[ "$DRY_RUN" == "true" ]]; then
        return 0
    fi
    
    log_info "Verifying published packages..."
    
    for package in "${SELECTED_PACKAGES[@]}"; do
        local package_path="packages/$package"
        local package_name=$(get_package_name "$package_path")
        local version=$(get_package_version "$package_path")
        
        log_info "Verifying $package_name@$version..."
        
        if npm view "$package_name@$version" version &>/dev/null; then
            log_success "$package_name@$version is available on NPM"
        else
            log_warning "$package_name@$version not found on NPM (may take a few minutes to propagate)"
        fi
    done
}

main() {
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --skip-tests)
                SKIP_TESTS=true
                shift
                ;;
            --skip-build)
                SKIP_BUILD=true
                shift
                ;;
            --tag)
                TAG="$2"
                shift 2
                ;;
            --package)
                SINGLE_PACKAGE="$2"
                shift 2
                ;;
            --help)
                print_usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                print_usage
                exit 1
                ;;
        esac
    done
    
    # Determine which packages to deploy
    if [[ -n "$SINGLE_PACKAGE" ]]; then
        if [[ " ${PACKAGES[@]} " =~ " $SINGLE_PACKAGE " ]]; then
            SELECTED_PACKAGES=("$SINGLE_PACKAGE")
        else
            log_error "Invalid package: $SINGLE_PACKAGE. Available: ${PACKAGES[*]}"
            exit 1
        fi
    else
        SELECTED_PACKAGES=("${PACKAGES[@]}")
    fi
    
    # Script header
    echo
    log_info "🚀 Enact Protocol NPM Deployment Script"
    log_info "Packages to deploy: ${SELECTED_PACKAGES[*]}"
    log_info "NPM tag: $TAG"
    [[ "$DRY_RUN" == "true" ]] && log_warning "DRY RUN MODE - No actual publishing"
    echo
    
    # Pre-flight checks
    check_npm_auth
    check_git_status
    
    # Prepare workspace for publishing (unlink, sync versions, etc.)
    log_info "Preparing workspace for publishing..."
    if ! ./scripts/pre-publish.sh; then
        log_error "Pre-publish preparation failed!"
        exit 1
    fi
    log_success "Workspace prepared for publishing"
    
    # Note: pre-publish.sh already runs tests and builds, but we can run them again if needed
    # run_tests  # Uncomment if you want to run tests again
    # build_packages  # Uncomment if you want to build again
    
    # Show what will be published
    log_info "Package versions that will be published:"
    for package in "${SELECTED_PACKAGES[@]}"; do
        local package_path="packages/$package"
        local package_name=$(get_package_name "$package_path")
        local version=$(get_package_version "$package_path")
        echo "  📦 $package_name@$version"
    done
    echo
    
    # Confirmation prompt (skip in dry-run)
    if [[ "$DRY_RUN" != "true" ]]; then
        read -p "Proceed with publishing? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_warning "Deployment cancelled by user"
            exit 0
        fi
    fi
    
    # Publish packages in dependency order (shared first, then mcp-server, then cli)
    local failed_packages=()
    
    for package in "${SELECTED_PACKAGES[@]}"; do
        if ! publish_package "$package"; then
            failed_packages+=("$package")
        fi
    done
    
    # Report results
    echo
    if [[ ${#failed_packages[@]} -eq 0 ]]; then
        log_success "🎉 All packages published successfully!"
        verify_published_packages
    else
        log_error "❌ Some packages failed to publish: ${failed_packages[*]}"
        exit 1
    fi
    
    # Post-deployment information
    if [[ "$DRY_RUN" != "true" ]]; then
        echo
        log_info "📋 Post-deployment checklist:"
        echo "  • Check packages on npmjs.com"
        echo "  • Test installation: npm install -g @enactprotocol/cli"
        echo "  • Update documentation if needed"
        echo "  • Create GitHub release if this is a major version"
        echo
    fi
}

# Change to project root directory
cd "$(dirname "$0")/.."

# Run main function
main "$@"
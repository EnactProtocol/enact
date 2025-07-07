#!/bin/bash

# version-bump.sh - Version management script for Enact Protocol monorepo
# Synchronizes versions across all packages and creates git tags

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

print_usage() {
    cat << EOF
Usage: $0 [VERSION_TYPE|VERSION] [OPTIONS]

Bump version across all packages in the monorepo

VERSION_TYPE:
    patch       Increment patch version (1.0.0 -> 1.0.1)
    minor       Increment minor version (1.0.0 -> 1.1.0)  
    major       Increment major version (1.0.0 -> 2.0.0)
    VERSION     Specific version (e.g., 2.1.3)

OPTIONS:
    --no-git    Don't create git commit and tag
    --dry-run   Show what would be changed without making changes
    --help      Show this help message

EXAMPLES:
    $0 patch                    # Bump patch version
    $0 minor                    # Bump minor version
    $0 major                    # Bump major version  
    $0 2.1.0                    # Set specific version
    $0 patch --dry-run          # Preview patch bump
    $0 minor --no-git           # Bump minor without git operations

EOF
}

get_current_version() {
    node -p "require('./package.json').version"
}

calculate_new_version() {
    local current="$1"
    local type="$2"
    
    case "$type" in
        patch)
            node -p "
                const [major, minor, patch] = '$current'.split('.').map(Number);
                \`\${major}.\${minor}.\${patch + 1}\`;
            "
            ;;
        minor)
            node -p "
                const [major, minor] = '$current'.split('.').map(Number);
                \`\${major}.\${minor + 1}.0\`;
            "
            ;;
        major)
            node -p "
                const [major] = '$current'.split('.').map(Number);
                \`\${major + 1}.0.0\`;
            "
            ;;
        *)
            echo "$type"  # Assume it's a specific version
            ;;
    esac
}

validate_version() {
    local version="$1"
    if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        log_error "Invalid version format: $version (expected: x.y.z)"
        return 1
    fi
    return 0
}

update_package_version() {
    local package_path="$1"
    local new_version="$2"
    local dry_run="$3"
    
    if [[ ! -f "$package_path/package.json" ]]; then
        log_error "Package.json not found: $package_path/package.json"
        return 1
    fi
    
    local package_name=$(node -p "require('./$package_path/package.json').name")
    
    if [[ "$dry_run" == "true" ]]; then
        log_info "DRY RUN: Would update $package_name to $new_version"
    else
        log_info "Updating $package_name to $new_version..."
        
        # Update package.json directly using Node.js to handle workspace dependencies
        node -e "
            const fs = require('fs');
            const path = './$package_path/package.json';
            const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));
            pkg.version = '$new_version';
            fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
        "
        
        log_success "Updated $package_name"
    fi
}

check_workspace_dependencies() {
    log_info "Checking workspace dependencies..."
    
    # Check if any package depends on others via workspace: protocol
    local has_workspace_deps=false
    
    for package_dir in packages/*/; do
        if [[ -f "$package_dir/package.json" ]]; then
            if grep -q '"workspace:\*"' "$package_dir/package.json"; then
                has_workspace_deps=true
                local package_name=$(node -p "require('./$package_dir/package.json').name")
                log_info "$package_name uses workspace dependencies"
            fi
        fi
    done
    
    if [[ "$has_workspace_deps" == "true" ]]; then
        log_success "Workspace dependencies detected - versions will be synchronized"
    else
        log_info "No workspace dependencies found"
    fi
}

create_git_commit_and_tag() {
    local new_version="$1"
    local no_git="$2"
    local dry_run="$3"
    
    if [[ "$no_git" == "true" ]]; then
        log_warning "Skipping git operations (--no-git flag used)"
        return 0
    fi
    
    if [[ "$dry_run" == "true" ]]; then
        log_info "DRY RUN: Would create git commit and tag v$new_version"
        return 0
    fi
    
    log_info "Creating git commit and tag..."
    
    # Add all package.json changes
    git add package.json packages/*/package.json
    
    # Create commit
    git commit -m "chore: bump version to $new_version

- Updated all package versions to $new_version
- Synchronized workspace dependencies"
    
    # Create tag
    git tag -a "v$new_version" -m "Release v$new_version"
    
    log_success "Created commit and tag v$new_version"
    log_info "Push with: git push && git push --tags"
}

main() {
    local version_type=""
    local no_git=false
    local dry_run=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --no-git)
                no_git=true
                shift
                ;;
            --dry-run)
                dry_run=true
                shift
                ;;
            --help)
                print_usage
                exit 0
                ;;
            -*)
                log_error "Unknown option: $1"
                print_usage
                exit 1
                ;;
            *)
                if [[ -z "$version_type" ]]; then
                    version_type="$1"
                else
                    log_error "Too many arguments"
                    print_usage
                    exit 1
                fi
                shift
                ;;
        esac
    done
    
    # Check if version type provided
    if [[ -z "$version_type" ]]; then
        log_error "Version type or version number required"
        print_usage
        exit 1
    fi
    
    # Header
    echo
    log_info "🏷️  Enact Protocol Version Management"
    [[ "$dry_run" == "true" ]] && log_warning "DRY RUN MODE - No actual changes"
    echo
    
    # Get current version
    local current_version=$(get_current_version)
    log_info "Current version: $current_version"
    
    # Calculate new version
    local new_version=$(calculate_new_version "$current_version" "$version_type")
    
    # Validate new version
    if ! validate_version "$new_version"; then
        exit 1
    fi
    
    log_info "New version: $new_version"
    
    # Check if version is actually changing
    if [[ "$current_version" == "$new_version" ]]; then
        log_warning "Version is already $new_version"
        exit 0
    fi
    
    # Check workspace dependencies
    check_workspace_dependencies
    
    # List packages that will be updated
    echo
    log_info "Packages to be updated:"
    echo "  📦 @enactprotocol/monorepo (root)"
    echo "  📦 @enactprotocol/shared"  
    echo "  📦 @enactprotocol/mcp-server"
    echo "  📦 @enactprotocol/cli"
    echo
    
    # Confirmation prompt (skip in dry-run)
    if [[ "$dry_run" != "true" ]]; then
        read -p "Proceed with version bump? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_warning "Version bump cancelled by user"
            exit 0
        fi
    fi
    
    # Update versions
    log_info "Updating package versions..."
    
    # Update root package.json
    update_package_version "." "$new_version" "$dry_run"
    
    # Update all workspace packages
    for package_dir in packages/*/; do
        if [[ -d "$package_dir" ]]; then
            update_package_version "$package_dir" "$new_version" "$dry_run"
        fi
    done
    
    # Create git commit and tag
    create_git_commit_and_tag "$new_version" "$no_git" "$dry_run"
    
    # Success message
    echo
    if [[ "$dry_run" == "true" ]]; then
        log_success "✨ DRY RUN: Would bump all packages to $new_version"
    else
        log_success "✨ All packages bumped to $new_version"
        echo
        log_info "📋 Next steps:"
        echo "  • Review changes: git show"
        echo "  • Push changes: git push && git push --tags"
        echo "  • Deploy to NPM: ./scripts/deploy-npm.sh"
        echo
    fi
}

# Change to project root
cd "$(dirname "$0")/.."

# Run main function
main "$@"
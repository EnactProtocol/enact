# Development Guide

This guide covers the development workflow for the Enact CLI monorepo, including workspace linking, testing, and publishing.

## 🏗️ Project Structure

```
enact-cli/
├── packages/
│   ├── shared/          # Core functionality and utilities
│   ├── cli/             # Main CLI application
│   ├── mcp-server/      # MCP server for AI integration
│   └── mcp-dev-server/  # Development workflow MCP server
├── scripts/             # Build and deployment scripts
├── examples/            # Example tool definitions
└── docs/               # Documentation
```

## 🚀 Quick Start

```bash
# Clone and setup
git clone <repository-url>
cd enact-cli
bun install

# Link packages for development
bun run link
```

## 📦 Package Dependencies

### Internal Dependencies
- **`@enactprotocol/shared`**: Core functionality (used by all other packages)
- **`@enactprotocol/cli`**: Main CLI application (depends on shared)
- **`@enactprotocol/mcp-server`**: MCP server (depends on shared)
- **`@enactprotocol/mcp-dev-server`**: Development MCP server (depends on shared)

### External Dependencies
- **`@enactprotocol/security`**: External security package (published separately)

## 🔗 Development Workflow

### Workspace Linking

During development, packages are linked using `bun link` which creates symlinks between workspace packages. This allows you to see changes immediately without rebuilding.

```bash
# Setup development environment
bun run link

# Verify links are working
ls -la packages/*/node_modules/@enactprotocol/shared
# Should show symlinks (->)
```

### Making Changes

1. **Edit code** in any package
2. **Changes are immediately available** in dependent packages (due to symlinks)
3. **Run tests**: `bun test`
4. **Build if needed**: `bun run build`

### Version Management

When you update the version of a shared package:

```bash
# 1. Update version in packages/shared/package.json
vim packages/shared/package.json

# 2. Sync all internal references
bun run sync-versions
```

The sync script automatically updates all internal package dependencies to match the current versions.

## 🧪 Testing

```bash
# Run all tests
bun test

# Run tests for specific packages
bun run test:cli
bun run test:mcp
bun run test:shared

# Run with coverage
bun run test:coverage

# Watch mode
bun run test:watch
```

## 🏗️ Building

```bash
# Build all packages
bun run build

# Build specific packages
bun run build:shared
bun run build:cli
bun run build:mcp
```

## 📋 Available Scripts

### Development Scripts
- `bun run link` - Setup workspace linking for development
- `bun run unlink` - Remove workspace links
- `bun run sync-versions` - Sync internal package versions
- `bun run dev` - Start CLI in development mode
- `bun run dev:mcp` - Start MCP server in development mode

### Build Scripts
- `bun run build` - Build all packages
- `bun run build:shared` - Build shared package
- `bun run build:cli` - Build CLI package
- `bun run build:mcp` - Build MCP server package

### Test Scripts
- `bun run test` - Run all tests
- `bun run test:all` - Run all tests including integration
- `bun run test:integration` - Run integration tests only
- `bun run test:watch` - Run tests in watch mode
- `bun run test:coverage` - Run tests with coverage

### Publishing Scripts
- `bun run pre-publish` - Prepare workspace for publishing
- `bun run post-publish` - Restore development environment
- `bun run deploy` - Full deployment process

## 🚀 Publishing Workflow

### Pre-Publish Preparation

Before publishing, the workspace must be prepared to remove symlinks and use exact versions:

```bash
bun run pre-publish
```

This script performs the following steps:
- ✅ Unlinks all workspace dependencies
- ✅ Syncs package versions
- ✅ Installs exact versions from registry
- ✅ Builds all packages
- ✅ Runs tests
- ✅ Verifies no workspace references remain
- ✅ Verifies no symlinks exist

### Publishing

```bash
bun run deploy
```

The deploy script automatically:
1. Runs pre-publish preparation
2. Publishes packages in dependency order (shared → cli/mcp)
3. Restores development environment

### Post-Publish Restoration

After publishing, the development environment is automatically restored:

```bash
bun run post-publish
```

This script:
- ✅ Restores workspace links
- ✅ Reinstalls with symlinks
- ✅ Ready for continued development

## 🔧 Troubleshooting

### Broken Links

If workspace links become corrupted:

```bash
# Reset all links
bun run unlink
bun run link
```

### Version Mismatches

If internal package versions get out of sync:

```bash
# Sync all versions
bun run sync-versions
```

### Publishing Issues

If you encounter issues during publishing:

```bash
# Ensure clean state
bun run pre-publish
# Check for any reported issues
# Fix issues and try again
```

### Development Environment Issues

For a complete reset of the development environment:

```bash
# Complete reset
bun run unlink
rm -rf node_modules packages/*/node_modules
bun install
bun run link
```

### Common Issues

#### "Cannot find module '@enactprotocol/shared'"

This usually means workspace links are broken:

```bash
bun run link
```

#### "Package versions don't match"

Internal package versions are out of sync:

```bash
bun run sync-versions
```

#### "Found workspace references in published package"

The pre-publish script detected workspace references that would break npm publishing:

```bash
bun run pre-publish
# Check the output for specific files with workspace references
```

## 🔍 Verification Commands

### Check Workspace Links

```bash
# Verify all packages are properly linked
ls -la packages/*/node_modules/@enactprotocol/shared

# Should show symlinks like:
# packages/cli/node_modules/@enactprotocol/shared -> ../../../shared
# packages/mcp-server/node_modules/@enactprotocol/shared -> ../../../shared
```

### Check Package Versions

```bash
# Check all package versions
grep '"version"' packages/*/package.json

# Check internal dependency versions
grep '@enactprotocol/shared' packages/*/package.json
```

### Check for Workspace References

```bash
# Should return no results when ready for publishing
grep -r "workspace:" packages/*/package.json
```

## 📝 Development Tips

### Hot Reloading

With workspace links enabled, changes to the shared package are immediately available in dependent packages without rebuilding.

### Testing Changes

Always test changes across all packages:

```bash
# Make changes to shared package
vim packages/shared/src/core/index.ts

# Test in CLI
cd packages/cli && bun test

# Test in MCP server
cd packages/mcp-server && bun test
```

### Version Bumping

When releasing new versions:

```bash
# 1. Update the main version
bun run version:patch  # or version:minor, version:major

# 2. Sync internal dependencies
bun run sync-versions

# 3. Test everything
bun test

# 4. Deploy
bun run deploy
```

### Working with External Dependencies

External dependencies like `@enactprotocol/security` should always use exact versions, never workspace references.

## 🎯 Best Practices

1. **Always use workspace links during development** - enables hot reloading
2. **Run sync-versions after version changes** - keeps dependencies consistent
3. **Use pre-publish before deploying** - ensures clean npm packages
4. **Test across all packages** - changes in shared affect everything
5. **Commit package.json changes together** - keeps versions in sync in git

## 📚 Additional Resources

- [Bun Workspaces Documentation](https://bun.sh/docs/install/workspaces)
- [Package.json Dependencies](https://docs.npmjs.com/specifying-dependencies-and-devdependencies-in-a-package-json-file)
- [Semantic Versioning](https://semver.org/)

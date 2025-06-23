# Enact CLI Test Suite

This directory contains comprehensive tests for the Enact CLI commands and core functionality.

## Test Organization

### Directory Structure
```
tests/
├── commands/           # Command-specific tests
│   ├── env.test.ts    # Environment variable management (30 tests)
│   ├── user.test.ts   # User operations (20 tests)
│   ├── exec.test.ts   # Execution command migration (18 tests)
│   ├── publish.test.ts # Publish command migration (16 tests)
│   └── search.test.ts # Search command functionality (13 tests)
├── core/              # Core library tests
│   └── core.search.test.ts # EnactCore search functionality (16 tests)
├── integration/       # Integration tests
│   └── search-integration.test.ts # Search integration (5 tests, 3 skipped)
└── helpers/           # Shared test utilities
    └── test-utils.ts  # Common test setup and helpers
```

## Test Coverage

### Total Test Count
- **227 passing tests**
- **3 skipped integration tests** (network-dependent)
- **0 failing tests**

### Command Tests (82 tests)
- **env.test.ts** - Environment variable management command (30 tests)
- **user.test.ts** - User operations command (20 tests)
- **exec.test.ts** - Execution command migration (18 tests)
- **publish.test.ts** - Publish command migration (16 tests)

### Core Functionality Tests (29 tests)
- **core.search.test.ts** - EnactCore search functionality (16 tests)
- **search.test.ts** - Search command functionality (13 tests)

### Integration Tests (8 tests)
- **search-integration.test.ts** - Integration tests for search (5 tests, 3 skipped)

**Note about skipped tests:** The 3 skipped tests are integration tests that require network access to test against real APIs. They are intentionally skipped by default to avoid:
- Network dependencies in CI/CD pipelines  
- Flaky tests due to network issues
- API rate limiting and external service dependencies

To run integration tests locally: `INTEGRATION_TESTS=true bun test tests/integration/`

## Test Categories

### Command Structure Tests
- Help command validation
- Subcommand recognition
- Options processing
- Error handling
- TypeScript interface compliance

### Integration Tests
- Command workflow validation
- File operations
- Configuration management
- API integration

### Core Library Tests
- Search functionality
- Tool parsing (YAML/JSON)
- Error handling
- API communication
- Mock-based unit testing

## Shared Test Utilities

The `helpers/test-utils.ts` file provides:
- **Console mocking** - Capture and validate console output
- **Environment setup** - Isolated test environments with cleanup
- **Command testing helpers** - Standardized command validation
- **Global cleanup** - Remove temporary test directories

## Recent Improvements

### ✅ Test Organization Refactor
- Moved all tests into organized subdirectories
- Created shared test utilities for consistency
- Standardized test patterns across all command tests

### ✅ Enhanced Test Coverage
- Added comprehensive command validation tests
- Improved error handling test coverage
- Created mock-based core functionality tests

### ✅ Fixed Test Infrastructure Issues
- Resolved timeout issues in core search tests
- Fixed import path issues after reorganization
- Improved temporary directory cleanup to prevent leftover folders

## Running Tests

```bash
# Run all tests (skips integration tests by default)
bun test

# Run tests in watch mode
bun test --watch

# Run specific test file
bun test tests/env.test.ts

# Run integration tests (requires network access)
INTEGRATION_TESTS=true bun test tests/integration/

# Run with coverage (using vitest)
npm run test:coverage
```

## Integration Tests

Integration tests are **skipped by default** because they:
- Require network access to external APIs
- Can be flaky due to network conditions
- May hit API rate limits
- Create external dependencies in CI/CD

To run them locally for development:
```bash
INTEGRATION_TESTS=true bun test tests/integration/search-integration.test.ts
```

## Test Structure

Each test file follows a consistent structure:
- Descriptive test suites organized by functionality
- Proper setup/teardown with beforeEach/afterEach
- Mock management for external dependencies
- Comprehensive error case coverage
- Type safety validation

## New Command Tests Added

Added comprehensive tests for:
1. **Environment Command (`env.test.ts`)** - Covers environment variable management with package namespacing
2. **User Command (`user.test.ts`)** - Covers user operations including public key retrieval

These tests validate command structure, help text, option processing, error handling, and TypeScript interface compliance without requiring complex mocking of interactive prompts.

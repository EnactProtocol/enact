# enact run

Execute a tool with its manifest-defined command in a containerized environment.

## Synopsis

```bash
enact run <tool> [options]
```

## Description

The `run` command executes a tool using the command defined in its manifest (`enact.yaml` or `enact.md`). The tool runs in an isolated container environment with:

- Input validation against the tool's JSON Schema
- Automatic secret resolution from the OS keyring
- Environment variable injection from `.env` files
- Shell-safe parameter interpolation

## Arguments

| Argument | Description |
|----------|-------------|
| `<tool>` | Tool to run. Can be a tool name (`alice/utils/greeter`), a path (`./my-tool`), or `.` for the current directory |

## Options

| Option | Description |
|--------|-------------|
| `-a, --args <json>` | Input arguments as a JSON object |
| `-i, --input <value>` | Input: `key=value` for params, `./path` for files/directories, `name=./path` for named inputs |
| `-o, --output <path>` | Export `/output` directory to this path after execution |
| `--apply` | Apply output back to input directory atomically (for in-place transformations) |
| `-t, --timeout <duration>` | Execution timeout (e.g., `30s`, `5m`, `1h`) |
| `--no-cache` | Disable container caching |
| `--local` | Only resolve from local sources |
| `--dry-run` | Show what would be executed without running |
| `--debug` | Show detailed parameter and environment resolution |
| `-v, --verbose` | Show detailed output including stderr and timing |
| `--json` | Output result as JSON |

## Examples

### Basic execution

```bash
# Run a tool with JSON arguments
enact run alice/utils/greeter --args '{"name":"World"}'

# Run a tool with key=value arguments
enact run alice/utils/greeter --input name=World

# Run a tool from current directory
enact run . --args '{"input":"test.txt"}'
```

### Advanced options

```bash
# Run with timeout
enact run slow-tool --args '{}' --timeout 5m

# Dry run to preview execution
enact run alice/utils/greeter --args '{"name":"World"}' --dry-run

# Get JSON output for scripting
enact run alice/utils/greeter --args '{"name":"World"}' --json

# Verbose mode for debugging
enact run alice/utils/greeter --args '{"name":"World"}' --verbose

# Debug parameter resolution
enact run alice/utils/greeter --args '{"name":"World"}' --debug
```

### Multiple inputs

```bash
# Mix JSON and key=value
enact run my-tool --args '{"config":{"debug":true}}' --input file=input.txt

# Multiple key=value pairs
enact run my-tool --input name=test --input count=5 --input enabled=true
```

### Input Files and Directories

Mount files or directories into the container for file-based tools:

```bash
# Single file input (mounted to /input/<filename>)
enact run my-tool --input ./document.pdf

# Single directory input (mounted to /input)
enact run my-tool --input ./data

# Named inputs (mounted to /inputs/<name>)
enact run my-tool --input left=./old --input right=./new
```

### Output Export

Export the container's `/output` directory to the host:

```bash
# Export output to a local directory
enact run my-tool --input ./src --output ./dist

# The tool writes to /output inside the container
# After execution, /output is copied to ./dist
```

### In-Place Transformations with --apply

For tools that transform data in-place (formatters, linters with --fix, etc.):

```bash
# Apply changes atomically back to the input directory
enact run formatter --input ./src --output ./src --apply

# What happens:
# 1. ./src is mounted read-only to /input
# 2. Tool processes files and writes to /output
# 3. On success, ./src is atomically replaced with /output contents
# 4. On failure, ./src remains unchanged
```

**Notes:**
- `--apply` requires exactly one unnamed directory input
- `--apply` requires `--output` to be specified
- Changes are atomic: either all succeed or original is preserved
- Tool source files are mounted to `/workspace` by default

## Input Resolution

Inputs are resolved in the following priority order:

1. `--input` key=value pairs (highest priority)
2. `--args` JSON object
3. Default values from the manifest's `inputSchema`

## Environment Resolution

The command automatically resolves environment variables:

1. **Secrets** (env vars with `secret: true` in manifest):
   - Resolved from OS keyring using namespace inheritance
   - Never written to disk or shown in output

2. **Environment variables** (env vars with `secret: false`):
   - Resolved from local `.enact/.env` (project)
   - Then from `~/.enact/.env` (global)
   - Then from manifest defaults

## Dry Run Output

When using `--dry-run`, the command shows:

- Tool name and version
- Container image that would be used
- All input parameters
- Environment variables (secrets masked as `***`)
- The interpolated command

## Debug Output

When using `--debug`, the command shows detailed parameter resolution:

- Schema properties with types and required/optional status
- Raw inputs (exactly what was provided)
- Inputs after defaults were applied
- Final inputs after validation and type coercion
- Environment variables (sensitive values masked)
- The final interpolated command

This is useful for troubleshooting parameter issues and understanding how optional parameters are handled.

## Exit Codes

| Code | Description |
|------|-------------|
| `0` | Successful execution |
| `1` | Execution failed or error |
| `2` | Invalid arguments |
| `3` | Tool not found |

## See Also

- [enact exec](../exec/README.md) - Execute arbitrary commands in a tool's container
- [enact install](../install/README.md) - Install tools
- [enact env](../env/README.md) - Manage environment variables and secrets

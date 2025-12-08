# enact exec

Execute an arbitrary command in a tool's container environment.

## Synopsis

```bash
enact exec <tool> "<command>" [options]
```

## Description

The `exec` command allows you to run any command inside a tool's container environment, not just the manifest-defined command. This is useful for:

- Debugging and inspecting tool containers
- Running one-off commands in a tool's environment
- Testing commands before adding them to a manifest
- Exploring tool dependencies and file structure

The container environment includes:
- The same base image defined in the manifest
- All environment variables and secrets
- The tool's source directory mounted

## Arguments

| Argument | Description |
|----------|-------------|
| `<tool>` | Tool to run in. Can be a tool name, path, or `.` for current directory |
| `<command>` | Command to execute. Quote complex commands with spaces or special characters |

## Options

| Option | Description |
|--------|-------------|
| `-t, --timeout <duration>` | Execution timeout (e.g., `30s`, `5m`, `1h`) |
| `-v, --verbose` | Show detailed output including stderr and timing |
| `--json` | Output result as JSON |

## Examples

### Basic usage

```bash
# View the tool's manifest
enact exec alice/utils/greeter "cat enact.md"

# List files in the container
enact exec alice/utils/greeter "ls -la"

# Check installed packages
enact exec python-tool "pip list"
```

### Debugging

```bash
# Interactive shell exploration
enact exec my-tool "sh -c 'echo $PATH && which python'"

# Check environment variables
enact exec my-tool "env | sort"

# Test a command before adding to manifest
enact exec my-tool "python --version"
```

### With options

```bash
# Long-running command with timeout
enact exec my-tool "sleep 10 && echo done" --timeout 30s

# Verbose output for debugging
enact exec my-tool "some-command" --verbose

# JSON output for scripting
enact exec my-tool "cat config.json" --json
```

## Differences from `enact run`

| Feature | `enact run` | `enact exec` |
|---------|-------------|--------------|
| Command | Manifest-defined | User-specified |
| Input validation | Yes (via inputSchema) | No |
| Parameter interpolation | Yes (`${param}`) | No |
| Use case | Production execution | Debugging/exploration |

## Security Note

The `exec` command runs with the same isolation as `run`:
- Commands execute inside the container
- Secrets are injected as environment variables
- Network access follows manifest settings

However, since you can run arbitrary commands, be careful when using `exec` with untrusted tools.

## Exit Codes

| Code | Description |
|------|-------------|
| `0` | Successful execution |
| `1` | Execution failed or error |
| `3` | Tool not found |

## See Also

- [enact run](../run/README.md) - Execute a tool's manifest-defined command
- [enact install](../install/README.md) - Install tools

# enact list

List installed tools.

## Synopsis

```bash
enact list [options]
```

## Description

The `list` command displays installed tools, showing their name and version. By default, it shows project tools. Use `-g` to show global tools.

## Options

| Option | Description |
|--------|-------------|
| `-g, --global` | List global tools (`~/.enact/tools/`) |
| `-v, --verbose` | Show detailed output including file paths |
| `--json` | Output as JSON |

## Examples

### Basic usage

```bash
# List project tools (default)
enact list

# List global tools
enact list -g

# List with full paths
enact list --verbose
```

### JSON output

```bash
# Get JSON for scripting
enact list --json

# Global tools as JSON
enact list -g --json
```

## Output Format

### Table Output (Default)

```
Project Tools
─────────────

Name                          Version
────────────────────────────────────────
alice/utils/greeter           1.0.0
company/internal-tool         0.5.0

Total: 2 tool(s)
```

### Global Tools

```
Global Tools
────────────

Name                          Version
────────────────────────────────────────
EnactProtocol/pdf-extract     2.1.0

Total: 1 tool(s)
```

### Verbose Output

```
Name                          Version      Location
──────────────────────────────────────────────────────────────────────
alice/utils/greeter           1.0.0        /path/to/project/.enact/tools/alice/utils/greeter
```

### JSON Output

```json
[
  {
    "name": "alice/utils/greeter",
    "version": "1.0.0",
    "location": "/path/to/project/.enact/tools/alice/utils/greeter",
    "scope": "project"
  }
]
```

## Tool Locations

| Scope | Directory | Description |
|-------|-----------|-------------|
| `project` | `.enact/tools/` | Tools installed for the current project |
| `global` | `~/.enact/tools/` | Tools installed globally for the user |

## Exit Codes

| Code | Description |
|------|-------------|
| `0` | Success |
| `1` | Error reading directories |

## See Also

- [enact install](../install/README.md) - Install tools
- [enact run](../run/README.md) - Execute tools

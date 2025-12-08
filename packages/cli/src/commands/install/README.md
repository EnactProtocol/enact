# enact install

Install a tool to the project or user directory.

## Synopsis

```bash
enact install [tool] [options]
```

## Description

The `install` command copies a tool to either the project's `.enact/tools/` directory (default) or the user's `~/.enact/tools/` directory (with `--global`). This makes the tool available for execution without specifying the full path.

## Arguments

| Argument | Description |
|----------|-------------|
| `[tool]` | Tool to install. Can be a tool name, path, `.` for current directory, or omitted to install from `tools.json` |

## Options

| Option | Description |
|--------|-------------|
| `-g, --global` | Install to user directory (`~/.enact/tools/`) instead of project |
| `-f, --force` | Overwrite existing installation without prompting |
| `-v, --verbose` | Show detailed output |
| `--json` | Output result as JSON |

## Installation Scopes

### Project Scope (Default)

```bash
enact install alice/utils/greeter
```

Installs to `.enact/tools/alice/utils/greeter/` in your project. This is ideal for:
- Tools specific to a project
- Team collaboration (commit `.enact/tools.json`)
- Reproducible builds

### Global Scope

```bash
enact install alice/utils/greeter --global
```

Installs to `~/.enact/tools/alice/utils/greeter/`. This is ideal for:
- Tools you use across multiple projects
- Personal utility tools
- System-wide availability

## Examples

### Install from registry (future)

```bash
# Install to project
enact install alice/utils/greeter

# Install globally
enact install alice/utils/greeter --global
```

### Install from local path

```bash
# Install current directory as a tool
enact install .

# Install from a specific path
enact install ./my-tools/greeter

# Install with absolute path
enact install /path/to/tool
```

### Install all project tools

```bash
# Install all tools defined in .enact/tools.json
enact install
```

### Force reinstall

```bash
# Overwrite existing installation
enact install alice/utils/greeter --force
```

## Tool Resolution

When installing by name, the command searches for the tool in this order:

1. Project tools (`.enact/tools/`)
2. User tools (`~/.enact/tools/`)
3. Cache (`~/.enact/cache/`)
4. Registry (future)

## Directory Structure

After installation, tools are organized by their namespaced name:

```
.enact/tools/
├── alice/
│   └── utils/
│       └── greeter/
│           ├── enact.md
│           └── ...
└── EnactProtocol/
    └── pdf-extract/
        ├── enact.yaml
        └── ...
```

## tools.json

The `.enact/tools.json` file tracks project dependencies:

```json
{
  "tools": {
    "alice/utils/greeter": "^1.0.0",
    "EnactProtocol/pdf-extract": "2.1.0"
  }
}
```

Running `enact install` without arguments installs all tools from this file.

## Exit Codes

| Code | Description |
|------|-------------|
| `0` | Successful installation |
| `1` | Installation failed |
| `3` | Tool not found |

## See Also

- [enact list](../list/README.md) - List installed tools
- [enact run](../run/README.md) - Execute tools
- [enact search](../search/README.md) - Search for tools (future)

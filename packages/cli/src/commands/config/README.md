# enact config

Manage CLI configuration.

## Synopsis

```bash
enact config <subcommand> [options]
```

## Description

The `config` command manages Enact's global configuration settings. Configuration is stored in `~/.enact/config.yaml` and controls default behaviors, trust settings, and other preferences.

## Subcommands

### config get

Get a configuration value.

```bash
enact config get <key> [options]
```

**Arguments:**
| Argument | Description |
|----------|-------------|
| `key` | Configuration key using dot notation |

**Options:**
| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |

**Examples:**

```bash
# Get trust policy
enact config get trust.policy

# Get as JSON
enact config get trust.publishers --json
```

### config set

Set a configuration value.

```bash
enact config set <key> <value> [options]
```

**Arguments:**
| Argument | Description |
|----------|-------------|
| `key` | Configuration key using dot notation |
| `value` | Value to set (use JSON for arrays/objects) |

**Options:**
| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |

**Examples:**

```bash
# Set trust policy
enact config set trust.policy strict

# Set an array value (use JSON)
enact config set trust.publishers '["alice","bob"]'

# Set a boolean
enact config set execution.sandbox true
```

### config list

List all configuration values.

```bash
enact config list [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |

**Examples:**

```bash
$ enact config list

Configuration file: /Users/you/.enact/config.yaml

trust.publishers: ["alice","EnactProtocol"]
trust.auditors: ["github:securityteam"]
trust.policy: warn
execution.timeout: 300
execution.sandbox: true
```

## Configuration Keys

### Trust Settings

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `trust.publishers` | `string[]` | `[]` | Trusted publisher names |
| `trust.auditors` | `string[]` | `[]` | Trusted auditor identities |
| `trust.policy` | `string` | `"warn"` | Policy for untrusted tools: `strict`, `warn`, `allow` |

### Execution Settings

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `execution.timeout` | `number` | `300` | Default timeout in seconds |
| `execution.sandbox` | `boolean` | `true` | Enable sandboxing by default |

### Output Settings

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `output.json` | `boolean` | `false` | Default to JSON output |
| `output.verbose` | `boolean` | `false` | Enable verbose output |

## Dot Notation

Configuration keys use dot notation to access nested values:

```yaml
# config.yaml
trust:
  publishers:
    - alice
    - bob
  policy: warn
```

Access with:
- `trust.policy` → `warn`
- `trust.publishers` → `["alice","bob"]`

## Configuration File

The configuration file is located at `~/.enact/config.yaml`. You can edit it directly or use the `config` commands.

### Example Configuration

```yaml
# ~/.enact/config.yaml
trust:
  publishers:
    - EnactProtocol
    - mycompany
  auditors:
    - github:security-team
  policy: warn

execution:
  timeout: 300
  sandbox: true

output:
  json: false
  verbose: false
```

## JSON Output

All subcommands support `--json` for machine-readable output:

```bash
$ enact config list --json
{
  "trust": {
    "publishers": ["alice"],
    "auditors": [],
    "policy": "warn"
  },
  "execution": {
    "timeout": 300
  }
}
```

## Examples

### Initial Setup

```bash
# Set up default trust
enact config set trust.policy warn

# Trust official tools
enact config set trust.publishers '["EnactProtocol"]'

# Configure execution defaults
enact config set execution.timeout 600
enact config set execution.sandbox true
```

### View Current Settings

```bash
# See everything
enact config list

# Check specific setting
enact config get trust.policy

# Export for backup
enact config list --json > enact-config-backup.json
```

### Scripting

```bash
# Get value for use in script
policy=$(enact config get trust.policy --json | jq -r '.value')

# Conditionally run based on config
if [[ "$policy" == "strict" ]]; then
  echo "Running in strict mode"
fi
```

## Exit Codes

| Code | Description |
|------|-------------|
| `0` | Success |
| `1` | Error |

## See Also

- [enact trust](../trust/README.md) - Shorthand commands for trust management
- [enact env](../env/README.md) - Manage environment variables

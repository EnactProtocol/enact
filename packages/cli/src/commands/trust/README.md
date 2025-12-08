# enact trust

Manage trusted publishers and auditors.

## Synopsis

```bash
enact trust [identity] [options]
enact trust <subcommand> [options]
```

## Description

The `trust` command manages your trust configuration for Enact tools. Trust determines which tools can run and under what conditions.

Enact supports two types of trusted identities:

1. **Publishers** - Tool authors (e.g., `alice`, `EnactProtocol`)
2. **Auditors** - Third-party reviewers (e.g., `github:securityteam`)

## Quick Usage

```bash
# Add a trusted publisher
enact trust alice

# Remove a trusted publisher
enact trust -r alice

# Add a trusted auditor (provider:identity format)
enact trust github:securityteam

# List all trusted identities
enact trust
```

## Identity Formats

| Type | Format | Examples |
|------|--------|----------|
| Publisher | `name` | `alice`, `EnactProtocol`, `mycompany` |
| Auditor | `provider:identity` | `github:user`, `google:user@example.com` |

The presence of a colon (`:`) determines whether an identity is treated as a publisher or auditor.

## Options

| Option | Description |
|--------|-------------|
| `-r, --remove` | Remove identity from trusted list |
| `--json` | Output as JSON |

## Subcommands

### trust (default)

With no subcommand and no identity, lists all trusted publishers and auditors.

```bash
enact trust
```

With an identity, adds it to the trust list (or removes with `-r`).

```bash
enact trust alice           # Add publisher
enact trust -r alice        # Remove publisher
enact trust github:user     # Add auditor
enact trust -r github:user  # Remove auditor
```

### trust list

List all trusted publishers and auditors.

```bash
enact trust list [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |

**Example:**

```bash
$ enact trust list

Trusted Publishers
  • alice
  • EnactProtocol

Trusted Auditors
  • github:securityteam

Policy: warn
```

### trust check

Check the trust status of a specific tool.

```bash
enact trust check <tool> [options]
```

**Arguments:**
| Argument | Description |
|----------|-------------|
| `tool` | Tool to check (name@version format) |

**Options:**
| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |

**Example:**

```bash
enact trust check alice/api/slack-notifier@1.0.0
```

> **Note:** Full trust verification requires the Trust Package (Phase 6).

## Trust Policy

The trust policy determines behavior when running untrusted tools:

| Policy | Behavior |
|--------|----------|
| `strict` | Refuse to run untrusted tools |
| `warn` | Warn but allow (default) |
| `allow` | Run without warnings |

Set the policy using the config command:

```bash
enact config set trust.policy strict
```

## How Trust Works

When you run a tool, Enact checks:

1. **Is the publisher trusted?**
   - Tool signed by `alice` → check if `alice` is in `trust.publishers`

2. **Is an auditor trusted?**
   - Tool audited by `github:user` → check if `github:user` is in `trust.auditors`

3. **Apply policy**
   - If trusted: run normally
   - If not trusted: apply policy (strict/warn/allow)

## Examples

### Set Up Trust for a Team

```bash
# Trust your company's namespace
enact trust mycompany

# Trust the official Enact tools
enact trust EnactProtocol

# Trust your security team as auditors
enact trust github:myorg/security-team
```

### Audit Current Trust

```bash
# List everything
enact trust list

# Get as JSON for scripting
enact trust list --json
```

### Check a Specific Tool

```bash
# Before running, check if tool is trusted
enact trust check alice/api/slack-notifier@1.0.0
```

## Configuration File

Trust settings are stored in `~/.enact/config.yaml`:

```yaml
trust:
  publishers:
    - alice
    - EnactProtocol
  auditors:
    - github:securityteam
  policy: warn
```

You can edit this file directly or use the `enact trust` and `enact config` commands.

## Exit Codes

| Code | Description |
|------|-------------|
| `0` | Success |
| `1` | Error |

## See Also

- [enact config](../config/README.md) - Manage CLI configuration including trust policy
- [enact run](../run/README.md) - How trust affects tool execution

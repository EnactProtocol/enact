# enact env

Manage environment variables and secrets.

## Synopsis

```bash
enact env <subcommand> [options]
```

## Description

The `env` command manages two types of values:

1. **Environment Variables** - Stored in `.env` files (local or global)
2. **Secrets** - Stored securely in the OS keyring (macOS Keychain, Windows Credential Manager, Linux Secret Service)

## Subcommands

### env set

Set an environment variable or secret.

```bash
enact env set <key> [value] [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `-s, --secret` | Store as secret in OS keyring |
| `-n, --namespace <ns>` | Namespace for secret (required with `--secret`) |
| `-l, --local` | Set in project `.enact/.env` instead of global |
| `--json` | Output as JSON |

**Examples:**

```bash
# Set global environment variable
enact env set API_URL https://api.example.com

# Set project-local environment variable
enact env set API_URL https://dev.example.com --local

# Set secret with value
enact env set API_KEY sk-12345 --secret --namespace alice/api

# Set secret interactively (prompts for value)
enact env set API_KEY --secret --namespace alice/api
```

### env get

Get an environment variable or check if a secret exists.

```bash
enact env get <key> [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `-s, --secret` | Check secret in OS keyring (never shows value) |
| `-n, --namespace <ns>` | Namespace for secret (required with `--secret`) |
| `--json` | Output as JSON |

**Examples:**

```bash
# Get environment variable with resolution source
enact env get API_URL

# Check if secret exists (never shows value)
enact env get API_KEY --secret --namespace alice/api
```

### env list

List environment variables or secrets.

```bash
enact env list [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `-s, --secret` | List secrets from OS keyring |
| `-n, --namespace <ns>` | Namespace for secrets (required with `--secret`) |
| `-l, --local` | Show only project variables |
| `-g, --global` | Show only global variables |
| `--json` | Output as JSON |

**Examples:**

```bash
# List all environment variables
enact env list

# List only local variables
enact env list --local

# List secrets for a namespace
enact env list --secret --namespace alice/api
```

### env delete

Delete an environment variable or secret.

```bash
enact env delete <key> [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `-s, --secret` | Delete secret from OS keyring |
| `-n, --namespace <ns>` | Namespace for secret (required with `--secret`) |
| `-l, --local` | Delete from project `.enact/.env` |
| `--json` | Output as JSON |

**Examples:**

```bash
# Delete global environment variable
enact env delete API_URL

# Delete local environment variable
enact env delete API_URL --local

# Delete secret
enact env delete API_KEY --secret --namespace alice/api
```

## Environment Variable Resolution

When a tool runs, environment variables are resolved in this order:

1. **Local** - `.enact/.env` in the project directory
2. **Global** - `~/.enact/.env`
3. **Manifest defaults** - Default values from `enact.yaml`

## Secret Namespaces

Secrets use namespace inheritance. When a tool requests a secret, Enact walks up the namespace path:

```
Tool: alice/api/slack/notifier
Needs: API_TOKEN

Lookup order:
  1. alice/api/slack:API_TOKEN
  2. alice/api:API_TOKEN ✓ found
  3. alice:API_TOKEN
```

This allows you to set secrets at different levels of specificity.

## Security

### Secrets vs Environment Variables

| Feature | Secrets | Environment Variables |
|---------|---------|----------------------|
| Storage | OS Keyring | `.env` files |
| Can be shown | Never | Yes |
| Namespace scoped | Yes | No |
| Version controlled | No | Optional |
| Use case | API keys, passwords | URLs, flags, config |

### Secret Safety

- Secrets are **never** written to disk or shown in output
- `enact env get --secret` only confirms existence
- Secrets are injected into containers as environment variables at runtime
- The OS keyring provides encryption at rest

## File Locations

| Type | Location |
|------|----------|
| Global env | `~/.enact/.env` |
| Local env | `.enact/.env` (project) |
| Secrets | OS Keyring (service: `enact-cli`) |

## Exit Codes

| Code | Description |
|------|-------------|
| `0` | Success |
| `1` | Error |

## See Also

- [enact run](../run/README.md) - How secrets are used during execution
- [enact config](../config/README.md) - Manage CLI configuration

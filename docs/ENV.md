# **Environment Variables Management v2.0 — Keyring Edition**

*Enact System Design Document*

---

## 1. Overview

Environment Variables Management v2.0 provides a unified `env` field for all runtime configuration, with automatic secure handling for secrets using OS-native keyring storage.

Core properties:

* Single `env` field for all variables (secrets and non-secrets)
* `secret: true` flag determines storage location
* Secrets: OS keyring (never written to disk)
* Non-secrets: `.env` files with priority resolution
* Namespace-scoped secrets with inheritance
* Fallback to Dagger secret providers for CI/headless environments

---

## 2. Architectural Principles

### 2.1. Unified declaration, separate storage

All environment variables are declared in a single `env` field. The `secret: true` flag determines where values are stored:

| `secret` | Storage | Logged | CLI |
|----------|---------|--------|-----|
| `true` | OS keyring | Never | `enact env ... --secret` |
| `false` (default) | `.env` files | Yes | `enact env` |

### 2.2. Secrets live only in the OS keyring

On developer machines, Enact stores and retrieves secrets from the OS keyring. Secrets are never written to disk.

### 2.3. Secrets are namespace-scoped

Secrets are stored at namespace paths and inherited by all tools within that namespace. Tools declare what secrets they need; namespaces provide them.

### 2.4. Secrets are ephemeral at runtime

Values are:
1. Loaded from keyring (or alternative source)
2. Held in memory briefly
3. Passed into Dagger as typed secret objects
4. Destroyed when the process exits

### 2.5. Leverage existing infrastructure

OS keyrings for developer machines. Dagger's secret providers (Vault, 1Password, environment variables) for CI and headless environments.

---

## 3. Manifest Declaration

All environment variables use the same `env` structure:

```yaml
env:
  API_TOKEN:
    description: "API authentication token"
    secret: true
  
  DATABASE_URL:
    description: "Database connection string"
    secret: true
  
  LOG_LEVEL:
    description: "Logging verbosity"
    default: "info"
  
  API_BASE_URL:
    description: "API endpoint"
    default: "https://api.example.com"
```

### 3.1. Field Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | string | Yes | What this variable is for |
| `secret` | boolean | No | If `true`, stored in OS keyring (default: `false`) |
| `default` | string | No | Default value if not set (only for non-secrets) |

### 3.2. Example Tool Manifest

```yaml
---
enact: "2.0.0"
name: "alice/api/slack-notifier"
description: "Send notifications to Slack"

env:
  SLACK_TOKEN:
    description: "Slack Bot OAuth Token"
    secret: true
  
  SLACK_CHANNEL:
    description: "Default channel to post to"
    default: "#general"
  
  LOG_LEVEL:
    description: "Logging verbosity"
    default: "info"
---
```

---

## 4. Secret Storage (OS Keyring)

### 4.1. Service Name

All keyring secrets are stored under:

```
enact-cli
```

### 4.2. Account Identifier

```
{namespace}:{SECRET_NAME}
```

Examples:

```
alice/api:API_TOKEN
acme-corp/data:DATABASE_URL
research/ml:HF_API_KEY
```

### 4.3. Namespace Inheritance

When a tool requests a secret, Enact walks up the namespace path:

```
Tool: alice/api/slack/notifier
Needs: API_TOKEN

Lookup:
  1. alice/api/slack:API_TOKEN
  2. alice/api:API_TOKEN ✓ found
  3. alice:API_TOKEN
```

First match wins.

---

## 5. Unified CLI Commands

All environment variables and secrets are managed through the `enact env` command.

---

## 6. Non-Secret Environment Variables

Variables without `secret: true` are stored in `.env` files.

### 6.1. Storage Locations

**Global (User-level):**
```
~/.enact/.env
```

**Local (Project-level):**
```
.enact/.env
```

### 6.2. Priority Order

When resolving non-secret environment variables:

1. **Local project `.env`** (`.enact/.env`) - highest priority
2. **Global user `.env`** (`~/.enact/.env`)
3. **Default values** from tool manifest - lowest priority

### 6.3. File Format

Standard `.env` format:

```bash
# Application Configuration
LOG_LEVEL=debug
API_BASE_URL=https://staging-api.example.com

# Feature Flags
ENABLE_BETA_FEATURES=true
```

### 6.4. Usage Examples

**Setting global defaults:**
```bash
# ~/.enact/.env
LOG_LEVEL=info
API_BASE_URL=https://api.example.com
```

**Overriding for a specific project:**
```bash
# my-project/.enact/.env
LOG_LEVEL=debug
API_BASE_URL=https://dev-api.example.com
```

### 6.5. Security Notes

- Non-secret environment variables may appear in logs and cache keys
- Use `secret: true` for sensitive data (stored in OS keyring)
- `.enact/.env` files should be added to `.gitignore` if they contain project-specific overrides

---

## 7. Alternative Secret Sources

For CI/CD pipelines, headless servers, or environments without a keyring, secrets can be provided at runtime using Dagger's secret URI scheme.

### 7.1. Runtime Override

```bash
enact run alice/api/slack --secret API_TOKEN=env://API_TOKEN
```

This bypasses keyring lookup for `API_TOKEN` and sources it from the environment variable instead.

### 7.2. Supported Providers

| Provider | URI Format | Example |
|----------|------------|---------|
| Environment variable | `env://VAR_NAME` | `env://API_TOKEN` |
| File | `file://PATH` | `file://./secrets/token.txt` |
| Command output | `cmd://COMMAND` | `cmd://"gh auth token"` |
| 1Password | `op://VAULT/ITEM/FIELD` | `op://infra/github/credential` |
| HashiCorp Vault | `vault://PATH` | `vault://credentials.api_token` |

### 7.3. CI/CD Examples

**GitHub Actions:**

```yaml
- name: Run tool
  run: |
    enact run alice/api/slack \
      --secret API_TOKEN=env://API_TOKEN \
      --secret SLACK_WEBHOOK=env://SLACK_WEBHOOK
  env:
    API_TOKEN: ${{ secrets.API_TOKEN }}
    SLACK_WEBHOOK: ${{ secrets.SLACK_WEBHOOK }}
```

**Using 1Password (with service account):**

```yaml
- name: Run tool
  run: |
    enact run alice/api/slack \
      --secret API_TOKEN=op://infra/api/token \
      --secret SLACK_WEBHOOK=op://infra/slack/webhook
  env:
    OP_SERVICE_ACCOUNT_TOKEN: ${{ secrets.OP_SERVICE_ACCOUNT_TOKEN }}
```

**Using HashiCorp Vault:**

```yaml
- name: Run tool
  run: |
    enact run alice/api/slack \
      --secret API_TOKEN=vault://secret/data/api#token
  env:
    VAULT_ADDR: ${{ secrets.VAULT_ADDR }}
    VAULT_TOKEN: ${{ secrets.VAULT_TOKEN }}
```

### 7.4. Mixed Sources

You can mix keyring and override sources. Unspecified secrets fall back to keyring lookup:

```bash
# API_TOKEN from Vault, SLACK_WEBHOOK from keyring
enact run alice/api/slack --secret API_TOKEN=vault://credentials.token
```

---

## 8. Dagger Integration

During `enact run`:

1. Read manifest `env` field and identify secrets (`secret: true`)
2. For each secret:
   - If `--secret NAME=uri` provided, use Dagger's secret resolution
   - Otherwise, resolve via namespace inheritance from keyring
3. Create typed Dagger secrets:

```ts
// From keyring
const value = await resolveSecret(toolPath, key);
const secretObj = client.setSecret(key, value);

// From URI (passed through to Dagger)
const secretObj = dag.secret(uri);
```

4. Inject into container:

```ts
// Secrets via Dagger's secure API
container = container.withSecretVariable(key, secretObj);

// Non-secrets as regular env vars
container = container.withEnvVariable(key, value);
```

5. Execute container
6. Secrets destroyed on exit

Credentials never appear in filesystem, logs, or process table.

---

## 9. Reference Implementation

```ts
import { keyring } from "@zowe/secrets-for-zowe-sdk";
import { dag } from "@dagger.io/dagger";

const SERVICE = "enact-cli";

export async function setSecret(namespace: string, key: string, value: string) {
  const account = `${namespace}:${key}`;
  await keyring.setPassword(SERVICE, account, value);
}

export async function getSecret(namespace: string, key: string) {
  const account = `${namespace}:${key}`;
  return await keyring.getPassword(SERVICE, account);
}

export async function resolveSecret(toolPath: string, key: string) {
  const segments = toolPath.split('/');
  
  for (let i = segments.length; i > 0; i--) {
    const namespace = segments.slice(0, i).join('/');
    const value = await getSecret(namespace, key);
    if (value) return { namespace, value };
  }
  
  return null;
}

export async function getSecretObject(
  toolPath: string,
  key: string,
  override?: string
) {
  if (override) {
    // Use Dagger's native secret resolution
    return dag.secret(override);
  }
  
  // Fall back to keyring
  const resolved = await resolveSecret(toolPath, key);
  if (!resolved) {
    throw new Error(`Secret '${key}' not found for tool '${toolPath}'`);
  }
  return dag.setSecret(key, resolved.value);
}
```

---

## 10. Security Properties

| Property | Guarantee |
|----------|-----------|
| At rest (keyring) | OS-encrypted storage |
| At rest (Vault/1Password) | Provider-managed encryption |
| Access control | OS authentication or provider auth |
| At runtime | Memory-only, passed via Dagger secret API |
| In logs | Never logged (Dagger scrubs secret values) |
| On disk | Never written |

---

## 11. Unified CLI Commands

All environment variables and secrets are managed through the `enact env` command. Use the `--secret` flag for sensitive data.

### 11.1. `enact env set <key> [value]`

**Set a non-secret environment variable:**

```bash
# Set globally
$ enact env set LOG_LEVEL debug
✓ Environment variable 'LOG_LEVEL' set globally.
  Location: ~/.enact/.env

# Set locally (project-specific)
$ enact env set LOG_LEVEL debug --local
✓ Environment variable 'LOG_LEVEL' set for project.
  Location: .enact/.env
```

**Set a secret (stored in OS keyring):**

```bash
$ enact env set API_TOKEN --secret --namespace alice/api
Enter secret value for API_TOKEN: *************
✓ Secret 'API_TOKEN' stored securely in keyring.
  Available to: alice/api/*
```

**Options:**
- `--secret` - Store in OS keyring instead of `.env` file
- `--namespace <namespace>` - Namespace for secret (required with `--secret`)
- `--local` - Use local project `.env` instead of global (ignored with `--secret`)

### 11.2. `enact env get <key>`

**Get a non-secret environment variable:**

```bash
$ enact env get LOG_LEVEL
LOG_LEVEL=debug (from .enact/.env)
```

**Check if a secret exists (never prints value):**

```bash
$ enact env get API_TOKEN --secret --namespace alice/api
✓ Secret 'API_TOKEN' exists at alice/api
```

### 11.3. `enact env list`

**List all environment variables:**

```bash
$ enact env list
Global (~/.enact/.env):
  LOG_LEVEL=info
  API_BASE_URL=https://api.example.com

Local (.enact/.env):
  LOG_LEVEL=debug
  API_BASE_URL=https://dev-api.example.com

Effective values:
  LOG_LEVEL=debug (local override)
  API_BASE_URL=https://dev-api.example.com (local override)
```

**List secrets for a namespace:**

```bash
$ enact env list --secret --namespace alice/api
Secrets for alice/api:
  API_TOKEN
  SLACK_WEBHOOK
```

### 11.4. `enact env delete <key>`

**Delete an environment variable:**

```bash
$ enact env delete LOG_LEVEL --local
✓ Environment variable 'LOG_LEVEL' removed from .enact/.env
```

**Delete a secret:**

```bash
$ enact env delete API_TOKEN --secret --namespace alice/api
✓ Secret 'API_TOKEN' removed from system keyring.
```

### 11.5. `enact env resolve <tool>`

Shows complete environment resolution for a tool (both secrets and env vars):

```bash
$ enact env resolve alice/api/slack/notifier

Secrets (from keyring):
  API_TOKEN      ← alice/api:API_TOKEN ✓
  SLACK_WEBHOOK  ← alice/api:SLACK_WEBHOOK ✓

Environment Variables:
  LOG_LEVEL      ← .enact/.env (local) = debug
  API_BASE_URL   ← ~/.enact/.env (global) = https://api.example.com
  TIMEOUT        ← default = 30

Missing:
  ✗ DATABASE_URL (required secret)

  To set: enact env set DATABASE_URL --secret --namespace alice/api
```

### 11.6. `enact env edit`

Open environment file in editor:

```bash
$ enact env edit          # Edit ~/.enact/.env
$ enact env edit --local  # Edit .enact/.env
```

Note: This only works for `.env` files, not secrets (which are in the keyring).

---

## 12. Summary

### Unified `env` Declaration

All variables declared in `env` field with consistent structure:

```yaml
env:
  SECRET_VAR:
    description: "Sensitive credential"
    secret: true
  
  NORMAL_VAR:
    description: "Non-sensitive config"
    default: "value"
```

### Storage by Type

| Type | Storage | CLI Flag |
|------|---------|----------|
| `secret: true` | OS keyring (namespace-scoped) | `enact env ... --secret --namespace <ns>` |
| `secret: false` (default) | `.env` files (local → global → default) | `enact env ...` |

### Unified CLI

All variables managed through `enact env` command:

```bash
# Non-secrets
enact env set LOG_LEVEL debug
enact env set LOG_LEVEL debug --local

# Secrets (add --secret --namespace)
enact env set API_TOKEN --secret --namespace alice/api

# Resolution for a tool
enact env resolve alice/api/slack/notifier
```

### Key Principles
- Single `env` field for all configuration
- `secret: true` flag determines secure storage
- Secrets never touch disk (keyring only)
- Non-secrets in plain `.env` files
- Both integrated seamlessly with Dagger
- Unified CLI with `--secret` flag for consistency
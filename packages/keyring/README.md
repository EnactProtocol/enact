# @enactprotocol/keyring

Cross-platform OS keyring for secure credential storage. **No native modules required** - works in Bun compiled binaries.

## How it works

Uses OS command-line tools to access secure credential storage:

| OS | Tool | Backend |
|----|------|---------|
| macOS | `security` | Keychain |
| Linux | `secret-tool` | libsecret (GNOME Keyring, KDE Wallet) |
| Windows | PowerShell | Windows Credential Manager |

## API

```typescript
import { getPassword, setPassword, deletePassword, findCredentials } from '@enactprotocol/keyring';

// Store a password
await setPassword('my-service', 'my-account', 'my-secret');

// Retrieve a password
const password = await getPassword('my-service', 'my-account');
// Returns: 'my-secret' or null if not found

// Delete a password  
const deleted = await deletePassword('my-service', 'my-account');
// Returns: true if deleted, false if not found

// Find all credentials for a service
const credentials = await findCredentials('my-service');
// Returns: [{ account: 'my-account', password: 'my-secret' }, ...]
```

## Requirements

- **macOS**: No additional setup (uses built-in `security` command)
- **Linux**: Requires `secret-tool` (`sudo apt install libsecret-tools` on Debian/Ubuntu)
- **Windows**: PowerShell 5.1+ (included in Windows 10/11)

## Why not native modules?

Native Node.js modules (like node-keytar) don't work in:
- Bun compiled single-file binaries
- Some bundled environments

This package shells out to OS commands instead, making it universally compatible while still using secure OS credential storage.

/**
 * Cross-platform keyring implementation using OS CLI tools
 *
 * This approach avoids native Node modules, making it compatible
 * with Bun compiled binaries.
 *
 * Uses:
 * - macOS: `security` command (Keychain)
 * - Linux: `secret-tool` command (libsecret/Secret Service)
 * - Windows: PowerShell/PasswordVault
 * - Fallback: Encrypted file-based storage (for unsupported/headless systems)
 */

import { exec } from "node:child_process";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execAsync = promisify(exec);

// Track whether we should use the fallback
let useFallback: boolean | null = null;

export interface Credential {
  account: string;
  password: string;
}

/**
 * Check if OS keyring is available
 */
async function checkKeyringAvailable(): Promise<boolean> {
  if (useFallback !== null) {
    return !useFallback;
  }

  try {
    switch (process.platform) {
      case "darwin":
        // security command is always available on macOS
        await execAsync("which security");
        useFallback = false;
        return true;
      case "linux":
        // Check if secret-tool is installed
        await execAsync("which secret-tool");
        // Also check if there's a secret service running (D-Bus)
        try {
          await execAsync("secret-tool search --help 2>&1");
          useFallback = false;
          return true;
        } catch {
          // secret-tool exists but secret service may not be running
          useFallback = true;
          return false;
        }
      case "win32":
        // Check if PowerShell can access PasswordVault
        try {
          await execAsync(
            'powershell -NoProfile -NonInteractive -Command "[void][Windows.Security.Credentials.PasswordVault,Windows.Security.Credentials,ContentType=WindowsRuntime]"'
          );
          useFallback = false;
          return true;
        } catch {
          useFallback = true;
          return false;
        }
      default:
        useFallback = true;
        return false;
    }
  } catch {
    useFallback = true;
    return false;
  }
}

/**
 * Get a password from the OS keyring
 */
export async function getPassword(service: string, account: string): Promise<string | null> {
  try {
    // Check if we should use fallback
    const keyringAvailable = await checkKeyringAvailable();
    if (!keyringAvailable) {
      return await fallbackGetPassword(service, account);
    }

    switch (process.platform) {
      case "darwin":
        return await macosGetPassword(service, account);
      case "linux":
        return await linuxGetPassword(service, account);
      case "win32":
        return await windowsGetPassword(service, account);
      default:
        return await fallbackGetPassword(service, account);
    }
  } catch (err) {
    // Password not found is not an error
    if (isNotFoundError(err)) {
      return null;
    }
    // If keyring fails, try fallback
    try {
      return await fallbackGetPassword(service, account);
    } catch {
      throw err;
    }
  }
}

/**
 * Store a password in the OS keyring
 */
export async function setPassword(
  service: string,
  account: string,
  password: string
): Promise<void> {
  // Check if we should use fallback
  const keyringAvailable = await checkKeyringAvailable();
  if (!keyringAvailable) {
    return await fallbackSetPassword(service, account, password);
  }

  try {
    switch (process.platform) {
      case "darwin":
        await macosSetPassword(service, account, password);
        break;
      case "linux":
        await linuxSetPassword(service, account, password);
        break;
      case "win32":
        await windowsSetPassword(service, account, password);
        break;
      default:
        await fallbackSetPassword(service, account, password);
    }
  } catch (_err) {
    // If keyring fails, try fallback
    useFallback = true;
    await fallbackSetPassword(service, account, password);
  }
}

/**
 * Delete a password from the OS keyring
 */
export async function deletePassword(service: string, account: string): Promise<boolean> {
  try {
    // Check if we should use fallback
    const keyringAvailable = await checkKeyringAvailable();
    if (!keyringAvailable) {
      return await fallbackDeletePassword(service, account);
    }

    switch (process.platform) {
      case "darwin":
        return await macosDeletePassword(service, account);
      case "linux":
        return await linuxDeletePassword(service, account);
      case "win32":
        return await windowsDeletePassword(service, account);
      default:
        return await fallbackDeletePassword(service, account);
    }
  } catch (err) {
    if (isNotFoundError(err)) {
      return false;
    }
    // If keyring fails, try fallback
    try {
      return await fallbackDeletePassword(service, account);
    } catch {
      throw err;
    }
  }
}

/**
 * Find all credentials for a service
 */
export async function findCredentials(service: string): Promise<Credential[]> {
  // Check if we should use fallback
  const keyringAvailable = await checkKeyringAvailable();
  if (!keyringAvailable) {
    return await fallbackFindCredentials(service);
  }

  try {
    switch (process.platform) {
      case "darwin":
        return await macosFindCredentials(service);
      case "linux":
        return await linuxFindCredentials(service);
      case "win32":
        return await windowsFindCredentials(service);
      default:
        return await fallbackFindCredentials(service);
    }
  } catch {
    // If keyring fails, try fallback
    return await fallbackFindCredentials(service);
  }
}

/**
 * Find the first password matching a service
 */
export async function findPassword(service: string): Promise<string | null> {
  const credentials = await findCredentials(service);
  return credentials.length > 0 ? credentials[0].password : null;
}

// ============================================================================
// macOS Implementation (using `security` command)
// We use base64 encoding to safely handle any password content
// ============================================================================

async function macosGetPassword(service: string, account: string): Promise<string | null> {
  const { stdout } = await execAsync(
    `security find-generic-password -s ${shellEscape(service)} -a ${shellEscape(account)} -w`
  );
  const encoded = stdout.trim();
  // Decode from base64
  try {
    return Buffer.from(encoded, "base64").toString("utf8");
  } catch {
    // If not base64 (legacy entry), return as-is
    return encoded;
  }
}

async function macosSetPassword(service: string, account: string, password: string): Promise<void> {
  // Delete existing first (security command doesn't update, it errors)
  try {
    await macosDeletePassword(service, account);
  } catch {
    // Ignore if not found
  }

  // Encode password as base64 to safely handle any content
  const encoded = Buffer.from(password, "utf8").toString("base64");
  await execAsync(
    `security add-generic-password -s ${shellEscape(service)} -a ${shellEscape(account)} -w ${shellEscape(encoded)}`
  );
}

async function macosDeletePassword(service: string, account: string): Promise<boolean> {
  await execAsync(
    `security delete-generic-password -s ${shellEscape(service)} -a ${shellEscape(account)}`
  );
  return true;
}

async function macosFindCredentials(service: string): Promise<Credential[]> {
  try {
    // Use security dump-keychain and grep for our service
    // Note: This only gets account names, we fetch passwords separately
    const { stdout } = await execAsync(
      `security dump-keychain 2>/dev/null | grep -B 5 '"svce"<blob>="${service}"' | grep '"acct"' || true`
    );

    const credentials: Credential[] = [];
    const matches = stdout.matchAll(/"acct"<blob>="([^"]+)"/g);

    for (const match of matches) {
      const account = match[1];
      try {
        const password = await macosGetPassword(service, account);
        if (password) {
          credentials.push({ account, password });
        }
      } catch {
        // Skip if can't get password
      }
    }

    return credentials;
  } catch {
    return [];
  }
}

// ============================================================================
// Linux Implementation (using `secret-tool` command)
// ============================================================================

async function linuxGetPassword(service: string, account: string): Promise<string | null> {
  const { stdout } = await execAsync(
    `secret-tool lookup service ${shellEscape(service)} account ${shellEscape(account)}`
  );
  return stdout.trim() || null;
}

async function linuxSetPassword(service: string, account: string, password: string): Promise<void> {
  // secret-tool reads password from stdin
  const label = `${service}/${account}`;
  await execAsync(
    `printf '%s' ${shellEscape(password)} | secret-tool store --label=${shellEscape(label)} service ${shellEscape(service)} account ${shellEscape(account)}`
  );
}

async function linuxDeletePassword(service: string, account: string): Promise<boolean> {
  await execAsync(
    `secret-tool clear service ${shellEscape(service)} account ${shellEscape(account)}`
  );
  return true;
}

async function linuxFindCredentials(service: string): Promise<Credential[]> {
  try {
    // secret-tool search returns items matching criteria
    const { stdout } = await execAsync(
      `secret-tool search service ${shellEscape(service)} 2>/dev/null || true`
    );

    const credentials: Credential[] = [];
    const blocks = stdout.split(/\[secret\]/);

    for (const block of blocks) {
      const accountMatch = block.match(/account\s*=\s*(.+)/);
      if (accountMatch) {
        const account = accountMatch[1].trim();
        try {
          const password = await linuxGetPassword(service, account);
          if (password) {
            credentials.push({ account, password });
          }
        } catch {
          // Skip if can't get password
        }
      }
    }

    return credentials;
  } catch {
    return [];
  }
}

// ============================================================================
// Windows Implementation (using cmdkey and PowerShell)
// ============================================================================

async function windowsGetPassword(service: string, account: string): Promise<string | null> {
  const target = `${service}/${account}`;

  // Use PowerShell with .NET CredentialManager
  const script = `
[void][Windows.Security.Credentials.PasswordVault,Windows.Security.Credentials,ContentType=WindowsRuntime]
try {
  $vault = New-Object Windows.Security.Credentials.PasswordVault
  $cred = $vault.Retrieve('${target.replace(/'/g, "''")}', '${account.replace(/'/g, "''")}')
  $cred.RetrievePassword()
  Write-Output $cred.Password
} catch {
  exit 1
}
`;

  try {
    const { stdout } = await execAsync(
      `powershell -NoProfile -NonInteractive -Command "${script.replace(/\n/g, " ").replace(/"/g, '\\"')}"`
    );
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

async function windowsSetPassword(
  service: string,
  account: string,
  password: string
): Promise<void> {
  const target = `${service}/${account}`;

  // Use PowerShell with .NET CredentialManager
  const script = `
[void][Windows.Security.Credentials.PasswordVault,Windows.Security.Credentials,ContentType=WindowsRuntime]
$vault = New-Object Windows.Security.Credentials.PasswordVault
try { $vault.Remove($vault.Retrieve('${target.replace(/'/g, "''")}', '${account.replace(/'/g, "''")}')) } catch {}
$cred = New-Object Windows.Security.Credentials.PasswordCredential('${target.replace(/'/g, "''")}', '${account.replace(/'/g, "''")}', '${password.replace(/'/g, "''")}')
$vault.Add($cred)
`;

  await execAsync(
    `powershell -NoProfile -NonInteractive -Command "${script.replace(/\n/g, " ").replace(/"/g, '\\"')}"`
  );
}

async function windowsDeletePassword(service: string, account: string): Promise<boolean> {
  const target = `${service}/${account}`;

  const script = `
[void][Windows.Security.Credentials.PasswordVault,Windows.Security.Credentials,ContentType=WindowsRuntime]
$vault = New-Object Windows.Security.Credentials.PasswordVault
$cred = $vault.Retrieve('${target.replace(/'/g, "''")}', '${account.replace(/'/g, "''")}')
$vault.Remove($cred)
`;

  try {
    await execAsync(
      `powershell -NoProfile -NonInteractive -Command "${script.replace(/\n/g, " ").replace(/"/g, '\\"')}"`
    );
    return true;
  } catch {
    return false;
  }
}

async function windowsFindCredentials(service: string): Promise<Credential[]> {
  const script = `
[void][Windows.Security.Credentials.PasswordVault,Windows.Security.Credentials,ContentType=WindowsRuntime]
$vault = New-Object Windows.Security.Credentials.PasswordVault
$creds = $vault.RetrieveAll() | Where-Object { $_.Resource -like '${service.replace(/'/g, "''")}/*' }
foreach ($cred in $creds) {
  $cred.RetrievePassword()
  Write-Output "$($cred.UserName)|$($cred.Password)"
}
`;

  try {
    const { stdout } = await execAsync(
      `powershell -NoProfile -NonInteractive -Command "${script.replace(/\n/g, " ").replace(/"/g, '\\"')}"`
    );

    const credentials: Credential[] = [];
    for (const line of stdout.trim().split("\n")) {
      if (line.includes("|")) {
        const [account, password] = line.split("|", 2);
        credentials.push({ account: account.trim(), password: password.trim() });
      }
    }
    return credentials;
  } catch {
    return [];
  }
}

// ============================================================================
// Utility functions
// ============================================================================

function shellEscape(str: string): string {
  // Escape for POSIX shells (bash/zsh)
  return `'${str.replace(/'/g, "'\\''")}'`;
}

function isNotFoundError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes("could not be found") ||
      msg.includes("not found") ||
      msg.includes("no matching") ||
      msg.includes("secitemnotfound") ||
      msg.includes("the specified item could not be found") ||
      msg.includes("exit code 44") || // macOS security not found
      msg.includes("exit code 1")
    );
  }
  return false;
}

// ============================================================================
// Fallback Implementation (encrypted file-based storage)
// For systems without OS keyring support (headless Linux, BSD, etc.)
// ============================================================================

const FALLBACK_DIR = join(homedir(), ".enact", "credentials");
const ALGORITHM = "aes-256-gcm";

/**
 * Get or create the encryption key based on machine-specific data
 * This isn't as secure as OS keyring, but better than plaintext
 */
function getFallbackKey(): Buffer {
  // Use machine-specific data to derive a key
  // This ties credentials to this machine
  const machineId = [
    process.platform,
    process.arch,
    homedir(),
    process.env.USER || process.env.USERNAME || "user",
  ].join(":");

  return createHash("sha256").update(machineId).digest();
}

function ensureFallbackDir(): void {
  if (!existsSync(FALLBACK_DIR)) {
    mkdirSync(FALLBACK_DIR, { recursive: true, mode: 0o700 });
  }
}

function getCredentialPath(service: string, account: string): string {
  // Create a safe filename from service/account
  const hash = createHash("sha256").update(`${service}:${account}`).digest("hex").slice(0, 16);
  return join(FALLBACK_DIR, `${hash}.enc`);
}

function encrypt(text: string): string {
  const key = getFallbackKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  // Return iv:authTag:encrypted
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

function decrypt(data: string): string {
  const key = getFallbackKey();
  const [ivHex, authTagHex, encrypted] = data.split(":");

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

async function fallbackGetPassword(service: string, account: string): Promise<string | null> {
  const path = getCredentialPath(service, account);

  if (!existsSync(path)) {
    return null;
  }

  try {
    const data = readFileSync(path, "utf8");
    return decrypt(data);
  } catch {
    return null;
  }
}

async function fallbackSetPassword(
  service: string,
  account: string,
  password: string
): Promise<void> {
  ensureFallbackDir();
  const path = getCredentialPath(service, account);
  const encrypted = encrypt(password);
  writeFileSync(path, encrypted, { mode: 0o600 });

  // Also store metadata for findCredentials
  const metaPath = join(FALLBACK_DIR, "meta.json");
  let meta: Record<string, string[]> = {};

  if (existsSync(metaPath)) {
    try {
      meta = JSON.parse(readFileSync(metaPath, "utf8"));
    } catch {
      meta = {};
    }
  }

  if (!meta[service]) {
    meta[service] = [];
  }
  if (!meta[service].includes(account)) {
    meta[service].push(account);
  }

  writeFileSync(metaPath, JSON.stringify(meta, null, 2), { mode: 0o600 });
}

async function fallbackDeletePassword(service: string, account: string): Promise<boolean> {
  const path = getCredentialPath(service, account);

  if (!existsSync(path)) {
    return false;
  }

  try {
    unlinkSync(path);

    // Update metadata
    const metaPath = join(FALLBACK_DIR, "meta.json");
    if (existsSync(metaPath)) {
      try {
        const meta = JSON.parse(readFileSync(metaPath, "utf8"));
        if (meta[service]) {
          meta[service] = meta[service].filter((a: string) => a !== account);
          if (meta[service].length === 0) {
            delete meta[service];
          }
          writeFileSync(metaPath, JSON.stringify(meta, null, 2), { mode: 0o600 });
        }
      } catch {
        // Ignore meta errors
      }
    }

    return true;
  } catch {
    return false;
  }
}

async function fallbackFindCredentials(service: string): Promise<Credential[]> {
  const metaPath = join(FALLBACK_DIR, "meta.json");

  if (!existsSync(metaPath)) {
    return [];
  }

  try {
    const meta = JSON.parse(readFileSync(metaPath, "utf8"));
    const accounts = meta[service] || [];
    const credentials: Credential[] = [];

    for (const account of accounts) {
      const password = await fallbackGetPassword(service, account);
      if (password) {
        credentials.push({ account, password });
      }
    }

    return credentials;
  } catch {
    return [];
  }
}

/**
 * Check if using fallback storage (for diagnostics)
 */
export function isUsingFallback(): boolean {
  return useFallback === true;
}

/**
 * Force using fallback storage (for testing or headless environments)
 */
export function forceFallback(enable: boolean): void {
  useFallback = enable;
}

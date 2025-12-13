import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function platformPackageDir(platform, arch) {
  if (platform === "darwin" && arch === "arm64") return "packages/enact-darwin-arm64";
  if (platform === "darwin" && arch === "x64") return "packages/enact-darwin-x64";
  if (platform === "linux" && arch === "arm64") return "packages/enact-linux-arm64";
  if (platform === "linux" && arch === "x64") return "packages/enact-linux-x64";
  if (platform === "win32" && arch === "x64") return "packages/enact-win32-x64";
  return null;
}

function isWindows(platform) {
  return platform === "win32";
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function assertOk(result, description) {
  if (result.error) throw result.error;
  if (typeof result.status === "number" && result.status !== 0) {
    throw new Error(`${description} failed with exit code ${result.status}`);
  }
}

function main() {
  const repoRoot = process.cwd();
  const platform = process.platform;
  const arch = process.arch;

  const pkgDirRel = platformPackageDir(platform, arch);
  if (!pkgDirRel) {
    console.error(`Unsupported platform for local binary build: ${platform}/${arch}`);
    process.exit(1);
  }

  const pkgDir = path.join(repoRoot, pkgDirRel);
  const binDir = path.join(pkgDir, "bin");
  ensureDir(binDir);

  const outName = isWindows(platform) ? "enact.exe" : "enact";
  const outPath = path.join(binDir, outName);

  const entry = path.join(repoRoot, "packages", "cli", "dist", "index.js");
  if (!fs.existsSync(entry)) {
    console.error(`Missing CLI build output: ${entry}`);
    console.error("Run: bun run build:cli (or bun run build) first.");
    process.exit(1);
  }

  const bun = process.env.BUN ?? "bun";
  const args = ["build", "--compile", entry, "--outfile", outPath];

  const result = spawnSync(bun, args, { stdio: "inherit" });
  assertOk(result, "bun build --compile");

  if (!isWindows(platform)) {
    fs.chmodSync(outPath, 0o755);
  }

  process.stdout.write(`${outPath}\n`);
}

main();

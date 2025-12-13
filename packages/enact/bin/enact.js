#!/usr/bin/env node

const { spawnSync } = require("node:child_process");

function pkgNameFor(platform, arch) {
  // Keep names aligned with the optionalDependencies list in this package.json
  if (platform === "darwin" && arch === "arm64") return "@enactprotocol/enact-darwin-arm64";
  if (platform === "darwin" && arch === "x64") return "@enactprotocol/enact-darwin-x64";
  if (platform === "linux" && arch === "arm64") return "@enactprotocol/enact-linux-arm64";
  if (platform === "linux" && arch === "x64") return "@enactprotocol/enact-linux-x64";
  if (platform === "win32" && arch === "x64") return "@enactprotocol/enact-win32-x64";
  return null;
}

function loadPlatformBinary(pkgName) {
  // Platform packages are expected to export { binPath }.
  // They may be ESM or CJS; handle both.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require(pkgName);
    return mod?.binPath ? mod : mod?.default ? mod.default : mod;
  } catch (err) {
    return { loadError: err };
  }
}

function run() {
  const pkgName = pkgNameFor(process.platform, process.arch);
  if (!pkgName) {
    console.error(
      `enact: unsupported platform ${process.platform}/${process.arch}. No prebuilt binary is available.`
    );
    process.exit(1);
  }

  const platformPkg = loadPlatformBinary(pkgName);
  if (!platformPkg || !platformPkg.binPath) {
    const msg = platformPkg?.loadError ? String(platformPkg.loadError) : "Unknown error";
    console.error(`enact: failed to load platform package ${pkgName}.`);
    console.error(msg);
    console.error("\nTry reinstalling: npm i -g @enactprotocol/enact");
    process.exit(1);
  }

  const binPath = platformPkg.binPath;
  const args = process.argv.slice(2);

  // Allow platform packages to ship a JS shim during development.
  const isNodeScript = /\.c?js$/i.test(binPath);
  const cmd = isNodeScript ? process.execPath : binPath;
  const cmdArgs = isNodeScript ? [binPath, ...args] : args;

  const result = spawnSync(cmd, cmdArgs, { stdio: "inherit" });
  if (result.error) {
    console.error(String(result.error));
    process.exit(1);
  }
  process.exit(result.status ?? 1);
}

run();

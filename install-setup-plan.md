You create a "thin" npm package that acts as a wrapper. When the user installs it, the package detects their operating system (Windows, Mac, Linux) and architecture (x64, ARM), then fetches and links the correct binary.

There are two main ways to achieve this:

Option 1: The "Postinstall" Script (Easiest to Set Up)
This method uses a script that runs immediately after npm install finishes. It downloads the binary from your GitHub Releases and places it in the bin folder.

How it works:

User runs: npm install -g my-bun-app

NPM downloads: Your tiny JS wrapper.

Postinstall runs: A script (e.g., install.js) checks process.platform and process.arch.

Download: It pulls the specific binary (e.g., my-app-linux-x64) from your GitHub Releases.

The Code (install.js): You can write this yourself, or use a helper library like bin-wrapper (though writing it yourself is often cleaner for simple needs).

JavaScript

// install.js
const { platform, arch } = process;
const https = require('https');
const fs = require('fs');

// Map node's platform/arch to your binary names
const PLATFORM_MAP = {
  'win32': 'windows',
  'darwin': 'darwin',
  'linux': 'linux'
};

const target = `${PLATFORM_MAP[platform]}-${arch}`; 
const url = `https://github.com/YourUser/enact/releases/download/v1.0.0/enact-${target}`;

// Download logic here (stream to a local file)
// ...
Option 2: The optionalDependencies Strategy (The "Pro" Way)
This is the modern standard used by high-performance tools (like esbuild). It’s faster and more reliable because it relies on npm's own dependency resolution rather than a potentially buggy custom script.

How it works: You publish multiple packages to npm:

enact (Main Package): Contains just a JavaScript wrapper file.

@enact/darwin-arm64: Contains only the Mac M1 binary.

@enact/linux-x64: Contains only the Linux binary.

(And so on for other platforms...)

In your Main package.json: You list all the platform-specific packages as optionalDependencies.

JSON

{
  "name": "enact",
  "version": "1.0.0",
  "bin": {
    "enact": "./bin/enact"
  },
  "optionalDependencies": {
    "@enact/darwin-arm64": "1.0.0",
    "@enact/darwin-x64": "1.0.0",
    "@enact/linux-x64": "1.0.0",
    "@enact/win32-x64": "1.0.0"
  }
}
The Magic: When a user runs npm install enact on a Mac M1:

NPM sees the list of optional dependencies.

It checks the os and cpu fields in the package.json of those sub-packages.

It only downloads @enact/darwin-arm64 and ignores the Windows and Linux ones.

Your main bin/enact script simply requires the correct one and runs it.

Option 2 (the optionalDependencies strategy) is considered the "professional" standard because it shifts the hard work from your code to the package manager (npm/pnpm/yarn).

When you write a custom download script (Option 1), you are essentially fighting against the package manager. When you use Option 2, you are working with it.

Here is why major projects like esbuild, Next.js, and Sentry use Option 2:

1. It Works Where Scripts Fail (Security)
Many corporate environments and secure CI/CD pipelines run npm with the --ignore-scripts flag to prevent malware.

Option 1 (Script): Your installation fails instantly. The binary never downloads.

Option 2 (Native): It works perfectly. The binary is just another "dependency" that npm downloads automatically.

2. It Respects Caching (Speed)
Option 1 (Script): Every time the user runs npm install, your script likely triggers a network request to GitHub to download the binary again (unless you write complex caching logic). This is slow and eats bandwidth.

Option 2 (Native): Npm caches the binary package (@enact/darwin-arm64) just like any other library. If the user installs your tool in a second project, it grabs the binary from the local disk cache instantly.

3. Native OS Detection is Better
Writing a script to detect every operating system is surprisingly hard.

Option 1 (Script): You have to handle win32 vs cygwin, x64 vs amd64, various Linux distros (Alpine uses musl instead of glibc), etc. One mistake breaks the install for that user.

Option 2 (Native): Npm has this logic built-in. You just add "os": ["darwin"] and "cpu": ["arm64"] to the package.json of the sub-package, and npm handles the detection logic for you flawlessly.

4. Offline Installation
Option 1 (Script): If a user is offline (or on a restricted intranet) but has your package in their local registry/cache, the install will crash because the script tries to fetch from the internet.

Option 2 (Native): If the packages are cached or bundled (like in a Docker layer), the install works offline without checking GitHub.

5. Uninstallation is Clean
Option 1 (Script): If you download a binary to a weird folder, npm uninstall might not know about it, leaving "garbage" files on the user's machine.

Option 2 (Native): Since the binary is inside a standard npm package folder, npm uninstall removes it cleanly.

The "Cost" of Option 2
The only downside is maintenance complexity for you. Instead of publishing 1 package, you are now publishing 4 or 5 packages (one for every platform + the main wrapper).

The Verdict:

Use Option 1 (Script) if this is a small tool for you and a few friends. It takes 10 minutes to write.

Use Option 2 (Dependencies) if you want this to be a "real" product that thousands of people use reliably.

Would you like to see a tool that automates Option 2 for you, so you don't have to manually publish 5 different packages?
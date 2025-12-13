The optionalDependencies Strategy (The "Pro" Way)
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
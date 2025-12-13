#!/usr/bin/env node

// Development shim.
// In release builds, replace this file with the real compiled binary.
const path = require("node:path");

require(path.join(__dirname, "..", "..", "cli", "dist", "index.js"));

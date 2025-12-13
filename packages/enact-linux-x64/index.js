const fs = require("node:fs");
const path = require("node:path");

const bin = path.join(__dirname, "bin", "enact");
const devShim = path.join(__dirname, "bin", "enact.js");

module.exports = {
  binPath: fs.existsSync(bin) ? bin : devShim,
};

/**
 * enact set command
 *
 * Set the active toolset by name in ~/.enact/tools.json
 */

import type { Command } from "commander";
import { error, success } from "../../utils";

/**
 * Handler for the set command
 */
async function setHandler(toolset: string): Promise<void> {
  try {
    const fs = require("node:fs");
    const path = require("node:path");
    const os = require("node:os");
    const homeDir = os.homedir();
    const toolsJsonPath = path.join(homeDir, ".enact", "tools.json");

    if (!fs.existsSync(toolsJsonPath)) {
      error(`tools.json not found at ${toolsJsonPath}`);
      process.exit(1);
    }

    const toolsJson = JSON.parse(fs.readFileSync(toolsJsonPath, "utf-8"));

    if (toolset === "NONE") {
      toolsJson.activeToolset = undefined;
      fs.writeFileSync(toolsJsonPath, JSON.stringify(toolsJson, null, 2));
      success(`Active toolset unset in ${toolsJsonPath}`);
      return;
    }

    if (!toolsJson.toolsets || !toolsJson.toolsets[toolset]) {
      error(`Toolset '${toolset}' not found in tools.json`);
      process.exit(1);
    }

    toolsJson.activeToolset = toolset;
    fs.writeFileSync(toolsJsonPath, JSON.stringify(toolsJson, null, 2));
    success(`Active toolset set to '${toolset}' in ${toolsJsonPath}`);
  } catch (err) {
    error(`Failed to set active toolset: ${err}`);
    process.exit(1);
  }
}

/**
 * Configure the set command
 */
export function configureSetCommand(program: Command): void {
  program
    .command("set <toolset>")
    .description(
      "Set the active toolset by name (writes to ~/.enact/tools.json). Use 'NONE' to unset."
    )
    .action(setHandler);
}

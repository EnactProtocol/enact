// src/utils/version.ts
import pc from "picocolors";

/**
 * Displays the CLI version with nice formatting
 */
export function showVersion(): void {
	// Bun automatically sets npm_package_version when running scripts via package.json
	const version = process.env.npm_package_version || "0.0.1-dev";
	const versionText = `v${version}`;

	console.error(`
${pc.bold("Enact CLI")} ${pc.cyan(versionText)}
${pc.dim("A tool to create and publish enact documents.")}
`);
}

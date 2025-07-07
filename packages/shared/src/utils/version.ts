// src/utils/version.ts
import pc from "picocolors";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

/**
 * Displays the CLI version with nice formatting
 */
export function showVersion(): void {
	let version = "0.0.1-dev";
	
	try {
		// Try to get version from environment first (for npm scripts)
		if (process.env.npm_package_version) {
			version = process.env.npm_package_version;
		} else {
			// When running as installed binary, read from package.json
			// Go up from shared/dist/utils/version.js to find package.json
			const currentFile = typeof __filename !== 'undefined' ? __filename : fileURLToPath(import.meta.url);
			const sharedDir = dirname(dirname(dirname(currentFile)));
			const packageJsonPath = join(sharedDir, 'package.json');
			const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
			version = packageJson.version;
		}
	} catch (error) {
		// Fall back to default version if anything fails
		version = "1.0.14";
	}
	
	const versionText = `v${version}`;

	console.error(`
${pc.bold("Enact CLI")} ${pc.cyan(versionText)}
${pc.dim("A tool to create and publish enact documents.")}
`);
}

// src/utils/version.ts
import color from 'picocolors';

/**
 * Displays the CLI version with nice formatting
 */
export function showVersion(): void {
  // Bun automatically sets npm_package_version when running scripts via package.json
  const version = process.env.npm_package_version || '0.0.1-dev';
  const versionText = `v${version}`;
  
  console.log(`
${color.bold('Enact CLI')} ${color.cyan(versionText)}
${color.dim('A tool to create and publish enact documents.')}
`);
}
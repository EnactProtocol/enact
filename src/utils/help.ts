// src/utils/help.ts
import pc from 'picocolors';

/**
 * Show the main help message
 */
export function showHelp(): void {
  console.log(`
${pc.bold('Enact CLI')} ${pc.dim('v0.1.0')}
${pc.dim('A simple CLI tool to publish documents')}

${pc.bold('Usage:')}
  ${pc.cyan('enact')} ${pc.green('<command>')} [options]

${pc.bold('Commands:')}
  ${pc.green('publish')}    Publishes a document to a server
  
${pc.bold('Options:')}
  ${pc.yellow('--help, -h')}    Show this help message
  ${pc.yellow('--version, -v')} Show version information

${pc.bold('Examples:')}
  ${pc.cyan('enact')} ${pc.green('publish')} document.md
  ${pc.cyan('enact')} ${pc.green('publish')} ${pc.yellow('--url')} https://example.com/api document.md
`);
}

/**
 * Show version information
 */
export function showVersion(): void {
  console.log(`enact-cli v0.1.0`);
}

/**
 * Show help for the publish command
 */
export function showPublishHelp(): void {
  console.log(`
${pc.bold('Usage:')} ${pc.cyan('enact')} ${pc.green('publish')} [options] [file]

${pc.bold('Publishes a document to a server')}

${pc.bold('Arguments:')}
  ${pc.green('file')}        The file to publish. If not provided, will prompt for a file.

${pc.bold('Options:')}
  ${pc.yellow('--help, -h')}    Show this help message
  ${pc.yellow('--url')}         Specify the server URL to publish to

${pc.bold('Examples:')}
  ${pc.cyan('enact')} ${pc.green('publish')} document.md
  ${pc.cyan('enact')} ${pc.green('publish')} ${pc.yellow('--url')} https://example.com/api document.md
`);
}
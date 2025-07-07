// src/utils/help.ts
import pc from "picocolors";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Get the package version from package.json
 */
function getVersion(): string {
	try {
		const packageJsonPath = join(__dirname, "../../package.json");
		const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
		return packageJson.version || "0.1.0";
	} catch (error) {
		// Fallback version if package.json can't be read
		return "0.1.0";
	}
}

/**
 * Show the main help message
 */
export function showHelp(): void {
	const version = getVersion();
	console.error(`
${pc.bold("Enact CLI")} ${pc.dim(`v${version}`)}
${pc.dim("A CLI tool for managing and publishing Enact tools")}

${pc.bold("Usage:")}
  ${pc.cyan("enact")} ${pc.green("<command>")} [options]

${pc.bold("Commands:")}
  ${pc.green("auth")}       Manage authentication (login, logout, status, token)
  ${pc.green("env")}        Manage environment variables (set, get, list, delete)
  ${pc.green("exec")}       Execute a tool by fetching and running it
  ${pc.green("init")}       Create a new tool definition
  ${pc.green("mcp")}        MCP client integration (install, list, status)
  ${pc.green("publish")}    Publish a tool to the registry
  ${pc.green("search")}     Search for tools in the registry
  ${pc.green("sign")}       Sign and verify tools with cryptographic signatures
  ${pc.green("remote")}     Manage remote servers (add, list, remove)
  ${pc.green("user")}       User operations (get public key)

${pc.bold("Global Options:")}
  ${pc.yellow("--help, -h")}     Show help message
  ${pc.yellow("--version, -v")}  Show version information

${pc.bold("Examples:")}
  ${pc.cyan("enact")}                           ${pc.dim("# Interactive mode")}
  ${pc.cyan("enact")} ${pc.green("search")} ${pc.yellow("--tags")} web,api         ${pc.dim("# Search tools by tags")}
  ${pc.cyan("enact")} ${pc.green("exec")} enact/text/slugify      ${pc.dim("# Execute a tool")}
  ${pc.cyan("enact")} ${pc.green("mcp")} install ${pc.yellow("--client")} claude-desktop ${pc.dim("# Install MCP server")}
  ${pc.cyan("enact")} ${pc.green("mcp")} install ${pc.yellow("--client")} goose       ${pc.dim("# Install for Goose AI")}
  ${pc.cyan("enact")} ${pc.green("env")} set API_KEY --encrypt   ${pc.dim("# Set encrypted env var")}
  ${pc.cyan("enact")} ${pc.green("sign")} verify my-tool.yaml     ${pc.dim("# Verify tool signatures")}
  ${pc.cyan("enact")} ${pc.green("publish")} my-tool.yaml           ${pc.dim("# Publish a tool")}
  ${pc.cyan("enact")} ${pc.green("auth")} login                   ${pc.dim("# Login with OAuth")}
  ${pc.cyan("enact")} ${pc.green("init")} ${pc.yellow("--minimal")}               ${pc.dim("# Create minimal tool template")}

${pc.bold("More Help:")}
  ${pc.cyan("enact")} ${pc.green("<command>")} ${pc.yellow("--help")}          ${pc.dim("# Show command-specific help")}
`);
}

/**
 * Show version information
 */
export function showVersion(): void {
	const version = getVersion();
	console.error(`enact-cli v${version}`);
}

/**
 * Show help for the auth command
 */
export function showAuthHelp(): void {
	console.error(`
${pc.bold("Usage:")} ${pc.cyan("enact")} ${pc.green("auth")} ${pc.blue("<subcommand>")} [options]

${pc.bold("Manage authentication for Enact registry")}

${pc.bold("Subcommands:")}
  ${pc.blue("login")}       Login using OAuth
  ${pc.blue("logout")}      Logout and clear stored credentials
  ${pc.blue("status")}      Check authentication status
  ${pc.blue("token")}       Display current authentication token

${pc.bold("Options:")}
  ${pc.yellow("--help, -h")}     Show this help message
  ${pc.yellow("--server, -s")}   Specify server URL
  ${pc.yellow("--port, -p")}     Specify port for OAuth callback

${pc.bold("Examples:")}
  ${pc.cyan("enact")} ${pc.green("auth")} ${pc.blue("login")}
  ${pc.cyan("enact")} ${pc.green("auth")} ${pc.blue("status")}
  ${pc.cyan("enact")} ${pc.green("auth")} ${pc.blue("login")} ${pc.yellow("--server")} https://api.example.com
`);
}

/**
 * Show help for the init command
 */
export function showInitHelp(): void {
	console.error(`
${pc.bold("Usage:")} ${pc.cyan("enact")} ${pc.green("init")} [options] [name]

${pc.bold("Create a new tool definition file")}

${pc.bold("Arguments:")}
  ${pc.blue("name")}         Name for the new tool (optional)

${pc.bold("Options:")}
  ${pc.yellow("--help, -h")}     Show this help message
  ${pc.yellow("--minimal, -m")}  Create a minimal tool template

${pc.bold("Examples:")}
  ${pc.cyan("enact")} ${pc.green("init")}
  ${pc.cyan("enact")} ${pc.green("init")} my-awesome-tool
  ${pc.cyan("enact")} ${pc.green("init")} ${pc.yellow("--minimal")} simple-tool
`);
}

/**
 * Show help for the publish command
 */
export function showPublishHelp(): void {
	console.error(`
${pc.bold("Usage:")} ${pc.cyan("enact")} ${pc.green("publish")} [options] [file]

${pc.bold("Publish a tool to the Enact registry")}

${pc.bold("Arguments:")}
  ${pc.blue("file")}         The tool definition file to publish (YAML format)

${pc.bold("Options:")}
  ${pc.yellow("--help, -h")}     Show this help message
  ${pc.yellow("--url")}          Specify the registry URL
  ${pc.yellow("--token, -t")}    Specify authentication token

${pc.bold("Examples:")}
  ${pc.cyan("enact")} ${pc.green("publish")} my-tool.yaml
  ${pc.cyan("enact")} ${pc.green("publish")} ${pc.yellow("--url")} https://registry.example.com my-tool.yaml
  ${pc.cyan("enact")} ${pc.green("publish")} ${pc.yellow("--token")} abc123 my-tool.yaml
`);
}

/**
 * Show help for the search command
 */
export function showSearchHelp(): void {
	console.error(`
${pc.bold("Usage:")} ${pc.cyan("enact")} ${pc.green("search")} [options] [query]

${pc.bold("Search for tools in the Enact registry")}

${pc.bold("Arguments:")}
  ${pc.blue("query")}        Search query (optional)

${pc.bold("Options:")}
  ${pc.yellow("--help, -h")}     Show this help message
  ${pc.yellow("--limit, -l")}    Limit number of results (default: 20)
  ${pc.yellow("--tags")}         Filter by tags (comma-separated)
  ${pc.yellow("--author, -a")}   Filter by author
  ${pc.yellow("--format, -f")}   Output format (table, json, minimal)

${pc.bold("Examples:")}
  ${pc.cyan("enact")} ${pc.green("search")}
  ${pc.cyan("enact")} ${pc.green("search")} "web scraper"
  ${pc.cyan("enact")} ${pc.green("search")} ${pc.yellow("--tags")} web,api ${pc.yellow("--limit")} 10
  ${pc.cyan("enact")} ${pc.green("search")} ${pc.yellow("--author")} johndoe ${pc.yellow("--format")} json
`);
}

/**
 * Show help for the remote command
 */
export function showRemoteHelp(): void {
	console.error(`
${pc.bold("Usage:")} ${pc.cyan("enact")} ${pc.green("remote")} ${pc.blue("<subcommand>")} [options]

${pc.bold("Manage remote Enact registry servers")}

${pc.bold("Subcommands:")}
  ${pc.blue("add")}         Add a new remote server
  ${pc.blue("list")}        List all configured remote servers
  ${pc.blue("remove")}      Remove a remote server

${pc.bold("Options:")}
  ${pc.yellow("--help, -h")}     Show this help message

${pc.bold("Examples:")}
  ${pc.cyan("enact")} ${pc.green("remote")} ${pc.blue("add")}
  ${pc.cyan("enact")} ${pc.green("remote")} ${pc.blue("list")}
  ${pc.cyan("enact")} ${pc.green("remote")} ${pc.blue("remove")} origin
`);
}

/**
 * Show help for the user command
 */
export function showUserHelp(): void {
	console.error(`
${pc.bold("Usage:")} ${pc.cyan("enact")} ${pc.green("user")} ${pc.blue("<subcommand>")} [options]

${pc.bold("User operations for Enact registry")}

${pc.bold("Subcommands:")}
  ${pc.blue("public-key")}  Get user's public key

${pc.bold("Options:")}
  ${pc.yellow("--help, -h")}     Show this help message
  ${pc.yellow("--server, -s")}   Specify server URL
  ${pc.yellow("--token, -t")}    Specify authentication token
  ${pc.yellow("--format, -f")}   Output format (default, json)

${pc.bold("Examples:")}
  ${pc.cyan("enact")} ${pc.green("user")} ${pc.blue("public-key")}
  ${pc.cyan("enact")} ${pc.green("user")} ${pc.blue("public-key")} ${pc.yellow("--format")} json
  ${pc.cyan("enact")} ${pc.green("user")} ${pc.blue("public-key")} ${pc.yellow("--server")} https://api.example.com
`);
}

/**
 * Show help for the env command
 */
export function showEnvHelp(): void {
	console.error(`
${pc.bold("Usage:")} ${pc.cyan("enact")} ${pc.green("env")} ${pc.blue("<subcommand>")} [options]

${pc.bold("Environment variable management for Enact CLI")}

${pc.bold("Subcommands:")}
  ${pc.blue("set")} ${pc.magenta("<name>")} [value]      Set an environment variable
  ${pc.blue("get")} ${pc.magenta("<name>")}              Get an environment variable
  ${pc.blue("list")}                    List all environment variables
  ${pc.blue("delete")} ${pc.magenta("<name>")}           Delete an environment variable
  ${pc.blue("copy")} ${pc.magenta("<from>")} ${pc.magenta("<to>")}        Copy variables between scopes
  ${pc.blue("export")} [format]         Export variables (env|json|yaml)
  ${pc.blue("clear")}                   Clear all environment variables

${pc.bold("Options:")}
  ${pc.yellow("--help, -h")}     Show this help message
  ${pc.yellow("--global")}       Use global scope (default)
  ${pc.yellow("--project")}      Use project scope
  ${pc.yellow("--encrypt")}      Encrypt sensitive values
  ${pc.yellow("--format")}       Output format (table|json)
  ${pc.yellow("--show")}         Show actual values (default: hidden)

${pc.bold("Examples:")}
  ${pc.cyan("enact")} ${pc.green("env")} ${pc.blue("set")} OPENAI_API_KEY ${pc.yellow("--encrypt")}
  ${pc.cyan("enact")} ${pc.green("env")} ${pc.blue("set")} DATABASE_URL postgres://... ${pc.yellow("--project")}
  ${pc.cyan("enact")} ${pc.green("env")} ${pc.blue("get")} OPENAI_API_KEY ${pc.yellow("--show")}
  ${pc.cyan("enact")} ${pc.green("env")} ${pc.blue("list")} ${pc.yellow("--project")} ${pc.yellow("--format")} json
  ${pc.cyan("enact")} ${pc.green("env")} ${pc.blue("copy")} global project
  ${pc.cyan("enact")} ${pc.green("env")} ${pc.blue("export")} env > .env
`);
}

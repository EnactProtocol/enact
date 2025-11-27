// src/commands/mcp.ts - MCP client integration commands
import {
	intro,
	outro,
	text,
	select,
	confirm,
	spinner,
	note,
} from "@clack/prompts";
import pc from "picocolors";
import { existsSync } from "fs";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
import { platform } from "os";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

interface McpOptions {
	help?: boolean;
	client?: string;
	server?: string;
}

// MCP client configurations
const MCP_CLIENTS = {
	"claude-desktop": {
		name: "Claude Desktop",
		configPaths: {
			darwin: join(
				homedir(),
				"Library/Application Support/Claude/claude_desktop_config.json",
			),
			win32: join(
				process.env.APPDATA || "",
				"Claude/claude_desktop_config.json",
			),
			linux: join(homedir(), ".config/claude/claude_desktop_config.json"),
		},
	},
	"claude-code": {
		name: "Claude Code",
		configPaths: {
			darwin: join(homedir(), ".claude.json"),
			win32: join(homedir(), ".claude.json"),
			linux: join(homedir(), ".claude.json"),
		},
	},
	vscode: {
		name: "VS Code MCP",
		configPaths: {
			darwin: join(
				homedir(),
				"Library/Application Support/Code/User/settings.json",
			),
			win32: join(process.env.APPDATA || "", "Code/User/settings.json"),
			linux: join(homedir(), ".config/Code/User/settings.json"),
		},
	},
	goose: {
		name: "Goose AI",
		configPaths: {
			darwin: join(homedir(), ".config/goose/config.yaml"),
			win32: join(process.env.APPDATA || "", "Block/goose/config/config.yaml"),
			linux: join(homedir(), ".config/goose/config.yaml"),
		},
	},
	gemini: {
		name: "Gemini",
		configPaths: {
			darwin: join(homedir(), ".gemini/settings.json"),
			win32: join(homedir(), ".gemini/settings.json"),
			linux: join(homedir(), ".gemini/settings.json"),
		},
	},
	"openai-codex": {
		name: "OpenAI Codex",
		configPaths: {
			darwin: join(homedir(), ".codex/config.toml"),
			win32: join(homedir(), ".codex/config.toml"),
			linux: join(homedir(), ".codex/config.toml"),
		}
	}
};

// MCP server configurations
const MCP_SERVERS = {
	"main": {
		name: "Enact MCP Server",
		description: "Main server for tool execution, search, and environment management",
		package: "@enactprotocol/mcp-server",
	},
	"dev": {
		name: "Enact MCP Dev Server", 
		description: "Development server for creating, testing, validating, and publishing tools",
		package: "@enactprotocol/mcp-dev-server",
	},
	"both": {
		name: "Both Servers",
		description: "Install both main and development servers",
		package: "both",
	},
};

export async function handleMcpCommand(
	args: string[],
	options: McpOptions,
): Promise<void> {
	if (options.help || !args[0]) {
		console.error(`
Usage: enact mcp <subcommand> [options]

Manages MCP (Model Context Protocol) client integrations.

Subcommands:
  install             Install Enact MCP server(s) to MCP clients
  list                List detected MCP clients
  status              Show MCP integration status

Options:
  --help, -h          Show this help message
  --client <name>     Target specific client (claude-desktop, claude-code, vscode, goose, gemini)
  --server <type>     Choose server type (main, dev, both) - default: main
`);
		return;
	}

	const subCommand = args[0];

	switch (subCommand) {
		case "install":
			await handleInstallCommand(options);
			break;
		case "list":
			await handleListCommand();
			break;
		case "status":
			await handleStatusCommand();
			break;
		default:
			console.error(pc.red(`Unknown MCP subcommand: ${subCommand}`));
			console.error('Run "enact mcp --help" for available commands.');
			process.exit(1);
	}
}

async function handleInstallCommand(options: McpOptions): Promise<void> {
	intro(pc.bgBlue(pc.white(" MCP Server Installation ")));

	try {
		const detectedClients = await detectMcpClients();

		if (detectedClients.length === 0) {
			note(
				pc.yellow(
					"No MCP clients detected on this system.\n\nSupported clients:\n• Claude Desktop\n• Claude Code\n• VS Code MCP\n• Goose AI\n• Gemini",
				),
				"No clients found",
			);
			outro("Please install a supported MCP client first.");
			return;
		}

		let targetClient = options.client;
		let serverType = options.server || "main";

		// Validate server type
		if (!MCP_SERVERS[serverType as keyof typeof MCP_SERVERS]) {
			console.error(pc.red(`Invalid server type: ${serverType}. Valid options: main, dev, both`));
			process.exit(1);
		}

		// Server selection if not specified
		if (!options.server) {
			serverType = (await select({
				message: "Which MCP server(s) would you like to install?",
				options: Object.entries(MCP_SERVERS).map(([key, config]) => ({
					value: key,
					label: `${config.name} - ${config.description}`,
				})),
			})) as string;
		}

		if (!targetClient) {
			if (detectedClients.length === 1) {
				targetClient = detectedClients[0].id;
				note(
					pc.blue(`Auto-detected: ${detectedClients[0].name}`),
					"Target client",
				);
			} else {
				targetClient = (await select({
					message: "Which MCP client would you like to configure?",
					options: detectedClients.map((client) => ({
						value: client.id,
						label: `${client.name} (${client.configPath})`,
					})),
				})) as string;
			}
		}

		if (!targetClient) {
			outro("Installation cancelled.");
			return;
		}

		const selectedClient = detectedClients.find((c) => c.id === targetClient);
		if (!selectedClient) {
			console.error(
				pc.red(`Client "${targetClient}" not found or not detected.`),
			);
			process.exit(1);
		}

		// Check if already installed
		const isAlreadyInstalled = await checkMcpServerInstalled(selectedClient, serverType);
		if (isAlreadyInstalled) {
			const serverConfig = MCP_SERVERS[serverType as keyof typeof MCP_SERVERS];
			const shouldReinstall = await confirm({
				message: `${serverConfig.name} is already installed in ${selectedClient.name}. Do you want to reinstall it?`,
			});

			if (!shouldReinstall) {
				outro("Installation cancelled.");
				return;
			}
		}

		const s = spinner();
		const serverConfig = MCP_SERVERS[serverType as keyof typeof MCP_SERVERS];
		s.start(`Installing ${serverConfig.name}...`);

		await installMcpServer(selectedClient, serverType);

		s.stop(`✓ ${serverConfig.name} installation process completed`);

		const successMessage = serverType === "both" 
			? `✓ Added both 'enact' and 'enact-dev' MCP servers to ${selectedClient.name}\n`
			: `✓ Added '${serverType === "main" ? "enact" : "enact-dev"}' MCP server to ${selectedClient.name}\n`;

		note(
			pc.green(successMessage) +
				pc.cyan(
					`→ Please restart ${selectedClient.name} to enable the MCP server(s)\n`,
				) +
				pc.cyan(`→ Look for the MCP tools icon in the chat interface`),
			"Installation complete",
		);

		outro("MCP server installation completed!");
	} catch (error) {
		console.error(pc.red(`Installation failed: ${(error as Error).message}`));
		process.exit(1);
	}
}

async function handleListCommand(): Promise<void> {
	intro(pc.bgBlue(pc.white(" MCP Client Detection ")));

	const detectedClients = await detectMcpClients();

	if (detectedClients.length === 0) {
		note(
			pc.yellow("No MCP clients detected on this system."),
			"Detection results",
		);
	} else {
		const clientList = detectedClients
			.map((client) => `✓ ${client.name}\n  Config: ${client.configPath}`)
			.join("\n\n");

		note(pc.green(clientList), "Detected MCP clients");
	}

	outro("Detection complete.");
}

async function handleStatusCommand(): Promise<void> {
	intro(pc.bgBlue(pc.white(" MCP Integration Status ")));

	const detectedClients = await detectMcpClients();

	if (detectedClients.length === 0) {
		note(pc.yellow("No MCP clients detected."), "Status");
		outro("No integrations to check.");
		return;
	}

	for (const client of detectedClients) {
		const mainInstalled = await checkMcpServerInstalled(client, "main");
		const devInstalled = await checkMcpServerInstalled(client, "dev");
		
		let status = "";
		if (mainInstalled && devInstalled) {
			status = pc.green("✓ Main + Dev servers");
		} else if (mainInstalled) {
			status = pc.green("✓ Main server") + pc.yellow(" (Dev server not installed)");
		} else if (devInstalled) {
			status = pc.green("✓ Dev server") + pc.yellow(" (Main server not installed)");
		} else {
			status = pc.yellow("○ Not installed");
		}

		note(`${status}\nConfig: ${client.configPath}`, client.name);
	}

	outro("Status check complete.");
}

export async function detectMcpClients(): Promise<
	Array<{ id: string; name: string; configPath: string }>
> {
	const currentPlatform =
		platform() as keyof (typeof MCP_CLIENTS)["claude-desktop"]["configPaths"];
	const detected = [];

	for (const [clientId, clientConfig] of Object.entries(MCP_CLIENTS)) {
		if (clientId === "goose") {
			// For Goose, check if the CLI is available OR if config directory exists
			const configPath = clientConfig.configPaths[currentPlatform];
			let isGooseAvailable = false;

			try {
				await execAsync("goose --version");
				isGooseAvailable = true;
			} catch (error) {
				// Check if config directory exists even if CLI is not available
				const configDir = join(configPath, "..");
				if (existsSync(configDir)) {
					isGooseAvailable = true;
				}
			}

			if (isGooseAvailable) {
				detected.push({
					id: clientId,
					name: clientConfig.name,
					configPath: configPath,
				});
			}
		} else {
			const configPath = clientConfig.configPaths[currentPlatform];
			if (configPath && existsSync(configPath)) {
				detected.push({
					id: clientId,
					name: clientConfig.name,
					configPath,
				});
			}
		}
	}

	return detected;
}

export async function installMcpServer(client: {
	id: string;
	name: string;
	configPath: string;
}, serverType: string = "main"): Promise<void> {
	if (client.id === "goose") {
		// For Goose, write directly to the config.yaml file
		try {
			// Write directly to Goose config.yaml
			const yaml = await import("yaml");
			const configPath = client.configPath;

			// Ensure config directory exists
			const configDir = join(configPath, "..");
			await mkdir(configDir, { recursive: true });

			let config: any = {};

			// Read existing config if it exists
			if (existsSync(configPath)) {
				try {
					const configContent = await readFile(configPath, "utf-8");
					config = yaml.parse(configContent) || {};
				} catch (error) {
					console.warn(
						pc.yellow(
							`Warning: Could not parse existing Goose config at ${configPath}. Creating new config.`,
						),
					);
				}
			}

			// Initialize extensions object if it doesn't exist
			if (!config.extensions) {
				config.extensions = {};
			}

			// Add server configurations based on serverType
			if (serverType === "main" || serverType === "both") {
				config.extensions.enact = {
					name: "enact",
					cmd: "npx",
					args: ["-y", "@enactprotocol/mcp-server"],
					enabled: true,
					type: "stdio",
					timeout: 300,
				};
			}

			if (serverType === "dev" || serverType === "both") {
				config.extensions["enact-dev"] = {
					name: "enact-dev",
					cmd: "npx",
					args: ["-y", "@enactprotocol/mcp-dev-server"],
					enabled: true,
					type: "stdio",
					timeout: 300,
				};
			}

			// Write updated config
			await writeFile(configPath, yaml.stringify(config), "utf-8");

			const serverConfig = MCP_SERVERS[serverType as keyof typeof MCP_SERVERS];
			note(
				pc.green(
					`✓ Successfully added '${serverConfig.name}' extension to Goose configuration\n`,
				) +
					pc.cyan(
						`→ The extension is now available in your Goose AI sessions\n`,
					) +
					pc.cyan(`→ Restart Goose if it's currently running`),
				"Installation complete",
			);
		} catch (error) {
			throw new Error(
				`Failed to configure Goose extension: ${(error as Error).message}`,
			);
		}
		return;
	}

	if (client.id === "openai-codex") {
        const configPath = client.configPath;
        const configDir = join(configPath, "..");
        await mkdir(configDir, { recursive: true });

        let content = "";
        if (existsSync(configPath)) {
            content = await readFile(configPath, "utf-8");
        }

        // Helper to generate the TOML block
        const generateTomlBlock = (name: string, pkg: string) => {
		return [
					`\n\n[mcp_servers.${name}]`,
					`command = "npx"`,
					`args = ["-y", "${pkg}"]`
				].join('\n');
			};

        const updates: { name: string; pkg: string }[] = [];
        
        if (serverType === "main" || serverType === "both") {
            updates.push({ name: "enact", pkg: "@enactprotocol/mcp-server" });
        }
        if (serverType === "dev" || serverType === "both") {
            updates.push({ name: "enact-dev", pkg: "@enactprotocol/mcp-dev-server" });
        }

        for (const update of updates) {
            // 1. Remove existing block if it exists (Regex to match [mcp_servers.name] until next [section] or EOF)
            // This ensures we update args if they changed, and don't duplicate keys
            const regex = new RegExp(`\\[mcp_servers\\.${update.name}\\][\\s\\S]*?(?=(\\n\\[|$))`, "g");
            content = content.replace(regex, "").trim();

            // 2. Append new block
            content += generateTomlBlock(update.name, update.pkg);
        }

        // Ensure we have a trailing newline
        if (!content.endsWith("\n")) content += "\n";

        await writeFile(configPath, content.trimStart(), "utf-8");
        return;
    }

	// Original logic for file-based clients
	const configPath = client.configPath;

	// Ensure config directory exists
	const configDir = join(configPath, "..");
	await mkdir(configDir, { recursive: true });

	let config: any = {};

	// Read existing config if it exists
	if (existsSync(configPath)) {
		try {
			const configContent = await readFile(configPath, "utf-8");
			config = JSON.parse(configContent);
		} catch (error) {
			console.warn(
				pc.yellow(
					`Warning: Could not parse existing config at ${configPath}. Creating new config.`,
				),
			);
		}
	}

	// Prepare MCP server configuration(s)
	const serverConfigs: Record<string, any> = {};

	if (serverType === "main" || serverType === "both") {
		serverConfigs.enact = {
			command: "npx",
			args: ["-y", "@enactprotocol/mcp-server"],
		};
	}

	if (serverType === "dev" || serverType === "both") {
		serverConfigs["enact-dev"] = {
			command: "npx",
			args: ["-y", "@enactprotocol/mcp-dev-server"],
		};
	}

	// Handle different client configuration formats
	if (client.id === "claude-desktop" || client.id === "claude-code" || client.id === "gemini") {
		// Claude Desktop/Code/Gemini format
		if (!config.mcpServers) {
			config.mcpServers = {};
		}
		Object.assign(config.mcpServers, serverConfigs);
	} else if (client.id === "vscode") {
		// VS Code format
		if (!config["mcp.servers"]) {
			config["mcp.servers"] = {};
		}
		Object.assign(config["mcp.servers"], serverConfigs);
	}

	// Write updated config
	await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
}

export async function checkMcpServerInstalled(client: {
	id: string;
	name: string;
	configPath: string;
}, serverType: string = "main"): Promise<boolean> {
	if (client.id === "goose") {
		try {
			const yaml = await import("yaml");

			if (!existsSync(client.configPath)) {
				return false;
			}

			const configContent = await readFile(client.configPath, "utf-8");
			const config = yaml.parse(configContent);

			// Check based on serverType
			if (serverType === "main") {
				return config?.extensions?.enact?.enabled === true;
			} else if (serverType === "dev") {
				return config?.extensions?.["enact-dev"]?.enabled === true;
			} else if (serverType === "both") {
				return config?.extensions?.enact?.enabled === true && 
					   config?.extensions?.["enact-dev"]?.enabled === true;
			}
			
			return false;
		} catch (error) {
			return false;
		}
	}

	if (client.id === "openai-codex") {
        if (!existsSync(client.configPath)) return false;
        try {
            const content = await readFile(client.configPath, "utf-8");
            
            // We check for the specific section header based on server type
            if (serverType === "main") {
                return content.includes("[mcp_servers.enact]");
            } else if (serverType === "dev") {
                return content.includes("[mcp_servers.enact-dev]");
            } else if (serverType === "both") {
                return content.includes("[mcp_servers.enact]") && 
                       content.includes("[mcp_servers.enact-dev]");
            }
            return false;
        } catch (error) {
            return false;
        }
    }

	if (!existsSync(client.configPath)) {
		return false;
	}

	try {
		const configContent = await readFile(client.configPath, "utf-8");
		const config = JSON.parse(configContent);

		if (client.id === "claude-desktop" || client.id === "claude-code" || client.id === "gemini") {
			const servers = config.mcpServers || {};
			if (serverType === "main") {
				return Boolean(servers.enact);
			} else if (serverType === "dev") {
				return Boolean(servers["enact-dev"]);
			} else if (serverType === "both") {
				return Boolean(servers.enact) && Boolean(servers["enact-dev"]);
			}
		} else if (client.id === "vscode") {
			const servers = config["mcp.servers"] || {};
			if (serverType === "main") {
				return Boolean(servers.enact);
			} else if (serverType === "dev") {
				return Boolean(servers["enact-dev"]);
			} else if (serverType === "both") {
				return Boolean(servers.enact) && Boolean(servers["enact-dev"]);
			}
		}

		return false;
	} catch (error) {
		return false;
	}
}

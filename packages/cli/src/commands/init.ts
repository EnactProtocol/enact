// src/commands/init.ts
import { existsSync } from "fs";
import { writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import * as p from "@clack/prompts";
import pc from "picocolors";

interface InitOptions {
	help?: boolean;
	minimal?: boolean;
}

/**
 * Handle the init command for creating new Enact tool definitions
 */
export async function handleInitCommand(
	args: string[],
	options: InitOptions,
): Promise<void> {
	if (options.help) {
		console.error(`
Usage: enact init [name] [options]

Creates a new Enact tool definition with interactive prompts.

Arguments:
  name                Optional tool name (e.g., my-tool, text/analyzer)

Options:
  --help, -h          Show this help message
  --minimal           Create a minimal tool definition (3 fields only)

Examples:
  enact init                       # Interactive mode
  enact init my-tool               # Create my-tool.yaml
  enact init text/analyzer         # Create text/analyzer.yaml
  enact init --minimal             # Create minimal tool definition
`);
		return;
	}

	// Start the interactive prompt
	p.intro(pc.bgCyan(pc.white(" Create New Enact Tool ")));

	// Determine the tool name and file path
	let toolName = args[0];
	let fileName: string;

	if (!toolName) {
		const nameResponse = await p.text({
			message: "Tool name (e.g., text/analyzer, my-namespace/my-tool):",
			placeholder: "my-tool",
			validate(value) {
				if (!value) return "Tool name is required";
				if (!/^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/.test(value)) {
					return "Tool name must be lowercase alphanumeric with hyphens, optionally with / for namespacing";
				}
				return undefined;
			},
		});

		if (p.isCancel(nameResponse)) {
			p.cancel("Operation cancelled");
			return;
		}

		toolName = nameResponse;
	}

	// Determine file name from tool name
	fileName = toolName.replace(/\//g, "-") + ".yaml";

	// Check if file already exists
	if (existsSync(fileName)) {
		const overwrite = await p.confirm({
			message: `File ${fileName} already exists. Overwrite?`,
		});

		if (!overwrite) {
			p.outro(pc.yellow("Operation cancelled"));
			return;
		}
	}

	// Get tool description
	const description = (await p.text({
		message: "Tool description:",
		placeholder: "What does your tool do?",
		validate(value) {
			if (!value) return "Description is required";
			return undefined;
		},
	})) as string;

	if (description === null) {
		p.outro(pc.yellow("Operation cancelled"));
		return;
	}

	// Get command
	const commandExample = options.minimal
		? 'echo "Hello, ${name}!"'
		: 'npx prettier@3.3.3 --write "${file}"';

	const command = (await p.text({
		message: "Command to execute:",
		placeholder: commandExample,
		validate(value) {
			if (!value) return "Command is required";
			return undefined;
		},
	})) as string;

	if (command === null) {
		p.outro(pc.yellow("Operation cancelled"));
		return;
	}

	// For minimal mode, we're done
	if (options.minimal) {
		const minimalContent = generateMinimalYaml(toolName, description, command);
		await writeFile(fileName, minimalContent);
		p.outro(
			pc.green(`✓ Created minimal tool definition: ${pc.bold(fileName)}`),
		);
		return;
	}

	// Continue with additional fields for full mode
	const timeout = (await p.text({
		message: "Execution timeout (Go duration format):",
		placeholder: "30s",
		initialValue: "30s",
		validate(value) {
			if (value && !/^\d+[smh]$/.test(value)) {
				return "Invalid duration format. Use formats like: 30s, 5m, 1h";
			}
			return undefined;
		},
	})) as string;

	// Get tags
	const tagsInput = (await p.text({
		message: "Tags (comma-separated):",
		placeholder: "text, analysis, cli",
	})) as string;

	const tags = tagsInput
		? tagsInput
				.split(",")
				.map((t) => t.trim())
				.filter((t) => t)
		: [];

	// Ask about input parameters
	const addInputSchema = await p.confirm({
		message: "Add input parameters?",
		initialValue: true,
	});

	let inputSchema = null;
	if (addInputSchema) {
		inputSchema = await collectInputSchema();
	}

	// Ask about examples
	const addExamples = await p.confirm({
		message: "Add example test cases?",
		initialValue: false,
	});

	let examples = null;
	if (addExamples) {
		examples = await collectExamples(inputSchema);
	}

	// Ask about environment variables
	const addEnvVars = await p.confirm({
		message: "Does your tool need environment variables?",
		initialValue: false,
	});

	let envVars = null;
	if (addEnvVars) {
		envVars = await collectEnvVars();
	}

	// Generate the YAML content
	const yamlContent = generateFullYaml({
		name: toolName,
		description,
		command,
		timeout: timeout || "30s",
		tags,
		inputSchema,
		examples,
		envVars,
	});

	// Write the file
	const spinner = p.spinner();
	spinner.start("Creating tool definition");

	try {
		await writeFile(fileName, yamlContent);
		spinner.stop("Tool definition created");

		// Show next steps
		p.note(
			`Next steps:
1. Review and edit ${pc.cyan(fileName)}
2. Test locally: ${pc.cyan(`enact test ${fileName}`)}
3. Publish: ${pc.cyan(`enact publish ${fileName}`)}`,
			"Success!",
		);

		p.outro(pc.green(`✓ Created ${pc.bold(fileName)}`));
	} catch (error) {
		spinner.stop("Failed to create tool definition");
		p.outro(pc.red(`✗ Error: ${(error as Error).message}`));
	}
}

/**
 * Collect input schema parameters
 */
async function collectInputSchema() {
	const properties: any = {};
	const required: string[] = [];

	p.note("Define input parameters for your tool", "Input Schema");

	let addMore = true;
	while (addMore) {
		const paramName = (await p.text({
			message: "Parameter name:",
			placeholder: "file",
			validate(value) {
				if (!value) return "Parameter name is required";
				if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(value)) {
					return "Parameter name must start with a letter and contain only letters, numbers, and underscores";
				}
				if (properties[value]) return "Parameter already exists";
				return undefined;
			},
		})) as string;

		if (paramName === null) break;

		const paramType = (await p.select({
			message: "Parameter type:",
			options: [
				{ value: "string", label: "String" },
				{ value: "integer", label: "Integer" },
				{ value: "number", label: "Number" },
				{ value: "boolean", label: "Boolean" },
				{ value: "array", label: "Array" },
				{ value: "object", label: "Object" },
			],
		})) as string;

		const paramDesc = (await p.text({
			message: "Parameter description:",
			placeholder: "File path to process",
		})) as string;

		const isRequired = await p.confirm({
			message: "Is this parameter required?",
			initialValue: true,
		});

		properties[paramName] = {
			type: paramType,
			description: paramDesc || `The ${paramName} parameter`,
		};

		// Add additional constraints based on type
		if (paramType === "string") {
			const addEnum = await p.confirm({
				message: "Limit to specific values?",
				initialValue: false,
			});

			if (addEnum) {
				const enumValues = (await p.text({
					message: "Allowed values (comma-separated):",
					placeholder: "json, yaml, xml",
				})) as string;

				if (enumValues) {
					properties[paramName].enum = enumValues
						.split(",")
						.map((v) => v.trim());
				}
			}
		}

		if (isRequired) {
			required.push(paramName);
		} else {
			const defaultValue = (await p.text({
				message: "Default value (optional):",
				placeholder: paramType === "string" ? "default-value" : "0",
			})) as string;

			if (defaultValue) {
				properties[paramName].default =
					paramType === "integer" || paramType === "number"
						? Number(defaultValue)
						: paramType === "boolean"
							? defaultValue.toLowerCase() === "true"
							: defaultValue;
			}
		}

		addMore = (await p.confirm({
			message: "Add another parameter?",
			initialValue: false,
		})) as boolean;
	}

	return {
		type: "object",
		properties,
		required: required.length > 0 ? required : undefined,
	};
}

/**
 * Collect example test cases
 */
async function collectExamples(inputSchema: any) {
	const examples: any[] = [];

	p.note("Add example test cases for your tool", "Examples");

	let addMore = true;
	while (addMore) {
		const example: any = {};

		// Build input based on schema
		if (inputSchema && inputSchema.properties) {
			const input: any = {};

			for (const [key, prop] of Object.entries(inputSchema.properties) as [
				string,
				any,
			][]) {
				const value = (await p.text({
					message: `Value for "${key}" (${prop.type}):`,
					placeholder:
						prop.default || (prop.type === "string" ? "example-value" : "0"),
				})) as string;

				if (value) {
					input[key] =
						prop.type === "integer" || prop.type === "number"
							? Number(value)
							: prop.type === "boolean"
								? value.toLowerCase() === "true"
								: value;
				}
			}

			example.input = input;
		} else {
			// No schema, just get raw input
			const inputJson = (await p.text({
				message: "Example input (JSON):",
				placeholder: '{"param": "value"}',
			})) as string;

			try {
				example.input = JSON.parse(inputJson);
			} catch (e) {
				p.log.warn("Invalid JSON, using as string");
				example.input = inputJson;
			}
		}

		const output = (await p.text({
			message: "Expected output:",
			placeholder: "Success: processed file.txt",
		})) as string;

		if (output) {
			example.output = output;
		}

		const desc = (await p.text({
			message: "Example description (optional):",
			placeholder: "Basic usage example",
		})) as string;

		if (desc) {
			example.description = desc;
		}

		examples.push(example);

		addMore = (await p.confirm({
			message: "Add another example?",
			initialValue: false,
		})) as boolean;
	}

	return examples.length > 0 ? examples : null;
}

/**
 * Collect environment variables
 */
async function collectEnvVars() {
	const envVars: any = {};

	p.note("Define environment variables for your tool", "Environment");

	let addMore = true;
	while (addMore) {
		const varName = (await p.text({
			message: "Environment variable name:",
			placeholder: "API_KEY",
			validate(value) {
				if (!value) return "Variable name is required";
				if (!/^[A-Z][A-Z0-9_]*$/.test(value)) {
					return "Variable name must be uppercase with underscores";
				}
				if (envVars[value]) return "Variable already exists";
				return undefined;
			},
		})) as string;

		if (varName === null) break;

		const varDesc = (await p.text({
			message: "Description:",
			placeholder: "API key for authentication",
		})) as string;

		const varSource = (await p.text({
			message: "Where to obtain this value:",
			placeholder: "https://example.com/api-keys",
		})) as string;

		const isRequired = await p.confirm({
			message: "Is this variable required?",
			initialValue: true,
		});

		envVars[varName] = {
			description: varDesc || "Environment variable",
			source: varSource || "Contact administrator",
			required: isRequired,
		};

		if (!isRequired) {
			const defaultValue = (await p.text({
				message: "Default value (optional):",
				placeholder: "default-value",
			})) as string;

			if (defaultValue) {
				envVars[varName].default = defaultValue;
			}
		}

		addMore = (await p.confirm({
			message: "Add another environment variable?",
			initialValue: false,
		})) as boolean;
	}

	return Object.keys(envVars).length > 0 ? envVars : null;
}

/**
 * Generate minimal YAML content
 */
function generateMinimalYaml(
	name: string,
	description: string,
	command: string,
): string {
	return `name: ${name}
description: "${description}"
command: "${command}"
`;
}

/**
 * Generate full YAML content
 */
function generateFullYaml(config: {
	name: string;
	description: string;
	command: string;
	timeout: string;
	tags: string[];
	inputSchema: any;
	examples: any;
	envVars: any;
}): string {
	let yaml = `# Enact Tool Definition
# Generated by enact-cli

name: ${config.name}
description: "${config.description}"
command: "${config.command}"
timeout: "${config.timeout}"
`;

	if (config.tags.length > 0) {
		yaml += `tags:\n${config.tags.map((t) => `  - "${t}"`).join("\n")}\n`;
	}

	if (config.inputSchema) {
		yaml += `\n# Input validation\ninputSchema:\n`;
		yaml += yamlStringify(config.inputSchema, 1);
	}

	if (config.examples) {
		yaml += `\n# Test cases\nexamples:\n`;
		yaml += config.examples
			.map((ex: any) => {
				let exampleYaml = "  - input: " + JSON.stringify(ex.input) + "\n";
				if (ex.output) {
					exampleYaml += "    output: ";
					if (typeof ex.output === "string" && ex.output.includes("\n")) {
						exampleYaml +=
							"|\n" +
							ex.output
								.split("\n")
								.map((line: string) => "      " + line)
								.join("\n") +
							"\n";
					} else {
						exampleYaml += JSON.stringify(ex.output) + "\n";
					}
				}
				if (ex.description) {
					exampleYaml += `    description: "${ex.description}"\n`;
				}
				return exampleYaml;
			})
			.join("");
	}

	if (config.envVars) {
		yaml += `\n# Environment variables\nenv:\n`;
		for (const [key, value] of Object.entries(config.envVars)) {
			const env = value as any;
			yaml += `  ${key}:\n`;
			yaml += `    description: "${env.description}"\n`;
			yaml += `    source: "${env.source}"\n`;
			yaml += `    required: ${env.required}\n`;
			if (env.default) {
				yaml += `    default: "${env.default}"\n`;
			}
		}
	}

	// Add helpful comments
	yaml += `
# Optional: Add behavior hints
# annotations:
#   readOnlyHint: true      # Tool doesn't modify the system
#   idempotentHint: true    # Multiple calls produce same result
#   destructiveHint: false  # Tool may make permanent changes
#   openWorldHint: false    # Tool connects to external systems

# Optional: Add output schema to help AI models understand responses
# outputSchema:
#   type: object
#   properties:
#     result:
#       type: string
#       description: "The result of the operation"

# Optional: Add cryptographic signature for authenticity
# signature:
#   algorithm: sha256
#   signer: developer-id
#   type: ecdsa-p256
#   created: ${new Date().toISOString()}
#   value: <signature-value>
`;

	return yaml;
}

/**
 * Simple YAML stringifier for nested objects
 */
function yamlStringify(obj: any, indent: number = 0): string {
	const spaces = "  ".repeat(indent);
	let result = "";

	if (Array.isArray(obj)) {
		obj.forEach((item) => {
			result += `${spaces}- `;
			if (typeof item === "object") {
				const lines = yamlStringify(item, indent + 1).split("\n");
				result += lines[0] + "\n";
				result += lines.slice(1).join("\n");
			} else {
				result += JSON.stringify(item) + "\n";
			}
		});
	} else if (typeof obj === "object" && obj !== null) {
		Object.entries(obj).forEach(([key, value]) => {
			if (value === undefined) return;

			result += `${spaces}${key}:`;

			if (typeof value === "object" && value !== null) {
				result += "\n" + yamlStringify(value, indent + 1);
			} else if (typeof value === "string" && value.includes("\n")) {
				result += " |\n";
				value.split("\n").forEach((line) => {
					result += `${spaces}  ${line}\n`;
				});
			} else {
				result += " " + JSON.stringify(value) + "\n";
			}
		});
	} else {
		result += spaces + JSON.stringify(obj) + "\n";
	}

	return result;
}

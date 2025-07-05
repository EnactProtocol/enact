// src/commands/create.ts
import { intro, outro, text, select, confirm, spinner } from "@clack/prompts";
import pc from "picocolors";
import { writeFile } from "fs/promises";

interface CreateOptions {
	help?: boolean;
	template?: string;
}

export async function handleCreateCommand(
	args: string[],
	options: CreateOptions,
): Promise<void> {
	if (options.help) {
		console.error(`
Usage: enact create [targetPath] [options]

Creates a new enact document in the specified path or current repository.

Arguments:
  targetPath  The path where the enact document should be created. Defaults to '.' (current directory).

Options:
  --help, -h          Show this help message
  --template <name>   Specify a template to use for the new document
`);
		return;
	}

	let targetPath = args[0] || "."; // Default to current directory

	// Pretty intro
	intro(pc.bgCyan(pc.black(" Create a new Enact document ")));

	// Interactive path confirmation if not explicitly provided
	if (args.length === 0) {
		const targetPathResponse = await text({
			message: "Where should we create the document?",
			placeholder: ".",
			initialValue: ".",
			validate(value: string) {
				if (!value) return "Please enter a valid path";
				return undefined;
			},
		});

		if (targetPathResponse === null) {
			outro(pc.yellow("Operation cancelled"));
			return;
		}

		targetPath = targetPathResponse as string;
	}

	// Template selection
	const templateChoice = await select({
		message: "Select a template:",
		options: [
			{ value: "basic", label: "Basic document" },
			{ value: "article", label: "Article with sections" },
			{ value: "report", label: "Detailed report" },
		],
	});

	if (templateChoice === null) {
		outro(pc.yellow("Operation cancelled"));
		return;
	}

	// Document metadata
	const titleResponse = await text({
		message: "Document title:",
		placeholder: "My Enact Document",
		validate(value: string) {
			if (!value) return "Title is required";
			return undefined;
		},
	});

	if (titleResponse === null) {
		outro(pc.yellow("Operation cancelled"));
		return;
	}

	const title = titleResponse as string;

	// Confirmation
	const shouldProceed = await confirm({
		message: `Create a new ${String(templateChoice)} document at "${targetPath}"?`,
	});

	if (!shouldProceed) {
		outro(pc.yellow("Operation cancelled"));
		return;
	}

	// Progress spinner
	const loadingSpinner = spinner();
	loadingSpinner.start("Creating your document");

	try {
		// Fake a delay to show the spinner
		await new Promise((resolve) => setTimeout(resolve, 1000));

		// Create the document based on template
		const content = generateTemplateContent(templateChoice as string, title);
		const filename = `${title.toLowerCase().replace(/\s+/g, "-")}.enact.md`;
		const fullPath =
			targetPath === "." ? filename : `${targetPath}/${filename}`;

		// Use Node.js writeFile instead of Bun.write
		await writeFile(fullPath, content, "utf8");

		loadingSpinner.stop("Document created successfully");
		outro(pc.green(`✓ Created ${pc.bold(fullPath)}`));
	} catch (error) {
		loadingSpinner.stop("Failed to create document");
		outro(pc.red(`✗ Error: ${(error as Error).message}`));
	}
}

function generateTemplateContent(template: string, title: string): string {
	const date = new Date().toISOString().split("T")[0];

	switch (template) {
		case "basic":
			return `---
title: ${title}
date: ${date}
---

# ${title}

Write your content here.
`;
		case "article":
			return `---
title: ${title}
date: ${date}
type: article
---

# ${title}

## Introduction

Write your introduction here.

## Main Content

Write your main content here.

## Conclusion

Write your conclusion here.
`;
		case "report":
			return `---
title: ${title}
date: ${date}
type: report
---

# ${title}

## Executive Summary

Write your executive summary here.

## Findings

### Finding 1

Details about finding 1.

### Finding 2

Details about finding 2.

## Recommendations

List your recommendations here.

## Appendix

Additional information.
`;
		default:
			return `---
title: ${title}
date: ${date}
---

# ${title}

Write your content here.
`;
	}
}

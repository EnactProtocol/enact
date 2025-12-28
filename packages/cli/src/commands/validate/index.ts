/**
 * enact validate command
 *
 * Validate a SKILL.md file for common issues and best practices.
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { type ToolManifest, tryResolveTool } from "@enactprotocol/shared";
import type { Command } from "commander";
import type { CommandContext, GlobalOptions } from "../../types";
import { colors, dim, error, formatError, info, newline, success, symbols } from "../../utils";

interface ValidateOptions extends GlobalOptions {
  fix?: boolean;
}

interface ValidationIssue {
  level: "error" | "warning" | "info";
  message: string;
  suggestion?: string;
}

/**
 * Extract parameter names from a command template
 */
function extractCommandParams(command: string): string[] {
  const params: string[] = [];
  const regex = /\$\{([^}:]+)(?::[^}]+)?\}/g;
  let match: RegExpExecArray | null;
  match = regex.exec(command);
  while (match !== null) {
    if (match[1] && !params.includes(match[1])) {
      params.push(match[1]);
    }
    match = regex.exec(command);
  }
  return params;
}

/**
 * Validate a tool manifest
 */
function validateManifest(manifest: ToolManifest, sourceDir: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Check name format
  if (!manifest.name) {
    issues.push({
      level: "error",
      message: "Missing 'name' field",
      suggestion: "Add a name in format: namespace/category/tool",
    });
  } else if (!manifest.name.includes("/")) {
    issues.push({
      level: "warning",
      message: `Name '${manifest.name}' should follow hierarchical format`,
      suggestion: "Use format: namespace/category/tool (e.g., alice/utils/formatter)",
    });
  }

  // Check version
  if (!manifest.version) {
    issues.push({
      level: "warning",
      message: "Missing 'version' field",
      suggestion: "Add a version using semver (e.g., 1.0.0)",
    });
  }

  // Check description
  if (!manifest.description) {
    issues.push({
      level: "warning",
      message: "Missing 'description' field",
      suggestion: "Add a clear description for discoverability",
    });
  }

  // Check base image
  if (manifest.from) {
    if (manifest.from.endsWith(":latest")) {
      issues.push({
        level: "warning",
        message: `Base image '${manifest.from}' uses :latest tag`,
        suggestion: "Pin to a specific version (e.g., python:3.12-slim instead of python:latest)",
      });
    }
  } else if (manifest.command) {
    issues.push({
      level: "info",
      message: "No 'from' field specified, will use alpine:latest",
      suggestion: "Consider specifying a base image for reproducibility",
    });
  }

  // Check command vs instruction tool
  if (!manifest.command) {
    // Instruction-based tool
    issues.push({
      level: "info",
      message: "No 'command' field - this is an LLM instruction tool",
    });
  } else {
    // Command-based tool - validate parameters
    const commandParams = extractCommandParams(manifest.command);
    const schemaProperties = manifest.inputSchema?.properties
      ? Object.keys(manifest.inputSchema.properties)
      : [];
    const requiredParams = manifest.inputSchema?.required || [];

    // Check for command params not in schema
    for (const param of commandParams) {
      if (!schemaProperties.includes(param)) {
        issues.push({
          level: "error",
          message: `Command uses \${${param}} but it's not defined in inputSchema.properties`,
          suggestion: `Add '${param}' to inputSchema.properties`,
        });
      }
    }

    // Check for required params without command usage (potential issue)
    for (const param of requiredParams) {
      if (!commandParams.includes(param)) {
        issues.push({
          level: "info",
          message: `Required parameter '${param}' is not used in command template`,
          suggestion: "This is fine if you access it via environment or files",
        });
      }
    }

    // Check for optional params without defaults
    for (const prop of schemaProperties) {
      if (!requiredParams.includes(prop)) {
        const propSchema = manifest.inputSchema?.properties?.[prop] as
          | { default?: unknown }
          | undefined;
        if (propSchema?.default === undefined) {
          issues.push({
            level: "warning",
            message: `Optional parameter '${prop}' has no default value`,
            suggestion: "Add a default value or it will be empty string in commands",
          });
        }
      }
    }

    // Check for double-quoting in command
    if (
      manifest.command.includes("'${") ||
      manifest.command.includes('"${') ||
      (manifest.command.includes("${") &&
        (manifest.command.includes("}'") || manifest.command.includes('}"')))
    ) {
      issues.push({
        level: "warning",
        message: "Command may have manual quotes around parameters",
        suggestion: "Enact auto-quotes parameters. Remove manual quotes around ${param}",
      });
    }
  }

  // Check timeout
  if (!manifest.timeout && manifest.command) {
    issues.push({
      level: "info",
      message: "No 'timeout' specified, using default (5 minutes)",
      suggestion: "Consider setting an explicit timeout for long-running tools",
    });
  }

  // Check for common file patterns
  if (manifest.command) {
    // Python tools
    if (manifest.command.includes("python") && manifest.from?.includes("python")) {
      const mainPy = resolve(sourceDir, "main.py");
      if (manifest.command.includes("/workspace/main.py") && !existsSync(mainPy)) {
        issues.push({
          level: "error",
          message: "Command references /workspace/main.py but main.py not found",
          suggestion: "Create main.py or update the command path",
        });
      }
    }

    // Node tools
    if (manifest.command.includes("node") && manifest.from?.includes("node")) {
      const indexJs = resolve(sourceDir, "index.js");
      const mainJs = resolve(sourceDir, "main.js");
      if (
        manifest.command.includes("/workspace/index.js") &&
        !existsSync(indexJs) &&
        !existsSync(mainJs)
      ) {
        issues.push({
          level: "warning",
          message: "Command references /workspace/index.js but index.js not found",
          suggestion: "Create index.js or update the command path",
        });
      }
    }
  }

  // Check env declarations
  if (manifest.env) {
    for (const [key, envDef] of Object.entries(manifest.env)) {
      if (envDef.secret && !envDef.description) {
        issues.push({
          level: "info",
          message: `Secret '${key}' has no description`,
          suggestion: "Add a description to help users understand what this secret is for",
        });
      }
    }
  }

  return issues;
}

/**
 * Display validation results
 */
function displayResults(issues: ValidationIssue[], toolPath: string): void {
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");
  const infos = issues.filter((i) => i.level === "info");

  newline();

  if (issues.length === 0) {
    success(`${symbols.success} ${toolPath} - No issues found!`);
    return;
  }

  info(`Validation results for ${toolPath}:`);
  newline();

  // Display errors
  for (const issue of errors) {
    console.log(`  ${colors.error(`${symbols.error} ERROR:`)} ${issue.message}`);
    if (issue.suggestion) {
      dim(`    → ${issue.suggestion}`);
    }
  }

  // Display warnings
  for (const issue of warnings) {
    console.log(`  ${colors.warning(`${symbols.warning} WARNING:`)} ${issue.message}`);
    if (issue.suggestion) {
      dim(`    → ${issue.suggestion}`);
    }
  }

  // Display info
  for (const issue of infos) {
    console.log(`  ${colors.info(`${symbols.info} INFO:`)} ${issue.message}`);
    if (issue.suggestion) {
      dim(`    → ${issue.suggestion}`);
    }
  }

  newline();

  // Summary
  const summary: string[] = [];
  if (errors.length > 0) summary.push(`${errors.length} error${errors.length > 1 ? "s" : ""}`);
  if (warnings.length > 0)
    summary.push(`${warnings.length} warning${warnings.length > 1 ? "s" : ""}`);
  if (infos.length > 0) summary.push(`${infos.length} info`);

  if (errors.length > 0) {
    error(`Found ${summary.join(", ")}`);
  } else if (warnings.length > 0) {
    console.log(colors.warning(`Found ${summary.join(", ")}`));
  } else {
    success(`Found ${summary.join(", ")} - looking good!`);
  }
}

/**
 * Validate command handler
 */
function validateHandler(toolPath: string, _options: ValidateOptions, ctx: CommandContext): void {
  const resolvedPath = resolve(ctx.cwd, toolPath);

  // Check if path exists
  if (!existsSync(resolvedPath)) {
    error(`Path not found: ${resolvedPath}`);
    process.exit(1);
  }

  // Resolve the tool
  const resolution = tryResolveTool(resolvedPath);

  if (!resolution) {
    error(`Could not find SKILL.md in: ${resolvedPath}`);
    dim("Make sure the directory contains a valid SKILL.md file.");
    process.exit(1);
  }

  // Validate the manifest
  const issues = validateManifest(resolution.manifest, resolution.sourceDir);

  // Display results
  displayResults(issues, toolPath);

  // Exit with error if there are errors
  const hasErrors = issues.some((i) => i.level === "error");
  if (hasErrors) {
    process.exit(1);
  }
}

/**
 * Configure the validate command
 */
export function configureValidateCommand(program: Command): void {
  program
    .command("validate")
    .description("Validate a SKILL.md file for common issues")
    .argument("[path]", "Path to tool directory", ".")
    .option("-v, --verbose", "Show detailed output")
    .option("--json", "Output result as JSON")
    .action((toolPath: string, options: ValidateOptions) => {
      const ctx: CommandContext = {
        cwd: process.cwd(),
        options,
        isCI: Boolean(process.env.CI),
        isInteractive: process.stdout.isTTY ?? false,
      };

      try {
        validateHandler(toolPath, options, ctx);
      } catch (err) {
        error(formatError(err));
        if (options.verbose && err instanceof Error && err.stack) {
          dim(err.stack);
        }
        process.exit(1);
      }
    });
}

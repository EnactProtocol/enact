// src/types.ts - Type definitions for Enact CLI Core
export interface EnactTool {
	// REQUIRED FIELDS
	name: string; // Tool identifier with hierarchical path
	description: string; // Human-readable description
	command: string; // Shell command to execute with version pins

	// RECOMMENDED FIELDS
	timeout?: string; // Go duration format: "30s", "5m", "1h" (default: "30s")
	tags?: string[]; // Tags for search and categorization
	license?: string; // SPDX License identifier (e.g., "MIT", "Apache-2.0")
	outputSchema?: JSONSchemaDefinition; // Output structure as JSON Schema (strongly recommended)

	// OPTIONAL FIELDS
	enact?: string; // Protocol version (e.g., "1.0.0")
	version?: string; // Tool definition version for tracking changes
	namespace?: string; // Environment variable namespace (deprecated, use name hierarchy)

	// Resource requirements
	resources?: {
		memory?: string; // System memory needed (e.g., "16Gi", "32Gi")
		gpu?: string; // GPU memory needed (e.g., "24Gi", "48Gi")
		disk?: string; // Disk space needed (e.g., "100Gi", "500Gi")
	};

	// Environment variables
	env?: Record<
		string,
		{
			description: string; // What this variable is for (required)
			source: string; // Where to get this value (required)
			required: boolean; // Whether this is required (required)
			default?: string; // Default value if not set (optional)
		}
	>;

	// Input/Output JSON Schemas
	inputSchema?: JSONSchemaDefinition;

	// Documentation and Testing
	doc?: string; // Markdown documentation
	authors?: Array<{
		name: string; // Author name (required)
		email?: string; // Author email (optional)
		url?: string; // Author website (optional)
	}>;

	examples?: Array<{
		input: Record<string, any>; // Input parameters
		output?: any; // Expected output
		description?: string; // Test description
	}>;

	// Behavior Annotations (MCP-aligned, all default to false)
	annotations?: {
		title?: string; // Human-readable display name
		readOnlyHint?: boolean; // No environment modifications
		destructiveHint?: boolean; // May make irreversible changes
		idempotentHint?: boolean; // Multiple calls = single call
		openWorldHint?: boolean; // Interacts with external systems
	};

	// Security
	signature?: {
		algorithm: string; // Hash algorithm: "sha256"
		type: string; // Signature type: "ecdsa-p256"
		signer: string; // Signer identifier
		created: string; // ISO timestamp
		value: string; // Base64 encoded signature
		role?: string; // Optional description of the signer
	};

	// Multi-signature support (new format)
	signatures?: Record<
		string,
		{
			algorithm: string; // Hash algorithm: "sha256"
			type: string; // Signature type: "ecdsa-p256"
			signer: string; // Signer identifier
			created: string; // ISO timestamp
			value: string; // Base64 encoded signature
			role?: string; // Optional description of the signer (e.g., "author", "maintainer")
		}
	>;

	// Extensions pattern (x-prefixed fields)
	[key: string]: any; // Allow x- prefixed extension fields
}

// JSON Schema type definitions
export interface JSONSchemaDefinition {
	type?: string | string[]; // JSON Schema type(s)
	description?: string; // Human-readable description
	format?: string; // Format specifier (e.g., "email", "date-time")
	default?: any; // Default value
	enum?: any[]; // Enumeration of possible values
	const?: any; // Constant value

	// String validations
	pattern?: string; // Regular expression pattern
	minLength?: number; // Minimum string length
	maxLength?: number; // Maximum string length

	// Number validations
	minimum?: number; // Minimum value
	maximum?: number; // Maximum value
	exclusiveMinimum?: number; // Exclusive minimum
	exclusiveMaximum?: number; // Exclusive maximum
	multipleOf?: number; // Multiple of

	// Array validations
	items?: JSONSchemaDefinition | JSONSchemaDefinition[]; // Items schema
	minItems?: number; // Minimum items
	maxItems?: number; // Maximum items
	uniqueItems?: boolean; // Items must be unique

	// Object validations
	properties?: Record<string, JSONSchemaDefinition>; // Properties
	required?: string[]; // Required properties
	additionalProperties?: JSONSchemaDefinition | boolean; // Additional properties

	// Combiners
	allOf?: JSONSchemaDefinition[]; // All of these schemas
	anyOf?: JSONSchemaDefinition[]; // Any of these schemas
	oneOf?: JSONSchemaDefinition[]; // Exactly one of these schemas
	not?: JSONSchemaDefinition; // Not this schema

	// Other
	definitions?: Record<string, JSONSchemaDefinition>; // Definitions
	$ref?: string; // JSON Schema reference
	$id?: string; // Schema ID
	$schema?: string; // Schema version

	// Custom extensions
	[key: string]: any; // Additional properties
}

export interface ExecutionResult {
	success: boolean;
	output?: any; // Command output/result
	error?: {
		message: string;
		code?: string;
		details?: any;
	};
	metadata: {
		executionId: string;
		toolName: string; // Changed from toolId
		version?: string;
		executedAt: string;
		environment: string;
		timeout?: string;
		command?: string; // The actual command that was executed
	};
}

// Execution environment interface
export interface ExecutionEnvironment {
	vars: Record<string, any>; // Environment variables
	resources?: {
		memory?: string;
		gpu?: string;
		disk?: string;
		timeout?: string;
	};
	namespace?: string; // Environment variable namespace
}

// Updated execution provider interface
export abstract class ExecutionProvider {
	abstract setup(tool: EnactTool): Promise<boolean>;
	abstract execute(
		tool: EnactTool,
		inputs: Record<string, any>,
		environment: ExecutionEnvironment,
	): Promise<ExecutionResult>;
	abstract cleanup(): Promise<boolean>;
	abstract resolveEnvironmentVariables(
		envConfig: Record<string, any>,
		namespace?: string,
	): Promise<Record<string, any>>;

	// New method for command execution
	abstract executeCommand(
		command: string,
		inputs: Record<string, any>,
		environment: ExecutionEnvironment,
		timeout?: string,
	): Promise<{ stdout: string; stderr: string; exitCode: number }>;
}

export interface EnactToolDefinition {
	name: string;
	description: string;
	command: string;
	from?: string;
	version?: string;
	timeout?: string;
	tags?: string[];
	inputSchema?: any;
	outputSchema?: any;
	examples?: any[];
	annotations?: {
		title?: string;
		readOnlyHint?: boolean;
		destructiveHint?: boolean;
		idempotentHint?: boolean;
		openWorldHint?: boolean;
	};
	env?: Record<
		string,
		{
			description: string;
			source?: string;
			required: boolean;
			default?: string;
		}
	>;
	resources?: {
		memory?: string;
		gpu?: string;
		disk?: string;
	};
	signature?: {
		algorithm: string;
		type: string;
		signer: string;
		created: string;
		value: string;
		role?: string;
	};
	signatures?: {
		signer: string;
		algorithm: string;
		type: string;
		value: string;
		created: string;
		role?: string;
	}[];
	raw_content?: string;
	namespace?: string;
	enact?: string;
	[key: string]: any;
}

export interface ToolSearchQuery {
	query: string;
	limit?: number;
	tags?: string[];
	format?: string;
}

export interface ToolUsage {
	action: "view" | "download" | "execute";
	metadata?: any;
}

export interface CLITokenCreate {
	name?: string;
}

export interface OAuthTokenExchange {
	grant_type: "authorization_code";
	code: string;
	redirect_uri: string;
	client_id: string;
	code_verifier: string;
}

export interface ApiResponse<T = any> {
	success: boolean;
	data?: T;
	error?: string;
}

export interface VerificationPolicy {
	minimumSignatures?: number;
	trustedSigners?: string[];
	allowedAlgorithms?: string[];
}

export interface EnactExecOptions {
	help?: boolean;
	input?: string;
	params?: string;
	timeout?: string;
	dry?: boolean;
	verbose?: boolean;
	force?: boolean; // Force execution even if verification fails (legacy)
	dangerouslySkipVerification?: boolean; // Skip all signature verification (DANGEROUS)
}

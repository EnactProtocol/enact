export interface EnactDocument {
  id?: string;
  content?: string;
  timestamp?: number;
  metadata?: Record<string, any>;
  // Enact protocol fields
  name?: string;
  description?: string;
  command?: string;
  enact?: string;
  version?: string;
  from?: string;
  timeout?: string;
  annotations?: Record<string, any>;
  env?: Record<string, any>;
  inputSchema?: Record<string, any>;
  signatures?: Signature[];
  // Allow any additional fields
  [key: string]: any;
}

export interface SigningOptions {
  algorithm?: 'secp256k1';
  encoding?: 'hex' | 'base64';
  includeFields?: string[];
  excludeFields?: string[];
  additionalCriticalFields?: string[];
  useEnactDefaults?: boolean;
}

export interface Signature {
  signature: string;
  publicKey: string;
  algorithm: string;
  timestamp: number;
}

export interface KeyPair {
  privateKey: string;
  publicKey: string;
}

export interface SecurityConfig {
  allowLocalUnsigned?: boolean;
  minimumSignatures?: number;
}

export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  allowLocalUnsigned: true,
  minimumSignatures: 1
};
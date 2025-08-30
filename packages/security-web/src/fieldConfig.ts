export interface FieldConfig {
  name: string;
  required: boolean;
  securityCritical: boolean;
  description?: string;
}

export interface SigningFieldOptions {
  includeFields?: string[];
  excludeFields?: string[];
  additionalCriticalFields?: string[];
  customFieldConfig?: FieldConfig[];
}

// Default Enact protocol security-critical fields (from Enact.md lines 419-430)
export const ENACT_DEFAULT_CRITICAL_FIELDS: FieldConfig[] = [
  { name: 'annotations', required: false, securityCritical: true, description: 'Security behavior hints' },
  { name: 'command', required: true, securityCritical: true, description: 'The actual execution payload' },
  { name: 'description', required: true, securityCritical: true, description: 'What the tool claims to do' },
  { name: 'enact', required: false, securityCritical: true, description: 'Protocol version security' },
  { name: 'env', required: false, securityCritical: true, description: 'Environment variables' },
  { name: 'from', required: false, securityCritical: true, description: 'Container image (critical for security)' },
  { name: 'inputSchema', required: false, securityCritical: true, description: 'Defines the attack surface' },
  { name: 'name', required: true, securityCritical: true, description: 'Tool identity (prevents impersonation)' },
  { name: 'timeout', required: false, securityCritical: true, description: 'Prevents DoS attacks' },
  { name: 'version', required: false, securityCritical: true, description: 'Tool version for compatibility' }
];

// Generic document fields (for non-Enact use cases)
export const GENERIC_DEFAULT_FIELDS: FieldConfig[] = [
  { name: 'id', required: true, securityCritical: true, description: 'Document identifier' },
  { name: 'content', required: true, securityCritical: true, description: 'Document content' },
  { name: 'timestamp', required: true, securityCritical: true, description: 'Creation timestamp' },
  { name: 'metadata', required: false, securityCritical: false, description: 'Additional metadata' }
];

export class FieldSelector {
  private fieldConfigs: FieldConfig[];

  constructor(fieldConfigs: FieldConfig[] = GENERIC_DEFAULT_FIELDS) {
    this.fieldConfigs = fieldConfigs;
  }

  // Create canonical object with only specified fields
  createCanonicalObject(
    document: Record<string, any>, 
    options: SigningFieldOptions = {}
  ): Record<string, any> {
    const {
      includeFields,
      excludeFields = [],
      additionalCriticalFields = [],
      customFieldConfig
    } = options;

    // Use custom config if provided, otherwise use instance config
    const activeConfig = customFieldConfig || this.fieldConfigs;
    
    // Determine which fields to include
    let fieldsToInclude: string[];
    
    if (includeFields) {
      // Explicit inclusion list
      fieldsToInclude = includeFields;
    } else {
      // Default to security-critical fields plus any additional ones
      const criticalFields = activeConfig
        .filter(config => config.securityCritical)
        .map(config => config.name);
      fieldsToInclude = [...criticalFields, ...additionalCriticalFields];
    }

    // Remove excluded fields
    fieldsToInclude = fieldsToInclude.filter(field => !excludeFields.includes(field));

    // Validate required fields are present
    this.validateRequiredFields(document, activeConfig, fieldsToInclude);

    // Create canonical object with only non-empty values, sorted alphabetically
    const canonical: Record<string, any> = {};
    
    fieldsToInclude
      .sort() // Alphabetical sorting for deterministic output
      .forEach(fieldName => {
        const value = document[fieldName];
        if (this.isNonEmpty(value)) {
          canonical[fieldName] = value;
        }
      });

    return canonical;
  }

  // Validate that required fields are present and will be included
  private validateRequiredFields(
    document: Record<string, any>, 
    config: FieldConfig[], 
    fieldsToInclude: string[]
  ): void {
    // Only validate required fields that are actually being included in the signature
    const requiredFieldsToInclude = config
      .filter(field => field.required && fieldsToInclude.includes(field.name))
      .map(field => field.name);

    for (const requiredField of requiredFieldsToInclude) {
      if (!document.hasOwnProperty(requiredField) || this.isEmpty(document[requiredField])) {
        throw new Error(`Required field '${requiredField}' is missing or empty`);
      }
    }
  }

  // Check if value should be excluded (following Enact protocol: empty values excluded)
  private isEmpty(value: any): boolean {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string' && value === '') return true;
    if (Array.isArray(value) && value.length === 0) return true;
    if (typeof value === 'object' && Object.keys(value).length === 0) return true;
    return false;
  }

  private isNonEmpty(value: any): boolean {
    return !this.isEmpty(value);
  }

  // Get field configuration
  getFieldConfig(): FieldConfig[] {
    return [...this.fieldConfigs];
  }

  // Get security-critical fields
  getSecurityCriticalFields(): string[] {
    return this.fieldConfigs
      .filter(config => config.securityCritical)
      .map(config => config.name)
      .sort();
  }

  // Get required fields
  getRequiredFields(): string[] {
    return this.fieldConfigs
      .filter(config => config.required)
      .map(config => config.name)
      .sort();
  }
}

// Pre-configured selectors for common use cases
export const EnactFieldSelector = new FieldSelector(ENACT_DEFAULT_CRITICAL_FIELDS);
export const GenericFieldSelector = new FieldSelector(GENERIC_DEFAULT_FIELDS);
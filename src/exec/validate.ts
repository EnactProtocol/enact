// src/exec/validate.ts - Simplified validation module for CLI core
import type { EnactTool, JSONSchemaDefinition } from "../types";

export function validateAgainstSchema(value: any, schema: JSONSchemaDefinition, fieldName: string): void {
  const { type, format, enum: enumValues, minimum, maximum, pattern, required } = schema;
  
  // Type validation
  if (type) {
    let validType = false;
    
    switch (type) {
      case 'string':
        validType = typeof value === 'string';
        break;
      case 'number':
      case 'integer':
        validType = typeof value === 'number';
        if (type === 'integer' && !Number.isInteger(value)) {
          validType = false;
        }
        break;
      case 'boolean':
        validType = typeof value === 'boolean';
        break;
      case 'array':
        validType = Array.isArray(value);
        break;
      case 'object':
        validType = typeof value === 'object' && value !== null && !Array.isArray(value);
        break;
    }
    
    if (!validType) {
      throw new Error(`Invalid type for ${fieldName}: expected ${type}`);
    }
  }
  
  // For object types, validate required properties
  if (type === 'object' && required && Array.isArray(required)) {
    for (const requiredProp of required) {
      if (value[requiredProp] === undefined) {
        throw new Error(`Missing required property: ${requiredProp} in ${fieldName}`);
      }
    }
  }
  
  // Format validation (simplified)
  if (format && type === 'string') {
    const formatValidators: Record<string, RegExp> = {
      'email': /^.+@.+\..+$/,
      'date-time': /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(.\d+)?(Z|[+-]\d{2}:\d{2})$/,
      'uri': /^https?:\/\/.+/,
    };
    
    if (formatValidators[format] && !formatValidators[format].test(value)) {
      throw new Error(`Invalid format for ${fieldName}: expected ${format}`);
    }
  }
  
  // Enum validation
  if (enumValues && !enumValues.includes(value)) {
    throw new Error(`Invalid value for ${fieldName}: must be one of [${enumValues.join(', ')}]`);
  }
  
  // Range validation for numbers
  if ((minimum !== undefined || maximum !== undefined) && typeof value === 'number') {
    if (minimum !== undefined && value < minimum) {
      throw new Error(`Value for ${fieldName} must be >= ${minimum}`);
    }
    if (maximum !== undefined && value > maximum) {
      throw new Error(`Value for ${fieldName} must be <= ${maximum}`);
    }
  }
  
  // Pattern validation for strings
  if (pattern && typeof value === 'string' && !new RegExp(pattern).test(value)) {
    throw new Error(`Value for ${fieldName} must match pattern: ${pattern}`);
  }
}

export function validateToolStructure(tool: EnactTool): void {
  // Check required fields
  const requiredFields = ['name', 'description', 'command'];
  
  for (const field of requiredFields) {
    if (!(tool as any)[field]) {
      throw new Error(`Missing required field: ${field} in tool ${JSON.stringify(tool)}`);
    }
  }
  
  // Validate name format - supports hierarchical names with forward slashes
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*(?:\/[a-zA-Z0-9][a-zA-Z0-9_-]*)*$/.test(tool.name)) {
    throw new Error(`Invalid tool name: ${tool.name}. Must follow hierarchical format like "tool-name" or "org/package/tool-name".`);
  }
  
  // Validate command is not empty
  if (!tool.command.trim()) {
    throw new Error('Command field cannot be empty');
  }
  
  // Validate timeout format if provided
  if (tool.timeout) {
    if (!/^\d+[smh]$/.test(tool.timeout)) {
      throw new Error(`Invalid timeout format: ${tool.timeout}. Must be Go duration format like "30s", "5m", "1h"`);
    }
  }
  
  // Validate environment variables structure
  if (tool.env) {
    for (const [varName, config] of Object.entries(tool.env)) {
      if (!config.description || !config.source || config.required === undefined) {
        throw new Error(`Environment variable ${varName} must have description, source, and required fields`);
      }
      
      if (!/^[A-Z][A-Z0-9_]*$/.test(varName)) {
        throw new Error(`Invalid environment variable name: ${varName}. Must be uppercase with underscores`);
      }
    }
  }
  
  // Validate authors structure if provided
  if (tool.authors) {
    for (const author of tool.authors) {
      if (!author.name) {
        throw new Error('Author must have a name field');
      }
      
      if (author.email && !/^.+@.+\..+$/.test(author.email)) {
        throw new Error(`Invalid email format for author: ${author.email}`);
      }
      
      if (author.url && !/^https?:\/\/.+/.test(author.url)) {
        throw new Error(`Invalid URL format for author: ${author.url}`);
      }
    }
  }
}

export function validateInputs(tool: EnactTool, inputs: Record<string, any>): Record<string, any> {
  const validatedInputs: Record<string, any> = {};
  
  if (!tool.inputSchema || !tool.inputSchema.properties) {
    return inputs;
  }
  
  // Check for required fields
  const requiredFields = tool.inputSchema.required || [];
  for (const field of requiredFields) {
    if (inputs[field] === undefined) {
      throw new Error(`Missing required input: ${field}`);
    }
  }
  
  // Validate and extract values
  for (const [key, schema] of Object.entries(tool.inputSchema.properties)) {
    if (inputs[key] !== undefined) {
      validateAgainstSchema(inputs[key], schema, key);
      validatedInputs[key] = inputs[key];
    } else if (schema.default !== undefined) {
      validatedInputs[key] = schema.default;
    }
  }
  
  return validatedInputs;
}

export function validateOutput(tool: EnactTool, output: any): any {
  if (!tool.outputSchema) {
    return output;
  }
  
  try {
    // Validate the entire output against the schema
    validateAgainstSchema(output, tool.outputSchema, 'output');
    
    // Also check required fields specifically
    if (tool.outputSchema.required && Array.isArray(tool.outputSchema.required)) {
      for (const requiredField of tool.outputSchema.required) {
        if (output[requiredField] === undefined) {
          throw new Error(`Missing required output field: ${requiredField}`);
        }
      }
    }
    
    return output;
  } catch (error) {
    throw new Error(`Output validation failed: ${(error as Error).message}`);
  }
}

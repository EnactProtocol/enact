/**
 * JSON Extractor
 * 
 * Extracts data from JSON files
 */

const fs = require('node:fs');

async function extractJSON(source) {
  const content = fs.readFileSync(source.path, 'utf-8');
  const data = JSON.parse(content);
  
  // Handle both array and object with data property
  if (Array.isArray(data)) {
    return data;
  }
  
  if (data.data && Array.isArray(data.data)) {
    return data.data;
  }
  
  return [data];
}

module.exports = { extractJSON };

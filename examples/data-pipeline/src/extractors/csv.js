/**
 * CSV Extractor
 * 
 * Extracts data from CSV files
 */

const fs = require('node:fs');

async function extractCSV(source) {
  const content = fs.readFileSync(source.path, 'utf-8');
  const lines = content.trim().split('\n');
  const headers = lines[0].split(source.delimiter || ',');
  
  return lines.slice(1).map(line => {
    const values = line.split(source.delimiter || ',');
    const record = {};
    headers.forEach((header, i) => {
      record[header.trim()] = values[i]?.trim();
    });
    return record;
  });
}

module.exports = { extractCSV };

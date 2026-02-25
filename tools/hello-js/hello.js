#!/usr/bin/env node

/**
 * Hello JS - A simple greeting tool
 *
 * Usage: node hello.js [name]
 *        node hello.js --name <name>
 */

function parseArgs(args) {
  const result = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--") && i + 1 < args.length) {
      result[args[i].slice(2)] = args[i + 1];
      i++;
    } else if (!args[i].startsWith("--")) {
      result._positional = result._positional || [];
      result._positional.push(args[i]);
    }
  }
  return result;
}

const parsed = parseArgs(process.argv.slice(2));
const name = parsed.name || parsed._positional?.[0] || "World";

console.log(`Hello, ${name}! 👋`);

const now = new Date().toISOString();
console.log(`Generated at: ${now}`);
console.log(`Node version: ${process.version}`);

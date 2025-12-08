#!/bin/bash
# Rename all @enact/ packages to @enactprotocol/

set -e

echo "Renaming @enact/ to @enactprotocol/ across the entire codebase..."

# Function to replace in file
replace_in_file() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/@enact\//@enactprotocol\//g" "$1"
    else
        # Linux
        sed -i "s/@enact\//@enactprotocol\//g" "$1"
    fi
}

# Update all package.json files
echo "Updating package.json files..."
find packages -name "package.json" -type f | while read file; do
    echo "  - $file"
    replace_in_file "$file"
done

# Update tsconfig.json
echo "Updating tsconfig.json..."
replace_in_file "tsconfig.json"

# Update all TypeScript source files
echo "Updating TypeScript source files..."
find packages -name "*.ts" -type f | while read file; do
    replace_in_file "$file"
done

# Update all TypeScript test files
echo "Updating TypeScript test files..."
find packages -name "*.test.ts" -type f | while read file; do
    replace_in_file "$file"
done

# Update all markdown files
echo "Updating markdown files..."
find . -name "*.md" -type f -not -path "./node_modules/*" -not -path "./.archive/*" | while read file; do
    replace_in_file "$file"
done

# Update JSON files (workflow files, config files)
echo "Updating JSON and YAML files..."
find . -name "*.json" -type f -not -path "./node_modules/*" -not -path "./bun.lock" -not -path "./.archive/*" | while read file; do
    replace_in_file "$file"
done

find . -name "*.yml" -o -name "*.yaml" -type f -not -path "./node_modules/*" -not -path "./.archive/*" | while read file; do
    replace_in_file "$file"
done

echo ""
echo "✅ Renaming complete!"
echo ""
echo "Next steps:"
echo "1. Review changes: git diff"
echo "2. Test build: bun run build"
echo "3. Commit: git add -A && git commit -m 'Rename packages from @enact to @enactprotocol'"

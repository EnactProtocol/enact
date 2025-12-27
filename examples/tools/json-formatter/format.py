#!/usr/bin/env python3
"""
JSON Formatter - Formats JSON files from /input to /output
"""

import argparse
import json
import os
import sys
from pathlib import Path


def format_json_file(input_path: Path, output_path: Path, indent: int, sort_keys: bool):
    """Format a single JSON file."""
    try:
        with open(input_path, 'r') as f:
            data = json.load(f)

        with open(output_path, 'w') as f:
            json.dump(data, f, indent=indent, sort_keys=sort_keys)
            f.write('\n')  # Add trailing newline

        print(f"Formatted: {input_path.name}")
        return True
    except json.JSONDecodeError as e:
        print(f"Error parsing {input_path.name}: {e}", file=sys.stderr)
        return False
    except Exception as e:
        print(f"Error processing {input_path.name}: {e}", file=sys.stderr)
        return False


def main():
    parser = argparse.ArgumentParser(description='Format JSON files')
    parser.add_argument('--indent', type=int, default=2, help='Indentation spaces')
    parser.add_argument('--sort-keys', type=str, default='false', help='Sort keys (true/false)')
    args = parser.parse_args()

    # Parse boolean from string
    sort_keys = args.sort_keys.lower() == 'true'

    input_dir = Path('/input')
    output_dir = Path('/output')

    # Create output directory
    output_dir.mkdir(parents=True, exist_ok=True)

    # Find and format all JSON files
    success_count = 0
    error_count = 0

    for json_file in input_dir.rglob('*.json'):
        # Preserve directory structure
        relative_path = json_file.relative_to(input_dir)
        output_path = output_dir / relative_path
        output_path.parent.mkdir(parents=True, exist_ok=True)

        if format_json_file(json_file, output_path, args.indent, sort_keys):
            success_count += 1
        else:
            error_count += 1

    print(f"---")
    print(f"Formatted {success_count} files, {error_count} errors")

    if error_count > 0:
        sys.exit(1)


if __name__ == '__main__':
    main()

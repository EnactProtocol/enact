#!/usr/bin/env node

import { parseCSV, toCSV } from "./csv-parser";
import { parseJSON, toJSON } from "./json-handler";
import type { DataRow, TransformOptions, TransformResult } from "./types";

function parseArgs(argv: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--") && i + 1 < argv.length) {
      result[argv[i].slice(2)] = argv[i + 1];
      i++;
    } else if (!argv[i].startsWith("--")) {
      positional.push(argv[i]);
    }
  }
  // Map positional args to named params for backwards compat
  if (positional.length > 0 && !result.input) result.input = positional[0];
  if (positional.length > 1 && !result["input-format"]) result["input-format"] = positional[1];
  if (positional.length > 2 && !result["output-format"]) result["output-format"] = positional[2];
  return result;
}

function transform(options: TransformOptions): TransformResult {
  try {
    let data: DataRow[];
    if (options.inputFormat === "csv") {
      data = parseCSV(options.input);
    } else {
      data = parseJSON(options.input);
    }

    if (options.filterColumn && options.filterValue) {
      data = data.filter((row) => String(row[options.filterColumn!]) === options.filterValue);
    }

    if (options.selectColumns && options.selectColumns.length > 0) {
      data = data.map((row) => {
        const filtered: DataRow = {};
        for (const col of options.selectColumns!) {
          if (col in row) {
            filtered[col] = row[col];
          }
        }
        return filtered;
      });
    }

    let outputData: string;
    if (options.outputFormat === "csv") {
      outputData = toCSV(data);
    } else {
      outputData = toJSON(data);
    }

    const columns = data.length > 0 ? Object.keys(data[0]) : [];

    return {
      status: "success",
      data: outputData,
      rowCount: data.length,
      columnCount: columns.length,
      columns: columns,
    };
  } catch (error) {
    return {
      status: "error",
      error: (error as Error).message,
    };
  }
}

function main() {
  try {
    const args = parseArgs(process.argv.slice(2));

    const inputData = args.input;
    const inputFormat = (args["input-format"] || args.inputFormat) as "csv" | "json";
    const outputFormat = (args["output-format"] || args.outputFormat) as "csv" | "json";
    const filterColumn = args["filter-column"] || args.filterColumn || undefined;
    const filterValue = args["filter-value"] || args.filterValue || undefined;
    const selectColumnsStr = args["select-columns"] || args.selectColumns;
    const selectColumns = selectColumnsStr
      ? selectColumnsStr.split(",").map((s) => s.trim())
      : undefined;

    if (!inputData || !inputFormat || !outputFormat) {
      console.log(
        JSON.stringify({
          status: "error",
          error: "Missing required arguments: --input, --input-format, --output-format",
        })
      );
      process.exit(1);
    }

    const options: TransformOptions = {
      input: inputData,
      inputFormat,
      outputFormat,
      filterColumn,
      filterValue,
      selectColumns,
    };

    const result = transform(options);
    console.log(JSON.stringify(result));

    if (result.status === "error") {
      process.exit(1);
    }
  } catch (error) {
    console.log(
      JSON.stringify({
        status: "error",
        error: (error as Error).message,
      })
    );
    process.exit(1);
  }
}

main();

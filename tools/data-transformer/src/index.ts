#!/usr/bin/env node

import { parseCSV, toCSV } from "./csv-parser";
import { parseJSON, toJSON } from "./json-handler";
import type { DataRow, TransformOptions, TransformResult } from "./types";

function transform(options: TransformOptions): TransformResult {
  try {
    // Parse input based on format
    let data: DataRow[];
    if (options.inputFormat === "csv") {
      data = parseCSV(options.input);
    } else {
      data = parseJSON(options.input);
    }

    // Apply filters if specified
    if (options.filterColumn && options.filterValue) {
      data = data.filter((row) => String(row[options.filterColumn!]) === options.filterValue);
    }

    // Select specific columns if specified
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

    // Convert to output format
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

// Main execution
function main() {
  try {
    // Parse command line arguments
    const inputData = process.argv[2];
    const inputFormat = process.argv[3] as "csv" | "json";
    const outputFormat = process.argv[4] as "csv" | "json";
    const filterColumn = process.argv[5] && process.argv[5] !== "" ? process.argv[5] : undefined;
    const filterValue = process.argv[6] && process.argv[6] !== "" ? process.argv[6] : undefined;
    const selectColumnsArg = process.argv[7];

    const selectColumns =
      selectColumnsArg && selectColumnsArg !== ""
        ? selectColumnsArg.split(",").map((s) => s.trim())
        : undefined;

    if (!inputData || !inputFormat || !outputFormat) {
      console.log(
        JSON.stringify({
          status: "error",
          error: "Missing required arguments: input, inputFormat, outputFormat",
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

# Data Transformer

A TypeScript-based tool that transforms data between CSV and JSON formats with advanced filtering and column selection capabilities.

## Features

- **Format Conversion**: Convert between CSV and JSON formats
- **Filtering**: Filter rows based on column values
- **Column Selection**: Select specific columns to include in output
- **Type Safety**: Built with TypeScript for robust data handling
- **Error Handling**: Comprehensive error reporting

## Usage Examples

### CSV to JSON

```bash
enact run enact/data/transformer -a '{
  "input": "name,age,city\nAlice,30,NYC\nBob,25,LA",
  "input_format": "csv",
  "output_format": "json"
}'
```

### JSON to CSV

```bash
enact run enact/data/transformer -a '{
  "input": "[{\"name\":\"Alice\",\"age\":30},{\"name\":\"Bob\",\"age\":25}]",
  "input_format": "json",
  "output_format": "csv"
}'
```

### Filter Data

```bash
enact run enact/data/transformer -a '{
  "input": "[{\"name\":\"Alice\",\"age\":30,\"city\":\"NYC\"},{\"name\":\"Bob\",\"age\":25,\"city\":\"LA\"}]",
  "input_format": "json",
  "output_format": "json",
  "filter_column": "city",
  "filter_value": "NYC"
}'
```

### Select Specific Columns

```bash
enact run enact/data/transformer -a '{
  "input": "[{\"name\":\"Alice\",\"age\":30,\"city\":\"NYC\"}]",
  "input_format": "json",
  "output_format": "json",
  "select_columns": "name,age"
}'
```

## Output Format

Success response:
```json
{
  "status": "success",
  "data": "<transformed data>",
  "rowCount": 2,
  "columnCount": 3,
  "columns": ["name", "age", "city"]
}
```

Error response:
```json
{
  "status": "error",
  "error": "Error message describing what went wrong"
}
```

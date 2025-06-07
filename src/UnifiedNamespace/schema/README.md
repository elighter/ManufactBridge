# Unified Namespace Schema Structure

This directory contains files related to data schemas in the ManufactBridge Unified Namespace (UNS) platform.

## Schema Definitions

Unified Namespace uses a JSON Schema-based schema validation mechanism for structured data sharing. This ensures:

- Data consistency
- Standardized data format
- Easier application development
- Improved data quality

## Basic Data Structure

Every message published in UNS must conform to the following general structure:

```json
{
  "timestamp": "2023-06-15T12:34:56.789Z",
  "value": <value-type-can-vary>,
  "quality": "GOOD|BAD|UNCERTAIN",
  "metadata": {
    "source": "source-system-id",
    "dataType": "string|number|boolean|object|array",
    "unit": "optional-unit"
  }
}
```

## Schema Validation

Data validation in UNS occurs in two stages:

1. **Topic Path Validation**: The topic paths where data is published are validated for compliance with defined rules.

2. **Data Structure Validation**: Published data is validated against the relevant JSON schema according to data type.

## Available Schemas

You can find the following schemas in this directory:

- **base-message.json**: Base schema for all UNS messages
- **device-data.json**: Schema for device data
- **alarm-event.json**: Schema for alarms and events
- **command.json**: Schema for command messages
- **metadata.json**: Schema for metadata information

## Schema Development

When adding new schemas or updating existing schemas, follow these steps:

1. Define the schema in compliance with JSON Schema format
2. Test schema validation
3. Add the schema to this directory
4. Update necessary references in the `schema-validator.js` file

## Resources

- [JSON Schema Official Website](https://json-schema.org/)
- [JSON Schema Validation](https://json-schema.org/understanding-json-schema/)
- [AJV JavaScript Validation Library](https://ajv.js.org/) 
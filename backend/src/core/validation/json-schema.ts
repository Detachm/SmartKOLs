import { AppError } from "../errors/app-error";

export type JsonSchema =
  | {
      type: "object";
      required?: string[];
      properties?: Record<string, JsonSchema>;
      additionalProperties?: boolean;
    }
  | {
      type: "array";
      items?: JsonSchema;
      minItems?: number;
    }
  | {
      type: "string";
      enum?: string[];
      minLength?: number;
    }
  | {
      type: "number" | "integer";
    }
  | {
      type: "boolean";
    };

export interface JsonSchemaValidationIssue {
  path: string;
  message: string;
}

export function parseJsonSchema(rawSchema: string, context: string): JsonSchema {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawSchema);
  } catch (error) {
    throw new AppError("INTERNAL_ERROR", `${context} is not valid JSON schema`, {
      details: { context },
      cause: error,
    });
  }

  return normalizeJsonSchema(parsed, context);
}

export function validateJsonValue(
  value: unknown,
  schema: JsonSchema,
  path = "$",
): JsonSchemaValidationIssue[] {
  if (schema.type === "object") {
    return validateObject(value, schema, path);
  }

  if (schema.type === "array") {
    return validateArray(value, schema, path);
  }

  if (schema.type === "string") {
    return validateString(value, schema, path);
  }

  if (schema.type === "number") {
    return typeof value === "number" && Number.isFinite(value)
      ? []
      : [{ path, message: "must be a finite number" }];
  }

  if (schema.type === "integer") {
    return typeof value === "number" && Number.isInteger(value)
      ? []
      : [{ path, message: "must be an integer" }];
  }

  return typeof value === "boolean"
    ? []
    : [{ path, message: "must be a boolean" }];
}

function normalizeJsonSchema(schema: unknown, context: string): JsonSchema {
  if (!isRecord(schema)) {
    throw new AppError("INTERNAL_ERROR", `${context} must be a JSON object schema`, {
      details: { context },
    });
  }

  const type = schema.type;
  if (type === "object") {
    const propertiesInput = isRecord(schema.properties) ? schema.properties : undefined;
    const properties = propertiesInput
      ? Object.fromEntries(
        Object.entries(propertiesInput).map(([key, value]) => [key, normalizeJsonSchema(value, `${context}.properties.${key}`)]),
      )
      : undefined;
    const required = Array.isArray(schema.required)
      ? schema.required.map((value, index) => requireString(value, `${context}.required[${index}]`))
      : undefined;

    return {
      type,
      properties,
      required,
      additionalProperties: schema.additionalProperties === undefined ? true : Boolean(schema.additionalProperties),
    };
  }

  if (type === "array") {
    return {
      type,
      items: schema.items === undefined ? undefined : normalizeJsonSchema(schema.items, `${context}.items`),
      minItems: schema.minItems === undefined ? undefined : requireNonNegativeInteger(schema.minItems, `${context}.minItems`),
    };
  }

  if (type === "string") {
    const enumValues = Array.isArray(schema.enum)
      ? schema.enum.map((value, index) => requireString(value, `${context}.enum[${index}]`))
      : undefined;

    return {
      type,
      enum: enumValues,
      minLength: schema.minLength === undefined ? undefined : requireNonNegativeInteger(schema.minLength, `${context}.minLength`),
    };
  }

  if (type === "number" || type === "integer" || type === "boolean") {
    return { type };
  }

  throw new AppError("INTERNAL_ERROR", `${context}.type must be one of: object, array, string, number, integer, boolean`, {
    details: { context, type },
  });
}

function validateObject(
  value: unknown,
  schema: Extract<JsonSchema, { type: "object" }>,
  path: string,
): JsonSchemaValidationIssue[] {
  if (!isRecord(value)) {
    return [{ path, message: "must be an object" }];
  }

  const issues: JsonSchemaValidationIssue[] = [];
  const properties = schema.properties ?? {};
  const required = new Set(schema.required ?? []);

  for (const key of Array.from(required)) {
    if (!(key in value)) {
      issues.push({ path: `${path}.${key}`, message: "is required" });
    }
  }

  for (const [key, propertyValue] of Object.entries(value)) {
    const propertySchema = properties[key];
    if (!propertySchema) {
      if (schema.additionalProperties === false) {
        issues.push({ path: `${path}.${key}`, message: "is not allowed" });
      }
      continue;
    }

    issues.push(...validateJsonValue(propertyValue, propertySchema, `${path}.${key}`));
  }

  return issues;
}

function validateArray(
  value: unknown,
  schema: Extract<JsonSchema, { type: "array" }>,
  path: string,
): JsonSchemaValidationIssue[] {
  if (!Array.isArray(value)) {
    return [{ path, message: "must be an array" }];
  }

  const issues: JsonSchemaValidationIssue[] = [];
  if (schema.minItems !== undefined && value.length < schema.minItems) {
    issues.push({ path, message: `must contain at least ${schema.minItems} items` });
  }

  if (!schema.items) {
    return issues;
  }

  for (const [index, item] of Array.from(value.entries())) {
    issues.push(...validateJsonValue(item, schema.items, `${path}[${index}]`));
  }

  return issues;
}

function validateString(
  value: unknown,
  schema: Extract<JsonSchema, { type: "string" }>,
  path: string,
): JsonSchemaValidationIssue[] {
  if (typeof value !== "string") {
    return [{ path, message: "must be a string" }];
  }

  const issues: JsonSchemaValidationIssue[] = [];
  if (schema.minLength !== undefined && value.length < schema.minLength) {
    issues.push({ path, message: `must have at least ${schema.minLength} characters` });
  }

  if (schema.enum && !schema.enum.includes(value)) {
    issues.push({ path, message: `must be one of: ${schema.enum.join(", ")}` });
  }

  return issues;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, context: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new AppError("INTERNAL_ERROR", `${context} must be a non-empty string`, {
      details: { context },
    });
  }

  return value.trim();
}

function requireNonNegativeInteger(value: unknown, context: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new AppError("INTERNAL_ERROR", `${context} must be a non-negative integer`, {
      details: { context, value },
    });
  }

  return value;
}

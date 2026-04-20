import { AppError } from "../errors/app-error";

export function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new AppError("VALIDATION_ERROR", `${field} must be a non-empty string`, {
      details: { field },
    });
  }

  return value.trim();
}

export function requireIntegerInRange(value: unknown, field: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new AppError("VALIDATION_ERROR", `${field} must be an integer between ${min} and ${max}`, {
      details: { field, min, max },
    });
  }

  return value;
}

export function requireOneOf<T extends string>(value: unknown, field: string, choices: readonly T[]): T {
  if (typeof value !== "string" || !choices.includes(value as T)) {
    throw new AppError("VALIDATION_ERROR", `${field} must be one of: ${choices.join(", ")}`, {
      details: { field, choices },
    });
  }

  return value as T;
}

export function requireIsoDateTimeString(value: unknown, field: string): string {
  const normalized = requireNonEmptyString(value, field);

  if (Number.isNaN(Date.parse(normalized))) {
    throw new AppError("VALIDATION_ERROR", `${field} must be a valid ISO datetime string`, {
      details: { field },
    });
  }

  return normalized;
}

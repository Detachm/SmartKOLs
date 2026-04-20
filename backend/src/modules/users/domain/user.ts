import { requireNonEmptyString, requireOneOf } from "../../../core/validation/guards";

export type UserStatus = "active" | "disabled";

export interface User {
  id: string;
  email: string;
  name: string;
  status: UserStatus;
  created_at: string;
}

export function createUser(input: {
  id: string;
  email: string;
  name: string;
  created_at: string;
}): User {
  return {
    id: requireNonEmptyString(input.id, "id"),
    email: normalizeEmail(input.email),
    name: requireNonEmptyString(input.name, "name"),
    status: requireOneOf("active", "status", ["active", "disabled"] as const),
    created_at: requireNonEmptyString(input.created_at, "created_at"),
  };
}

export function normalizeEmail(value: string): string {
  return requireNonEmptyString(value, "email").toLowerCase();
}

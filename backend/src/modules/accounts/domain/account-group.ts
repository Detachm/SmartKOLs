import { AppError } from "../../../core/errors/app-error";
import { requireNonEmptyString } from "../../../core/validation/guards";

export interface AccountGroup {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
  created_at: string;
}

export function createAccountGroup(group: AccountGroup): AccountGroup {
  return {
    id: requireNonEmptyString(group.id, "id"),
    workspace_id: requireNonEmptyString(group.workspace_id, "workspace_id"),
    name: normalizeAccountGroupName(group.name),
    color: normalizeAccountGroupColor(group.color),
    created_at: requireNonEmptyString(group.created_at, "created_at"),
  };
}

export function normalizeAccountGroupName(value: string): string {
  return requireNonEmptyString(value, "name").trim();
}

export function normalizeAccountGroupColor(value: string): string {
  const normalized = requireNonEmptyString(value, "color").trim().toLowerCase();
  if (!/^#[0-9a-f]{6}$/.test(normalized)) {
    throw new AppError("VALIDATION_ERROR", "account group color must be a 7-character hex value like #1f8fff", {
      details: { field: "color", value },
    });
  }

  return normalized;
}

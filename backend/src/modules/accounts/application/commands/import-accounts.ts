import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import { requireNonEmptyString } from "../../../../core/validation/guards";
import type { ImportAccountsRequest, ImportAccountsResponse } from "../../../../contracts/api/account-imports";
import type { WorkspacesRepository } from "../../../workspaces/application/ports/workspaces-repository";
import type { AuditLog } from "../../../audit/domain/audit-log";
import { createAccount, normalizeHandle } from "../../domain/account";
import { createAccountGroup, normalizeAccountGroupName } from "../../domain/account-group";
import type { AccountGroupsRepository } from "../ports/account-groups-repository";
import type { AccountsRepository } from "../ports/accounts-repository";
import type { AccountImportWriteTransaction } from "../ports/account-import-write-transaction";

export interface ImportAccountsDependencies {
  workspaces: WorkspacesRepository;
  groups: AccountGroupsRepository;
  accounts: AccountsRepository;
  writes: AccountImportWriteTransaction;
  clock: Clock;
}

interface PreparedImportRow {
  handle: string;
  display_name: string;
  group_name?: string;
}

const AUTO_GROUP_COLOR_PALETTE = [
  "#1f8fff",
  "#ef4444",
  "#0f766e",
  "#8b5cf6",
  "#ea580c",
  "#2563eb",
  "#059669",
  "#dc2626",
] as const;

function pickDeterministicColor(input: string): string {
  const normalized = input.trim().toLowerCase();
  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) >>> 0;
  }
  return AUTO_GROUP_COLOR_PALETTE[hash % AUTO_GROUP_COLOR_PALETTE.length];
}

function prepareRows(rows: ImportAccountsRequest["rows"]): PreparedImportRow[] {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new AppError("VALIDATION_ERROR", "rows must include at least one account", {
      details: { field: "rows" },
    });
  }

  return rows.map((row, index) => ({
    handle: normalizeHandle(row.handle),
    display_name: requireNonEmptyString(row.display_name, `rows[${index}].display_name`),
    group_name: row.group_name?.trim() ? normalizeAccountGroupName(row.group_name) : undefined,
  }));
}

export class ImportAccounts {
  constructor(private readonly deps: ImportAccountsDependencies) {}

  async execute(input: ImportAccountsRequest): Promise<ImportAccountsResponse> {
    const workspace = await this.deps.workspaces.findById(input.workspace_id);
    if (!workspace) {
      throw new AppError("NOT_FOUND", "workspace not found", {
        details: { workspace_id: input.workspace_id },
      });
    }

    const preparedRows = prepareRows(input.rows);
    const duplicateHandles = preparedRows
      .map((row) => row.handle)
      .filter((handle, index, array) => array.indexOf(handle) !== index);
    if (duplicateHandles.length > 0) {
      throw new AppError("VALIDATION_ERROR", "rows contain duplicate account handles", {
        details: { duplicate_handles: Array.from(new Set(duplicateHandles)) },
      });
    }

    for (const row of preparedRows) {
      const existing = await this.deps.accounts.findByWorkspaceAndHandle(workspace.id, row.handle);
      if (existing) {
        throw new AppError("CONFLICT", "account handle already exists in workspace", {
          details: { workspace_id: workspace.id, handle: row.handle },
        });
      }
    }

    const existingGroups = await this.deps.groups.listByWorkspaceId(workspace.id);
    const groupByName = new Map(existingGroups.map((group) => [group.name, group]));
    const requestedGroupNames = Array.from(new Set(preparedRows.map((row) => row.group_name).filter(Boolean))) as string[];
    const missingGroupNames = requestedGroupNames.filter((groupName) => !groupByName.has(groupName));
    if (missingGroupNames.length > 0 && !input.create_missing_groups) {
      throw new AppError("VALIDATION_ERROR", "rows reference groups that do not exist in workspace", {
        details: { missing_group_names: missingGroupNames, create_missing_groups: false },
      });
    }

    const now = this.deps.clock.now().toISOString();
    const createdGroups = missingGroupNames.map((groupName) => {
      const group = createAccountGroup({
        id: newId(),
        workspace_id: workspace.id,
        name: groupName,
        color: pickDeterministicColor(groupName),
        created_at: now,
      });
      groupByName.set(group.name, group);
      return group;
    });

    const createdAccounts = preparedRows.map((row) => createAccount({
      id: newId(),
      workspace_id: workspace.id,
      group_id: row.group_name ? groupByName.get(row.group_name)?.id : undefined,
      platform: "x",
      handle: row.handle,
      display_name: row.display_name,
      created_at: now,
    }));

    const auditLogs: AuditLog[] = [
      ...createdGroups.map((group) => ({
        id: newId(),
        workspace_id: workspace.id,
        actor_type: "system" as const,
        entity_type: "account_group",
        entity_id: group.id,
        action: "account_group.created_via_import",
        after_state: JSON.stringify(group),
        created_at: now,
      })),
      ...createdAccounts.map((account) => ({
        id: newId(),
        workspace_id: workspace.id,
        actor_type: "system" as const,
        entity_type: "account",
        entity_id: account.id,
        action: "account.created_via_import",
        after_state: JSON.stringify(account),
        created_at: now,
      })),
    ];

    await this.deps.writes.commitImport({
      groups: createdGroups,
      accounts: createdAccounts,
      audit_logs: auditLogs,
    });

    return {
      workspace_id: workspace.id,
      created_group_count: createdGroups.length,
      created_account_count: createdAccounts.length,
      created_group_ids: createdGroups.map((group) => group.id),
      created_account_ids: createdAccounts.map((account) => account.id),
    };
  }
}

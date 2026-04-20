import { newId } from "../../../core/ids/new-id";
import { AppError } from "../../../core/errors/app-error";
import { requireNonEmptyString } from "../../../core/validation/guards";
import type { SqliteExecutor } from "../../../infrastructure/db/sqlite-executor";
import type { ManagedSecretVault } from "../application/ports/managed-secret-vault";

interface ManagedSecretRow {
  id: string;
  namespace: string;
  kind: string;
  secret_json: string;
  created_at: string;
  updated_at: string;
}

type JsonObject = Record<string, unknown>;

export class SqliteManagedSecretVault implements ManagedSecretVault {
  constructor(private readonly db: SqliteExecutor) {}

  async readJsonSecret(
    secretRef: string,
    input: {
      namespace: string;
      expected_kinds: readonly string[];
    },
  ): Promise<Record<string, unknown>> {
    const secretId = this.parseManagedSecretRef(secretRef);
    const row = this.db.get<ManagedSecretRow>(
      `SELECT id, namespace, kind, secret_json, created_at, updated_at
      FROM managed_secrets
      WHERE id = ?`,
      [secretId],
    );

    if (!row) {
      throw new AppError("NOT_FOUND", "managed secret not found", {
        details: {
          secret_ref: secretRef,
          secret_id: secretId,
          namespace: input.namespace,
        },
      });
    }

    if (row.namespace !== input.namespace) {
      throw new AppError("INVALID_STATE", "managed secret namespace mismatch", {
        details: {
          secret_ref: secretRef,
          secret_id: secretId,
          expected_namespace: input.namespace,
          actual_namespace: row.namespace,
        },
      });
    }

    if (!input.expected_kinds.includes(row.kind)) {
      throw new AppError("INVALID_STATE", "managed secret kind is unsupported", {
        details: {
          secret_ref: secretRef,
          secret_id: secretId,
          namespace: row.namespace,
          kind: row.kind,
          expected_kinds: input.expected_kinds,
        },
      });
    }

    return parseJsonObject(row.secret_json, {
      secret_ref: secretRef,
      secret_id: secretId,
    });
  }

  async upsertJsonSecret(
    existingSecretRef: string | undefined,
    input: {
      namespace: string;
      kind: string;
      secret: object;
      now: string;
    },
  ): Promise<string> {
    const secretId = existingSecretRef?.startsWith("managed:")
      ? this.parseManagedSecretRef(existingSecretRef)
      : newId();
    const existing = this.db.get<ManagedSecretRow>(
      `SELECT id, namespace, kind, secret_json, created_at, updated_at
      FROM managed_secrets
      WHERE id = ?`,
      [secretId],
    );

    if (existing && existing.namespace !== input.namespace) {
      throw new AppError("INVALID_STATE", "managed secret namespace cannot be reassigned", {
        details: {
          secret_ref: existingSecretRef,
          secret_id: secretId,
          existing_namespace: existing.namespace,
          requested_namespace: input.namespace,
        },
      });
    }

    this.db.run(
      `INSERT INTO managed_secrets (
        id, namespace, kind, secret_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        namespace = excluded.namespace,
        kind = excluded.kind,
        secret_json = excluded.secret_json,
        updated_at = excluded.updated_at`,
      [
        secretId,
        input.namespace,
        input.kind,
        JSON.stringify(input.secret),
        existing?.created_at ?? input.now,
        input.now,
      ],
    );

    return `managed:${secretId}`;
  }

  async deleteManagedSecret(
    secretRef: string | undefined,
    input?: {
      namespace?: string;
    },
  ): Promise<void> {
    if (!secretRef || !secretRef.startsWith("managed:")) {
      return;
    }

    const secretId = this.parseManagedSecretRef(secretRef);
    if (input?.namespace) {
      const row = this.db.get<Pick<ManagedSecretRow, "namespace">>(
        `SELECT namespace
        FROM managed_secrets
        WHERE id = ?`,
        [secretId],
      );

      if (row && row.namespace !== input.namespace) {
        throw new AppError("INVALID_STATE", "managed secret namespace mismatch", {
          details: {
            secret_ref: secretRef,
            secret_id: secretId,
            expected_namespace: input.namespace,
            actual_namespace: row.namespace,
          },
        });
      }
    }

    this.db.run(`DELETE FROM managed_secrets WHERE id = ?`, [secretId]);
  }

  async migrateLegacySecrets(): Promise<void> {
    this.db.run(
      `INSERT OR IGNORE INTO managed_secrets (id, namespace, kind, secret_json, created_at, updated_at)
      SELECT id, 'connector_x', provider, secret_json, created_at, updated_at
      FROM credential_secrets`,
    );
    this.db.run(
      `INSERT OR IGNORE INTO managed_secrets (id, namespace, kind, secret_json, created_at, updated_at)
      SELECT id, 'alert_channel', kind, secret_json, created_at, updated_at
      FROM alert_channel_secrets`,
    );
  }

  private parseManagedSecretRef(secretRef: string): string {
    const normalized = requireNonEmptyString(secretRef, "secret_ref");
    if (!normalized.startsWith("managed:")) {
      throw new AppError("INVALID_STATE", "secret_ref must use managed secret storage", {
        details: {
          secret_ref: normalized,
        },
      });
    }

    return requireNonEmptyString(normalized.slice("managed:".length), "managed secret id");
  }
}

function parseJsonObject(secretJson: string, details: Record<string, unknown>): JsonObject {
  let parsed: unknown;
  try {
    parsed = JSON.parse(secretJson);
  } catch (error) {
    throw new AppError("INTERNAL_ERROR", "managed secret must contain valid JSON", {
      cause: error,
      details,
    });
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new AppError("INTERNAL_ERROR", "managed secret must contain a JSON object", {
      details,
    });
  }

  return parsed as JsonObject;
}

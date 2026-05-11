import { readFileSync } from "fs";
import path from "path";
import type { SqliteExecutor } from "./sqlite-executor";
import { formatTrendDisplayTopic, normalizeTrendClusterKey, shouldRepairTrendTopic } from "../../modules/trends/domain/trend-clustering";
import { sanitizeLegacyEngagementAutomationTargets } from "../../modules/engagement/application/engagement-policy-validation";

interface TableColumnRow {
  name: string;
}

interface SqlDefinitionRow {
  sql: string;
}

export function loadSchemaSql(schemaPath = path.resolve(process.cwd(), "backend/schema.sql")): string {
  return readFileSync(schemaPath, "utf8");
}

export function applySchema(db: SqliteExecutor, schemaSql?: string): void {
  const sql = schemaSql ?? loadSchemaSql();
  const statements = sql
    .split(/;\s*\n/g)
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0)
    .filter((statement) => !statement.includes("CREATE UNIQUE INDEX IF NOT EXISTS idx_engagement_messages_thread_external_message_id"))
    .filter((statement) => !statement.includes("CREATE INDEX IF NOT EXISTS idx_connector_requests_request_id"))
    .filter((statement) => !statement.includes("CREATE UNIQUE INDEX IF NOT EXISTS idx_connector_requests_account_endpoint_idempotency"))
    // Older live DB snapshots may not yet have these columns; defer these indexes until after ensureColumn().
    .filter((statement) => !statement.includes("CREATE INDEX IF NOT EXISTS idx_autopost_policies_status_next_run_after"))
    .filter((statement) => !statement.includes("CREATE INDEX IF NOT EXISTS idx_recurring_brief_plans_status_next_run_after"));

  db.transaction((tx) => {
    for (const statement of statements) {
      tx.run(statement);
    }
  });

  ensureColumn(db, "engagement_messages", "external_message_id", "TEXT");
  ensureColumn(db, "source_fetch_runs", "lease_expires_at", "DATETIME");
  ensureColumn(db, "publish_jobs", "lease_expires_at", "DATETIME");
  ensureColumn(db, "agent_tasks", "error_code", "TEXT");
  ensureColumn(db, "agent_tasks", "error_message", "TEXT");
  ensureColumn(db, "agent_tasks", "started_at", "DATETIME");
  ensureColumn(db, "agent_tasks", "lease_expires_at", "DATETIME");
  ensureColumn(db, "agent_tasks", "finished_at", "DATETIME");
  ensureColumn(db, "autopost_policies", "next_run_after", "DATETIME");
  ensureColumn(db, "autopost_policies", "last_attempted_at", "DATETIME");
  ensureColumn(db, "autopost_policies", "last_run_status", "TEXT");
  ensureColumn(db, "autopost_policies", "last_failed_at", "DATETIME");
  ensureColumn(db, "autopost_policies", "last_error_code", "TEXT");
  ensureColumn(db, "autopost_policies", "last_error_message", "TEXT");
  ensureColumn(db, "autopost_policies", "last_enqueued_at", "DATETIME");
  ensureColumn(db, "autopost_policies", "last_run_id", "TEXT");
  ensureColumn(db, "recurring_brief_plans", "last_attempted_at", "DATETIME");
  ensureColumn(db, "recurring_brief_plans", "last_run_status", "TEXT");
  ensureColumn(db, "recurring_brief_plans", "last_failed_at", "DATETIME");
  ensureColumn(db, "recurring_brief_plans", "last_error_code", "TEXT");
  ensureColumn(db, "recurring_brief_plans", "last_error_message", "TEXT");
  ensureColumn(db, "trends", "cluster_key", "TEXT");
  rebuildConnectorRequestsIfNeeded(db);
  db.run(`DROP INDEX IF EXISTS idx_engagement_messages_thread_external_message_id`);
  db.run(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_engagement_messages_thread_external_message_id
    ON engagement_messages (thread_id, external_message_id)`,
  );
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_source_fetch_runs_status_started_at
    ON source_fetch_runs (status, started_at ASC)`,
  );
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_publish_jobs_status_run_after
    ON publish_jobs (status, run_after ASC)`,
  );
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_publish_jobs_schedule_run_after
    ON publish_jobs (schedule_id, run_after DESC)`,
  );
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_agent_tasks_status_created_at
    ON agent_tasks (status, created_at ASC)`,
  );
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_worker_jobs_status_run_after
    ON worker_jobs (status, run_after ASC)`,
  );
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_autopost_policies_status_next_run_after
    ON autopost_policies (status, next_run_after ASC)`,
  );
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_worker_jobs_target_status
    ON worker_jobs (job_type, target_type, target_id, status)`,
  );
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_connector_requests_request_id
    ON connector_requests (request_id)`,
  );
  db.run(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_connector_requests_account_endpoint_idempotency
    ON connector_requests (account_id, endpoint_code, idempotency_key)
    WHERE idempotency_key IS NOT NULL`,
  );
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_publish_schedules_workspace_scheduled_for
    ON publish_schedules (workspace_id, scheduled_for ASC)`,
  );
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_content_briefs_account_updated_at
    ON content_briefs (account_id, updated_at DESC)`,
  );
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_content_brief_evidence_brief_rank
    ON content_brief_evidence_items (brief_id, rank ASC)`,
  );
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_trends_workspace_cluster_key
    ON trends (workspace_id, cluster_key)`,
  );
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_source_documents_workspace_published_at
    ON source_documents (workspace_id, COALESCE(published_at, created_at) DESC)`,
  );
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_source_watchlists_account_updated_at
    ON source_watchlists (account_id, updated_at DESC)`,
  );
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_recurring_brief_plans_account_updated_at
    ON recurring_brief_plans (account_id, updated_at DESC)`,
  );
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_recurring_brief_plans_status_next_run_after
    ON recurring_brief_plans (status, next_run_after ASC)`,
  );
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_autopost_runs_account_created_at
    ON autopost_runs (account_id, created_at DESC)`,
  );
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_autopost_runs_policy_created_at
    ON autopost_runs (policy_id, created_at DESC)`,
  );
  db.run(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_worker_jobs_editorial_queued_target
    ON worker_jobs (job_type, target_type, target_id)
    WHERE job_type = 'editorial.recurring_brief.execute' AND status = 'queued'`,
  );
  db.run(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_worker_jobs_autopost_queued_target
    ON worker_jobs (job_type, target_type, target_id)
    WHERE job_type = 'autopost.execute' AND status = 'queued'`,
  );
  db.run(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_worker_jobs_orchestration_queued_target
    ON worker_jobs (job_type, target_type, target_id)
    WHERE job_type = 'orchestration.tick' AND status = 'queued'`,
  );
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_account_orchestration_states_status_next_tick_after
    ON account_orchestration_states (status, next_tick_after ASC)`,
  );
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_orchestration_runs_account_created_at
    ON orchestration_runs (account_id, created_at DESC)`,
  );
  rebuildWorkerJobsIfNeeded(db);
  migrateLegacyContentBriefSourceScopes(db);
  normalizeSourceDocumentPublishedAt(db);
  normalizeTrendMetadata(db);
  dedupeTrendRows(db);
  sanitizeLegacyEngagementPolicies(db);
}

function ensureColumn(db: SqliteExecutor, tableName: string, columnName: string, columnDefinition: string): void {
  const columns = db.all<TableColumnRow>(`PRAGMA table_info(${tableName})`);
  if (columns.some((column) => column.name === columnName)) {
    return;
  }

  db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
}

function rebuildConnectorRequestsIfNeeded(db: SqliteExecutor): void {
  const definition = db.get<SqlDefinitionRow>(
    `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'connector_requests'`,
  );

  if (!definition?.sql || definition.sql.includes("'running'")) {
    return;
  }

  db.transaction((tx) => {
    tx.run(`ALTER TABLE connector_requests RENAME TO connector_requests_legacy`);
    tx.run(`
      CREATE TABLE connector_requests (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        request_id TEXT,
        account_id TEXT NOT NULL,
        credential_id TEXT NOT NULL,
        endpoint_code TEXT NOT NULL,
        idempotency_key TEXT,
        request_payload TEXT NOT NULL,
        response_payload TEXT,
        platform_status_code TEXT,
        status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed', 'rate_limited')),
        error_code TEXT,
        error_message TEXT,
        started_at DATETIME NOT NULL,
        finished_at DATETIME,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
        FOREIGN KEY (credential_id) REFERENCES account_credentials(id) ON DELETE CASCADE
      )
    `);
    tx.run(`
      INSERT INTO connector_requests (
        id, workspace_id, request_id, account_id, credential_id, endpoint_code, idempotency_key,
        request_payload, response_payload, platform_status_code, status, error_code, error_message,
        started_at, finished_at
      )
      SELECT
        id, workspace_id, request_id, account_id, credential_id, endpoint_code, idempotency_key,
        request_payload, response_payload, platform_status_code, status, error_code, error_message,
        started_at, finished_at
      FROM connector_requests_legacy
    `);
    tx.run(`DROP TABLE connector_requests_legacy`);
  });
}

function normalizeSourceDocumentPublishedAt(db: SqliteExecutor): void {
  const rows = db.all<{ id: string; published_at?: string | null }>(
    `SELECT id, published_at FROM source_documents WHERE published_at IS NOT NULL AND published_at != ''`,
  );

  for (const row of rows) {
    const normalized = normalizePublishedAt(row.published_at ?? undefined);
    if (!normalized || normalized === row.published_at) {
      continue;
    }

    db.run(`UPDATE source_documents SET published_at = ? WHERE id = ?`, [normalized, row.id]);
  }
}

function normalizeTrendMetadata(db: SqliteExecutor): void {
  const rows = db.all<{ id: string; topic: string; cluster_key?: string | null }>(
    `SELECT id, topic, cluster_key FROM trends`,
  );

  for (const row of rows) {
    const clusterKey = row.cluster_key?.trim() || normalizeTrendClusterKey(row.topic);
    if (!clusterKey) {
      continue;
    }

    const normalizedTopic = row.topic.replace(/\s+/g, " ").trim();
    const nextTopic = shouldRepairTrendTopic(normalizedTopic, clusterKey)
      ? formatTrendDisplayTopic(clusterKey)
      : normalizedTopic;

    if (clusterKey === (row.cluster_key ?? "").trim() && nextTopic === normalizedTopic) {
      continue;
    }

    db.run(`UPDATE trends SET cluster_key = ?, topic = ? WHERE id = ?`, [clusterKey, nextTopic, row.id]);
  }
}

function dedupeTrendRows(db: SqliteExecutor): void {
  const rows = db.all<{
    id: string;
    workspace_id: string;
    cluster_key?: string | null;
    topic: string;
    status: "active" | "cooling" | "archived";
    score: number;
    updated_at: string;
  }>(
    `SELECT id, workspace_id, cluster_key, topic, status, score, updated_at
    FROM trends
    ORDER BY
      workspace_id ASC,
      cluster_key ASC,
      CASE status
        WHEN 'active' THEN 2
        WHEN 'cooling' THEN 1
        ELSE 0
      END DESC,
      score DESC,
      updated_at DESC,
      id DESC`,
  );

  const seen = new Set<string>();

  for (const row of rows) {
    const clusterKey = row.cluster_key?.trim() || normalizeTrendClusterKey(row.topic);
    if (!clusterKey) {
      continue;
    }

    const dedupeKey = `${row.workspace_id}:${clusterKey}`;
    if (!seen.has(dedupeKey)) {
      seen.add(dedupeKey);
      if (clusterKey !== (row.cluster_key ?? "").trim()) {
        db.run(`UPDATE trends SET cluster_key = ? WHERE id = ?`, [clusterKey, row.id]);
      }
      continue;
    }

    if (row.status !== "archived" || clusterKey !== (row.cluster_key ?? "").trim()) {
      db.run(`UPDATE trends SET cluster_key = ?, status = 'archived' WHERE id = ?`, [clusterKey, row.id]);
    }
  }
}

function normalizePublishedAt(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  const timestamp = Date.parse(trimmed);
  if (!Number.isFinite(timestamp)) {
    return trimmed;
  }

  return new Date(timestamp).toISOString();
}

function rebuildWorkerJobsIfNeeded(db: SqliteExecutor): void {
  const definition = db.get<SqlDefinitionRow>(
    `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'worker_jobs'`,
  );

  if (!definition?.sql || definition.sql.includes("'orchestration.tick'")) {
    return;
  }

  db.transaction((tx) => {
    tx.run(`ALTER TABLE worker_jobs RENAME TO worker_jobs_legacy`);
    tx.run(`
      CREATE TABLE worker_jobs (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        job_type TEXT NOT NULL CHECK (job_type IN ('mentions.pull', 'dm.pull', 'engagement.reply.execute', 'editorial.recurring_brief.execute', 'autopost.execute', 'orchestration.tick')),
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
        run_after DATETIME NOT NULL,
        lease_expires_at DATETIME,
        error_code TEXT,
        error_message TEXT,
        started_at DATETIME,
        finished_at DATETIME,
        created_at DATETIME NOT NULL,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
      )
    `);
    tx.run(`
      INSERT INTO worker_jobs (
        id, workspace_id, job_type, target_type, target_id, payload, status, run_after, lease_expires_at,
        error_code, error_message, started_at, finished_at, created_at
      )
      SELECT
        id, workspace_id, job_type, target_type, target_id, payload, status, run_after, lease_expires_at,
        error_code, error_message, started_at, finished_at, created_at
      FROM worker_jobs_legacy
    `);
    tx.run(`DROP TABLE worker_jobs_legacy`);
  });
}

interface LegacyContentBriefSourceScopeRow {
  id: string;
  generation_mode: "from_trend" | "from_documents" | "from_source_scope";
  source_scope?: string | null;
}

function migrateLegacyContentBriefSourceScopes(db: SqliteExecutor): void {
  const rows = db.all<LegacyContentBriefSourceScopeRow>(
    `SELECT id, generation_mode, source_scope
    FROM content_briefs
    WHERE source_scope IS NOT NULL AND TRIM(source_scope) <> ''`,
  );

  const updates = rows.flatMap((row) => {
    const migrated = migrateLegacyContentBriefSourceScope(row);
    if (!migrated || migrated === row.source_scope) {
      return [];
    }

    return [{
      id: row.id,
      source_scope: migrated,
    }];
  });

  if (updates.length === 0) {
    return;
  }

  db.transaction((tx) => {
    for (const update of updates) {
      tx.run(
        `UPDATE content_briefs SET source_scope = ? WHERE id = ?`,
        [update.source_scope, update.id],
      );
    }
  });
}

function migrateLegacyContentBriefSourceScope(row: LegacyContentBriefSourceScopeRow): string | undefined {
  if (!row.source_scope) {
    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(row.source_scope);
  } catch {
    return row.source_scope;
  }

  if (!parsed || typeof parsed !== "object") {
    return row.source_scope;
  }

  const raw = parsed as {
    kind?: unknown;
    source_id?: unknown;
    source_ids?: unknown;
    source_type?: unknown;
    source_types?: unknown;
    preferred_source_ids?: unknown;
    preferred_source_types?: unknown;
    query?: unknown;
    published_from?: unknown;
    published_to?: unknown;
    limit?: unknown;
    source_document_ids?: unknown;
    requested_audience?: unknown;
    requested_angle_hint?: unknown;
  };

  if (raw.kind === "selected_documents") {
    return row.source_scope;
  }

  if (raw.kind !== "account_active_sources") {
    return row.source_scope;
  }

  const requested_audience = optionalTrimmedString(raw.requested_audience);
  const requested_angle_hint = optionalTrimmedString(raw.requested_angle_hint);

  if (
    row.generation_mode === "from_documents"
    && Array.isArray(raw.source_document_ids)
    && raw.source_document_ids.every((item) => typeof item === "string")
  ) {
    return JSON.stringify({
      kind: "selected_documents",
      source_document_ids: normalizeStringArray(raw.source_document_ids),
      requested_audience,
      requested_angle_hint,
    });
  }

  return JSON.stringify({
    kind: "account_active_sources",
    source_ids: normalizeStringArray([
      ...extractStringArray(raw.source_ids),
      ...extractOptionalString(raw.source_id),
    ]),
    source_types: normalizeStringArray([
      ...extractStringArray(raw.source_types),
      ...extractOptionalString(raw.source_type),
    ]),
    preferred_source_ids: normalizeStringArray(extractStringArray(raw.preferred_source_ids)),
    preferred_source_types: normalizeStringArray(extractStringArray(raw.preferred_source_types)),
    query: optionalTrimmedString(raw.query),
    published_from: optionalTrimmedString(raw.published_from),
    published_to: optionalTrimmedString(raw.published_to),
    limit: typeof raw.limit === "number" && Number.isInteger(raw.limit) && raw.limit >= 1 && raw.limit <= 120
      ? raw.limit
      : 40,
    requested_audience,
    requested_angle_hint,
  });
}

function optionalTrimmedString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function normalizeStringArray(values: string[]): string[] {
  return Array.from(new Set(values.map((item) => item.trim()).filter((item) => item !== "")));
}

function extractStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function extractOptionalString(value: unknown): string[] {
  return typeof value === "string" && value.trim() !== "" ? [value.trim()] : [];
}

function sanitizeLegacyEngagementPolicies(db: SqliteExecutor): void {
  const rows = db.all<{
    account_id: string;
    account_handle: string;
    policy_body: string;
    updated_at: string;
  }>(
    `SELECT ep.account_id, ep.policy_body, ep.updated_at, a.handle AS account_handle
    FROM engagement_policies ep
    INNER JOIN accounts a ON a.id = ep.account_id`,
  );

  const updates = rows.flatMap((row) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(row.policy_body);
    } catch {
      return [];
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return [];
    }

    const sanitized = sanitizeLegacyEngagementAutomationTargets(
      parsed as import("../../modules/engagement/domain/engagement-policy").EngagementPolicyRule,
      row.account_handle,
    );
    if (!sanitized.changed) {
      return [];
    }

    return [{
      account_id: row.account_id,
      policy_body: JSON.stringify(sanitized.policy_body),
      updated_at: new Date().toISOString(),
    }];
  });

  if (updates.length === 0) {
    return;
  }

  db.transaction((tx) => {
    for (const update of updates) {
      tx.run(
        `UPDATE engagement_policies
        SET policy_body = ?, updated_at = ?
        WHERE account_id = ?`,
        [update.policy_body, update.updated_at, update.account_id],
      );
    }
  });
}

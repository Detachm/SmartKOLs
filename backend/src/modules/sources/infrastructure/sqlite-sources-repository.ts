import type { SqliteExecutor } from "../../../infrastructure/db/sqlite-executor";
import type { SourcesRepository } from "../application/ports/sources-repository";
import type { Source } from "../domain/source";
import type { SourceDocument } from "../domain/source-document";
import type { SourceFetchRun } from "../domain/source-fetch-run";

export class SqliteSourcesRepository implements SourcesRepository {
  constructor(private readonly db: SqliteExecutor) {}

  async findSourceById(sourceId: string): Promise<Source | null> {
    return this.db.get<Source>(
      `SELECT
        id, workspace_id, account_id, type, name, url, status, last_fetched_at, created_at
      FROM sources
      WHERE id = ?`,
      [sourceId],
    );
  }

  async findSourceByAccountAndUrl(accountId: string, url: string): Promise<Source | null> {
    return this.db.get<Source>(
      `SELECT
        id, workspace_id, account_id, type, name, url, status, last_fetched_at, created_at
      FROM sources
      WHERE account_id = ? AND url = ?`,
      [accountId, url],
    );
  }

  async listSourcesByAccountId(accountId: string): Promise<Source[]> {
    return this.db.all<Source>(
      `SELECT
        id, workspace_id, account_id, type, name, url, status, last_fetched_at, created_at
      FROM sources
      WHERE account_id = ?
      ORDER BY created_at DESC`,
      [accountId],
    );
  }

  async saveSource(source: Source): Promise<void> {
    this.db.run(
      `INSERT INTO sources (
        id, workspace_id, account_id, type, name, url, status, last_fetched_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        type = excluded.type,
        name = excluded.name,
        url = excluded.url,
        status = excluded.status,
        last_fetched_at = excluded.last_fetched_at`,
      [
        source.id,
        source.workspace_id,
        source.account_id,
        source.type,
        source.name,
        source.url,
        source.status,
        source.last_fetched_at ?? null,
        source.created_at,
      ],
    );
  }

  async deleteSource(sourceId: string): Promise<void> {
    this.db.run(`DELETE FROM sources WHERE id = ?`, [sourceId]);
  }

  async createFetchRun(run: SourceFetchRun): Promise<void> {
    this.db.run(
      `INSERT INTO source_fetch_runs (
        id, source_id, status, fetched_count, error_code, error_message, started_at, lease_expires_at, finished_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        run.id,
        run.source_id,
        run.status,
        run.fetched_count,
        run.error_code ?? null,
        run.error_message ?? null,
        run.started_at,
        run.lease_expires_at ?? null,
        run.finished_at ?? null,
      ],
    );
  }

  async findFetchRunById(runId: string): Promise<SourceFetchRun | null> {
    return this.db.get<SourceFetchRun>(
      `SELECT
        id, source_id, status, fetched_count, error_code, error_message, started_at, lease_expires_at, finished_at
      FROM source_fetch_runs
      WHERE id = ?`,
      [runId],
    );
  }

  async listFetchRunsByWorkspaceAndStatus(workspaceId: string, status: SourceFetchRun["status"], limit: number): Promise<SourceFetchRun[]> {
    return this.db.all<SourceFetchRun>(
      `SELECT
        sfr.id, sfr.source_id, sfr.status, sfr.fetched_count, sfr.error_code, sfr.error_message, sfr.started_at, sfr.lease_expires_at, sfr.finished_at
      FROM source_fetch_runs sfr
      INNER JOIN sources s ON s.id = sfr.source_id
      WHERE s.workspace_id = ? AND sfr.status = ?
      ORDER BY COALESCE(sfr.finished_at, sfr.started_at) ASC, sfr.id ASC
      LIMIT ?`,
      [workspaceId, status, limit],
    );
  }

  async claimNextQueuedFetchRun(startedAt: string, leaseExpiresAt: string): Promise<SourceFetchRun | null> {
    return this.db.transaction((tx) => {
      const run = tx.get<SourceFetchRun>(
        `SELECT
          sfr.id, sfr.source_id, sfr.status, sfr.fetched_count, sfr.error_code, sfr.error_message, sfr.started_at, sfr.lease_expires_at, sfr.finished_at
        FROM source_fetch_runs sfr
        INNER JOIN sources s ON s.id = sfr.source_id
        WHERE sfr.status = 'queued'
          AND s.status = 'active'
        ORDER BY sfr.started_at ASC
        LIMIT 1`,
      );

      if (!run) {
        return null;
      }

      const claimed = tx.run(
        `UPDATE source_fetch_runs
        SET status = 'running', started_at = ?, lease_expires_at = ?, error_code = NULL, error_message = NULL, finished_at = NULL
        WHERE id = ? AND status = 'queued'`,
        [startedAt, leaseExpiresAt, run.id],
      );

      if (claimed.changes !== 1) {
        return null;
      }

      return {
        ...run,
        status: "running" as const,
        started_at: startedAt,
        lease_expires_at: leaseExpiresAt,
        error_code: undefined,
        error_message: undefined,
        finished_at: undefined,
      };
    });
  }

  async listExpiredRunningFetchRuns(now: string, limit: number): Promise<SourceFetchRun[]> {
    return this.db.all<SourceFetchRun>(
      `SELECT
        id, source_id, status, fetched_count, error_code, error_message, started_at, lease_expires_at, finished_at
      FROM source_fetch_runs
      WHERE status = 'running' AND lease_expires_at IS NOT NULL AND lease_expires_at <= ?
      ORDER BY lease_expires_at ASC
      LIMIT ?`,
      [now, limit],
    );
  }

  async saveFetchRun(run: SourceFetchRun): Promise<void> {
    this.db.run(
      `UPDATE source_fetch_runs
      SET status = ?, fetched_count = ?, error_code = ?, error_message = ?, started_at = ?, lease_expires_at = ?, finished_at = ?
      WHERE id = ?`,
      [
        run.status,
        run.fetched_count,
        run.error_code ?? null,
        run.error_message ?? null,
        run.started_at,
        run.lease_expires_at ?? null,
        run.finished_at ?? null,
        run.id,
      ],
    );
  }

  async listFetchRunsBySourceId(sourceId: string): Promise<SourceFetchRun[]> {
    return this.db.all<SourceFetchRun>(
      `SELECT
        id, source_id, status, fetched_count, error_code, error_message, started_at, lease_expires_at, finished_at
      FROM source_fetch_runs
      WHERE source_id = ?
      ORDER BY started_at DESC`,
      [sourceId],
    );
  }

  async findDocumentByContentHash(sourceId: string, contentHash: string): Promise<SourceDocument | null> {
    return this.db.get<SourceDocument>(
      `SELECT
        id, workspace_id, source_id, external_doc_id, canonical_url, title, summary, body_text,
        language, published_at, content_hash, created_at
      FROM source_documents
      WHERE source_id = ? AND content_hash = ?`,
      [sourceId, contentHash],
    );
  }

  async findDocumentById(documentId: string): Promise<SourceDocument | null> {
    return this.db.get<SourceDocument>(
      `SELECT
        id, workspace_id, source_id, external_doc_id, canonical_url, title, summary, body_text,
        language, published_at, content_hash, created_at
      FROM source_documents
      WHERE id = ?`,
      [documentId],
    );
  }

  async listDocumentsByIds(documentIds: string[]): Promise<SourceDocument[]> {
    if (documentIds.length === 0) {
      return [];
    }

    const placeholders = documentIds.map(() => "?").join(", ");
    return this.db.all<SourceDocument>(
      `SELECT
        id, workspace_id, source_id, external_doc_id, canonical_url, title, summary, body_text,
        language, published_at, content_hash, created_at
      FROM source_documents
      WHERE id IN (${placeholders})`,
      documentIds,
    );
  }

  async listDocumentsBySourceId(sourceId: string): Promise<SourceDocument[]> {
    return this.db.all<SourceDocument>(
      `SELECT
        id, workspace_id, source_id, external_doc_id, canonical_url, title, summary, body_text,
        language, published_at, content_hash, created_at
      FROM source_documents
      WHERE source_id = ?
      ORDER BY COALESCE(published_at, created_at) DESC`,
      [sourceId],
    );
  }

  async listRecentDocumentsByWorkspaceId(workspaceId: string, limit: number): Promise<SourceDocument[]> {
    return this.db.all<SourceDocument>(
      `SELECT
        id, workspace_id, source_id, external_doc_id, canonical_url, title, summary, body_text,
        language, published_at, content_hash, created_at
      FROM source_documents
      WHERE workspace_id = ?
      ORDER BY COALESCE(published_at, created_at) DESC
      LIMIT ?`,
      [workspaceId, limit],
    );
  }

  async listRecentDocumentsByAccountId(accountId: string, limit: number): Promise<SourceDocument[]> {
    return this.db.all<SourceDocument>(
      `SELECT
        sd.id, sd.workspace_id, sd.source_id, sd.external_doc_id, sd.canonical_url, sd.title, sd.summary, sd.body_text,
        sd.language, sd.published_at, sd.content_hash, sd.created_at
      FROM source_documents sd
      INNER JOIN sources s ON s.id = sd.source_id
      WHERE s.account_id = ?
      ORDER BY COALESCE(sd.published_at, sd.created_at) DESC
      LIMIT ?`,
      [accountId, limit],
    );
  }

  async createDocument(document: SourceDocument): Promise<void> {
    this.db.run(
      `INSERT INTO source_documents (
        id, workspace_id, source_id, external_doc_id, canonical_url, title, summary, body_text,
        language, published_at, content_hash, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        document.id,
        document.workspace_id,
        document.source_id,
        document.external_doc_id ?? null,
        document.canonical_url,
        document.title,
        document.summary,
        document.body_text,
        document.language,
        document.published_at ?? null,
        document.content_hash,
        document.created_at,
      ],
    );
  }
}

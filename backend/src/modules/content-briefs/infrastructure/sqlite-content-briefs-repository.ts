import type { SqliteExecutor } from "../../../infrastructure/db/sqlite-executor";
import type { ContentBriefsRepository } from "../application/ports/content-briefs-repository";
import type { ContentBrief } from "../domain/content-brief";
import type { ContentBriefEvidenceItem } from "../domain/content-brief-evidence-item";

interface ContentBriefRow extends ContentBrief {
  evidence_count: number;
}

interface EvidenceRow {
  id: string;
  brief_id: string;
  source_document_id: string;
  rank: number;
  usage_reason: string;
  key_claims: string;
  quoted_excerpt?: string | null;
  created_at: string;
}

export class SqliteContentBriefsRepository implements ContentBriefsRepository {
  constructor(private readonly db: SqliteExecutor) {}

  private mapBriefRow<T extends ContentBrief>(row: T): T {
    return {
      ...row,
      trend_id: row.trend_id ?? undefined,
      topic_hint: row.topic_hint ?? undefined,
      topic: row.topic ?? undefined,
      angle: row.angle ?? undefined,
      audience: row.audience ?? undefined,
      outline: row.outline ?? undefined,
      source_scope: row.source_scope ?? undefined,
      generated_by_run_id: row.generated_by_run_id ?? undefined,
      error_code: row.error_code ?? undefined,
      error_message: row.error_message ?? undefined,
    };
  }

  async findBriefById(briefId: string): Promise<ContentBrief | null> {
    const row = this.db.get<ContentBrief>(
      `SELECT
        id, workspace_id, account_id, trend_id, status, generation_mode, topic_hint, topic, angle, audience, outline,
        source_scope, generated_by_run_id, error_code, error_message, created_at, updated_at
      FROM content_briefs
      WHERE id = ?`,
      [briefId],
    );

    return row ? this.mapBriefRow(row) : null;
  }

  async listBriefsByAccountId(accountId: string, limit: number): Promise<Array<ContentBrief & { evidence_count: number }>> {
    const rows = this.db.all<ContentBriefRow>(
      `SELECT
        cb.id, cb.workspace_id, cb.account_id, cb.trend_id, cb.status, cb.generation_mode, cb.topic_hint, cb.topic,
        cb.angle, cb.audience, cb.outline, cb.source_scope, cb.generated_by_run_id, cb.error_code, cb.error_message,
        cb.created_at, cb.updated_at,
        COALESCE((SELECT COUNT(*) FROM content_brief_evidence_items e WHERE e.brief_id = cb.id), 0) AS evidence_count
      FROM content_briefs cb
      WHERE cb.account_id = ?
      ORDER BY cb.updated_at DESC
      LIMIT ?`,
      [accountId, limit],
    );

    return rows.map((row) => this.mapBriefRow(row));
  }

  async saveBrief(brief: ContentBrief): Promise<void> {
    this.db.run(
      `INSERT INTO content_briefs (
        id, workspace_id, account_id, trend_id, status, generation_mode, topic_hint, topic, angle, audience, outline,
        source_scope, generated_by_run_id, error_code, error_message, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        trend_id = excluded.trend_id,
        status = excluded.status,
        generation_mode = excluded.generation_mode,
        topic_hint = excluded.topic_hint,
        topic = excluded.topic,
        angle = excluded.angle,
        audience = excluded.audience,
        outline = excluded.outline,
        source_scope = excluded.source_scope,
        generated_by_run_id = excluded.generated_by_run_id,
        error_code = excluded.error_code,
        error_message = excluded.error_message,
        updated_at = excluded.updated_at`,
      [
        brief.id,
        brief.workspace_id,
        brief.account_id,
        brief.trend_id ?? null,
        brief.status,
        brief.generation_mode,
        brief.topic_hint ?? null,
        brief.topic ?? null,
        brief.angle ?? null,
        brief.audience ?? null,
        brief.outline ?? null,
        brief.source_scope ?? null,
        brief.generated_by_run_id ?? null,
        brief.error_code ?? null,
        brief.error_message ?? null,
        brief.created_at,
        brief.updated_at,
      ],
    );
  }

  async listEvidenceByBriefId(briefId: string): Promise<ContentBriefEvidenceItem[]> {
    const rows = this.db.all<EvidenceRow>(
      `SELECT
        id, brief_id, source_document_id, rank, usage_reason, key_claims, quoted_excerpt, created_at
      FROM content_brief_evidence_items
      WHERE brief_id = ?
      ORDER BY rank ASC, created_at ASC`,
      [briefId],
    );

    return rows.map(mapEvidenceRow);
  }

  async listEvidenceByBriefIds(briefIds: string[]): Promise<ContentBriefEvidenceItem[]> {
    if (briefIds.length === 0) {
      return [];
    }

    const placeholders = briefIds.map(() => "?").join(", ");
    const rows = this.db.all<EvidenceRow>(
      `SELECT
        id, brief_id, source_document_id, rank, usage_reason, key_claims, quoted_excerpt, created_at
      FROM content_brief_evidence_items
      WHERE brief_id IN (${placeholders})
      ORDER BY brief_id ASC, rank ASC, created_at ASC`,
      briefIds,
    );

    return rows.map(mapEvidenceRow);
  }

  async replaceEvidenceItems(briefId: string, items: ContentBriefEvidenceItem[]): Promise<void> {
    this.db.transaction((tx) => {
      tx.run(`DELETE FROM content_brief_evidence_items WHERE brief_id = ?`, [briefId]);

      for (const item of items) {
        tx.run(
          `INSERT INTO content_brief_evidence_items (
            id, brief_id, source_document_id, rank, usage_reason, key_claims, quoted_excerpt, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.id,
            item.brief_id,
            item.source_document_id,
            item.rank,
            item.usage_reason,
            JSON.stringify(item.key_claims),
            item.quoted_excerpt ?? null,
            item.created_at,
          ],
        );
      }
    });
  }
}

function mapEvidenceRow(row: EvidenceRow): ContentBriefEvidenceItem {
  return {
    id: row.id,
    brief_id: row.brief_id,
    source_document_id: row.source_document_id,
    rank: row.rank,
    usage_reason: row.usage_reason,
    key_claims: JSON.parse(row.key_claims) as string[],
    quoted_excerpt: row.quoted_excerpt ?? undefined,
    created_at: row.created_at,
  };
}

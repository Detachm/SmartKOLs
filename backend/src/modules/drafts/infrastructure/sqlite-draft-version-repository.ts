import type { DraftVersionRepository } from "../application/ports/draft-version-repository";
import type { DraftVersion } from "../domain/draft-version";
import type { SqliteExecutor } from "../../../infrastructure/db/sqlite-executor";

export class SqliteDraftVersionRepository implements DraftVersionRepository {
  constructor(private readonly db: SqliteExecutor) {}

  async getNextVersionNumber(draftId: string): Promise<number> {
    const row = this.db.get<{ max_version: number | null }>(
      `SELECT MAX(version_no) AS max_version
      FROM draft_versions
      WHERE draft_id = ?`,
      [draftId],
    );

    return (row?.max_version ?? 0) + 1;
  }

  async findById(versionId: string): Promise<DraftVersion | null> {
    return this.db.get<DraftVersion>(
      `SELECT
        id, draft_id, version_no, content, metadata, created_by_type, created_by_id, created_at
      FROM draft_versions
      WHERE id = ?`,
      [versionId],
    );
  }

  async create(version: DraftVersion): Promise<void> {
    this.db.run(
      `INSERT INTO draft_versions (
        id, draft_id, version_no, content, metadata, created_by_type, created_by_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        version.id,
        version.draft_id,
        version.version_no,
        version.content,
        version.metadata,
        version.created_by_type,
        version.created_by_id ?? null,
        version.created_at,
      ],
    );
  }
}

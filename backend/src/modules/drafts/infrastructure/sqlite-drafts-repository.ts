import type { DraftsRepository } from "../application/ports/drafts-repository";
import type { Draft, DraftReview } from "../domain/draft";
import type { SqliteStatementExecutor } from "../../../infrastructure/db/sqlite-executor";

export class SqliteDraftsRepository implements DraftsRepository {
  constructor(private readonly db: SqliteStatementExecutor) {}

  async findById(draftId: string): Promise<Draft | null> {
    return this.db.get<Draft>(
      `SELECT
        id, workspace_id, account_id, trend_id, current_version_id, status,
        topic, scheduled_for, generated_by_run_id, created_at, updated_at
      FROM drafts
      WHERE id = ?`,
      [draftId],
    );
  }

  async findByGeneratedRunId(runId: string): Promise<Draft | null> {
    return this.db.get<Draft>(
      `SELECT
        id, workspace_id, account_id, trend_id, current_version_id, status,
        topic, scheduled_for, generated_by_run_id, created_at, updated_at
      FROM drafts
      WHERE generated_by_run_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT 1`,
      [runId],
    );
  }

  async listRecentByAccountId(accountId: string, limit: number): Promise<Draft[]> {
    return this.db.all<Draft>(
      `SELECT
        id, workspace_id, account_id, trend_id, current_version_id, status,
        topic, scheduled_for, generated_by_run_id, created_at, updated_at
      FROM drafts
      WHERE account_id = ?
      ORDER BY updated_at DESC, id DESC
      LIMIT ?`,
      [accountId, limit],
    );
  }

  async save(draft: Draft): Promise<void> {
    this.saveSync(draft);
  }

  saveSync(draft: Draft): void {
    this.db.run(
      `INSERT INTO drafts (
        id, workspace_id, account_id, trend_id, current_version_id, status,
        topic, scheduled_for, generated_by_run_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        trend_id = excluded.trend_id,
        current_version_id = excluded.current_version_id,
        status = excluded.status,
        topic = excluded.topic,
        scheduled_for = excluded.scheduled_for,
        generated_by_run_id = excluded.generated_by_run_id,
        updated_at = excluded.updated_at`,
      [
        draft.id,
        draft.workspace_id,
        draft.account_id,
        draft.trend_id ?? null,
        draft.current_version_id ?? null,
        draft.status,
        draft.topic,
        draft.scheduled_for ?? null,
        draft.generated_by_run_id ?? null,
        draft.created_at,
        draft.updated_at,
      ],
    );
  }

  async listReviewsByDraftId(draftId: string): Promise<DraftReview[]> {
    return this.db.all<DraftReview>(
      `SELECT
        id, draft_id, reviewer_type, reviewer_id, action, comment, created_at
      FROM draft_reviews
      WHERE draft_id = ?
      ORDER BY created_at ASC`,
      [draftId],
    );
  }

  async appendReview(review: DraftReview): Promise<void> {
    this.appendReviewSync(review);
  }

  appendReviewSync(review: DraftReview): void {
    this.db.run(
      `INSERT INTO draft_reviews (
        id, draft_id, reviewer_type, reviewer_id, action, comment, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        review.id,
        review.draft_id,
        review.reviewer_type,
        review.reviewer_id ?? null,
        review.action,
        review.comment ?? null,
        review.created_at,
      ],
    );
  }

  async findLatestScheduleIdByDraftId(draftId: string): Promise<string | null> {
    const row = this.db.get<{ id: string }>(
      `SELECT id
      FROM publish_schedules
      WHERE draft_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT 1`,
      [draftId],
    );

    return row?.id ?? null;
  }
}

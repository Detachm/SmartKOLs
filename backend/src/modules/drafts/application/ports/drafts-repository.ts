import type { Draft, DraftReview } from "../../domain/draft";

export interface DraftsRepository {
  findById(draftId: string): Promise<Draft | null>;
  findByGeneratedRunId(runId: string): Promise<Draft | null>;
  listRecentByAccountId(accountId: string, limit: number): Promise<Draft[]>;
  listReviewsByDraftId(draftId: string): Promise<DraftReview[]>;
  save(draft: Draft): Promise<void>;
  appendReview(review: DraftReview): Promise<void>;
  findLatestScheduleIdByDraftId(draftId: string): Promise<string | null>;
}

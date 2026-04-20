import type { DraftReview } from "../../modules/drafts/domain/draft";

export interface DraftReviewListResponse {
  reviews: DraftReview[];
}

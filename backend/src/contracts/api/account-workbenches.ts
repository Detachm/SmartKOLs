import type { ContentBriefDetailResponse, ContentBriefListItemResponse } from "./content-briefs";
import type { DraftListItem } from "./drafts";
import type { RecurringBriefPlanListResponse, SourceWatchlistListResponse } from "./editorial";
import type { EngagementPolicyResponse } from "./engagement-policies";
import type { EngagementThreadDetailResponse, EngagementThreadListItem, ReplyProposalListResponse } from "./engagement";
import type { AccountSourceDocumentListResponse } from "./sources";
import type { Trend } from "../../modules/trends/domain/trend";
import type { Source } from "../../modules/sources/domain/source";

export interface BriefWorkbenchResponse {
  account: {
    id: string;
    workspace_id: string;
  };
  sources: Source[];
  trends: Trend[];
  briefs: ContentBriefListItemResponse[];
  documents: AccountSourceDocumentListResponse["documents"];
  watchlists: SourceWatchlistListResponse["watchlists"];
  recurring_plans: RecurringBriefPlanListResponse["plans"];
  selected_brief?: ContentBriefDetailResponse;
}

export interface DraftWorkbenchResponse {
  account: {
    id: string;
    workspace_id: string;
  };
  drafts: DraftListItem[];
  ready_briefs: ContentBriefListItemResponse[];
  selected_brief?: ContentBriefDetailResponse;
}

export interface EngagementWorkbenchResponse {
  account: {
    id: string;
    workspace_id: string;
  };
  threads: EngagementThreadListItem[];
  selected_thread?: EngagementThreadDetailResponse;
  proposals: ReplyProposalListResponse["proposals"];
  policy?: EngagementPolicyResponse["policy"];
  policy_missing: boolean;
}

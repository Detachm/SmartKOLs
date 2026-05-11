import { AppError } from "../../../core/errors/app-error";
import { requireNonEmptyString, requireOneOf } from "../../../core/validation/guards";

export type DraftStatus = "pending" | "approved" | "rejected" | "scheduled" | "published" | "failed";
export type DraftReviewerType = "user" | "agent";

export interface Draft {
  id: string;
  workspace_id: string;
  account_id: string;
  trend_id?: string;
  current_version_id?: string;
  status: DraftStatus;
  topic: string;
  scheduled_for?: string;
  generated_by_run_id?: string;
  created_at: string;
  updated_at: string;
}

export interface DraftReview {
  id: string;
  draft_id: string;
  reviewer_type: DraftReviewerType;
  reviewer_id?: string;
  action: "approve" | "reject" | "edit" | "request_regenerate";
  comment?: string;
  created_at: string;
}

export function approveDraftState(draft: Draft, updatedAt: string): Draft {
  if (draft.status !== "pending") {
    throw new AppError("INVALID_STATE", `draft cannot transition from ${draft.status} to approved`, {
      details: { draft_id: draft.id, from: draft.status, to: "approved" },
    });
  }

  return {
    ...draft,
    status: "approved",
    updated_at: requireNonEmptyString(updatedAt, "updated_at"),
  };
}

export function rejectDraftState(draft: Draft, updatedAt: string): Draft {
  if (!["pending", "failed"].includes(draft.status)) {
    throw new AppError("INVALID_STATE", `draft cannot transition from ${draft.status} to rejected`, {
      details: { draft_id: draft.id, from: draft.status, to: "rejected" },
    });
  }

  return {
    ...draft,
    status: "rejected",
    updated_at: requireNonEmptyString(updatedAt, "updated_at"),
  };
}

export function editDraftContent(draft: Draft, updatedAt: string): Draft {
  if (!["pending", "approved"].includes(draft.status)) {
    throw new AppError("INVALID_STATE", `draft cannot be edited while status is ${draft.status}`, {
      details: { draft_id: draft.id, status: draft.status },
    });
  }

  return {
    ...draft,
    updated_at: requireNonEmptyString(updatedAt, "updated_at"),
  };
}

export function markDraftPublishFailed(draft: Draft, updatedAt: string): Draft {
  if (draft.status !== "scheduled") {
    throw new AppError("INVALID_STATE", `draft cannot transition from ${draft.status} to failed`, {
      details: { draft_id: draft.id, from: draft.status, to: "failed" },
    });
  }

  return {
    ...draft,
    status: "failed",
    updated_at: requireNonEmptyString(updatedAt, "updated_at"),
  };
}

export function createDraftReview(input: {
  id: string;
  draft_id: string;
  reviewer_type: DraftReviewerType;
  reviewer_id?: string;
  action: "approve" | "reject" | "edit" | "request_regenerate";
  comment?: string;
  created_at: string;
}): DraftReview {
  return {
    id: requireNonEmptyString(input.id, "id"),
    draft_id: requireNonEmptyString(input.draft_id, "draft_id"),
    reviewer_type: requireOneOf(input.reviewer_type, "reviewer_type", ["user", "agent"] as const),
    reviewer_id: input.reviewer_id?.trim() || undefined,
    action: requireOneOf(input.action, "action", ["approve", "reject", "edit", "request_regenerate"] as const),
    comment: input.comment?.trim() || undefined,
    created_at: requireNonEmptyString(input.created_at, "created_at"),
  };
}

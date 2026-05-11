import { AppError } from "../../../core/errors/app-error";
import { requireNonEmptyString, requireOneOf } from "../../../core/validation/guards";

export type PublishScheduleStatus = "scheduled" | "queued" | "published" | "failed" | "cancelled";

export interface PublishSchedule {
  id: string;
  workspace_id: string;
  account_id: string;
  draft_id: string;
  scheduled_for: string;
  status: PublishScheduleStatus;
  created_at: string;
}

export function createPublishSchedule(input: {
  id: string;
  workspace_id: string;
  account_id: string;
  draft_id: string;
  scheduled_for: string;
  created_at: string;
}): PublishSchedule {
  return {
    id: requireNonEmptyString(input.id, "id"),
    workspace_id: requireNonEmptyString(input.workspace_id, "workspace_id"),
    account_id: requireNonEmptyString(input.account_id, "account_id"),
    draft_id: requireNonEmptyString(input.draft_id, "draft_id"),
    scheduled_for: requireNonEmptyString(input.scheduled_for, "scheduled_for"),
    status: "scheduled",
    created_at: requireNonEmptyString(input.created_at, "created_at"),
  };
}

export function markScheduleQueued(schedule: PublishSchedule): PublishSchedule {
  if (schedule.status !== "scheduled") {
    throw new AppError("INVALID_STATE", `schedule cannot transition from ${schedule.status} to queued`, {
      details: { schedule_id: schedule.id, from: schedule.status, to: "queued" },
    });
  }

  return { ...schedule, status: "queued" };
}

export function retryFailedSchedule(schedule: PublishSchedule): PublishSchedule {
  if (schedule.status !== "failed") {
    throw new AppError("INVALID_STATE", `schedule cannot transition from ${schedule.status} to queued by retry`, {
      details: { schedule_id: schedule.id, from: schedule.status, to: "queued" },
    });
  }

  return { ...schedule, status: "queued" };
}

export function reschedulePendingSchedule(schedule: PublishSchedule, scheduledFor: string): PublishSchedule {
  const status = requireOneOf(schedule.status, "status", ["scheduled", "queued", "published", "failed", "cancelled"] as const);
  if (status !== "scheduled") {
    throw new AppError("INVALID_STATE", `schedule cannot be rescheduled from ${status}`, {
      details: { schedule_id: schedule.id, from: status, to: "scheduled" },
    });
  }

  return {
    ...schedule,
    scheduled_for: requireNonEmptyString(scheduledFor, "scheduled_for"),
  };
}

export function cancelPendingSchedule(schedule: PublishSchedule): PublishSchedule {
  const status = requireOneOf(schedule.status, "status", ["scheduled", "queued", "published", "failed", "cancelled"] as const);
  if (status !== "scheduled") {
    throw new AppError("INVALID_STATE", `schedule cannot transition from ${status} to cancelled`, {
      details: { schedule_id: schedule.id, from: status, to: "cancelled" },
    });
  }

  return { ...schedule, status: "cancelled" };
}

export function markSchedulePublished(schedule: PublishSchedule): PublishSchedule {
  const status = requireOneOf(schedule.status, "status", ["queued", "scheduled", "published", "failed", "cancelled"] as const);
  if (!["queued", "scheduled"].includes(status)) {
    throw new AppError("INVALID_STATE", `schedule cannot transition from ${status} to published`, {
      details: { schedule_id: schedule.id, from: status, to: "published" },
    });
  }

  return { ...schedule, status: "published" };
}

export function markScheduleFailed(schedule: PublishSchedule): PublishSchedule {
  if (!["scheduled", "queued"].includes(schedule.status)) {
    throw new AppError("INVALID_STATE", `schedule cannot transition from ${schedule.status} to failed`, {
      details: { schedule_id: schedule.id, from: schedule.status, to: "failed" },
    });
  }

  return { ...schedule, status: "failed" };
}

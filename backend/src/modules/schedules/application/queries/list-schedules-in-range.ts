import { AppError } from "../../../../core/errors/app-error";
import {
  requireIntegerInRange,
  requireIsoDateTimeString,
  requireNonEmptyString,
  requireOneOf,
} from "../../../../core/validation/guards";
import type { ScheduleRangeResponse } from "../../../../contracts/api/schedules";
import type { PublishScheduleStatus } from "../../domain/publish-schedule";

export interface ListSchedulesInRangeInput {
  workspace_id?: string;
  account_id?: string;
  status?: PublishScheduleStatus;
  from: string;
  to: string;
  limit?: number;
}

export interface ScheduleCalendarReadModel {
  listSchedulesInRange(input: {
    workspace_id?: string;
    account_id?: string;
    status?: PublishScheduleStatus;
    from: string;
    to: string;
    limit: number;
  }): Promise<ScheduleRangeResponse>;
}

export interface ListSchedulesInRangeDependencies {
  readModel: ScheduleCalendarReadModel;
}

export class ListSchedulesInRange {
  constructor(private readonly deps: ListSchedulesInRangeDependencies) {}

  async execute(input: ListSchedulesInRangeInput): Promise<ScheduleRangeResponse> {
    const from = requireIsoDateTimeString(input.from, "from");
    const to = requireIsoDateTimeString(input.to, "to");

    if (Date.parse(from) >= Date.parse(to)) {
      throw new AppError("VALIDATION_ERROR", "from must be earlier than to", {
        details: { from, to },
      });
    }

    return this.deps.readModel.listSchedulesInRange({
      workspace_id: input.workspace_id ? requireNonEmptyString(input.workspace_id, "workspace_id") : undefined,
      account_id: input.account_id ? requireNonEmptyString(input.account_id, "account_id") : undefined,
      status: input.status ? requireOneOf(input.status, "status", ["scheduled", "queued", "published", "failed", "cancelled"] as const) : undefined,
      from,
      to,
      limit: input.limit === undefined ? 500 : requireIntegerInRange(input.limit, "limit", 1, 1000),
    });
  }
}

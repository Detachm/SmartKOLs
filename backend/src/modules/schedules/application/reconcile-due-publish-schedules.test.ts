import assert from "node:assert/strict";
import test from "node:test";
import { reconcileDuePublishSchedules } from "./reconcile-due-publish-schedules";
import type { PublishSchedule } from "../domain/publish-schedule";

test("reconcileDuePublishSchedules queues every due scheduled publish schedule", async () => {
  const dueSchedules: PublishSchedule[] = [
    {
      id: "schedule_1",
      workspace_id: "ws_1",
      account_id: "acct_1",
      draft_id: "draft_1",
      scheduled_for: "2026-04-27T00:24:00.000Z",
      status: "scheduled",
      created_at: "2026-04-26T16:19:10.215Z",
    },
    {
      id: "schedule_2",
      workspace_id: "ws_1",
      account_id: "acct_2",
      draft_id: "draft_2",
      scheduled_for: "2026-04-27T00:30:00.000Z",
      status: "scheduled",
      created_at: "2026-04-26T16:20:10.215Z",
    },
  ];
  const queued: string[] = [];

  const result = await reconcileDuePublishSchedules({
    schedules: {
      listDueScheduledSchedules: async (now: string, limit: number) => {
        assert.equal(now, "2026-04-27T04:06:00.000Z");
        assert.equal(limit, 10);
        return dueSchedules;
      },
    } as never,
    queuePublishJob: {
      execute: async (scheduleId: string) => {
        queued.push(scheduleId);
        return { id: `job_${scheduleId}` };
      },
    } as never,
    clock: {
      now: () => new Date("2026-04-27T04:06:00.000Z"),
    },
    limit: 10,
  });

  assert.equal(result.queued, 2);
  assert.deepEqual(queued, ["schedule_1", "schedule_2"]);
});

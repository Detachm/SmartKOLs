import type { Clock } from "../../../core/time/clock";
import type { QueuePublishJob } from "./commands/queue-publish-job";
import type { SchedulesRepository } from "./ports/schedules-repository";

export async function reconcileDuePublishSchedules(input: {
  schedules: SchedulesRepository;
  queuePublishJob: QueuePublishJob;
  clock: Clock;
  limit?: number;
}) {
  const dueSchedules = await input.schedules.listDueScheduledSchedules(
    input.clock.now().toISOString(),
    input.limit ?? 50,
  );

  let queued = 0;
  for (const schedule of dueSchedules) {
    await input.queuePublishJob.execute(schedule.id);
    queued += 1;
  }

  return { queued };
}

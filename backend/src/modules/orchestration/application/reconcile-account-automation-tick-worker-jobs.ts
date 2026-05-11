import type { Clock } from "../../../core/time/clock";
import type { QueueAccountAutomationTick } from "./commands/queue-account-automation-tick";
import type { AccountOrchestrationStatesRepository } from "./ports/account-orchestration-states-repository";

export const ACCOUNT_AUTOMATION_TICK_INTERVAL_MINUTES = 30;

export async function reconcileAccountAutomationTickWorkerJobs(input: {
  states: AccountOrchestrationStatesRepository;
  queueAccountAutomationTick: QueueAccountAutomationTick;
  clock: Clock;
  limit?: number;
}) {
  const now = input.clock.now();
  const nowIso = now.toISOString();
  const staleBefore = addMinutes(nowIso, -ACCOUNT_AUTOMATION_TICK_INTERVAL_MINUTES);
  const candidates = await input.states.listDueAutomationTickCandidates({
    now: nowIso,
    stale_before: staleBefore,
    limit: input.limit ?? 50,
  });

  for (const candidate of candidates) {
    await input.queueAccountAutomationTick.execute({
      account_id: candidate.account_id,
      trigger_kind: "system",
      create_if_missing: true,
      run_after: candidate.next_tick_after && candidate.next_tick_after > nowIso
        ? candidate.next_tick_after
        : nowIso,
    });
  }

  return {
    queued: candidates.length,
  };
}

export function resolveNextAccountAutomationTickAfter(fromIsoTimestamp: string): string {
  return addMinutes(fromIsoTimestamp, ACCOUNT_AUTOMATION_TICK_INTERVAL_MINUTES);
}

function addMinutes(isoTimestamp: string, minutes: number): string {
  return new Date(Date.parse(isoTimestamp) + minutes * 60_000).toISOString();
}

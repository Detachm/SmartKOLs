import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { QueueAccountAutomationTickResponse } from "../../../../contracts/api/account-automation";
import type { QueueAccountAutomationTick } from "../../../../modules/orchestration/application/commands/queue-account-automation-tick";

export async function queueAccountAutomationTickHandler(
  command: QueueAccountAutomationTick,
  accountId: string,
): Promise<Result<QueueAccountAutomationTickResponse>> {
  try {
    const job = await command.execute({
      account_id: accountId,
      trigger_kind: "manual",
      create_if_missing: true,
    });
    if (!job) {
      return err(new AppError("INTERNAL_ERROR", "failed to queue account automation tick", {
        details: { account_id: accountId },
      }));
    }

    return ok({
      job_id: job.id,
      status: "queued",
      run_after: job.run_after,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}

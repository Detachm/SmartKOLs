import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { UpdateAccountAutomationStateResponse } from "../../../../contracts/api/account-automation";
import type { ResumeAccountAutomation } from "../../../../modules/orchestration/application/commands/resume-account-automation";

export async function resumeAccountAutomationHandler(
  command: ResumeAccountAutomation,
  accountId: string,
): Promise<Result<UpdateAccountAutomationStateResponse>> {
  try {
    const state = await command.execute(accountId);
    return ok({
      account_id: state.account_id,
      orchestration_status: state.status,
      updated_at: state.updated_at,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}

import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { AgentRunDetailResponse, AgentRunTraceResponse } from "../../../../contracts/api/agent-runtime";
import type { GetAgentRun } from "../../../../modules/agent-runtime/application/queries/get-agent-run";
import type { GetAgentRunTrace } from "../../../../modules/agent-runtime/application/queries/get-agent-run-trace";

export async function getAgentRunHandler(
  query: GetAgentRun,
  runId: string,
): Promise<Result<AgentRunDetailResponse>> {
  try {
    return ok(await query.execute(runId));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}

export async function getAgentRunTraceHandler(
  query: GetAgentRunTrace,
  runId: string,
): Promise<Result<AgentRunTraceResponse>> {
  try {
    return ok(await query.execute(runId));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}

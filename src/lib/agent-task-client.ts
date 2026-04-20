import { requestBackendResult } from "@/lib/backend-client";

export interface AgentTaskTerminalDetail {
  task: {
    id: string;
    status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
    error_code?: string | null;
    error_message?: string | null;
  };
  latest_run?: {
    id: string;
    status: "running" | "succeeded" | "failed";
    output?: string;
  };
}

export async function waitForAgentTask(taskId: string, options?: {
  maxAttempts?: number;
  intervalMs?: number;
}): Promise<AgentTaskTerminalDetail> {
  const maxAttempts = options?.maxAttempts ?? 60;
  const intervalMs = options?.intervalMs ?? 2000;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const taskResult = await requestBackendResult<AgentTaskTerminalDetail>(`/api/backend/agent-tasks/${encodeURIComponent(taskId)}`);

    if (!taskResult.result.ok) {
      throw new Error(taskResult.result.error.message);
    }

    const payload = taskResult.result.data;
    if (payload.task.status === "succeeded") {
      return payload;
    }

    if (payload.task.status === "failed" || payload.task.status === "cancelled") {
      throw new Error(payload.task.error_message || payload.task.error_code || "agent task failed");
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error("agent task timed out");
}

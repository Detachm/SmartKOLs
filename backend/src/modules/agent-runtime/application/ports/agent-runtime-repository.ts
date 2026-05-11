import type { AgentDefinition } from "../../domain/agent-definition";
import type { AgentTask, AgentTaskStatus } from "../../domain/agent-task";
import type { AgentRun } from "../../domain/agent-run";
import type { ModelRequest } from "../../domain/model-request";
import type { ModelRequestAttempt } from "../../domain/model-request-attempt";
import type { ToolCall } from "../../domain/tool-call";

export interface AgentRuntimeRepository {
  findDefinitionById(definitionId: string): Promise<AgentDefinition | null>;
  findDefinitionByCode(code: string): Promise<AgentDefinition | null>;
  createDefinition(definition: AgentDefinition): Promise<void>;
  findTaskById(taskId: string): Promise<AgentTask | null>;
  listTasksByWorkspaceAndStatus(workspaceId: string, status: AgentTaskStatus, limit: number): Promise<AgentTask[]>;
  claimNextQueuedTask(startedAt: string, leaseExpiresAt: string): Promise<AgentTask | null>;
  listExpiredRunningTasks(now: string, limit: number): Promise<AgentTask[]>;
  createTask(task: AgentTask): Promise<void>;
  saveTask(task: AgentTask): Promise<void>;
  findRunById(runId: string): Promise<AgentRun | null>;
  findLatestRunByTaskId(taskId: string): Promise<AgentRun | null>;
  listRunsByRequestId(requestId: string): Promise<AgentRun[]>;
  createRun(run: AgentRun): Promise<void>;
  saveRun(run: AgentRun): Promise<void>;
  findModelRequestByAgentRunId(agentRunId: string): Promise<ModelRequest | null>;
  listModelRequestsByWorkspaceId(workspaceId: string, limit: number): Promise<ModelRequest[]>;
  createModelRequest(modelRequest: ModelRequest): Promise<void>;
  saveModelRequest(modelRequest: ModelRequest): Promise<void>;
  listModelRequestAttempts(modelRequestId: string): Promise<ModelRequestAttempt[]>;
  createModelRequestAttempt(attempt: ModelRequestAttempt): Promise<void>;
  listToolCallsByAgentRunId(agentRunId: string): Promise<ToolCall[]>;
  createToolCall(toolCall: ToolCall): Promise<void>;
}

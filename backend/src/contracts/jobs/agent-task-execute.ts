export type AgentTaskJobType =
  | "content_brief.generate"
  | "draft.generate"
  | "draft.review"
  | "inbox.classify"
  | "engagement.reply_propose"
  | "persona.distill";

export interface AgentTaskExecuteJob {
  job_type: AgentTaskJobType;
  agent_task_id: string;
  workspace_id: string;
  target_type: string;
  target_id: string;
  requested_at: string;
}

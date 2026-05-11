export type AuditActorType = "user" | "agent" | "system";

export interface AuditLog {
  id: string;
  workspace_id: string;
  request_id?: string;
  actor_type: AuditActorType;
  actor_id?: string;
  entity_type: string;
  entity_id: string;
  action: string;
  before_state?: string;
  after_state?: string;
  created_at: string;
}

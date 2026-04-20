export type RuntimeEventSeverity = "info" | "warning" | "critical";

export interface RuntimeEvent {
  id: string;
  workspace_id?: string;
  request_id?: string;
  process_id?: string;
  severity: RuntimeEventSeverity;
  event_type: string;
  source_type: string;
  source_id?: string;
  message: string;
  payload_json?: string;
  created_at: string;
}

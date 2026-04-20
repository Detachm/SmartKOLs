export type RuntimeProcessType = "http_server" | "worker";
export type RuntimeProcessStatus = "running" | "stopped";

export interface RuntimeProcess {
  id: string;
  process_type: RuntimeProcessType;
  process_name: string;
  pid: number;
  hostname: string;
  status: RuntimeProcessStatus;
  metadata_json: string;
  started_at: string;
  last_heartbeat_at: string;
  stopped_at?: string;
}

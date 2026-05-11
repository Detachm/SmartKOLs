import type { AlertChannel } from "../../modules/alert-channels/domain/alert-channel";

export interface AlertChannelListResponse {
  channels: AlertChannel[];
}

export interface CreateAlertChannelRequest {
  workspace_id: string;
  name: string;
  kind: "lark_webhook" | "telegram_bot";
  status: "active" | "paused";
  routing_body: {
    minimum_severity: "info" | "warning" | "critical";
    source_types: Array<"connector" | "runtime" | "publish" | "risk">;
    dedupe_window_minutes: number;
  };
  delivery: {
    webhook_url?: string;
    signing_secret?: string;
    bot_token?: string;
    chat_id?: string;
  };
}

export interface UpdateAlertChannelRequest {
  name: string;
  status: "active" | "paused";
  routing_body: {
    minimum_severity: "info" | "warning" | "critical";
    source_types: Array<"connector" | "runtime" | "publish" | "risk">;
    dedupe_window_minutes: number;
  };
  delivery?: {
    webhook_url?: string;
    signing_secret?: string;
    bot_token?: string;
    chat_id?: string;
  };
}

export interface DeleteAlertChannelResponse {
  deleted_channel_id: string;
  workspace_id: string;
}

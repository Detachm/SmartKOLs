import type { AlertChannel } from "../../domain/alert-channel";

export interface AlertChannelsRepository {
  findById(channelId: string): Promise<AlertChannel | null>;
  listByWorkspaceId(workspaceId: string, limit: number): Promise<AlertChannel[]>;
  save(channel: AlertChannel): Promise<void>;
  delete(channelId: string): Promise<void>;
}

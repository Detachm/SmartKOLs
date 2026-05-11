import { requireIntegerInRange, requireNonEmptyString } from "../../../../core/validation/guards";
import type { AlertChannelsRepository } from "../ports/alert-channels-repository";

export interface ListAlertChannelsDependencies {
  channels: AlertChannelsRepository;
}

export class ListAlertChannels {
  constructor(private readonly deps: ListAlertChannelsDependencies) {}

  async execute(workspaceId: string, limit = 50) {
    return {
      channels: await this.deps.channels.listByWorkspaceId(
        requireNonEmptyString(workspaceId, "workspace_id"),
        requireIntegerInRange(limit, "limit", 1, 100),
      ),
    };
  }
}

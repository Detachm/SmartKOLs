import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import type { AlertChannelsRepository } from "../ports/alert-channels-repository";
import type { AlertChannelSecretStore } from "../ports/alert-channel-secret-store";

export interface DeleteAlertChannelDependencies {
  channels: AlertChannelsRepository;
  secretStore: AlertChannelSecretStore;
  auditLogs: AuditLogRepository;
  clock: Clock;
}

export class DeleteAlertChannel {
  constructor(private readonly deps: DeleteAlertChannelDependencies) {}

  async execute(channelId: string) {
    const existing = await this.deps.channels.findById(channelId);
    if (!existing) {
      throw new AppError("NOT_FOUND", "alert channel not found", {
        details: { channel_id: channelId },
      });
    }

    await this.deps.channels.delete(channelId);
    await this.deps.secretStore.deleteSecret(existing.secret_ref);

    const now = this.deps.clock.now().toISOString();
    await this.deps.auditLogs.append({
      id: newId(),
      workspace_id: existing.workspace_id,
      actor_type: "user",
      entity_type: "alert_channel",
      entity_id: existing.id,
      action: "alert_channel.deleted",
      before_state: JSON.stringify(existing),
      created_at: now,
    });

    return {
      deleted_channel_id: existing.id,
      workspace_id: existing.workspace_id,
    };
  }
}

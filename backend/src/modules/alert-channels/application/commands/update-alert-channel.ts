import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import type { AlertChannelsRepository } from "../ports/alert-channels-repository";
import type { AlertChannelSecretStore } from "../ports/alert-channel-secret-store";
import {
  buildAlertChannelDestinationHint,
  createAlertChannel,
  createLarkWebhookSecret,
  createTelegramBotSecret,
  type AlertChannelRouting,
  type AlertChannelSecret,
} from "../../domain/alert-channel";

export interface UpdateAlertChannelDependencies {
  channels: AlertChannelsRepository;
  secretStore: AlertChannelSecretStore;
  auditLogs: AuditLogRepository;
  clock: Clock;
}

export class UpdateAlertChannel {
  constructor(private readonly deps: UpdateAlertChannelDependencies) {}

  async execute(input: {
    channel_id: string;
    name: string;
    status: "active" | "paused";
    routing_body: AlertChannelRouting;
    delivery?: {
      webhook_url?: string;
      signing_secret?: string;
      bot_token?: string;
      chat_id?: string;
    };
  }) {
    const existing = await this.deps.channels.findById(input.channel_id);
    if (!existing) {
      throw new AppError("NOT_FOUND", "alert channel not found", {
        details: { channel_id: input.channel_id },
      });
    }

    const now = this.deps.clock.now().toISOString();
    let secretRef = existing.secret_ref;
    let destinationHint = existing.destination_hint;

    if (input.delivery) {
      const secret = parseRotatedSecret(existing.kind, input.delivery);
      secretRef = await this.deps.secretStore.upsertSecret(existing.secret_ref, existing.kind, secret);
      destinationHint = buildAlertChannelDestinationHint(existing.kind, secret);
    }

    const channel = createAlertChannel({
      ...existing,
      name: input.name,
      status: input.status,
      secret_ref: secretRef,
      destination_hint: destinationHint,
      routing_body: input.routing_body,
      updated_at: now,
    });

    await this.deps.channels.save(channel);
    await this.deps.auditLogs.append({
      id: newId(),
      workspace_id: channel.workspace_id,
      actor_type: "user",
      entity_type: "alert_channel",
      entity_id: channel.id,
      action: "alert_channel.updated",
      before_state: JSON.stringify(existing),
      after_state: JSON.stringify(channel),
      created_at: now,
    });

    return channel;
  }
}

function parseRotatedSecret(
  kind: "lark_webhook" | "telegram_bot",
  input: {
    webhook_url?: string;
    signing_secret?: string;
    bot_token?: string;
    chat_id?: string;
  },
): AlertChannelSecret {
  if (kind === "lark_webhook") {
    return createLarkWebhookSecret({
      webhook_url: input.webhook_url ?? "",
      signing_secret: input.signing_secret,
    });
  }

  return createTelegramBotSecret({
    bot_token: input.bot_token ?? "",
    chat_id: input.chat_id ?? "",
  });
}

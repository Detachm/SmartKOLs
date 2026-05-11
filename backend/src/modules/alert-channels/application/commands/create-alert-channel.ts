import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import type { WorkspacesRepository } from "../../../workspaces/application/ports/workspaces-repository";
import type { AlertChannelsRepository } from "../ports/alert-channels-repository";
import type { AlertChannelSecretStore } from "../ports/alert-channel-secret-store";
import {
  buildAlertChannelDestinationHint,
  createAlertChannel,
  createLarkWebhookSecret,
  createTelegramBotSecret,
  type AlertChannelKind,
  type AlertChannelRouting,
  type AlertChannelSecret,
} from "../../domain/alert-channel";

export interface CreateAlertChannelDependencies {
  workspaces: WorkspacesRepository;
  channels: AlertChannelsRepository;
  secretStore: AlertChannelSecretStore;
  auditLogs: AuditLogRepository;
  clock: Clock;
}

export class CreateAlertChannel {
  constructor(private readonly deps: CreateAlertChannelDependencies) {}

  async execute(input: {
    workspace_id: string;
    name: string;
    kind: AlertChannelKind;
    status: "active" | "paused";
    routing_body: AlertChannelRouting;
    delivery: {
      webhook_url?: string;
      signing_secret?: string;
      bot_token?: string;
      chat_id?: string;
    };
  }) {
    const workspace = await this.deps.workspaces.findById(input.workspace_id);
    if (!workspace) {
      throw new AppError("NOT_FOUND", "workspace not found", {
        details: { workspace_id: input.workspace_id },
      });
    }

    const secret = parseDeliverySecret(input.kind, input.delivery);
    const secretRef = await this.deps.secretStore.upsertSecret(undefined, input.kind, secret);
    const now = this.deps.clock.now().toISOString();
    const channel = createAlertChannel({
      id: newId(),
      workspace_id: workspace.id,
      name: input.name,
      kind: input.kind,
      status: input.status,
      secret_ref: secretRef,
      destination_hint: buildAlertChannelDestinationHint(input.kind, secret),
      routing_body: input.routing_body,
      created_at: now,
      updated_at: now,
    });

    await this.deps.channels.save(channel);
    await this.deps.auditLogs.append({
      id: newId(),
      workspace_id: workspace.id,
      actor_type: "user",
      entity_type: "alert_channel",
      entity_id: channel.id,
      action: "alert_channel.created",
      after_state: JSON.stringify(channel),
      created_at: now,
    });

    return channel;
  }
}

function parseDeliverySecret(
  kind: AlertChannelKind,
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

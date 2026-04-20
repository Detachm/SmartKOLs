import { AppError } from "../../../core/errors/app-error";
import { requireIntegerInRange, requireNonEmptyString, requireOneOf } from "../../../core/validation/guards";
import type { AlertSeverity, AlertSourceType } from "../../monitoring/domain/alert";

export type AlertChannelKind = "lark_webhook" | "telegram_bot";
export type AlertChannelStatus = "active" | "paused";

export interface AlertChannelRouting {
  minimum_severity: AlertSeverity;
  source_types: AlertSourceType[];
  dedupe_window_minutes: number;
}

export interface AlertChannel {
  id: string;
  workspace_id: string;
  name: string;
  kind: AlertChannelKind;
  status: AlertChannelStatus;
  secret_ref: string;
  destination_hint: string;
  routing_body: AlertChannelRouting;
  created_at: string;
  updated_at: string;
}

export interface LarkWebhookSecret {
  webhook_url: string;
  signing_secret?: string;
}

export interface TelegramBotSecret {
  bot_token: string;
  chat_id: string;
}

export type AlertChannelSecret = LarkWebhookSecret | TelegramBotSecret;

const SOURCE_TYPE_ORDER: AlertSourceType[] = ["connector", "runtime", "publish", "risk"];
const KIND_CHOICES = ["lark_webhook", "telegram_bot"] as const;

export function createAlertChannel(channel: AlertChannel): AlertChannel {
  return {
    id: requireNonEmptyString(channel.id, "id"),
    workspace_id: requireNonEmptyString(channel.workspace_id, "workspace_id"),
    name: requireNonEmptyString(channel.name, "name"),
    kind: requireOneOf(channel.kind, "kind", KIND_CHOICES),
    status: requireOneOf(channel.status, "status", ["active", "paused"] as const),
    secret_ref: requireNonEmptyString(channel.secret_ref, "secret_ref"),
    destination_hint: requireNonEmptyString(channel.destination_hint, "destination_hint"),
    routing_body: {
      minimum_severity: requireOneOf(
        channel.routing_body.minimum_severity,
        "routing_body.minimum_severity",
        ["info", "warning", "critical"] as const,
      ),
      source_types: normalizeSourceTypes(channel.routing_body.source_types),
      dedupe_window_minutes: requireIntegerInRange(
        channel.routing_body.dedupe_window_minutes,
        "routing_body.dedupe_window_minutes",
        1,
        1440,
      ),
    },
    created_at: requireNonEmptyString(channel.created_at, "created_at"),
    updated_at: requireNonEmptyString(channel.updated_at, "updated_at"),
  };
}

export function createLarkWebhookSecret(input: { webhook_url: string; signing_secret?: string }): LarkWebhookSecret {
  const webhookUrl = requireNonEmptyString(input.webhook_url, "delivery.webhook_url");
  if (!/^https?:\/\//.test(webhookUrl)) {
    throw new AppError("VALIDATION_ERROR", "delivery.webhook_url must be an absolute URL");
  }

  return {
    webhook_url: webhookUrl,
    signing_secret: optionalString(input.signing_secret),
  };
}

export function createTelegramBotSecret(input: { bot_token: string; chat_id: string }): TelegramBotSecret {
  return {
    bot_token: requireNonEmptyString(input.bot_token, "delivery.bot_token"),
    chat_id: requireNonEmptyString(input.chat_id, "delivery.chat_id"),
  };
}

export function buildAlertChannelDestinationHint(kind: AlertChannelKind, secret: AlertChannelSecret): string {
  if (kind === "lark_webhook") {
    const { hostname } = new URL((secret as LarkWebhookSecret).webhook_url);
    return `lark://${hostname}`;
  }

  const chatId = (secret as TelegramBotSecret).chat_id;
  const suffix = chatId.length <= 4 ? chatId : chatId.slice(-4);
  return `telegram://chat:${suffix}`;
}

function normalizeSourceTypes(value: AlertSourceType[]): AlertSourceType[] {
  const unique = new Set<AlertSourceType>();
  for (const item of value) {
    unique.add(requireOneOf(item, "routing_body.source_types", SOURCE_TYPE_ORDER));
  }

  if (unique.size === 0) {
    throw new AppError("VALIDATION_ERROR", "routing_body.source_types must contain at least one alert source type");
  }

  return SOURCE_TYPE_ORDER.filter((item) => unique.has(item));
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

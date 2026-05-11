import { parse } from "node-html-parser";
import { AppError } from "../../../core/errors/app-error";
import type { SourceFetchAdapter, SourceFetchAdapterResult } from "../application/ports/source-fetch-adapter";
import type { Source } from "../domain/source";

export interface TelegramSourceFetchAdapterConfig {
  request_timeout_ms: number;
  user_agent: string;
  max_items: number;
}

export class TelegramSourceFetchAdapter implements SourceFetchAdapter {
  readonly source_type = "telegram" as const;

  constructor(private readonly config: TelegramSourceFetchAdapterConfig) {}

  async fetch(source: Source, _runtime: Parameters<SourceFetchAdapter["fetch"]>[1]): Promise<SourceFetchAdapterResult> {
    const channelUrl = normalizeTelegramChannelUrl(source.url);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.request_timeout_ms);

    try {
      const response = await fetch(channelUrl, {
        method: "GET",
        headers: {
          "user-agent": this.config.user_agent,
          accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
        },
        signal: controller.signal,
      });

      const html = await response.text();
      if (!response.ok) {
        throw toTelegramHttpError(source, response.status, channelUrl);
      }

      const root = parse(html);
      const wraps = root.querySelectorAll(".tgme_widget_message_wrap").slice(0, this.config.max_items);
      const documents = wraps
        .map((wrap, index) => normalizeTelegramMessage(wrap, channelUrl, index))
        .filter((item): item is NonNullable<typeof item> => item !== null);

      if (documents.length === 0) {
        throw new AppError("SOURCE_FETCH_INVALID_RESPONSE", "telegram source did not yield any public channel messages", {
          details: { source_id: source.id, url: source.url, normalized_url: channelUrl },
        });
      }

      return {
        documents,
        raw_response: html,
        raw_response_extension: "txt",
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new AppError("SOURCE_FETCH_TIMEOUT", "telegram source request timed out", {
          cause: error,
          details: { source_id: source.id, url: source.url },
        });
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function normalizeTelegramChannelUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  const host = normalizeHost(url.hostname);
  if (!["t.me", "telegram.me"].includes(host)) {
    throw new AppError("SOURCE_FETCH_UNSUPPORTED", "telegram source must use t.me or telegram.me", {
      details: { url: rawUrl, host },
    });
  }

  const segments = url.pathname.split("/").filter((segment) => segment.trim() !== "");
  if (segments.length === 0) {
    throw new AppError("SOURCE_FETCH_UNSUPPORTED", "telegram source url must point to a public channel path", {
      details: { url: rawUrl },
    });
  }

  const channel = segments[0] === "s" ? segments[1] : segments[0];
  if (!channel || channel.toLowerCase() === "joinchat") {
    throw new AppError("SOURCE_FETCH_UNSUPPORTED", "telegram source must point to a public channel, not an invite link", {
      details: { url: rawUrl },
    });
  }

  return `https://t.me/s/${channel}`;
}

function normalizeTelegramMessage(
  wrap: ReturnType<typeof parse>,
  channelUrl: string,
  index: number,
): null | {
  external_doc_id: string;
  canonical_url: string;
  title: string;
  summary: string;
  body_text: string;
  language: string;
  published_at?: string;
} {
  const textNode = wrap.querySelector(".tgme_widget_message_text");
  const bodyText = normalizeWhitespace(textNode?.text ?? "");
  if (bodyText.length < 40) {
    return null;
  }

  const dateLink = wrap.querySelector(".tgme_widget_message_date");
  const canonicalUrl = dateLink?.getAttribute("href")?.trim();
  if (!canonicalUrl) {
    return null;
  }

  const messageId = canonicalUrl.split("/").pop()?.trim();
  if (!messageId) {
    return null;
  }

  const publishedAt = dateLink?.querySelector("time")?.getAttribute("datetime")?.trim();
  return {
    external_doc_id: messageId,
    canonical_url: canonicalUrl,
    title: summarize(bodyText, 80) ?? `Telegram message ${index + 1}`,
    summary: summarize(bodyText, 280) ?? bodyText,
    body_text: bodyText,
    language: "und",
    published_at: publishedAt,
  };
}

function toTelegramHttpError(source: Source, status: number, url: string): AppError {
  if (status === 429) {
    return new AppError("SOURCE_FETCH_RATE_LIMITED", `telegram fetch failed with status ${status}`, {
      details: { source_id: source.id, source_type: source.type, url, status },
    });
  }

  if (status >= 500) {
    return new AppError("SOURCE_FETCH_UPSTREAM_5XX", `telegram fetch failed with status ${status}`, {
      details: { source_id: source.id, source_type: source.type, url, status },
    });
  }

  return new AppError("EXTERNAL_DEPENDENCY_ERROR", `telegram fetch failed with status ${status}`, {
    details: { source_id: source.id, source_type: source.type, url, status },
  });
}

function normalizeHost(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/^www\./, "");
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function summarize(value: string, limit: number): string | undefined {
  const normalized = normalizeWhitespace(value);
  return normalized === "" ? undefined : normalized.slice(0, limit);
}

import { parse, type HTMLElement } from "node-html-parser";
import { XMLParser } from "fast-xml-parser";
import { AppError } from "../../../core/errors/app-error";
import type { SourceFetchAdapter, SourceFetchAdapterResult } from "../application/ports/source-fetch-adapter";
import type { Source } from "../domain/source";

export interface YouTubeSourceFetchAdapterConfig {
  request_timeout_ms: number;
  user_agent: string;
  max_items: number;
}

interface YouTubeFeedEntry {
  id?: string;
  title?: string;
  published?: string;
  updated?: string;
  link?: unknown;
  author?: {
    name?: string;
    uri?: string;
  };
  "yt:videoId"?: string;
  "yt:channelId"?: string;
  "media:group"?: {
    "media:title"?: string;
    "media:description"?: string;
  };
}

export class YouTubeSourceFetchAdapter implements SourceFetchAdapter {
  readonly source_type = "youtube" as const;
  private readonly xml = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    trimValues: true,
  });

  constructor(private readonly config: YouTubeSourceFetchAdapterConfig) {}

  async fetch(source: Source, _runtime: Parameters<SourceFetchAdapter["fetch"]>[1]): Promise<SourceFetchAdapterResult> {
    const resolution = await resolveYouTubeFeed(source, this.config);
    const feedResponse = await fetchText(source, resolution.feed_url, this.config, "application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.1");

    let parsed: unknown;
    try {
      parsed = this.xml.parse(feedResponse.body);
    } catch (error) {
      throw new AppError("SOURCE_FETCH_INVALID_RESPONSE", "youtube feed response is not valid xml", {
        details: { source_id: source.id, url: source.url, feed_url: resolution.feed_url },
        cause: error,
      });
    }

    const documents = normalizeYouTubeDocuments(parsed, source, this.config.max_items);
    if (documents.length === 0) {
      throw new AppError("SOURCE_FETCH_INVALID_RESPONSE", "youtube source did not yield any videos", {
        details: { source_id: source.id, url: source.url, feed_url: resolution.feed_url },
      });
    }

    return {
      documents,
      raw_response: JSON.stringify({
        source_url: source.url,
        source_type: source.type,
        feed_url: resolution.feed_url,
        resolution_mode: resolution.mode,
        seed_html: resolution.seed_html,
        feed_xml: feedResponse.body,
      }),
      raw_response_extension: "json",
    };
  }
}

async function resolveYouTubeFeed(
  source: Source,
  config: YouTubeSourceFetchAdapterConfig,
): Promise<{ feed_url: string; mode: string; seed_html?: string }> {
  const url = new URL(source.url);
  const host = normalizeHost(url.hostname);
  if (!["youtube.com", "youtu.be"].includes(host)) {
    throw new AppError("SOURCE_FETCH_UNSUPPORTED", "youtube source must use youtube.com or youtu.be", {
      details: { source_id: source.id, url: source.url, host },
    });
  }

  if (host === "youtube.com" && url.pathname === "/feeds/videos.xml") {
    if (url.searchParams.get("channel_id") || url.searchParams.get("playlist_id")) {
      return {
        feed_url: url.toString(),
        mode: "direct-feed",
      };
    }
  }

  if (host === "youtube.com" && url.pathname.startsWith("/channel/")) {
    const channelId = url.pathname.split("/")[2]?.trim();
    if (channelId) {
      return {
        feed_url: `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`,
        mode: "channel-id",
      };
    }
  }

  if (host === "youtube.com" && url.pathname === "/playlist") {
    const playlistId = url.searchParams.get("list")?.trim();
    if (playlistId) {
      return {
        feed_url: `https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(playlistId)}`,
        mode: "playlist-id",
      };
    }
  }

  const page = await fetchText(source, source.url, config, "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1");
  const root = parse(page.body);
  const channelId = extractYouTubeChannelId(root, page.body);
  if (channelId) {
    return {
      feed_url: `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`,
      mode: "resolved-channel-id",
      seed_html: page.body,
    };
  }

  const playlistId = extractYouTubePlaylistId(root, page.url);
  if (playlistId) {
    return {
      feed_url: `https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(playlistId)}`,
      mode: "resolved-playlist-id",
      seed_html: page.body,
    };
  }

  throw new AppError("SOURCE_FETCH_UNSUPPORTED", "youtube source url must resolve to a channel or playlist feed", {
    details: { source_id: source.id, url: source.url },
  });
}

function normalizeYouTubeDocuments(parsed: unknown, source: Source, maxItems: number): unknown[] {
  const root = asRecord(parsed, "youtube feed root");
  const feed = asRecord(root.feed, "youtube.feed");
  const entries = asArray(feed.entry).slice(0, maxItems);

  return entries
    .map((entry, index) => normalizeYouTubeEntry(asRecord(entry, `youtube.feed.entry[${index}]`), source))
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
}

function normalizeYouTubeEntry(entry: Record<string, unknown>, source: Source) {
  const typedEntry = entry as YouTubeFeedEntry;
  const videoId = firstNonEmptyString([
    typedEntry["yt:videoId"],
    typedEntry.id ? extractVideoIdFromText(typedEntry.id) : undefined,
  ]);
  const canonicalUrl = firstNonEmptyString([
    pickLinkHref(typedEntry.link),
    videoId ? `https://www.youtube.com/watch?v=${videoId}` : undefined,
  ]);
  if (!canonicalUrl) {
    return null;
  }

  const title = firstNonEmptyString([
    typedEntry.title,
    typedEntry["media:group"]?.["media:title"],
  ]);
  if (!title) {
    return null;
  }

  const description = firstNonEmptyString([
    typedEntry["media:group"]?.["media:description"],
  ]);
  const bodyText = [title, description].filter((value) => typeof value === "string" && value.trim() !== "").join("\n\n");
  if (bodyText.trim() === "") {
    return null;
  }

  return {
    external_doc_id: videoId ?? canonicalUrl,
    canonical_url: canonicalUrl,
    title,
    summary: summarize(description ?? bodyText),
    body_text: bodyText,
    language: "en",
    published_at: firstNonEmptyString([typedEntry.published, typedEntry.updated]),
    source_id: source.id,
  };
}

async function fetchText(
  source: Source,
  url: string,
  config: YouTubeSourceFetchAdapterConfig,
  accept: string,
): Promise<{ url: string; body: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.request_timeout_ms);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "user-agent": config.user_agent,
        accept,
      },
      signal: controller.signal,
    });

    const body = await response.text();
    if (!response.ok) {
      throw toYouTubeHttpError(source, response.status, url);
    }

    return {
      url: response.url || url,
      body,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new AppError("SOURCE_FETCH_TIMEOUT", "youtube request timed out", {
        cause: error,
        details: { source_id: source.id, url },
      });
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function extractYouTubeChannelId(root: HTMLElement, rawHtml: string): string | undefined {
  const canonical = root.querySelector('link[rel="canonical"]')?.getAttribute("href")?.trim();
  if (canonical) {
    try {
      const url = new URL(canonical);
      if (url.pathname.startsWith("/channel/")) {
        return url.pathname.split("/")[2]?.trim();
      }
    } catch {
      // ignore invalid canonical
    }
  }

  const meta = root.querySelector('meta[itemprop="channelId"]')?.getAttribute("content")?.trim();
  if (meta) {
    return meta;
  }

  const regexes = [
    /"channelId":"(UC[^"]+)"/,
    /"externalId":"(UC[^"]+)"/,
    /channel_id=(UC[\w-]+)/,
  ];
  for (const regex of regexes) {
    const match = rawHtml.match(regex);
    if (match?.[1]) {
      return match[1];
    }
  }

  return undefined;
}

function extractYouTubePlaylistId(root: HTMLElement, pageUrl: string): string | undefined {
  const canonical = root.querySelector('link[rel="canonical"]')?.getAttribute("href")?.trim();
  for (const candidate of [canonical, pageUrl]) {
    if (!candidate) {
      continue;
    }

    try {
      const url = new URL(candidate, pageUrl);
      const playlistId = url.searchParams.get("list")?.trim();
      if (playlistId) {
        return playlistId;
      }
    } catch {
      continue;
    }
  }

  return undefined;
}

function pickLinkHref(value: unknown): string | undefined {
  for (const link of asArray(value)) {
    if (typeof link === "string" && link.trim() !== "") {
      return link.trim();
    }

    if (isRecord(link)) {
      const href = typeof link["@_href"] === "string" ? link["@_href"].trim() : "";
      const rel = typeof link["@_rel"] === "string" ? link["@_rel"].trim() : "";
      if (href && (rel === "" || rel === "alternate")) {
        return href;
      }
    }
  }

  return undefined;
}

function extractVideoIdFromText(value: string): string | undefined {
  const trimmed = value.trim();
  const urlMatch = trimmed.match(/[?&]v=([\w-]+)/);
  if (urlMatch?.[1]) {
    return urlMatch[1];
  }

  const tail = trimmed.split(":").pop()?.trim();
  return tail || undefined;
}

function summarize(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 280);
}

function toYouTubeHttpError(source: Source, status: number, url: string): AppError {
  if (status === 429) {
    return new AppError("SOURCE_FETCH_RATE_LIMITED", `youtube fetch failed with status ${status}`, {
      details: { source_id: source.id, source_type: source.type, url, status },
    });
  }

  if (status >= 500) {
    return new AppError("SOURCE_FETCH_UPSTREAM_5XX", `youtube fetch failed with status ${status}`, {
      details: { source_id: source.id, source_type: source.type, url, status },
    });
  }

  return new AppError("EXTERNAL_DEPENDENCY_ERROR", `youtube fetch failed with status ${status}`, {
    details: { source_id: source.id, source_type: source.type, url, status },
  });
}

function asRecord(value: unknown, context: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new AppError("SOURCE_FETCH_INVALID_RESPONSE", `${context} must be an object`);
  }

  return value;
}

function asArray(value: unknown): unknown[] {
  if (value === undefined || value === null) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function firstNonEmptyString(values: Array<string | undefined>): string | undefined {
  return values.find((value) => typeof value === "string" && value.trim() !== "")?.trim();
}

function normalizeHost(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/^www\./, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

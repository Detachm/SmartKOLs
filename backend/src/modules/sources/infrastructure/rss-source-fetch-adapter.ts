import { XMLParser } from "fast-xml-parser";
import { AppError } from "../../../core/errors/app-error";
import type { SourceFetchAdapter, SourceFetchAdapterResult } from "../application/ports/source-fetch-adapter";
import type { Source } from "../domain/source";

export interface RssSourceFetchAdapterConfig {
  request_timeout_ms: number;
  user_agent: string;
  max_items: number;
}

export class RssSourceFetchAdapter implements SourceFetchAdapter {
  readonly source_type = "rss" as const;
  private readonly xml = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    trimValues: true,
  });

  constructor(private readonly config: RssSourceFetchAdapterConfig) {}

  async fetch(source: Source, _runtime: Parameters<SourceFetchAdapter["fetch"]>[1]): Promise<SourceFetchAdapterResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.request_timeout_ms);

    try {
      const primary = await this.fetchFeedBody(source, source.url, controller.signal);
      const normalized = await this.normalizeFeedWithAutodiscovery(source, source.url, primary.body, controller.signal);
      return {
        documents: normalized.documents,
        raw_response: normalized.raw_response,
        raw_response_extension: normalized.raw_response_extension,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new AppError("SOURCE_FETCH_TIMEOUT", "rss fetch request timed out", { cause: error });
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async fetchFeedBody(source: Source, url: string, signal: AbortSignal) {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "user-agent": this.config.user_agent,
        accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, text/html;q=0.8, */*;q=0.1",
      },
      signal,
    });

    const body = await response.text();
    if (!response.ok) {
      throw toRssHttpError(source, response.status);
    }

    return { body, contentType: response.headers.get("content-type") ?? "" };
  }

  private async normalizeFeedWithAutodiscovery(source: Source, requestUrl: string, body: string, signal: AbortSignal) {
    const parsed = tryParseXml(this.xml, body);
    if (parsed) {
      try {
        return {
          documents: normalizeFeedDocuments(parsed, source, this.config.max_items),
          raw_response: body,
          raw_response_extension: "xml" as const,
        };
      } catch (error) {
        if (!(error instanceof AppError) || error.message !== "source response is not rss or atom") {
          throw error;
        }
      }
    }

    const discoveredFeedUrl = discoverAlternateFeedUrl(body, requestUrl);
    if (discoveredFeedUrl && discoveredFeedUrl !== requestUrl) {
      const discovered = await this.fetchFeedBody(source, discoveredFeedUrl, signal);
      const discoveredParsed = tryParseXml(this.xml, discovered.body);
      if (!discoveredParsed) {
        throw new AppError("SOURCE_FETCH_INVALID_RESPONSE", "discovered feed is not valid xml", {
          details: { source_id: source.id, url: discoveredFeedUrl },
        });
      }

      return {
        documents: normalizeFeedDocuments(discoveredParsed, source, this.config.max_items),
        raw_response: discovered.body,
        raw_response_extension: "xml" as const,
      };
    }

    if (!parsed) {
      throw new AppError("SOURCE_FETCH_INVALID_RESPONSE", "rss response is not valid xml", {
        details: { source_id: source.id, url: source.url },
      });
    }

    throw new AppError("SOURCE_FETCH_INVALID_RESPONSE", "source response is not rss or atom", {
      details: { source_id: source.id, url: source.url },
    });
  }
}

function toRssHttpError(source: Source, status: number): AppError {
  if (status === 429) {
    return new AppError("SOURCE_FETCH_RATE_LIMITED", `rss fetch failed with status ${status}`, {
      details: { source_id: source.id, url: source.url, status },
    });
  }

  if (status >= 500) {
    return new AppError("SOURCE_FETCH_UPSTREAM_5XX", `rss fetch failed with status ${status}`, {
      details: { source_id: source.id, url: source.url, status },
    });
  }

  return new AppError("EXTERNAL_DEPENDENCY_ERROR", `rss fetch failed with status ${status}`, {
    details: { source_id: source.id, url: source.url, status },
  });
}

function normalizeFeedDocuments(parsed: unknown, source: Source, maxItems: number): unknown[] {
  const root = asRecord(parsed, "feed root");

  if (root.rss) {
    return normalizeRssItems(asRecord(root.rss, "rss"), source, maxItems);
  }

  if (root.feed) {
    return normalizeAtomEntries(asRecord(root.feed, "feed"), source, maxItems);
  }

  throw new AppError("SOURCE_FETCH_INVALID_RESPONSE", "source response is not rss or atom", {
    details: { source_id: source.id, url: source.url },
  });
}

function tryParseXml(xml: XMLParser, body: string): unknown | null {
  try {
    return xml.parse(body);
  } catch {
    return null;
  }
}

function discoverAlternateFeedUrl(body: string, requestUrl: string): string | undefined {
  const linkTagMatches = body.match(/<link\b[^>]*>/gi) ?? [];
  for (const tag of linkTagMatches) {
    const rel = readHtmlAttribute(tag, "rel")?.toLowerCase() ?? "";
    const type = readHtmlAttribute(tag, "type")?.toLowerCase() ?? "";
    const href = readHtmlAttribute(tag, "href");
    if (!href) {
      continue;
    }

    if (!rel.includes("alternate")) {
      continue;
    }

    if (!type.includes("rss") && !type.includes("atom") && !type.includes("xml")) {
      continue;
    }

    try {
      return new URL(href, requestUrl).toString();
    } catch {
      continue;
    }
  }

  return undefined;
}

function readHtmlAttribute(tag: string, attribute: string): string | undefined {
  const pattern = new RegExp(`${attribute}\\s*=\\s*(['"])(.*?)\\1`, "i");
  const matched = tag.match(pattern);
  return matched?.[2]?.trim() || undefined;
}

function normalizeRssItems(rss: Record<string, unknown>, source: Source, maxItems: number): unknown[] {
  const channel = asRecord(rss.channel, "rss.channel");
  const items = asArray(channel.item).slice(0, maxItems);
  return items
    .map((item, index) => normalizeRssItem(asRecord(item, `rss.channel.item[${index}]`), source))
    .filter((item) => item !== null);
}

function normalizeAtomEntries(feed: Record<string, unknown>, source: Source, maxItems: number): unknown[] {
  const entries = asArray(feed.entry).slice(0, maxItems);
  return entries
    .map((entry, index) => normalizeAtomEntry(asRecord(entry, `feed.entry[${index}]`), source))
    .filter((item) => item !== null);
}

function normalizeRssItem(item: Record<string, unknown>, source: Source) {
  const canonicalUrl = firstNonEmptyString([
    pickText(item.link),
    pickText(item.guid),
  ]);
  if (!canonicalUrl) {
    return null;
  }

  const rawBody = firstNonEmptyString([
    pickText(item["content:encoded"]),
    pickText(item.description),
    pickText(item.summary),
  ]);
  const bodyText = htmlToText(rawBody);
  if (!bodyText) {
    return null;
  }

  const title = firstNonEmptyString([pickText(item.title), canonicalUrl]);
  return {
    external_doc_id: firstNonEmptyString([pickText(item.guid), canonicalUrl]),
    canonical_url: canonicalUrl,
    title,
    summary: summarize(bodyText),
    body_text: bodyText,
    language: firstNonEmptyString([pickText(item["dc:language"]), "en"]),
    published_at: firstNonEmptyString([pickText(item.pubDate), pickText(item.published)]),
    source_id: source.id,
  };
}

function normalizeAtomEntry(entry: Record<string, unknown>, source: Source) {
  const canonicalUrl = firstNonEmptyString([
    pickAtomLink(entry.link),
    pickText(entry.id),
  ]);
  if (!canonicalUrl) {
    return null;
  }

  const rawBody = firstNonEmptyString([
    pickText(entry.content),
    pickText(entry.summary),
  ]);
  const bodyText = htmlToText(rawBody);
  if (!bodyText) {
    return null;
  }

  const title = firstNonEmptyString([pickText(entry.title), canonicalUrl]);
  return {
    external_doc_id: firstNonEmptyString([pickText(entry.id), canonicalUrl]),
    canonical_url: canonicalUrl,
    title,
    summary: summarize(bodyText),
    body_text: bodyText,
    language: firstNonEmptyString([pickText(entry.language), "en"]),
    published_at: firstNonEmptyString([pickText(entry.updated), pickText(entry.published)]),
    source_id: source.id,
  };
}

function pickAtomLink(value: unknown): string | undefined {
  const links = asArray(value);
  for (const link of links) {
    if (typeof link === "string" && link.trim() !== "") {
      return link.trim();
    }

    if (isRecord(link)) {
      const rel = typeof link["@_rel"] === "string" ? link["@_rel"].trim() : "";
      const href = typeof link["@_href"] === "string" ? link["@_href"].trim() : "";
      if (href && (rel === "" || rel === "alternate")) {
        return href;
      }
    }
  }

  return undefined;
}

function pickText(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim() !== "") {
    return value.trim();
  }

  if (isRecord(value)) {
    if (typeof value["#text"] === "string" && value["#text"].trim() !== "") {
      return value["#text"].trim();
    }
    if (typeof value["@_href"] === "string" && value["@_href"].trim() !== "") {
      return value["@_href"].trim();
    }
  }

  return undefined;
}

function summarize(bodyText: string): string {
  const normalized = bodyText.replace(/\s+/g, " ").trim();
  return normalized.slice(0, 280);
}

function htmlToText(input: string | undefined): string {
  if (!input) {
    return "";
  }

  return decodeEntities(
    input
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function decodeEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function firstNonEmptyString(values: Array<string | undefined>): string | undefined {
  return values.find((value) => typeof value === "string" && value.trim() !== "")?.trim();
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

import { parse, type HTMLElement } from "node-html-parser";
import { AppError } from "../../../core/errors/app-error";
import type { SourceFetchAdapter, SourceFetchAdapterResult } from "../application/ports/source-fetch-adapter";
import type { Source } from "../domain/source";

export interface HtmlSourceFetchAdapterConfig {
  source_type: "website" | "substack";
  request_timeout_ms: number;
  user_agent: string;
  max_items: number;
}

interface HtmlFetchPageResult {
  url: string;
  html: string;
  root: HTMLElement;
}

interface CandidateUrl {
  url: string;
  score: number;
}

export class HtmlSourceFetchAdapter implements SourceFetchAdapter {
  readonly source_type: "website" | "substack";

  constructor(private readonly config: HtmlSourceFetchAdapterConfig) {
    this.source_type = config.source_type;
  }

  async fetch(source: Source, _runtime: Parameters<SourceFetchAdapter["fetch"]>[1]): Promise<SourceFetchAdapterResult> {
    const seedPage = await fetchHtmlPage(source, source.url, this.config);
    const candidateUrls = discoverCandidateUrls(source, seedPage, this.config);
    const pages: HtmlFetchPageResult[] = [];
    const documents: unknown[] = [];

    for (const candidateUrl of candidateUrls) {
      const page = await fetchHtmlPage(source, candidateUrl, this.config);
      pages.push(page);
      const document = extractDocumentFromPage(source, page, this.config.source_type);
      if (!document) {
        continue;
      }

      documents.push(document);
      if (documents.length >= this.config.max_items) {
        break;
      }
    }

    if (documents.length === 0) {
      throw new AppError("SOURCE_FETCH_INVALID_RESPONSE", `${source.type} source did not yield any content documents`, {
        details: { source_id: source.id, url: source.url, source_type: source.type },
      });
    }

    return {
      documents,
      raw_response: JSON.stringify({
        source_url: source.url,
        source_type: source.type,
        fetched_urls: pages.map((page) => ({
          url: page.url,
          html: page.html,
        })),
      }),
      raw_response_extension: "json",
    };
  }
}

async function fetchHtmlPage(
  source: Source,
  url: string,
  config: HtmlSourceFetchAdapterConfig,
): Promise<HtmlFetchPageResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.request_timeout_ms);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "user-agent": config.user_agent,
        accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
      },
      signal: controller.signal,
    });

    const html = await response.text();
    if (!response.ok) {
      throw toHtmlHttpError(source, response.status, url);
    }

    if (!response.headers.get("content-type")?.includes("html") && !looksLikeHtml(html)) {
      throw new AppError("SOURCE_FETCH_INVALID_RESPONSE", "html source did not return html content", {
        details: { source_id: source.id, url },
      });
    }

    return {
      url: response.url || url,
      html,
      root: parse(html),
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new AppError("SOURCE_FETCH_TIMEOUT", "html source request timed out", {
        cause: error,
        details: { source_id: source.id, url },
      });
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function discoverCandidateUrls(
  source: Source,
  seedPage: HtmlFetchPageResult,
  config: HtmlSourceFetchAdapterConfig,
): string[] {
  const seedUrl = new URL(seedPage.url);
  const candidates = new Map<string, CandidateUrl>();
  addCandidate(candidates, normalizeCanonicalUrl(seedPage.root, seedPage.url) ?? seedPage.url, 100);
  addCandidate(candidates, seedPage.url, 90);

  for (const anchor of seedPage.root.querySelectorAll("a[href]")) {
    const href = anchor.getAttribute("href");
    if (!href) {
      continue;
    }

    const normalized = normalizeCandidateUrl(seedUrl, href);
    if (!normalized) {
      continue;
    }
    if (!isAllowedCandidateUrl(seedUrl, normalized, config.source_type)) {
      continue;
    }

    const score = scoreCandidateUrl(anchor, normalized, config.source_type);
    if (score <= 0) {
      continue;
    }

    addCandidate(candidates, normalized, score);
  }

  return Array.from(candidates.values())
    .sort((left, right) => right.score - left.score || left.url.localeCompare(right.url))
    .slice(0, Math.max(config.max_items * 4, 12))
    .map((candidate) => candidate.url);
}

function extractDocumentFromPage(
  source: Source,
  page: HtmlFetchPageResult,
  sourceType: "website" | "substack",
): null | {
  external_doc_id: string;
  canonical_url: string;
  title: string;
  summary: string;
  body_text: string;
  language: string;
  published_at?: string;
} {
  const canonicalUrl = normalizeCanonicalUrl(page.root, page.url) ?? page.url;
  const articleRoot = page.root.querySelector("article") ?? page.root.querySelector("main") ?? page.root.querySelector("body") ?? page.root;
  const title = firstNonEmptyString([
    findMetaContent(page.root, "property", "og:title"),
    findMetaContent(page.root, "name", "twitter:title"),
    page.root.querySelector("title")?.text.trim(),
    page.root.querySelector("h1")?.text.trim(),
  ]);
  if (!title) {
    return null;
  }

  const bodyText = extractPrimaryBodyText(articleRoot);
  if (bodyText.length < 120) {
    return null;
  }

  const ogType = findMetaContent(page.root, "property", "og:type");
  const summary = firstNonEmptyString([
    findMetaContent(page.root, "name", "description"),
    findMetaContent(page.root, "property", "og:description"),
    summarize(bodyText),
  ]) ?? summarize(bodyText);
  const publishedAt = firstNonEmptyString([
    findMetaContent(page.root, "property", "article:published_time"),
    findMetaContent(page.root, "name", "publish-date"),
    findMetaContent(page.root, "name", "pubdate"),
    findMetaContent(page.root, "itemprop", "datePublished"),
    page.root.querySelector("time[datetime]")?.getAttribute("datetime")?.trim(),
    extractJsonLdPublishedAt(page.root),
  ]);
  if (!isLikelyContentDocument(page, articleRoot, bodyText, publishedAt, ogType, sourceType)) {
    return null;
  }

  return {
    external_doc_id: canonicalUrl,
    canonical_url: canonicalUrl,
    title,
    summary,
    body_text: bodyText,
    language: firstNonEmptyString([
      page.root.querySelector("html")?.getAttribute("lang")?.trim(),
      sourceType === "substack" ? "en" : undefined,
      "en",
    ]) ?? "en",
    published_at: publishedAt,
  };
}

function extractPrimaryBodyText(scope: HTMLElement): string {
  const cloned = parse(scope.toString());

  for (const selector of [
    "script",
    "style",
    "noscript",
    "nav",
    "footer",
    "header",
    "aside",
    "form",
    "svg",
    "iframe",
    "button",
    "figure",
    ".advertisement",
    ".ad",
    ".newsletter",
    ".subscribe",
    ".related-posts",
  ]) {
    for (const node of cloned.querySelectorAll(selector)) {
      node.remove();
    }
  }

  const parts = [
    ...cloned.querySelectorAll("p").map((node) => node.text.trim()),
    ...cloned.querySelectorAll("li").map((node) => node.text.trim()),
    ...cloned.querySelectorAll("blockquote").map((node) => node.text.trim()),
    ...cloned.querySelectorAll("h2").map((node) => node.text.trim()),
    ...cloned.querySelectorAll("h3").map((node) => node.text.trim()),
  ].filter((part) => part.length > 0);

  const text = parts.length > 0 ? parts.join("\n\n") : cloned.text;
  return normalizeWhitespace(decodeEntities(text));
}

function isLikelyContentDocument(
  page: HtmlFetchPageResult,
  articleRoot: HTMLElement,
  bodyText: string,
  publishedAt: string | undefined,
  ogType: string | undefined,
  sourceType: "website" | "substack",
): boolean {
  const url = new URL(page.url);
  const paragraphCount = articleRoot.querySelectorAll("p").length;
  const pathDepth = url.pathname.split("/").filter((segment) => segment.trim() !== "").length;
  let score = 0;

  if (page.root.querySelector("article")) {
    score += 2;
  }
  if (publishedAt) {
    score += 2;
  }
  if (typeof ogType === "string" && ogType.toLowerCase().includes("article")) {
    score += 1;
  }
  if (paragraphCount >= 3) {
    score += 1;
  }
  if (pathDepth >= 2) {
    score += 1;
  }
  if (bodyText.length >= 400) {
    score += 1;
  }

  if (sourceType === "substack") {
    return /\/p\//.test(url.pathname) || score >= 4;
  }

  return score >= 3;
}

function extractJsonLdPublishedAt(root: HTMLElement): string | undefined {
  for (const script of root.querySelectorAll('script[type="application/ld+json"]')) {
    const raw = script.text.trim();
    if (raw === "") {
      continue;
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      const publishedAt = findDatePublished(parsed);
      if (publishedAt) {
        return publishedAt;
      }
    } catch {
      continue;
    }
  }

  return undefined;
}

function findDatePublished(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findDatePublished(item);
      if (found) {
        return found;
      }
    }
    return undefined;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  if (typeof value.datePublished === "string" && value.datePublished.trim() !== "") {
    return value.datePublished.trim();
  }

  if (value["@graph"]) {
    return findDatePublished(value["@graph"]);
  }

  return undefined;
}

function scoreCandidateUrl(anchor: HTMLElement, url: string, sourceType: "website" | "substack"): number {
  let score = 10;
  const text = anchor.text.trim();
  if (text.length >= 16) {
    score += 20;
  }
  if (/\b(20\d{2}|19\d{2})\b/.test(url)) {
    score += 25;
  }
  if (sourceType === "substack" && /\/p\//.test(url)) {
    score += 50;
  }
  if (/\/(article|post|posts|blog|news)\//.test(url)) {
    score += 20;
  }
  if (anchor.closest("article")) {
    score += 20;
  }
  if (url.includes("#")) {
    score -= 20;
  }
  return score;
}

function isAllowedCandidateUrl(seedUrl: URL, candidate: string, sourceType: "website" | "substack"): boolean {
  let candidateUrl: URL;
  try {
    candidateUrl = new URL(candidate);
  } catch {
    return false;
  }

  if (!["http:", "https:"].includes(candidateUrl.protocol)) {
    return false;
  }
  if (normalizeHost(candidateUrl.hostname) !== normalizeHost(seedUrl.hostname)) {
    return false;
  }

  const pathname = candidateUrl.pathname.toLowerCase();
  if (
    pathname.endsWith(".xml")
    || pathname.endsWith(".rss")
    || pathname.endsWith(".atom")
    || pathname.endsWith(".json")
    || pathname.endsWith(".pdf")
    || pathname.endsWith(".jpg")
    || pathname.endsWith(".jpeg")
    || pathname.endsWith(".png")
    || pathname.endsWith(".webp")
    || pathname.endsWith(".gif")
  ) {
    return false;
  }

  for (const blockedFragment of ["/tag/", "/category/", "/author/", "/search", "/login", "/signup", "/subscribe"]) {
    if (pathname.includes(blockedFragment)) {
      return false;
    }
  }

  if (sourceType === "substack" && pathname === "/") {
    return false;
  }

  return true;
}

function normalizeCandidateUrl(baseUrl: URL, href: string): string | null {
  const trimmed = href.trim();
  if (trimmed === "" || trimmed.startsWith("#") || trimmed.startsWith("mailto:") || trimmed.startsWith("javascript:")) {
    return null;
  }

  try {
    const url = new URL(trimmed, baseUrl);
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeCanonicalUrl(root: HTMLElement, fallbackUrl: string): string | undefined {
  const canonical = root.querySelector('link[rel="canonical"]')?.getAttribute("href")?.trim();
  if (!canonical) {
    return undefined;
  }

  try {
    return new URL(canonical, fallbackUrl).toString();
  } catch {
    return undefined;
  }
}

function findMetaContent(root: HTMLElement, attrName: string, attrValue: string): string | undefined {
  return root.querySelector(`meta[${attrName}="${attrValue}"]`)?.getAttribute("content")?.trim();
}

function addCandidate(store: Map<string, CandidateUrl>, url: string, score: number) {
  const existing = store.get(url);
  if (!existing || score > existing.score) {
    store.set(url, { url, score });
  }
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function summarize(bodyText: string): string {
  return normalizeWhitespace(bodyText).slice(0, 280);
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

function looksLikeHtml(value: string): boolean {
  return /<html|<body|<article|<main/i.test(value);
}

function toHtmlHttpError(source: Source, status: number, url: string): AppError {
  if (status === 429) {
    return new AppError("SOURCE_FETCH_RATE_LIMITED", `html fetch failed with status ${status}`, {
      details: { source_id: source.id, source_type: source.type, url, status },
    });
  }

  if (status >= 500) {
    return new AppError("SOURCE_FETCH_UPSTREAM_5XX", `html fetch failed with status ${status}`, {
      details: { source_id: source.id, source_type: source.type, url, status },
    });
  }

  return new AppError("EXTERNAL_DEPENDENCY_ERROR", `html fetch failed with status ${status}`, {
    details: { source_id: source.id, source_type: source.type, url, status },
  });
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

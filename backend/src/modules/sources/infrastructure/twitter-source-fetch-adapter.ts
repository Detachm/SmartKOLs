import { AppError } from "../../../core/errors/app-error";
import { assertCredentialUsable } from "../../connector-x/domain/account-credential";
import type { SourceFetchAdapter, SourceFetchAdapterResult } from "../application/ports/source-fetch-adapter";
import type { Source } from "../domain/source";

export class TwitterSourceFetchAdapter implements SourceFetchAdapter {
  readonly source_type = "twitter" as const;

  async fetch(source: Source, runtime: Parameters<SourceFetchAdapter["fetch"]>[1]): Promise<SourceFetchAdapterResult> {
    const credential = await runtime.getValidCredential(source.account_id);
    if (!credential) {
      throw new AppError("NOT_FOUND", "valid account credential not found for twitter source fetch", {
        details: { source_id: source.id, account_id: source.account_id },
      });
    }

    assertCredentialUsable(credential);
    const handle = extractTwitterHandle(source.url);
    const result = await runtime.twitterClient.listUserPosts({
      account_id: source.account_id,
      provider: credential.provider,
      secret_ref: credential.secret_ref,
      handle,
    });

    return {
      documents: result.posts.map((post) => ({
        external_doc_id: post.external_post_id,
        canonical_url: `https://x.com/${post.handle}/status/${post.external_post_id}`,
        title: summarize(prefixWithKind(post.kind, post.content), 80),
        summary: summarize(prefixWithKind(post.kind, post.content), 280),
        body_text: post.content,
        language: "und",
        published_at: post.occurred_at,
      })),
      raw_response: result.raw_response,
      raw_response_extension: "json",
    };
  }
}

function extractTwitterHandle(rawUrl: string): string {
  const url = new URL(rawUrl);
  const segments = url.pathname.split("/").filter((segment) => segment.trim() !== "");
  const first = segments[0]?.trim();
  if (!first) {
    throw new AppError("SOURCE_FETCH_UNSUPPORTED", "twitter source url must point to a profile path", {
      details: { url: rawUrl },
    });
  }

  if (["home", "explore", "search", "messages", "notifications", "i", "intent"].includes(first.toLowerCase())) {
    throw new AppError("SOURCE_FETCH_UNSUPPORTED", "twitter source url must point to a public profile timeline", {
      details: { url: rawUrl, path: url.pathname },
    });
  }

  if (segments.length > 1) {
    throw new AppError("SOURCE_FETCH_UNSUPPORTED", "twitter source url must point to a profile root, not a post or nested route", {
      details: { url: rawUrl, path: url.pathname },
    });
  }

  return first.startsWith("@") ? first.slice(1) : first;
}

function summarize(value: string, limit: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.slice(0, limit);
}

function prefixWithKind(kind: "post" | "reply", content: string): string {
  return kind === "reply" ? `[reply] ${content}` : content;
}

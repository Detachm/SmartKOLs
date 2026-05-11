import type { BackendConfig } from "./load-backend-config";
import { HtmlSourceFetchAdapter } from "../../modules/sources/infrastructure/html-source-fetch-adapter";
import { RssSourceFetchAdapter } from "../../modules/sources/infrastructure/rss-source-fetch-adapter";
import { TelegramSourceFetchAdapter } from "../../modules/sources/infrastructure/telegram-source-fetch-adapter";
import { TwitterSourceFetchAdapter } from "../../modules/sources/infrastructure/twitter-source-fetch-adapter";
import { YouTubeSourceFetchAdapter } from "../../modules/sources/infrastructure/youtube-source-fetch-adapter";

export function loadSourceFetchDependencies(config: BackendConfig["source_fetch"]) {
  return {
    sourceFetchAdapters: [
      new RssSourceFetchAdapter({
        request_timeout_ms: config.request_timeout_ms,
        user_agent: config.user_agent,
        max_items: config.max_items,
      }),
      new HtmlSourceFetchAdapter({
        source_type: "website",
        request_timeout_ms: config.request_timeout_ms,
        user_agent: config.user_agent,
        max_items: config.max_items,
      }),
      new HtmlSourceFetchAdapter({
        source_type: "substack",
        request_timeout_ms: config.request_timeout_ms,
        user_agent: config.user_agent,
        max_items: config.max_items,
      }),
      new YouTubeSourceFetchAdapter({
        request_timeout_ms: config.request_timeout_ms,
        user_agent: config.user_agent,
        max_items: config.max_items,
      }),
      new TwitterSourceFetchAdapter(),
      new TelegramSourceFetchAdapter({
        request_timeout_ms: config.request_timeout_ms,
        user_agent: config.user_agent,
        max_items: config.max_items,
      }),
    ],
  };
}

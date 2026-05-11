import { AppError } from "../../../core/errors/app-error";
import type { SourceType } from "./source";

export function validateSourceUrlForType(type: SourceType, rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch (error) {
    throw new AppError("VALIDATION_ERROR", "source url must be a valid absolute URL", {
      details: { type, url: rawUrl },
      cause: error,
    });
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new AppError("VALIDATION_ERROR", "source url must use http or https", {
      details: { type, url: rawUrl, protocol: url.protocol },
    });
  }

  const normalizedUrl = url.toString();
  const host = normalizeHost(url.hostname);

  if (type === "rss" || type === "website") {
    return normalizedUrl;
  }

  if (type === "substack") {
    if (!host.endsWith("substack.com")) {
      throw new AppError("VALIDATION_ERROR", "substack source must use a substack.com domain", {
        details: { type, url: normalizedUrl, host },
      });
    }
    return normalizedUrl;
  }

  if (type === "youtube") {
    if (!["youtube.com", "youtu.be"].includes(host)) {
      throw new AppError("VALIDATION_ERROR", "youtube source must use youtube.com or youtu.be", {
        details: { type, url: normalizedUrl, host },
      });
    }
    return normalizedUrl;
  }

  if (type === "twitter") {
    if (!["x.com", "twitter.com"].includes(host)) {
      throw new AppError("VALIDATION_ERROR", "twitter source must use x.com or twitter.com", {
        details: { type, url: normalizedUrl, host },
      });
    }
    return normalizedUrl;
  }

  if (type === "telegram") {
    if (!["t.me", "telegram.me"].includes(host)) {
      throw new AppError("VALIDATION_ERROR", "telegram source must use t.me or telegram.me", {
        details: { type, url: normalizedUrl, host },
      });
    }
    return normalizedUrl;
  }

  throw new AppError("VALIDATION_ERROR", "unsupported source type", {
    details: { type, url: normalizedUrl },
  });
}

function normalizeHost(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/^www\./, "");
}
